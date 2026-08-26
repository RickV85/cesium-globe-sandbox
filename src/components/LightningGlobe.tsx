'use client';

import { useCallback, useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import { ION_TOKEN, hasIonToken } from '@/lib/ion';
import type { Flash } from '@/lib/types';
import styles from './LightningGlobe.module.css';

/**
 * A request to point the camera at a flash.
 *
 * The nonce exists so that clicking the same table row twice flies again --
 * with a bare Flash the effect would see an unchanged reference and skip.
 */
export type FocusRequest = { flash: Flash; nonce: number };

type Props = {
  flashes: Flash[];
  /** Camera target. Set by table clicks only, so picking on the globe does not
   *  yank the view out from under the user. */
  focus: FocusRequest | null;
  onSelect: (flash: Flash | null) => void;
};

/** The ingest bbox (Northern Rockies) — where the camera opens. */
const HOME = Cesium.Rectangle.fromDegrees(-117, 41, -105, 49);

/**
 * GLM flash energies span roughly 1e-15 to 1e-12 J, so the ramp is on a log
 * scale — a linear one would put almost every flash at the bottom.
 */
const LOG_E_MIN = Math.log10(1e-15);
const LOG_E_MAX = Math.log10(1e-12);
// The dim end stays clearly visible against bright terrain -- a darker blue
// reads as "nothing there" at regional zoom, which is the wrong impression for
// a detection that did happen.
const DIM = Cesium.Color.fromCssColorString('#8fd4ff');
const BRIGHT = Cesium.Color.fromCssColorString('#fffbe0');

function energyColor(energy: number | null): Cesium.Color {
  if (energy === null || energy <= 0) return Cesium.Color.WHITE;
  const x = Cesium.Math.clamp((Math.log10(energy) - LOG_E_MIN) / (LOG_E_MAX - LOG_E_MIN), 0, 1);
  return Cesium.Color.lerp(DIM, BRIGHT, x, new Cesium.Color());
}

/** Area runs ~70–800 km²; sqrt keeps the big ones from swamping the view. */
function areaPixels(area: number | null): number {
  if (area === null || area <= 0) return 12;
  return Cesium.Math.clamp(Math.sqrt(area) * 0.8, 11, 28);
}

export default function LightningGlobe({ flashes, focus, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const handlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null);
  /** entity id -> flash, so a pick can be mapped back to its record. */
  const byEntityId = useRef<Map<string, Flash>>(new Map());
  // Kept in a ref so the viewer-creation effect below can stay dependency-free
  // (it must run exactly once) while still calling the latest handler.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const homeView = useCallback((viewer: Cesium.Viewer) => {
    viewer.camera.flyTo({ destination: HOME, duration: 2.5 });
  }, []);

  // --- create the viewer once -------------------------------------------
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    if (hasIonToken) Cesium.Ion.defaultAccessToken = ION_TOKEN;

    const viewer = new Cesium.Viewer(containerRef.current, {
      ...(hasIonToken
        ? {}
        : {
            baseLayer: Cesium.ImageryLayer.fromProviderAsync(
              Promise.resolve(
                new Cesium.OpenStreetMapImageryProvider({
                  url: 'https://tile.openstreetmap.org/',
                  credit: new Cesium.Credit('© OpenStreetMap contributors'),
                }),
              ),
              {},
            ),
          }),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: true,
      animation: false,
      timeline: false,
    });

    viewer.scene.globe.enableLighting = false;
    viewer.camera.setView({ destination: HOME });
    viewerRef.current = viewer;

    // Map a click on the globe back to the underlying flash record.
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = viewer.scene.pick(movement.position);
      const id = Cesium.defined(picked) && picked.id instanceof Cesium.Entity ? picked.id.id : null;
      onSelectRef.current(id ? (byEntityId.current.get(id) ?? null) : null);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    handlerRef.current = handler;

    if (process.env.NODE_ENV === 'development') {
      (window as unknown as Record<string, unknown>).viewer = viewer;
    }

    // Draw the ingest bbox outline once. Rectangle stores its bounds in
    // radians, so they're converted to degrees before building the corners
    const w = Cesium.Math.toDegrees(HOME.west);
    const s = Cesium.Math.toDegrees(HOME.south);
    const e = Cesium.Math.toDegrees(HOME.east);
    const n = Cesium.Math.toDegrees(HOME.north);
    viewer.entities.add({
      name: 'Northern Rockies ingest bbox',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([w, s, e, s, e, n, w, n, w, s]),
        material: Cesium.Color.RED,
        width: 3,
        clampToGround: true,
      },
    });

    return () => {
      if (handlerRef.current && !handlerRef.current.isDestroyed()) handlerRef.current.destroy();
      handlerRef.current = null;
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // --- rebuild entities when the data changes -----------------------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const entities = viewer.entities;
    // Batch: without this Cesium fires a change event per entity and the
    // visualizers re-run for every single one.
    entities.suspendEvents();
    // Remove only the flash entities this effect owns
    for (const id of byEntityId.current.keys()) entities.removeById(id);
    byEntityId.current.clear();

    for (const flash of flashes) {
      const id = `${flash.flash_id}@${flash.t}`;
      byEntityId.current.set(id, flash);

      entities.add({
        id,
        position: Cesium.Cartesian3.fromDegrees(flash.lon, flash.lat),
        point: {
          pixelSize: areaPixels(flash.area_km2),
          color: energyColor(flash.energy_j),
          // A dark ring keeps pale points legible over snow, cloud and desert.
          outlineColor: Cesium.Color.BLACK.withAlpha(0.75),
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }

    entities.resumeEvents();
  }, [flashes]);

  // --- fly to a flash selected in the table ------------------------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !focus) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(focus.flash.lon, focus.flash.lat, 250_000),
      duration: 1.5,
    });
  }, [focus]);

  return (
    <div className={styles.globeWrap}>
      <div ref={containerRef} className={styles.globe} />
      <button
        type="button"
        className={styles.homeButton}
        onClick={() => viewerRef.current && homeView(viewerRef.current)}
      >
        Reset view
      </button>
    </div>
  );
}
