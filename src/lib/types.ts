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
  t: string;
  lon: number;
  lat: number;
  energy_j: number | null;
  area_km2: number | null;
  quality_flag: number | null;
  flash_id: number;
};

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
  count: number;
  truncated?: boolean;
  flashes: Flash[];
};
