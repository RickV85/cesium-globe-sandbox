import { LIVE_DEFAULT_RETENTION_SEC, LIVE_POLL_MS } from '@/constants';
import type { Flash } from '@/lib/types';
import type { GlmWorkerResponse } from './glm.worker';
import { createLiveFeed } from './createLiveFeed';
import { dayOfYear, hourPrefix, listKeys, parseKeyTimes } from './glmS3';

jest.mock('./glmS3', () => ({ ...jest.requireActual('./glmS3'), listKeys: jest.fn() }));

const FILE_MS = 20_000;
const MINUTE = 60_000;
const DEFAULT_MINUTES = LIVE_DEFAULT_RETENTION_SEC / 60;
const NOW = Date.UTC(2026, 8, 15, 18, 5, 0);

const pad = (n: number, width = 2) => String(n).padStart(width, '0');
function stamp(ms: number) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(dayOfYear(ms), 3)}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}0`;
}
const keyFor = (startMs: number) =>
  `${hourPrefix(startMs)}OR_GLM-L2-LCFA_G19_s${stamp(startMs)}_e${stamp(startMs + FILE_MS)}_c${stamp(startMs + FILE_MS + 2000)}.nc`;

/** Fake S3: one file every 20 s from two hours back up to `latestStartMs`. */
const s3 = { latestStartMs: 0 };
function fakeListKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  for (let t = NOW - 120 * MINUTE; t <= s3.latestStartMs; t += FILE_MS) {
    const key = keyFor(t);
    if (key.startsWith(prefix)) keys.push(key);
  }
  return Promise.resolve(keys);
}

/** One flash per file, 19 s into it -- late enough not to be pruned during a short test. */
function flashFor(key: string): Flash {
  const at = new Date(parseKeyTimes(key)!.startMs + 19_000).toISOString().replace('Z', '000Z');
  return { flash_time: at, lat: 45, lon: -110, energy_j: 1e-14, area_km2: 100, quality_flag: 0, flash_id: 1 };
}

/** Records every key it is asked to decode and answers after `delayMs`. Keys in `failing` always error. */
function fakeWorker(decoded: string[], { delayMs = 1, failing = new Set<string>() } = {}) {
  const worker = {
    onmessage: null as ((event: { data: GlmWorkerResponse }) => void) | null,
    onerror: null,
    postMessage(key: string) {
      decoded.push(key);
      const data: GlmWorkerResponse = failing.has(key) ? { error: 'corrupt file' } : { flashes: [flashFor(key)] };
      setTimeout(() => worker.onmessage?.({ data }), delayMs);
    },
  };
  return worker as unknown as Worker;
}

/** Files overlapping the last `minutes` before NOW, given the fake S3's newest file. */
const filesInLast = (minutes: number) => Math.floor((s3.latestStartMs - (NOW - minutes * MINUTE)) / FILE_MS) + 1;
const newestFirst = (keys: string[]) => [...keys].sort().reverse();

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  s3.latestStartMs = NOW - 40_000;
  jest.mocked(listKeys).mockImplementation(fakeListKeys);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('it should backfill the whole retention window on start, newest file first', async () => {
  const decoded: string[] = [];
  const feed = createLiveFeed(() => fakeWorker(decoded));
  feed.start();
  await jest.advanceTimersByTimeAsync(1000);

  expect(decoded[0]).toBe(keyFor(s3.latestStartMs));
  expect(decoded).toEqual(newestFirst(decoded));
  expect(decoded).toHaveLength(filesInLast(DEFAULT_MINUTES));

  const { flashes, status } = feed.getSnapshot();
  expect(flashes).toHaveLength(filesInLast(DEFAULT_MINUTES));
  expect(flashes[0].flash_time > flashes[flashes.length - 1].flash_time).toBe(true);
  expect(status.pendingFiles).toBe(0);
});

test('it should backfill only the older files when retention is widened', async () => {
  const decoded: string[] = [];
  const feed = createLiveFeed(() => fakeWorker(decoded));
  feed.setRetention(10 * 60);
  feed.start();
  await jest.advanceTimersByTimeAsync(1000);
  const initial = [...decoded];
  expect(initial).toHaveLength(filesInLast(10));

  feed.setRetention(60 * 60);
  await jest.advanceTimersByTimeAsync(1000);
  const added = decoded.slice(initial.length);

  expect(added.every((key) => key < initial[initial.length - 1])).toBe(true);
  expect(added).toEqual(newestFirst(added));
  expect(decoded).toHaveLength(filesInLast(60));
  expect(feed.getSnapshot().flashes).toHaveLength(filesInLast(60));
});

test('it should decode new files ahead of a backfill still in progress', async () => {
  const decoded: string[] = [];
  const feed = createLiveFeed(() => fakeWorker(decoded, { delayMs: 200 })); // ~18 s to backfill 30 minutes
  feed.start();
  await jest.advanceTimersByTimeAsync(2000);

  s3.latestStartMs = NOW - 20_000;
  const newKey = keyFor(s3.latestStartMs);
  await jest.advanceTimersByTimeAsync(30_000);

  const position = decoded.indexOf(newKey);
  expect(position).toBeGreaterThan(0);
  expect(position).toBeLessThan(decoded.length - 10);
  expect(new Set(decoded).size).toBe(decoded.length);
});

test('it should trim immediately and notify subscribers when retention shrinks', async () => {
  const feed = createLiveFeed(() => fakeWorker([]));
  feed.start();
  await jest.advanceTimersByTimeAsync(1000);

  const listener = jest.fn();
  feed.subscribe(listener);
  feed.setRetention(10 * 60);

  expect(listener).toHaveBeenCalled();
  const cutoff = Date.now() - 10 * MINUTE;
  const { flashes } = feed.getSnapshot();
  expect(flashes.length).toBeLessThan(filesInLast(DEFAULT_MINUTES));
  expect(flashes.every((flash) => Date.parse(flash.flash_time) >= cutoff)).toBe(true);
});

// Sad paths

test('it should retry a failing file on later polls and give up after three attempts', async () => {
  const decoded: string[] = [];
  const badKey = keyFor(NOW - 5 * MINUTE);
  const feed = createLiveFeed(() => fakeWorker(decoded, { failing: new Set([badKey]) }));
  feed.start();
  await jest.advanceTimersByTimeAsync(1000);
  expect(feed.getSnapshot().status.error).toContain('corrupt file');

  await jest.advanceTimersByTimeAsync(LIVE_POLL_MS * 5);

  expect(decoded.filter((key) => key === badKey)).toHaveLength(3);
  expect(decoded).toContain(keyFor(NOW - 5 * MINUTE - FILE_MS));
});

test('it should keep the same flashes array when a poll finds nothing new', async () => {
  const feed = createLiveFeed(() => fakeWorker([]));
  feed.start();
  await jest.advanceTimersByTimeAsync(1000);
  const { flashes } = feed.getSnapshot();
  const listings = jest.mocked(listKeys).mock.calls.length;

  await jest.advanceTimersByTimeAsync(LIVE_POLL_MS);

  expect(jest.mocked(listKeys).mock.calls.length).toBeGreaterThan(listings);
  expect(feed.getSnapshot().flashes).toBe(flashes);
});

test('it should keep the same snapshot until something changes', async () => {
  const feed = createLiveFeed(() => fakeWorker([]));
  const before = feed.getSnapshot();
  expect(feed.getSnapshot()).toBe(before);

  feed.start();
  await jest.advanceTimersByTimeAsync(1000);
  expect(feed.getSnapshot()).not.toBe(before);
});
