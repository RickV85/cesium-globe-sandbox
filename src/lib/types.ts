/**
 * Shapes shared between the API and the browser.
 *
 * Deliberately free of any server-side import. `src/lib/flashes.ts` pulls in
 * the Postgres driver and `node:fs`, so client components must never import
 * from there -- even for a type, where a missing `import type` would drag the
 * whole module into the browser bundle.
 */

/** One GLM lightning flash. */
export type Flash = {
  /** ISO-8601 UTC, microsecond precision. */
  flash_time: string;
  lon: number;
  lat: number;
  energy_j: number | null;
  area_km2: number | null;
  quality_flag: number | null;
  flash_id: number;
};

/**
 * Stable identity for a flash: the Cesium entity id and the table row key are
 * the same string, which is what lets a globe pick find its row and a row
 * click find its pin. Both sides must derive it here -- rebuilding the format
 * by hand anywhere means a pick silently stops matching.
 */
export const flashKey = (f: Flash) => `${f.flash_id}@${f.flash_time}`;

/** GET /api/bounds */
export type Bounds = {
  earliest: string | null;
  latest: string | null;
  count: number;
};

/** GET /api/flashes */
export type FlashesResponse = {
  start: string | null;
  end: string | null;
  first: string | null;
  last: string | null;
  count: number;
  truncated?: boolean;
  flashes: Flash[];
};

export type DateValue = string;
export type DateInputState = { start: DateValue; end: DateValue };

export type ErrorState = {
  dateErr?: string;
  fetchErr?: string;
  flashWinErr?: string;
};
