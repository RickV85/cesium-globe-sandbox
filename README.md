# Cesium globe sandbox

A small Next.js app for getting familiar with [CesiumJS](https://cesium.com/platform/cesiumjs/),
the 3D globe library. It is a set of short, self-contained lessons that each reset the globe and
run a commented block of **raw CesiumJS** — the same API the official docs and
[Sandcastle](https://sandcastle.cesium.com/) examples use, so tutorial code pastes in directly.

Lesson 7 drapes **live NOAA satellite imagery** over the globe.

## Getting started

```bash
npm install
```

Add a Cesium ion token (free) to `.env.local`:

```bash
NEXT_PUBLIC_CESIUM_ION_TOKEN=your_token_here
```

Get one at <https://ion.cesium.com/tokens> — sign in and copy the **Default Token**. Then:

```bash
npm run dev
```

The app runs without a token, but on OpenStreetMap imagery with no elevation data, and lesson 3
will tell you it is disabled. Everything else, including all the NOAA imagery, works either way.

> Note: `Cesium.Ion.defaultAccessToken` is *not* a way to check whether you have a token.
> CesiumJS ships a demo token baked into the bundle, so ion assets will quietly load on Cesium's
> shared, rate-limited quota. This project gates on its own env var instead — see `src/lib/ion.ts`.

## The lessons

Each lives in its own file under `src/lessons/`, and the panel shows the essential calls next to
the running globe.

| # | Lesson | What it covers |
|---|--------|----------------|
| 1 | Camera & coordinates | `Cartesian3.fromDegrees`, `camera.flyTo`, heading/pitch in radians |
| 2 | Entities | points, labels, geodesic polylines, extruded polygons |
| 3 | Terrain | world terrain, `depthTestAgainstTerrain`, `sampleTerrainMostDetailed` (needs a token) |
| 4 | Imagery layers | the layer stack, `alpha`/`brightness`, adding any tile service |
| 5 | Picking | `ScreenSpaceEventHandler`, `scene.pick` vs `globe.pick` |
| 6 | The clock | `SampledPositionProperty`, entity `availability`, `trackedEntity` |
| 7 | NOAA satellite imagery | live GOES + VIIRS imagery and weather radar |

In development the live viewer is exposed as `window.viewer`, so you can poke at the scene from
the browser console:

```js
viewer.camera.positionCartographic
viewer.entities.values
viewer.imageryLayers.length
```

## The NOAA data

Defined in `src/lib/noaa.ts`. NOAA's satellite products are published as ordinary WMTS tiles
through NASA's GIBS service with open CORS headers, so Cesium reads them with the built-in
`WebMapTileServiceImageryProvider` — no custom tile code and no API key.

- **GOES-East / GOES-West** — NOAA's geostationary satellites. A new frame every 10 minutes, so
  you see live cloud motion. They only cover their own disk, so the far side of the globe stays
  empty. GeoColor (true colour by day, IR at night) and Band 13 clean infrared are included.
- **VIIRS on NOAA-20** — a polar orbiter that images the entire planet once per day. Included as
  a global true-colour daily mosaic and as the Day/Night Band ("Earth at night").
- **Weather radar** — NOAA's own ArcGIS service (MRMS base reflectivity, CONUS). This one is a
  *dynamic* map service rather than pre-cut tiles, so Cesium renders each image on demand.

Two details that catch people out, both handled in `createNoaaImageryProvider`:

- GIBS serves **512×512** tiles, not Cesium's default 256.
- Products publish with a lag, so requesting "now" returns empty tiles. `latestTimestamp()`
  steps back 30 minutes for the geostationary feeds and uses yesterday (UTC) for daily mosaics.

The NOAA buttons below the lessons stay live whichever lesson is loaded — click one to swap the
product, click it again to remove it.

## How Cesium is wired into Next.js

Cesium is not a normal npm dependency: it fetches Workers, Assets, Widgets and ThirdParty files
at runtime rather than bundling them.

- `scripts/copy-cesium-assets.mjs` copies those four directories into `public/cesium`. It runs
  from the `predev` and `prebuild` hooks. Next 16 uses Turbopack, which does not run webpack
  plugins, so `copy-webpack-plugin` is not an option here.
- `src/app/layout.tsx` sets `window.CESIUM_BASE_URL` with a `beforeInteractive` script, which
  guarantees it lands before any Cesium module is evaluated.
- `src/app/page.tsx` loads the viewer with `ssr: false` — Cesium touches `window` on import and
  can never render on the server.
- `public/cesium` is generated, so it is gitignored and excluded from linting.

## Gotchas worth knowing

- **Never call `scene.primitives.removeAll()`** to clear a scene. The Viewer's own
  `DataSourceDisplay` keeps its `PrimitiveCollection` there, and `removeAll()` destroys it, which
  breaks entity rendering. Use `viewer.entities.removeAll()` and `viewer.dataSources.removeAll()`
  instead — see `src/lessons/scene.ts`.
- **Give the container a definite height.** In a CSS grid, an `auto` row leaves `height: 100%`
  with nothing to resolve against and Cesium's canvas collapses to a few pixels. `src/components/CesiumViewer.module.css`
  sets an explicit `grid-template-rows`.
- **Set the opening camera view yourself.** Cesium derives its default from the canvas aspect
  ratio at construction time; if the stylesheet lands a beat later, the camera ends up hundreds of
  thousands of km out, staring at empty sky.
- **Long polylines need `arcType: Cesium.ArcType.GEODESIC`**, or they cut straight through the
  planet instead of following the surface.

## Scripts

```bash
npm run dev      # copy Cesium assets, then start the dev server
npm run build    # copy Cesium assets, then production build
npm run lint
```
