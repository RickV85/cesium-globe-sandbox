import { LIVE_DEFAULT_RETENTION_SEC, LIVE_POLL_MS } from '@/constants';
import { flashKey, type Flash } from '@/lib/types';
import type { GlmWorkerRequest, GlmWorkerResponse } from './glm.worker';
import { hourPrefixesBetween, listKeys, parseKeyTimes } from './glmS3';

/*
 * Near-real-time GLM flashes for the Northern Rockies, read straight from
 * NOAA's public S3 bucket and kept outside React.
 *
 * The feed starts at page load, so live mode already has data when the user
 * switches to it. Flashes live in a plain Map rather than React state:
 * updating state after every file re-rendered the whole app every 10-20 s,
 * which stuttered replay playback. useLiveFlashes subscribes only while live
 * mode is on.
 *
 * Two loops:
 *
 *   - poll() lists every file in the retention window each LIVE_POLL_MS and
 *     queues the ones not decoded yet, newest first. That one rule covers the
 *     first load, a widened window, and a tab that was hidden for a while.
 *   - pump() hands queued files to the worker one at a time, front first, so
 *     fresh files never wait behind a backfill for more than one poll.
 *
 * Every window edge is measured against the bucket's clock, not the browser's:
 * poll() re-learns the offset between the two from the newest key it lists.
 *
 * There is no stop(): signing out reloads the page, which ends the feed.
 *
 * This takes the worker as a factory so Jest can drive it with a fake one;
 * liveFeed.ts creates the real instance.
 */

export type LiveFeedStatus = {
  /** End of the newest GLM file decoded -- the "as of" time for what's on screen. */
  lastFileEndMs: number | null;
  /** Files in the window not decoded yet; non-zero while backfilling. */
  pendingFiles: number;
  error: string | null;
};

/** Flashes are newest first. */
export type LiveFeedSnapshot = { flashes: Flash[]; status: LiveFeedStatus };

export const EMPTY_LIVE_SNAPSHOT: LiveFeedSnapshot = {
  flashes: [],
  status: { lastFileEndMs: null, pendingFiles: 0, error: null },
};

/** A file that keeps failing is given up on after this many polls. */
const MAX_ATTEMPTS = 3;

/**
 * A decode with no reply by this point counts as failed. Only worker messages
 * settle a decode, so without this a worker that never answers -- a script
 * that failed to load, say -- would leave pump() waiting forever and live mode
 * stuck on "connecting…".
 */
export const DECODE_TIMEOUT_MS = 60_000;

/**
 * How far either side of the window to list while the clock offset is unknown.
 * Hour folders are coarse, so an hour covers any skew worth worrying about.
 */
const OFFSET_SLACK_MS = 60 * 60 * 1000;

const fileName = (key: string) => key.slice(key.lastIndexOf('/') + 1);
const endOf = (key: string) => parseKeyTimes(key)?.endMs ?? 0;
const messageOf = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/** Same-format ISO strings sort chronologically as plain strings. */
const newestFirst = (a: Flash, b: Flash) => (a.flash_time < b.flash_time ? 1 : a.flash_time > b.flash_time ? -1 : 0);

