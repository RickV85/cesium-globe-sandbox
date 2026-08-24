import * as Cesium from "cesium";
import type { Lesson } from "./types";

/**
 * Lesson 4 -- imagery layers.
 *
 * The globe's surface texture is a *stack* of imagery layers. Each has its own
 * alpha, brightness, contrast and visibility, and they composite bottom-to-top.
 * This is the mechanism the NOAA lesson builds on.
 */
export const imageryLesson: Lesson = {
  id: "imagery",
  title: "4 · Imagery layers & blending",
  summary:
    "Stack a second map on top of the base layer and blend it. Any standard tile service -- WMTS, WMS, XYZ, ArcGIS -- plugs in the same way.",
  snippet: `const layers = viewer.imageryLayers;

const osm = layers.addImageryProvider(
  new Cesium.OpenStreetMapImageryProvider({
    url: "https://tile.openstreetmap.org/",
  }),
);

osm.alpha = 0.5;        // blend with whatever is underneath
osm.brightness = 1.2;
layers.raise(osm);      // reorder within the stack`,

  run({ viewer, log }) {
    const layers = viewer.imageryLayers;
    log(`Base stack currently has ${layers.length} layer(s).`);

    const osm = layers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({
        url: "https://tile.openstreetmap.org/",
        credit: new Cesium.Credit("© OpenStreetMap contributors"),
      }),
    );

    // Half-transparent so you can see it compositing over the base imagery.
    osm.alpha = 0.55;
    log("Added OpenStreetMap on top at alpha 0.55 -- roads over satellite imagery.");
    log("Each layer exposes alpha, brightness, contrast, hue, saturation, gamma.");

    // Animate the blend so the stacking is obvious.
    let rising = false;
    const timer = window.setInterval(() => {
      osm.alpha += rising ? 0.05 : -0.05;
      if (osm.alpha <= 0.15) rising = true;
      if (osm.alpha >= 0.9) rising = false;
    }, 120);
    // Stash the timer so cleanup can clear it.
    (viewer as unknown as Record<string, unknown>).__imageryTimer = timer;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(2.35, 48.86, 60_000),
      duration: 3,
    });
    log("Flying to Paris. Watch the OSM layer fade in and out over the base map.");
  },

  cleanup({ viewer }) {
    const store = viewer as unknown as Record<string, unknown>;
    if (typeof store.__imageryTimer === "number") {
      window.clearInterval(store.__imageryTimer);
      delete store.__imageryTimer;
    }
  },
};
