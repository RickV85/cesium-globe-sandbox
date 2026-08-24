import * as Cesium from "cesium";
import type { Lesson } from "./types";

/**
 * Lesson 1 -- moving the camera.
 *
 * Almost everything in Cesium is expressed in Cartesian3: a point in
 * earth-centred, earth-fixed metres. You rarely type those numbers yourself;
 * Cartesian3.fromDegrees(lon, lat, height) converts from the coordinates you
 * actually have.
 */
export const cameraLesson: Lesson = {
  id: "camera",
  title: "1 · Camera & coordinates",
  summary:
    "Fly the camera to a place, aimed at an angle. Cesium positions things with Cartesian3 (earth-centred metres) and orients them with heading/pitch/roll in radians.",
  snippet: `viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(86.925, 27.9, 12000),
  orientation: {
    heading: Cesium.Math.toRadians(20),   // compass direction
    pitch: Cesium.Math.toRadians(-25),    // negative = looking down
    roll: 0,
  },
  duration: 4,
});`,

  run({ viewer, log }) {
    // Mount Everest, viewed from 12 km up and tilted 25 degrees below horizontal.
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(86.925, 27.9, 12_000),
      orientation: {
        heading: Cesium.Math.toRadians(20),
        pitch: Cesium.Math.toRadians(-25),
        roll: 0,
      },
      duration: 4,
    });

    log("Flying to Mount Everest (86.925E, 27.9N) from 12 km up.");
    log("Note the globe is smooth -- there is no terrain loaded yet. That is lesson 3.");
    log("Drag to orbit, scroll to zoom, middle-drag or ctrl-drag to tilt.");

    // The camera reports where it ended up, in radians -- convert to read it.
    const stop = viewer.camera.moveEnd.addEventListener(() => {
      const c = viewer.camera.positionCartographic;
      log(
        `camera now at ${Cesium.Math.toDegrees(c.longitude).toFixed(3)}, ` +
          `${Cesium.Math.toDegrees(c.latitude).toFixed(3)} @ ${(c.height / 1000).toFixed(1)} km`,
      );
      stop();
    });
  },
};
