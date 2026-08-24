import * as Cesium from "cesium";
import type { Lesson } from "./types";
import { hasIonToken } from "@/lib/ion";

/**
 * Lesson 3 -- terrain.
 *
 * By default the globe is a smooth ellipsoid. Real elevation is a separate
 * streaming dataset that you attach to the viewer. Cesium World Terrain is
 * hosted on Cesium ion, so this lesson is the first that needs your token.
 */
export const terrainLesson: Lesson = {
  id: "terrain",
  title: "3 · Terrain (needs an ion token)",
  summary:
    "Swap the smooth ellipsoid for real global elevation, then sample the height of a point on it. Also switches on depth testing so entities sit behind mountains instead of through them.",
  snippet: `viewer.terrainProvider = await Cesium.createWorldTerrainAsync();

// Without this, points and lines draw on top of terrain that should hide them.
viewer.scene.globe.depthTestAgainstTerrain = true;

// Ask the terrain how high a given lon/lat actually is:
const [sample] = await Cesium.sampleTerrainMostDetailed(
  viewer.terrainProvider,
  [Cesium.Cartographic.fromDegrees(-119.53, 37.73)],
);
console.log(sample.height);`,

  async run({ viewer, log }) {
    // Gate on our own env var, not on Cesium.Ion.defaultAccessToken -- Cesium
    // ships a built-in demo token, so that property is never empty and terrain
    // would silently load on Cesium's shared quota instead of yours.
    if (!hasIonToken) {
      log("No Cesium ion token set, so world terrain is unavailable.");
      log("Add NEXT_PUBLIC_CESIUM_ION_TOKEN to .env.local and restart the dev server.");
      log("Free token: https://ion.cesium.com/tokens");
      return;
    }

    log("Loading Cesium World Terrain...");
    try {
      viewer.terrainProvider = await Cesium.createWorldTerrainAsync();
    } catch (error) {
      log(`Terrain failed to load: ${error instanceof Error ? error.message : String(error)}`);
      log("This usually means the ion token is missing the 'assets:read' scope.");
      return;
    }

    // Terrain occludes geometry only when depth testing is on.
    viewer.scene.globe.depthTestAgainstTerrain = true;
    log("Terrain attached. depthTestAgainstTerrain is now true.");

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-119.53, 37.68, 9_000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-20),
      },
      duration: 4,
    });
    log("Flying to Yosemite Valley -- tilt the camera to see the relief.");

    // Terrain is streamed, so height queries are asynchronous.
    const [halfDome] = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [
      Cesium.Cartographic.fromDegrees(-119.5332, 37.7459),
    ]);
    log(`Sampled terrain height at Half Dome: ${halfDome.height.toFixed(0)} m`);

    viewer.entities.add({
      name: "Half Dome",
      position: Cesium.Cartesian3.fromDegrees(-119.5332, 37.7459, halfDome.height),
      point: { pixelSize: 12, color: Cesium.Color.YELLOW },
      label: {
        text: `Half Dome ${halfDome.height.toFixed(0)} m`,
        font: "14px sans-serif",
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -18),
      },
    });
  },
};
