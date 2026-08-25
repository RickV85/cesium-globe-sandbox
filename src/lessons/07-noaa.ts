import * as Cesium from "cesium";
import type { Lesson } from "./types";
import {
  NOAA_LAYERS,
  createNoaaImageryProvider,
  createNoaaRadarProvider,
  ignoreMissingTiles,
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
// Use the EPSG:3857 endpoint: its GoogleMapsCompatible grid matches Cesium's
// WebMercatorTilingScheme exactly. The EPSG:4326 grid does NOT line up with
// GeographicTilingScheme at any level, and silently fetches the wrong tiles.
// "default" in the time slot means "the latest frame you have".
const provider = new Cesium.WebMapTileServiceImageryProvider({
  url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor" +
       "/default/default/GoogleMapsCompatible_Level7" +
       "/{TileMatrix}/{TileRow}/{TileCol}.png",
  layer: "GOES-East_ABI_GeoColor",
  style: "default",
  format: "image/png",
  tileMatrixSetID: "GoogleMapsCompatible_Level7",
  maximumLevel: 6,
  tileWidth: 256,
  tileHeight: 256,
  tilingScheme: new Cesium.WebMercatorTilingScheme(),
  // GOES only sees its own disk. Without this, Cesium requests tiles
  // outside it and GIBS answers 400 TileOutOfRange.
  rectangle: Cesium.Rectangle.fromDegrees(-151.9, -32, 56.2, 84),
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
    viewer.imageryLayers.addImageryProvider(
      ignoreMissingTiles(createNoaaImageryProvider(viirs)),
    );
    log("VIIRS (NOAA-20) true colour added -- latest daily mosaic, covers the whole globe.");

    // 2. GOES-East on top. Clipped to its own disk via NoaaLayer.extent, so it
    //    simply stops over the Atlantic instead of requesting tiles GIBS
    //    refuses. That is the geostationary trade-off, made explicit.
    const goesLayer = viewer.imageryLayers.addImageryProvider(
      ignoreMissingTiles(createNoaaImageryProvider(goes)),
    );
    goesLayer.alpha = 0.92;
    log("GOES-East GeoColor added -- latest frame, refreshes every 10 minutes.");
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
