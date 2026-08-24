import * as Cesium from "cesium";
import type { Lesson } from "./types";
import {
  NOAA_LAYERS,
  createNoaaImageryProvider,
  createNoaaRadarProvider,
  latestTimestamp,
} from "@/lib/noaa";

/**
 * Lesson 7 -- real NOAA satellite data.
 *
 * This is lesson 4 (imagery stacking) pointed at live data. Nothing here is a
 * special case: NOAA's products are ordinary WMTS and ArcGIS services, so the
 * same two calls that added OpenStreetMap add a weather satellite.
 *
 * The NOAA strip in the panel below stays live after this lesson runs -- use it
 * to swap products and watch the stack change.
 */
export const noaaLesson: Lesson = {
  id: "noaa",
  title: "7 · Live NOAA satellite imagery",
  summary:
    "Drape NOAA-20's daily global mosaic over the globe, overlay GOES-East's 10-minute geostationary view of the Americas, and add live weather radar on top.",
  snippet: `// NOAA products are plain WMTS tiles served by NASA GIBS.
const provider = new Cesium.WebMapTileServiceImageryProvider({
  url: "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/GOES-East_ABI_GeoColor" +
       "/default/2026-08-19T19:50:00Z/1km/{TileMatrix}/{TileRow}/{TileCol}.png",
  layer: "GOES-East_ABI_GeoColor",
  style: "default",
  format: "image/png",
  tileMatrixSetID: "1km",
  maximumLevel: 6,
  tileWidth: 512,          // GIBS uses 512px tiles, not Cesium's default 256
  tileHeight: 512,
  tilingScheme: new Cesium.GeographicTilingScheme(),
});

viewer.imageryLayers.addImageryProvider(provider);

// NOAA's own radar is a dynamic ArcGIS service rather than pre-cut tiles:
viewer.imageryLayers.addImageryProvider(
  await Cesium.ArcGisMapServerImageryProvider.fromUrl(NOAA_RADAR_URL, {
    usePreCachedTilesIfAvailable: false,
  }),
);`,

  async run({ viewer, log }) {
    const viirs = NOAA_LAYERS.find((l) => l.id === "viirs-truecolor")!;
    const goes = NOAA_LAYERS.find((l) => l.id === "goes-east-geocolor")!;

    // 1. Global daily mosaic from NOAA-20's VIIRS instrument.
    const viirsTime = latestTimestamp(viirs.cadence);
    viewer.imageryLayers.addImageryProvider(createNoaaImageryProvider(viirs, viirsTime));
    log(`VIIRS (NOAA-20) true colour added for ${viirsTime} -- covers the whole globe.`);

    // 2. GOES-East on top. Only covers its own disk, so it will be transparent
    //    over Asia and most of Europe. That is the geostationary trade-off.
    const goesTime = latestTimestamp(goes.cadence);
    const goesLayer = viewer.imageryLayers.addImageryProvider(
      createNoaaImageryProvider(goes, goesTime),
    );
    goesLayer.alpha = 0.92;
    log(`GOES-East GeoColor added for ${goesTime} UTC -- refreshes every 10 minutes.`);
    log("GOES is geostationary: it only sees the Americas. Spin the globe to see it end.");

    // 3. NOAA's live radar mosaic, US only.
    try {
      const radar = await createNoaaRadarProvider();
      viewer.imageryLayers.addImageryProvider(radar);
      log("NOAA base reflectivity radar added on top (CONUS only).");
    } catch (error) {
      log(`Radar layer unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }

    log(`Imagery stack is now ${viewer.imageryLayers.length} layers deep.`);

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        goes.home.longitude,
        goes.home.latitude,
        goes.home.height,
      ),
      duration: 4,
    });
  },
};
