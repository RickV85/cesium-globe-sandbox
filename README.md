# GOES-19 lightning

A Next.js app that replays GLM lightning flash detections from NOAA's GOES-19 satellite on a
CesiumJS globe. Flashes are ingested from raw NetCDF into Postgres/PostGIS, served by route
handlers in this app, and animated against the Cesium clock.

Currently loaded: **2026-08-01**, Northern Rockies (lat 41–49, lon −117 to −105) — 187 flashes
between 00:00:03Z and 04:03:33Z. One evening thunderstorm; 19 of the 24 hours are empty.

## Running it

```bash
npm install
```

`.env.local` needs two values:

```bash
NEXT_PUBLIC_CESIUM_ION_TOKEN=   # https://ion.cesium.com/tokens
SUPABASE_DB_URL=                # server-side only, NEVER NEXT_PUBLIC_
```

```bash
npm run dev
```

## How it fits together

```
~/GOES/files/            ingest (Python)      backfill.py + migrations/
        |                                     goes2go -> xarray -> Postgres
        v
Supabase Postgres/PostGIS   flashes(flash_time, geom, energy_j, area_km2, ...)
        |
        v
src/lib/db.ts            postgres.js client, server-only
src/lib/flashes.ts       the two queries
src/app/api/*/route.ts   GET /api/flashes, GET /api/bounds
        |
        v
src/components/          LightningApp (table + controls) -> LightningGlobe (Cesium)
```

### API

`GET /api/bounds` → `{earliest, latest, count}`. The UI opens on this, because a picker
defaulting to "the whole day" would land on 19 empty hours.

`GET /api/flashes?start=&end=&limit=` → `{start, end, count, truncated, flashes[]}`, each flash
`{t, lon, lat, energy_j, area_km2, quality_flag, flash_id}`. Both params default to the full
extent. One endpoint feeds both the table and the globe — there is deliberately no separate
"map data" route.

### The globe

**All at once** adds every flash as an entity with no `availability`, so the clock is ignored and
everything stays on screen. **Playback** gives each entity a `TimeIntervalCollection` running from
its own timestamp for the chosen trail length, so the Cesium clock reveals the storm as it
happened. Speed and trail are both adjustable; the dial and timeline at the bottom scrub it.

Clicking a table row flies the camera there and, in playback, jumps the clock to that instant
**and pauses** — without the pause a 300-data-second trail at 300× is lit for about one wall
second and vanishes before you can look at it. Clicking a flash on the globe does the reverse:
it highlights and scrolls to the row, but deliberately does not move the camera.

Colour runs a log scale over flash energy (~1e-15 to 1e-12 J — linear would put nearly everything
at the bottom), and point size follows √area.

## Things worth knowing

**`_Unsigned` in GLM files.** Flash times, ids, energies and areas are stored as `int16` but carry
`_Unsigned = "true"`, so the bits must be read as `uint16`. Over half the time values in a typical
file are negative when read signed. xarray honours the attribute; **h5py does not**, and silently
yields times wrong by 65536 × scale_factor = 25.000385 s. This cost real debugging time.

**`flash_area` is in m², not km².** `units = "m2"`, `scale_factor ≈ 152601.86`. Correct values
land at 70–770 km².

**Timestamps are formatted in SQL.** Drivers map `timestamptz` to a JS `Date`, which holds
milliseconds; GLM resolves to microseconds and two flashes in the same millisecond are common.
`to_char(... 'US')` keeps the precision as text.

**TLS to Supabase.** postgres.js follows libpq semantics, where `require` encrypts without
verifying — which is what Supabase's pooler needs, since its chain is not in Node's trust store.
Set `PGSSLROOTCERT` to Supabase's CA bundle for real verification before deploying. (`pg` treats
`require` as `verify-full` and fails with `SELF_SIGNED_CERT_IN_CHAIN`.)

**The DB client is cached on `globalThis`** so it survives hot reload — which means edits to
`src/lib/db.ts` need a dev server *restart*, not just a save.

**Cesium in Next.** Cesium fetches Workers/Assets/Widgets at runtime rather than bundling them.
`scripts/copy-cesium-assets.mjs` copies them into `public/cesium` from the `predev`/`prebuild`
hooks (Turbopack does not run webpack plugins, so `copy-webpack-plugin` is not an option).
`window.CESIUM_BASE_URL` is set by a `beforeInteractive` script in the root layout, and the globe
is loaded with `ssr: false`.

**Give the Cesium container a definite height.** In a CSS grid, an `auto` row leaves `height: 100%`
with nothing to resolve against and the canvas collapses to a few pixels.

**`src/lib/noaa.ts` is currently unused.** It holds the GIBS/NOAA imagery layer setup and is kept
for the next step: requesting the GOES-East frame matching the playback timestamp, so the clouds
on screen are the ones that produced each flash. It documents a real trap — GIBS's EPSG:4326 grid
never aligns with Cesium's `GeographicTilingScheme` at any zoom, so use the EPSG:3857 endpoint.

## Next

- Cluster flashes into storms with `ST_ClusterDBSCAN`, with user-tunable `eps`/`minpoints`.
  Storms stay a *query*, never a table — the parameters are the user's, so nothing can be
  precomputed. Note DBSCAN is purely spatial, so a temporal dimension has to be added
  (time buckets, or a rolling window partition).
- Time-matched GOES imagery under the flashes.
- Widen the ingest beyond a single day.

## Scripts

```bash
npm run dev      # copy Cesium assets, then start the dev server
npm run build
npm run lint
```
