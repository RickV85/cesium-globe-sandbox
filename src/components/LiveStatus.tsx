import { useSyncExternalStore } from 'react';

import { LIVE_POLL_MS, LIVE_RETENTION_OPTIONS_SEC } from '@/constants';
import type { LiveFeedStatus } from '@/lib/live/liveFeed';
import sharedStyles from './LightningApp.module.css';

interface Props {
  status: LiveFeedStatus;
  retentionSec: number;
  onRetentionChange: (seconds: number) => void;
}

/** Whole seconds of wall time, re-rendering once a second so "Xs ago" keeps counting. */
function subscribeToSeconds(onChange: () => void) {
  const interval = window.setInterval(onChange, 1000);
  return () => window.clearInterval(interval);
}
const nowSeconds = () => Math.floor(Date.now() / 1000);
const serverSeconds = () => 0;

function ago(seconds: number): string {
  if (seconds < 90) return `${Math.max(seconds, 0)} s ago`;
  return `${Math.round(seconds / 60)} min ago`;
}

export default function LiveStatus({ status, retentionSec, onRetentionChange }: Props) {
  const now = useSyncExternalStore(subscribeToSeconds, nowSeconds, serverSeconds);
  const { lastFileEndMs, pendingFiles, error } = status;

  return (
    <div>
      <h2>Live GOES-19 feed</h2>
      <p className={sharedStyles.hint}>
        Checks NOAA&apos;s public bucket every {LIVE_POLL_MS / 1000} s. Each GLM file covers 20 s and is published
        about 10–30 s after the flashes in it. Nothing is stored.
      </p>
      <p className={sharedStyles.hint}>
        Newest data:
        <span className={sharedStyles.count}>
          {lastFileEndMs === null ? 'connecting…' : ago(now - Math.floor(lastFileEndMs / 1000))}
        </span>
      </p>
      {pendingFiles > 0 && (
        <p className={sharedStyles.hint}>
          Backfilling:
          <span className={sharedStyles.count}>{pendingFiles} files queued</span>
        </p>
      )}
      <label className={sharedStyles.field}>
        <span>Keep for</span>
        <select value={retentionSec} onChange={(e) => onRetentionChange(Number(e.target.value))}>
          {LIVE_RETENTION_OPTIONS_SEC.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds / 60} minutes
            </option>
          ))}
        </select>
      </label>
      {error && <p className={sharedStyles.error}>{error}</p>}
    </div>
  );
}
