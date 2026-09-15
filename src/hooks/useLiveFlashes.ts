'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { EMPTY_LIVE_SNAPSHOT, liveFeed, type LiveFeedSnapshot } from '@/lib/live/liveFeed';

const noopUnsubscribe = () => {};
const getEmptySnapshot = () => EMPTY_LIVE_SNAPSHOT;

/**
 * Live GLM flashes for React.
 *
 * The feed (src/lib/live/createLiveFeed.ts) starts when this first mounts --
 * at page load -- and runs until the page unloads, so its data is ready the
 * moment live mode is switched on. Only while `enabled` does this hook
 * subscribe to it: in replay, polls never re-render the app, which is what
 * keeps replay playback smooth.
 */
export function useLiveFlashes(enabled: boolean, retentionSec: number): LiveFeedSnapshot {
  useEffect(() => {
    liveFeed.start();
  }, []);

  useEffect(() => {
    liveFeed.setRetention(retentionSec);
  }, [retentionSec]);

  const subscribe = useCallback(
    (onChange: () => void) => (enabled ? liveFeed.subscribe(onChange) : noopUnsubscribe),
    [enabled],
  );

  return useSyncExternalStore(subscribe, enabled ? liveFeed.getSnapshot : getEmptySnapshot, getEmptySnapshot);
}
