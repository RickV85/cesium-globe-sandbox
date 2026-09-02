'use client';

import { useCallback, useContext, useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import { ION_TOKEN, hasIonToken } from '@/lib/ion';
import { flashKey, type Flash } from '@/lib/types';
import styles from './LightningGlobe.module.css';
import { AppContext } from '@/app/contexts/AppContext';

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
  windowSeconds: number;
};

/** The ingest bbox (Northern Rockies) — where the camera opens. */
const HOME = Cesium.Rectangle.fromDegrees(-117, 41, -105, 49);

/**
 * GLM flash energies span roughly 1e-15 to 1e-12 J — three decades — so the
 * ramp runs on the exponent. A linear one would put nearly every flash at the
 * bottom.
 */
const MIN_EXP = -15;
const DECADES = 3;
const YELLOW_HUE = 0.14;

function energyColor(energy: number | null): Cesium.Color {
  if (energy === null || energy <= 0) return Cesium.Color.WHITE;
  const t = Cesium.Math.clamp((Math.log10(energy) - MIN_EXP) / DECADES, 0, 1);
  return Cesium.Color.fromHsl(YELLOW_HUE * (1 - t), 1.0, 0.5);
}

/** Area runs ~70–800 km²; sqrt keeps the big ones from swamping the view. */
function areaPixels(area: number | null): number {
  if (area === null || area <= 0) return 12;
  return Cesium.Math.clamp(Math.sqrt(area) * 0.8, 11, 28);
}

function buildAvailability(flash: Flash, windowSeconds: number): Cesium.TimeIntervalCollection {
  const start = Cesium.JulianDate.fromIso8601(flash.flash_time);
  const stop = Cesium.JulianDate.addSeconds(start, windowSeconds, new Cesium.JulianDate());
  return new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({ start, stop })]);
}

export default function LightningGlobe({ flashes, focus, onSelect, windowSeconds }: Props) {
  const { isTimeWindowEnabled } = useContext(AppContext);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const handlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null);
  /** entity id -> flash, so a pick can be mapped back to its record. */
  const byEntityId = useRef<Map<string, Flash>>(new Map());
  // Kept in a ref so the viewer-creation effect below can stay dependency-free
  // (it must run exactly once) while still calling the latest handler.
  const onSelectRef = useRef(onSelect);
  const lastFlashTimeRef = useRef<Cesium.JulianDate | null>(null);
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
      animation: true,
      timeline: true,
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
        material: Cesium.Color.WHITE,
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

  useEffect(() => {
    // isTimeWindowEnabled
    //   ? viewerRef.current?.timeline.container.cl
    //   : viewerRef.current?.timeline.container.remove();
  }, [isTimeWindowEnabled]);

  // --- add/change/delete entities when the data changes -----------------------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const entities = viewer.entities;
    // Batch: without this Cesium fires a change event per entity and the
    // visualizers re-run for every single one.
    entities.suspendEvents();

    const seen = new Set<string>();

    for (const flash of flashes) {
      const id = flashKey(flash);
      seen.add(id);
      byEntityId.current.set(id, flash);

      const existing = entities.getById(id);
      if (existing) {
        existing.availability = buildAvailability(flash, windowSeconds);
        continue;
      }

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
        availability: buildAvailability(flash, windowSeconds),
      });
    }

    // Remove only flash entities that are no longer present.
    for (const id of byEntityId.current.keys()) {
      if (!seen.has(id)) {
        entities.removeById(id);
        byEntityId.current.delete(id);
      }
    }

    entities.resumeEvents();
  }, [flashes, windowSeconds]);

  // --- Reset clock bounds on new data -----------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const clock = viewer.clock;

    if (!flashes.length) {
      const now = Cesium.JulianDate.now();
      const nowMinusOneHour = Cesium.JulianDate.addHours(now, -1, new Cesium.JulianDate());

      lastFlashTimeRef.current = null;
      clock.clockRange = Cesium.ClockRange.UNBOUNDED;
      clock.startTime = now;
      clock.stopTime = now;
      clock.currentTime = now;
      clock.shouldAnimate = false;
      viewer.timeline.zoomTo(nowMinusOneHour, now);
    } else {
      const start = Cesium.JulianDate.fromIso8601(flashes[0].flash_time);
      const lastFlashTime = Cesium.JulianDate.fromIso8601(flashes[flashes.length - 1].flash_time);
      lastFlashTimeRef.current = lastFlashTime;

      // Adds windowSeconds on so that all flashes are shown by end of playback, so changing window length
      // will change the end of the timeline as well
      const stop = Cesium.JulianDate.addSeconds(lastFlashTime, windowSeconds, new Cesium.JulianDate());
      const dataSpanSeconds = Math.max(Cesium.JulianDate.secondsDifference(lastFlashTime, start), 1);

      clock.clockRange = Cesium.ClockRange.LOOP_STOP;
      clock.startTime = start;
      clock.stopTime = stop;
      clock.currentTime = start;
      clock.shouldAnimate = false;
      clock.multiplier = Cesium.Math.clamp(dataSpanSeconds / 60, 0.5, 20000);

      viewer.timeline.zoomTo(start, stop);
    }
  }, [flashes, windowSeconds]);

  // --- fly to a flash selected in the table ------------------------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !focus) return;

    // set the selected entity to show selected box on globe
    viewer.selectedEntity = viewer.entities.getById(flashKey(focus.flash));

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(focus.flash.lon, focus.flash.lat, 25000),
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
