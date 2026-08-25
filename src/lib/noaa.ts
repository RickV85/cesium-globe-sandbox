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
 *                           disk -- the far side of the globe has no data.
 *   VIIRS on NOAA-20      : a polar orbiter that images the whole Earth once per
 *                           day, stitched into a global daily mosaic.
 *
 * IMPORTANT -- use the EPSG:3857 endpoint, not EPSG:4326.
 *
 * GIBS publishes both. The EPSG:4326 grid looks like the obvious choice for a
 * globe, but its tile pyramid is 288 degrees wide at level 0 and halves from
 * there (288, 144, 72, 36, 18...). Cesium's GeographicTilingScheme is a
 * quadtree starting at 180 degrees (180, 90, 45, 22.5, 11.25...). The ratio is
 * 288/180 = 1.6, which is not a power of two, so the two grids never line up at
 * any zoom level. Pointing Cesium at the 4326 endpoint silently fetches tiles
 * for the wrong part of the world, and requests beyond GIBS's narrower matrix
 * width come back as HTTP 400 TileOutOfRange.
 *
 * The EPSG:3857 endpoint uses GoogleMapsCompatible grids: one 256px tile at
 * level 0, doubling each level. That is exactly Cesium's WebMercatorTilingScheme.
 */
import * as Cesium from "cesium";

const GIBS_WMTS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

/** How often a product publishes a new frame. */
export type Cadence = "daily" | "ten-minute";

export type NoaaLayer = {
  id: string;
  label: string;
  description: string;
  /** GIBS layer identifier, straight out of the WMTS capabilities document. */
  gibsLayer: string;
  /** Each layer declares which GoogleMapsCompatible grid it is published on. */
  tileMatrixSet: string;
  /** Deepest level that grid defines. Beyond it, tiles 400. */
  maximumLevel: number;
  format: "jpg" | "png";
  cadence: Cadence;
  /**
   * The area GIBS actually serves tiles for, in degrees.
   *
   * The geostationary layers only cover their own disk, and GIBS answers
   * requests outside it with HTTP 400 TileOutOfRange rather than a blank tile.
   * Passing this to Cesium as `rectangle` stops it asking in the first place.
   * These boxes are the intersection of the per-level TileMatrixSetLimits in
   * the GIBS capabilities document. Omit for global layers.
   */
  extent?: { west: number; south: number; east: number; north: number };
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
    tileMatrixSet: "GoogleMapsCompatible_Level7",
    maximumLevel: 6,
    format: "png",
    cadence: "ten-minute",
    extent: { west: -151.9, south: -32, east: 56.2, north: 84 },
    home: { longitude: -75, latitude: 20, height: 18_000_000 },
  },
  {
    id: "goes-east-infrared",
    label: "GOES-East · Clean Infrared",
    description:
      "Band 13 thermal infrared. Measures cloud-top temperature, so it works at night and makes storm structure obvious.",
    gibsLayer: "GOES-East_ABI_Band13_Clean_Infrared",
    tileMatrixSet: "GoogleMapsCompatible_Level6",
    maximumLevel: 5,
    format: "png",
    cadence: "ten-minute",
    extent: { west: -157.5, south: -32, east: 56.2, north: 85 },
    home: { longitude: -75, latitude: 20, height: 18_000_000 },
  },
  {
    id: "goes-west-geocolor",
    label: "GOES-West · GeoColor",
    description:
      "The Pacific-facing twin of GOES-East. Its disk runs past the antimeridian; this layer shows the eastern half of it, from the Pacific across the Americas.",
    gibsLayer: "GOES-West_ABI_GeoColor",
    tileMatrixSet: "GoogleMapsCompatible_Level7",
    maximumLevel: 6,
    format: "png",
    cadence: "ten-minute",
    // GOES-West's coverage straddles the antimeridian, which a single Cesium
    // Rectangle cannot express cleanly. This is the western block of it.
    extent: { west: -180, south: -32, east: -22.5, north: 84 },
    home: { longitude: -137, latitude: 15, height: 18_000_000 },
  },
  {
    id: "viirs-truecolor",
    label: "VIIRS (NOAA-20) · True Colour",
    description:
      "NOAA-20 is a polar orbiter: it sweeps the entire planet once a day. This is the resulting global daily mosaic -- the whole globe is covered, unlike GOES.",
    gibsLayer: "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
    tileMatrixSet: "GoogleMapsCompatible_Level9",
    maximumLevel: 9,
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
    tileMatrixSet: "GoogleMapsCompatible_Level8",
    maximumLevel: 8,
    format: "png",
    cadence: "daily",
    home: { longitude: 20, latitude: 30, height: 20_000_000 },
  },
];

/**
 * Pick which frame of a product to request.
 *
 * Do not compute a timestamp from the local clock for the geostationary feeds:
 * GIBS publishes them with a variable lag, often over an hour, so a guessed
 * "now minus N minutes" lands on a frame that does not exist and every tile
 * 404s. (The browser then reports those as CORS errors, because GIBS 404
 * responses carry no Access-Control-Allow-Origin header -- a misleading
 * symptom of a plain missing tile.) The literal string "default" asks GIBS for
 * the most recent frame it actually has.
 *
 * The daily mosaics need the opposite treatment: "default" resolves to *today*,
 * which is still being filled in as the satellite completes its orbits and is
 * mostly empty. Yesterday (UTC) is the most recent complete one.
 */
export function frameFor(cadence: Cadence, now = new Date()): string {
  if (cadence === "ten-minute") return "default";
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return yesterday.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Turn a NOAA layer definition into a Cesium imagery provider.
 *
 * The details that trip people up:
 *   - use the EPSG:3857 endpoint so the grid matches WebMercatorTilingScheme
 *     (see the note at the top of this file)
 *   - these tiles are 256px, and the matrix set name is per-layer
 *   - partial-coverage layers must be clipped with `rectangle`
 *   - the time slot takes "default" for the latest frame
 */
export function createNoaaImageryProvider(
  layer: NoaaLayer,
  time: string = frameFor(layer.cadence),
): Cesium.WebMapTileServiceImageryProvider {
  return new Cesium.WebMapTileServiceImageryProvider({
    url: `${GIBS_WMTS}/${layer.gibsLayer}/default/${time}/${layer.tileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.${layer.format}`,
    layer: layer.gibsLayer,
    style: "default",
    format: layer.format === "jpg" ? "image/jpeg" : "image/png",
    tileMatrixSetID: layer.tileMatrixSet,
    maximumLevel: layer.maximumLevel,
    tileWidth: 256,
    tileHeight: 256,
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    rectangle: layer.extent
      ? Cesium.Rectangle.fromDegrees(
          layer.extent.west,
          layer.extent.south,
          layer.extent.east,
          layer.extent.north,
        )
      : undefined,
    credit: new Cesium.Credit("NOAA / NESDIS via NASA GIBS"),
  });
}

/**
 * Stop Cesium retrying and logging tiles a service simply does not have.
 *
 * Even a correctly configured layer has holes -- VIIRS has no data over the
 * winter pole, for instance -- and GIBS answers those with a 404. Cesium's
 * default is to retry and log each one, which floods the console. Setting
 * `retry = false` makes a missing tile just be transparent.
 */
export function ignoreMissingTiles(provider: Cesium.ImageryProvider) {
  provider.errorEvent.addEventListener((error: Cesium.TileProviderError) => {
    error.retry = false;
  });
  return provider;
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
