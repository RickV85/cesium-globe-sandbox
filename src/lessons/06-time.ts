import * as Cesium from "cesium";
import type { Lesson } from "./types";

/**
 * Lesson 6 -- time.
 *
 * This is the part of Cesium that has no real equivalent in Leaflet. Every
 * viewer owns a Clock, and entity properties can be *functions of time*
 * rather than fixed values. Set a position at a few timestamps and Cesium
 * interpolates the rest, driving the animation widget and timeline for free.
 */
export const timeLesson: Lesson = {
  id: "time",
  title: "6 · The clock & animated positions",
  summary:
    "Give an entity a SampledPositionProperty -- a position that varies with time -- and Cesium interpolates between your samples and animates it against the viewer clock.",
  snippet: `const start = Cesium.JulianDate.now();
const stop = Cesium.JulianDate.addMinutes(start, 40, new Cesium.JulianDate());

viewer.clock.startTime = start;
viewer.clock.stopTime = stop;
viewer.clock.currentTime = start;
viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
viewer.clock.multiplier = 60;      // 60x real time
viewer.clock.shouldAnimate = true;

const position = new Cesium.SampledPositionProperty();
position.addSample(start, Cesium.Cartesian3.fromDegrees(-104.99, 39.74, 10000));
position.addSample(stop,  Cesium.Cartesian3.fromDegrees(-0.13, 51.5, 10000));

viewer.entities.add({
  position,
  orientation: new Cesium.VelocityOrientationProperty(position),
  point: { pixelSize: 14, color: Cesium.Color.YELLOW },
  path: { width: 2, material: Cesium.Color.YELLOW.withAlpha(0.7) },
  availability: new Cesium.TimeIntervalCollection([
    new Cesium.TimeInterval({ start, stop }),
  ]),
});`,

  run({ viewer, log }) {
    const start = Cesium.JulianDate.now();
    const stop = Cesium.JulianDate.addMinutes(start, 40, new Cesium.JulianDate());

    viewer.clock.startTime = start.clone();
    viewer.clock.stopTime = stop.clone();
    viewer.clock.currentTime = start.clone();
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    viewer.clock.multiplier = 60;
    viewer.clock.shouldAnimate = true;
    viewer.timeline?.zoomTo(start, stop);

    // Waypoints along a Denver -> London great circle, at cruise altitude.
    const waypoints: Array<[number, number, number]> = [
      [-104.99, 39.74, 0],
      [-90.0, 46.0, 10_500],
      [-70.0, 52.0, 11_000],
      [-40.0, 56.0, 11_000],
      [-10.0, 54.0, 10_500],
      [-0.13, 51.5, 0],
    ];

    const position = new Cesium.SampledPositionProperty();
    waypoints.forEach(([lon, lat, height], index) => {
      const time = Cesium.JulianDate.addMinutes(
        start,
        (index / (waypoints.length - 1)) * 40,
        new Cesium.JulianDate(),
      );
      position.addSample(time, Cesium.Cartesian3.fromDegrees(lon, lat, height));
    });

    // Smooth the path instead of connecting samples with straight segments.
    position.setInterpolationOptions({
      interpolationDegree: 2,
      interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
    });

    const flight = viewer.entities.add({
      name: "Flight DEN → LHR",
      // availability tells Cesium when this entity exists at all
      availability: new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({ start, stop }),
      ]),
      position,
      orientation: new Cesium.VelocityOrientationProperty(position),
      point: {
        pixelSize: 14,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
      },
      path: {
        resolution: 10,
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.YELLOW,
        }),
      },
    });

    log("Clock running at 60x. Use the animation widget (bottom left) to scrub.");
    log("The timeline at the bottom is driven by the entity's availability interval.");
    log("viewer.trackedEntity makes the camera chase it -- doing that now.");
    viewer.trackedEntity = flight;
  },

  cleanup({ viewer }) {
    viewer.trackedEntity = undefined;
    viewer.clock.shouldAnimate = false;
  },
};
