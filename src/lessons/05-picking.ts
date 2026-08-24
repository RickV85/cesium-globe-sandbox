import * as Cesium from "cesium";
import type { Lesson } from "./types";

/**
 * Lesson 5 -- turning a mouse click into a location.
 *
 * Two different questions, two different calls:
 *   scene.pick(windowPos)          -> "what object is under the cursor?"
 *   globe.pick(ray, scene)         -> "what point on the earth is under it?"
 */
export const pickingLesson: Lesson = {
  id: "picking",
  title: "5 · Picking: clicks to coordinates",
  summary:
    "Wire up a ScreenSpaceEventHandler and read both what you clicked and where you clicked. Screen coordinates come back as Cartesian2; the globe answers in Cartesian3.",
  snippet: `const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

handler.setInputAction((movement) => {
  // 1. Did we hit an entity?
  const picked = viewer.scene.pick(movement.position);
  if (Cesium.defined(picked)) console.log(picked.id?.name);

  // 2. Where on the globe is that pixel?
  const ray = viewer.camera.getPickRay(movement.position);
  const point = ray && viewer.scene.globe.pick(ray, viewer.scene);
  if (point) {
    const c = Cesium.Cartographic.fromCartesian(point);
    console.log(Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude));
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

handler.destroy();  // always tear this down`,

  run({ viewer, log }) {
    viewer.entities.add({
      name: "Target marker",
      position: Cesium.Cartesian3.fromDegrees(-98.58, 39.83),
      point: { pixelSize: 18, color: Cesium.Color.LIME, outlineColor: Cesium.Color.BLACK, outlineWidth: 2 },
    });

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.id instanceof Cesium.Entity) {
        log(`Picked entity: ${picked.id.name ?? picked.id.id}`);
      }

      const ray = viewer.camera.getPickRay(movement.position);
      const cartesian = ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined;

      if (!cartesian) {
        log("Clicked past the edge of the globe -- no intersection.");
        return;
      }

      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      log(
        `Clicked ${Cesium.Math.toDegrees(carto.longitude).toFixed(4)}, ` +
          `${Cesium.Math.toDegrees(carto.latitude).toFixed(4)} ` +
          `(globe height ${carto.height.toFixed(0)} m)`,
      );
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    (viewer as unknown as Record<string, unknown>).__pickHandler = handler;

    log("Click anywhere on the globe. Handler is live until you switch lessons.");
    log("There is a green marker over Kansas -- click it to see entity picking too.");

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-98.58, 39.83, 4_000_000),
      duration: 2.5,
    });
  },

  cleanup({ viewer }) {
    const store = viewer as unknown as Record<string, unknown>;
    const handler = store.__pickHandler;
    if (handler instanceof Cesium.ScreenSpaceEventHandler && !handler.isDestroyed()) {
      handler.destroy();
    }
    delete store.__pickHandler;
  },
};
