import { getSql } from "./db";
import type { Bounds, Flash } from "./types";

export type { Bounds, Flash };

export const DEFAULT_SATELLITE = 19;
export const MAX_LIMIT = 50_000;

/*
 * A note on the to_char() calls below.
 *
 * Drivers map timestamptz to a JS Date, which holds milliseconds. GLM resolves
 * flashes to microseconds, and two flashes inside the same millisecond are
 * common during an active cell -- letting Date round them would quietly
 * collapse distinct events. Formatting to text in SQL keeps the full precision.
 *
 * Every `${...}` below is a bound parameter, not string interpolation:
 * postgres.js turns them into $1, $2, ... and sends the values separately.
 */

export async function queryFlashes(opts: {
  start: string;
  end: string;
  satellite?: number;
  limit?: number;
}): Promise<Flash[]> {
  const { start, end, satellite = DEFAULT_SATELLITE } = opts;
  const limit = Math.min(opts.limit ?? MAX_LIMIT, MAX_LIMIT);
  const sql = getSql();

  return sql<Flash[]>`
    select
        to_char(flash_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as t,
        st_x(geom)::float8 as lon,
        st_y(geom)::float8 as lat,
        energy_j,
        area_km2,
        quality_flag,
        flash_id
      from flashes
     where satellite   =  ${satellite}
       and flash_time >=  ${start}::timestamptz
       and flash_time <   ${end}::timestamptz
     order by flash_time
     limit ${limit}
  `;
}

/**
 * The window the dataset actually covers.
 *
 * The UI needs this: only ~4 hours of the ingested day contain flashes, so a
 * time picker defaulting to "the whole day" would open on 19 hours of nothing.
 */
export async function queryBounds(satellite = DEFAULT_SATELLITE): Promise<Bounds> {
  const sql = getSql();

  const [row] = await sql<Bounds[]>`
    select
        to_char(min(flash_time) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as earliest,
        to_char(max(flash_time) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as latest,
        count(*)::int as count
      from flashes
     where satellite = ${satellite}
  `;
  return row;
}
