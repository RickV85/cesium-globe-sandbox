/**
 * Most flashes a replay query returns; past this the results are cut off and
 * the UI shows the truncation warning. Deliberately well under what the API
 * could return: the cap is what the globe can draw without bogging down.
 */
export const MAX_LIMIT = 10_000;

export const TEN_MIN_IN_SEC = 10 * 60;
export const ONE_HOUR_IN_SEC = 60 * 60;
export const ONE_HOUR_IN_MS = ONE_HOUR_IN_SEC * 1000;
export const ONE_DAY_IN_SEC = 24 * ONE_HOUR_IN_SEC;

export const ONE_DAY_IN_MS = ONE_DAY_IN_SEC * 1000;

/**
 * Northern Rockies, in degrees. This is the Python ingest's bbox, the camera's
 * home view, and the only area live mode decodes flashes for.
 */
export const ROCKIES_BBOX = { west: -117, south: 41, east: -105, north: 49 } as const;

/** How often live mode asks S3 for new GLM files. Files land every 20 s. */
export const LIVE_POLL_MS = 10_000;
/** How long a flash stays on screen in live mode. The feed backfills the whole window: ~30 MB per 30 minutes. */
export const LIVE_RETENTION_OPTIONS_SEC = [TEN_MIN_IN_SEC, 3 * TEN_MIN_IN_SEC, ONE_HOUR_IN_SEC];
export const LIVE_DEFAULT_RETENTION_SEC = 3 * TEN_MIN_IN_SEC;
export const LIVE_SHOW_PENDING_BACKFILL_DELAY_MS = 500;
