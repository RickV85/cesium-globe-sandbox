import * as Cesium from "cesium";
import type { Lesson } from "./types";

/**
 * Lesson 2 -- the Entity API.
 *
 * Entities are Cesium's high-level "draw a thing here" API. You describe what
 * you want and Cesium handles the graphics. (The lower-level Primitive API is
 * faster for tens of thousands of objects, but you almost never start there.)
 */
export const entitiesLesson: Lesson = {
  id: "entities",
  title: "2 · Entities: points, lines, shapes",
  summary:
    "Add geometry to the globe. One entity can carry several graphics types at once -- here: points with labels, a great-circle line, and an extruded polygon.",
  snippet: `viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(-104.99, 39.74),
  point: { pixelSize: 12, color: Cesium.Color.CYAN },
  label: { text: "Denver", pixelOffset: new Cesium.Cartesian2(0, -18) },
});

viewer.entities.add({
  polyline: {
    positions: Cesium.Cartesian3.fromDegreesArray([-104.99, 39.74, -0.13, 51.5]),
    width: 3,
    material: Cesium.Color.ORANGE,
    arcType: Cesium.ArcType.GEODESIC,   // bends with the earth
  },
});`,

  run({ viewer, log }) {
    const cities: Array<[string, number, number]> = [
      ["Denver", -104.99, 39.74],
      ["London", -0.13, 51.5],
      ["Tokyo", 139.69, 35.69],
    ];

    for (const [name, lon, lat] of cities) {
      viewer.entities.add({
        name,
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: 12,
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
        },
        label: {
          text: name,
          font: "14px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -18),
          // Hide the label once you are far enough away to avoid clutter.
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3.0e7),
        },
      });
    }

    // A polyline over long distances must be GEODESIC, or it cuts through
    // the planet instead of following the surface.
    viewer.entities.add({
      name: "Denver to London",
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([-104.99, 39.74, -0.13, 51.5]),
        width: 3,
        material: Cesium.Color.ORANGE,
        arcType: Cesium.ArcType.GEODESIC,
      },
    });

    // Polygons can be extruded into volumes by giving them a height.
    viewer.entities.add({
      name: "Extruded box over Colorado",
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
          -109, 37, -102, 37, -102, 41, -109, 41,
        ]),
        material: Cesium.Color.MAGENTA.withAlpha(0.4),
        extrudedHeight: 250_000,
        outline: true,
        outlineColor: Cesium.Color.MAGENTA,
      },
    });

    log("Added 3 labelled points, a geodesic polyline and an extruded polygon.");
    log("Click any of them -- the Viewer's built-in selection panel reads entity.name.");
    log("viewer.entities is an EntityCollection: add / remove / removeAll / getById.");

    viewer.flyTo(viewer.entities, { duration: 3 });
  },
};