export function createLiveFeed(createWorker: () => Worker) {
  const byKey = new Map<string, Flash>();
  /** Files decoded or given up on. Trimmed with the window, so a wider window refetches. */
  const done = new Set<string>();
  const attempts = new Map<string, number>();
  const listeners = new Set<() => void>();
  /** Files in the window not decoded yet, newest first. Replaced by every poll. */
  let queue: string[] = [];
  let retentionMs = LIVE_DEFAULT_RETENTION_SEC * 1000;
  let snapshot = EMPTY_LIVE_SNAPSHOT;
  let worker: Worker | null = null;
  /** The decode pump() is waiting on, if any. Replies not matching its id are ignored. */
  let awaiting: { id: number; resolve: (response: GlmWorkerResponse) => void } | null = null;
  let nextDecodeId = 1;
  let polling = false;
  let pumping = false;
  /**
   * Offset from the browser clock to the bucket's, learned from the newest key
   * listed; null until a listing lands. File times come from S3 key stamps, so
   * a client clock even a few minutes off would otherwise list hour folders
   * that do not exist yet -- live mode blank, with no error -- or push the
   * files that do exist out of the window.
   */
  let clockOffsetMs: number | null = null;

  /** Now, on the bucket's clock. */
  const feedNow = () => Date.now() + (clockOffsetMs ?? 0);

  /** Drop flashes and done-file records that have left the window. Returns whether any flash was removed. */
  function prune(): boolean {
    const cutoff = feedNow() - retentionMs;
    for (const key of done) {
      if (endOf(key) <= cutoff) done.delete(key);
    }
    let removed = false;
    for (const [id, flash] of byKey) {
      if (Date.parse(flash.flash_time) < cutoff) {
        byKey.delete(id);
        removed = true;
      }
    }
    return removed;
  }

  /**
   * Replace the snapshot and notify. The flashes array is only rebuilt when
   * flashes changed, so a status-only update doesn't make the globe re-diff.
   */
  function publish(status: Partial<LiveFeedStatus>, flashesChanged: boolean) {
    snapshot = {
      flashes: flashesChanged ? [...byKey.values()].sort(newestFirst) : snapshot.flashes,
      status: { ...snapshot.status, ...status },
    };
    for (const listener of listeners) listener();
  }

  /**
   * Settle the decode pump() is waiting on, if this answer is still the one it
   * is waiting for. A reply to a decode already given up on -- timed out, or
   * failed by the worker's onerror -- would otherwise resolve the *next* file's
   * promise, marking that file done with the wrong flashes and never decoding it.
   */
  function settle(response: GlmWorkerResponse) {
    if (awaiting?.id !== response.id) return;
    const { resolve } = awaiting;
    awaiting = null;
    resolve(response);
  }

  /** One decode, settled by the worker's reply, its onerror, or the timeout -- first one wins. */
  function decode(w: Worker, key: string) {
    const id = nextDecodeId++;
    return new Promise<GlmWorkerResponse>((resolve) => {
      const timer = window.setTimeout(
        () => settle({ id, error: `no reply after ${DECODE_TIMEOUT_MS / 1000} s` }),
        DECODE_TIMEOUT_MS,
      );
      awaiting = {
        id,
        resolve: (response) => {
          window.clearTimeout(timer);
          resolve(response);
        },
      };
      w.postMessage({ id, key } satisfies GlmWorkerRequest);
    });
  }

  async function poll() {
    if (polling || !worker) return;
    polling = true;
    try {
      // Listing is the only thing that can reveal a skewed clock, so until the
      // offset is known the request is widened at both ends to find the files
      // wherever they actually are.
      const slack = clockOffsetMs === null ? OFFSET_SLACK_MS : 0;
      const listed: string[] = [];
      for (const prefix of hourPrefixesBetween(feedNow() - retentionMs - slack, feedNow() + slack)) {
        listed.push(...(await listKeys(prefix)));
      }

      // The newest file in the bucket is the closest thing to a trustworthy
      // clock. Listing nothing at all means the window is aimed at hours S3
      // has no files for, so drop the offset and search wide again next poll.
      const newestEnd = listed.reduce((newest, key) => Math.max(newest, endOf(key)), 0);
      clockOffsetMs = newestEnd > 0 ? newestEnd - Date.now() : null;

      const windowStart = feedNow() - retentionMs;
      const removed = prune();
      queue = listed.filter((key) => endOf(key) > windowStart && !done.has(key)).reverse();
      publish({ pendingFiles: queue.length, error: null }, removed);
      void pump();
    } catch (cause) {
      publish({ error: messageOf(cause) }, prune());
    } finally {
      polling = false;
    }
  }

  async function pump() {
    const w = worker;
    if (pumping || !w) return;
    pumping = true;
    try {
      while (queue.length) {
        const key = queue.shift()!;
        // Decoded already (a poll re-queued it mid-decode), or aged out while waiting.
        if (done.has(key) || endOf(key) <= feedNow() - retentionMs) continue;

        const result = await decode(w, key);
        if ('error' in result) {
          const tries = (attempts.get(key) ?? 0) + 1;
          attempts.set(key, tries);
          if (tries >= MAX_ATTEMPTS) {
            attempts.delete(key);
            done.add(key);
          }
          // Stop until the next poll, which re-queues the file for another try.
          publish({ pendingFiles: queue.length, error: `Could not read ${fileName(key)}: ${result.error}` }, false);
          return;
        }

        attempts.delete(key);
        done.add(key);
        for (const flash of result.flashes) byKey.set(flashKey(flash), flash);
        publish(
          {
            lastFileEndMs: Math.max(snapshot.status.lastFileEndMs ?? 0, endOf(key)),
            pendingFiles: queue.length,
            error: null,
          },
          prune() || result.flashes.length > 0,
        );
      }
    } finally {
      pumping = false;
    }
  }

  return {
    /** Start polling. Idempotent, and there is no stop: signing out reloads the page. */
    start() {
      if (worker) return;
      worker = createWorker();
      worker.onmessage = ({ data }: MessageEvent<GlmWorkerResponse>) => settle(data);
      worker.onerror = (event) => {
        const error = event.message || 'worker failed';
        // With nothing in flight -- a worker script that failed to load -- there
        // is no decode to fail, so the error goes straight to the status rather
        // than waiting for the first decode to time out.
        if (awaiting) settle({ id: awaiting.id, error });
        else publish({ error }, false);
      };
      window.setInterval(() => void poll(), LIVE_POLL_MS);
      void poll();
    },

    /** A shorter window trims at once; a longer one is backfilled by the poll this triggers. */
    setRetention(seconds: number) {
      if (seconds * 1000 === retentionMs) return;
      retentionMs = seconds * 1000;
      publish({}, prune());
      void poll();
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Stable between publishes, as useSyncExternalStore requires. */
    getSnapshot: () => snapshot,
  };
}
