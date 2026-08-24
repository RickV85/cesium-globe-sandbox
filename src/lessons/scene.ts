import * as Cesium from "cesium";

/**
 * Put the globe back to a known state between lessons.
 *
 * Worth reading once: it is a decent map of the places Cesium keeps state.
 * Entities, data sources and primitives are three separate collections, and
 * terrain and imagery are configured independently of all of them.
 */
export function resetScene(viewer: Cesium.Viewer) {
  viewer.entities.removeAll();
  viewer.dataSources.removeAll();
  // Note: do NOT call scene.primitives.removeAll() here. The Viewer's own
  // DataSourceDisplay keeps its PrimitiveCollection in scene.primitives, and
  // removeAll() destroys it -- which kills the render loop on the next frame.

  // Imagery is a stack. Layer 0 is the base map; drop everything above it.
  const layers = viewer.imageryLayers;
  while (layers.length > 1) {
    layers.remove(layers.get(layers.length - 1), true);
  }
  if (layers.length === 1) {
    layers.get(0).show = true;
    layers.get(0).alpha = 1.0;
  }

  // Back to a smooth ellipsoid -- no elevation data.
  viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
  viewer.scene.globe.depthTestAgainstTerrain = false;
  viewer.scene.globe.enableLighting = false;

  viewer.clock.shouldAnimate = false;
  viewer.clock.multiplier = 1;
  viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;

  viewer.trackedEntity = undefined;
  viewer.selectedEntity = undefined;
}
