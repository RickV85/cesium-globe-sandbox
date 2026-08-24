/**
 * NOAA satellite imagery for Cesium.
 *
 * NOAA's satellite products are served publicly through NASA's GIBS
 * (Global Imagery Browse Services) as standard WMTS tiles, with permissive
 * CORS headers -- which is what makes them usable straight from the browser.
 *
 *   GOES-East / GOES-West : NOAA's geostationary weather satellites. They stare
 *                           at the Americas and refresh every 10 minutes, so you
 *                           see live cloud motion. They only cover their own
 *                           disk -- the far side of the globe stays empty.
 *   VIIRS on NOAA-20      : a polar orbiter that images the whole Earth once per
 *                           day, stitched into a global daily mosaic.
 *
 * All of these are plain WMTS, so Cesium reads them with the built-in
 * WebMapTileServiceImageryProvider -- no custom tile code required.
 */
import * as Cesium from "cesium";

const GIBS_WMTS = "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best";

/** How often a product publishes a new frame. */
export type Cadence = "daily" | "ten-minute";

export type NoaaLayer = {
  id: string;
  label: string;
  description: string;
  /** GIBS layer identifier, straight out of the WMTS capabilities document. */
  gibsLayer: string;
  /** GIBS names its tile matrix sets after ground resolution, not zoom level. */
  tileMatrixSet: "250m" | "500m" | "1km" | "2km";
  /** Deepest zoom level this matrix set defines. Beyond it, tiles 404. */
  maximumLevel: number;
  format: "jpg" | "png";
  cadence: Cadence;
  /** Roughly where on the globe this product is worth looking at. */
  home: { longitude: number; latitude: number; height: number };
};

export const NOAA_LAYERS: NoaaLayer[] = [
  {
    id: "goes-east-geocolor",
    label: "GOES-East · GeoColor",
    description:
      "NOAA's geostationary satellite over the Americas. True-colour by day, infrared cloud-top rendering by night. New frame every 10 minutes.",
    gibsLayer: "GOES-East_ABI_GeoColor",
    tileMatrixSet: "1km",
    maximumLevel: 6,
    format: "png",
    cadence: "ten-minute",
    home: { longitude: -75, latitude: 20, height: 18_000_000 },
  },
  {
    id: "goes-east-infrared",
    label: "GOES-East · Clean Infrared",
    description:
      "Band 13 thermal infrared. Measures cloud-top temperature, so it works at night and makes storm structure obvious.",
    gibsLayer: "GOES-East_ABI_Band13_Clean_Infrared",
    tileMatrixSet: "2km",
    maximumLevel: 5,
    format: "png",
    cadence: "ten-minute",
    home: { longitude: -75, latitude: 20, height: 18_000_000 },
  },
  {
    id: "goes-west-geocolor",
    label: "GOES-West · GeoColor",
    description:
      "The Pacific-facing twin of GOES-East. Together the two cover the Americas and most of the Pacific.",
    gibsLayer: "GOES-West_ABI_GeoColor",
    tileMatrixSet: "1km",
    maximumLevel: 6,
    format: "png",
    cadence: "ten-minute",
    home: { longitude: -137, latitude: 15, height: 18_000_000 },
  },
  {
    id: "viirs-truecolor",
    label: "VIIRS (NOAA-20) · True Colour",
    description:
      "NOAA-20 is a polar orbiter: it sweeps the entire planet once a day. This is the resulting global daily mosaic -- the whole globe is covered, unlike GOES.",
    gibsLayer: "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
    tileMatrixSet: "250m",
    maximumLevel: 8,
    format: "jpg",
    cadence: "daily",
    home: { longitude: 10, latitude: 25, height: 20_000_000 },
  },
  {
    id: "viirs-night",
    label: "VIIRS (NOAA-20) · Day/Night Band",
    description:
      "The low-light sensor on NOAA-20. City lights, fires and moonlit clouds -- the 'Earth at night' view.",
    gibsLayer: "VIIRS_NOAA20_DayNightBand_At_Sensor_Radiance",
    tileMatrixSet: "500m",
    maximumLevel: 7,
    format: "png",
    cadence: "daily",
    home: { longitude: 20, latitude: 30, height: 20_000_000 },
  },
];

/**
 * Build the timestamp string GIBS expects in the tile URL.
 *
 * Both products are published with a lag, so asking for "right now" reliably
 * returns empty tiles. We deliberately step back:
 *   - geostationary: round down to a 10-minute boundary, then back off 30 min
 *   - daily mosaics: use yesterday (UTC), which is always complete
 */
export function latestTimestamp(cadence: Cadence, now = new Date()): string {
  if (cadence === "daily") {
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return day.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  const lagged = new Date(now.getTime() - 30 * 60 * 1000);
  lagged.setUTCSeconds(0, 0);
  lagged.setUTCMinutes(Math.floor(lagged.getUTCMinutes() / 10) * 10);
  return lagged.toISOString().replace(/\.\d{3}Z$/, "Z"); // YYYY-MM-DDTHH:MM:SSZ
}

/**
 * Turn a NOAA layer definition into a Cesium imagery provider.
 *
 * The two details that trip people up:
 *   - GIBS tiles are 512x512, not Cesium's default 256
 *   - the grid is geographic (EPSG:4326) and starts as 2x1 tiles at level 0,
 *     which is exactly what GeographicTilingScheme produces by default
 */
export function createNoaaImageryProvider(
  layer: NoaaLayer,
  time = latestTimestamp(layer.cadence),
): Cesium.WebMapTileServiceImageryProvider {
  return new Cesium.WebMapTileServiceImageryProvider({
    url: `${GIBS_WMTS}/${layer.gibsLayer}/default/${time}/${layer.tileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.${layer.format}`,
    layer: layer.gibsLayer,
    style: "default",
    format: layer.format === "jpg" ? "image/jpeg" : "image/png",
    tileMatrixSetID: layer.tileMatrixSet,
    maximumLevel: layer.maximumLevel,
    tileWidth: 512,
    tileHeight: 512,
    tilingScheme: new Cesium.GeographicTilingScheme(),
    credit: new Cesium.Credit("NOAA / NESDIS via NASA GIBS"),
  });
}

/**
 * NOAA live weather radar (CONUS base reflectivity).
 *
 * This one is not GIBS -- it is NOAA's own ArcGIS server, a *dynamic* map
 * service rather than pre-cut tiles, so Cesium has to ask it to render each
 * image on demand (`usePreCachedTilesIfAvailable: false`).
 */
export const NOAA_RADAR_URL =
  "https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity/MapServer";

export async function createNoaaRadarProvider() {
  return Cesium.ArcGisMapServerImageryProvider.fromUrl(NOAA_RADAR_URL, {
    usePreCachedTilesIfAvailable: false,
    credit: new Cesium.Credit("NOAA / National Weather Service"),
  });
}
