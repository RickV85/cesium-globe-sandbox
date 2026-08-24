"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

import { LESSONS } from "@/lessons";
import type { Lesson } from "@/lessons";
import { resetScene } from "@/lessons/scene";
import { NOAA_LAYERS, createNoaaImageryProvider, latestTimestamp } from "@/lib/noaa";
import { ION_TOKEN, hasIonToken } from "@/lib/ion";
import styles from "./CesiumViewer.module.css";

export default function CesiumViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const activeLessonRef = useRef<Lesson | null>(null);
  const noaaLayerRef = useRef<Cesium.ImageryLayer | null>(null);

  const [ready, setReady] = useState(false);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [activeNoaaId, setActiveNoaaId] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);

  const log = useCallback((message: string) => {
    setLogLines((previous) => [...previous, message].slice(-80));
  }, []);

  // ---------------------------------------------------------------------
  // Create the Viewer exactly once, and destroy it on unmount. React's
  // StrictMode mounts effects twice in development, so the teardown has to
  // be genuinely complete or you end up with two globes.
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const hasToken = hasIonToken;
    if (hasToken) {
      Cesium.Ion.defaultAccessToken = ION_TOKEN;
    }

    const viewer = new Cesium.Viewer(containerRef.current, {
      // With no ion token we cannot use Cesium's default (ion-hosted) imagery,
      // so fall back to OpenStreetMap and let the app still run.
      ...(hasToken
        ? {}
        : {
            baseLayer: Cesium.ImageryLayer.fromProviderAsync(
              Promise.resolve(
                new Cesium.OpenStreetMapImageryProvider({
                  url: "https://tile.openstreetmap.org/",
                  credit: new Cesium.Credit("© OpenStreetMap contributors"),
                }),
              ),
              {},
            ),
          }),
      baseLayerPicker: false, // we manage the imagery stack by hand in the lessons
      geocoder: hasToken, // the search box is an ion service
      animation: true,
      timeline: true,
      homeButton: true,
      sceneModePicker: true,
      navigationHelpButton: true,
      infoBox: true,
      selectionIndicator: true,
    });

    viewer.scene.globe.maximumScreenSpaceError = 2;

    // Set the opening view explicitly rather than relying on Cesium's default.
    // Cesium derives that default from the canvas aspect ratio at construction
    // time, and in dev the CSS module can land a beat later -- leaving the
    // camera hundreds of thousands of km out, staring at an empty sky.
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-60, 20, 24_000_000),
    });

    viewerRef.current = viewer;
    setReady(true);

    // Handy while learning: poke at the live scene from the browser console,
    // e.g. `viewer.camera.positionCartographic` or `viewer.entities.values`.
    if (process.env.NODE_ENV === "development") {
      (window as unknown as Record<string, unknown>).viewer = viewer;
    }

    return () => {
      activeLessonRef.current?.cleanup?.({ viewer, log });
      activeLessonRef.current = null;
      noaaLayerRef.current = null;
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      setReady(false);
    };
  }, [log]);

  // ---------------------------------------------------------------------
  // Lesson switching: tear the previous one down, reset the globe, run next.
  // ---------------------------------------------------------------------
  const runLesson = useCallback(
    async (lesson: Lesson) => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      activeLessonRef.current?.cleanup?.({ viewer, log });
      resetScene(viewer);
      noaaLayerRef.current = null;
      setActiveNoaaId(null);

      activeLessonRef.current = lesson;
      setActiveLessonId(lesson.id);
      setLogLines([`▶ ${lesson.title}`]);

      try {
        await lesson.run({ viewer, log });
      } catch (error) {
        log(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [log],
  );

  // ---------------------------------------------------------------------
  // NOAA layer strip -- stays usable no matter which lesson is loaded.
  // ---------------------------------------------------------------------
  const showNoaaLayer = useCallback(
    (layerId: string) => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      // Toggle off if the same button is pressed twice.
      if (noaaLayerRef.current) {
        viewer.imageryLayers.remove(noaaLayerRef.current, true);
        noaaLayerRef.current = null;
      }
      if (activeNoaaId === layerId) {
        setActiveNoaaId(null);
        log("Removed the NOAA layer from the imagery stack.");
        return;
      }

      const layer = NOAA_LAYERS.find((candidate) => candidate.id === layerId);
      if (!layer) return;

      const time = latestTimestamp(layer.cadence);
      noaaLayerRef.current = viewer.imageryLayers.addImageryProvider(
        createNoaaImageryProvider(layer, time),
      );
      setActiveNoaaId(layerId);

      log(`${layer.label} — frame ${time}`);
      log(layer.description);

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          layer.home.longitude,
          layer.home.latitude,
          layer.home.height,
        ),
        duration: 3,
      });
    },
    [activeNoaaId, log],
  );

  const activeLesson = LESSONS.find((lesson) => lesson.id === activeLessonId) ?? null;

  return (
    <div className={styles.shell}>
      <div ref={containerRef} className={styles.globe} />

      <aside className={styles.panel}>
        <header className={styles.header}>
          <h1>Cesium sandbox</h1>
          <p>
            Each lesson resets the globe and runs a small, commented block of raw CesiumJS.
            The source for every one is in <code>src/lessons/</code>.
          </p>
          {!hasIonToken && (
            <p className={styles.warning}>
              No Cesium ion token found. Running on OpenStreetMap imagery with no terrain.
              Add <code>NEXT_PUBLIC_CESIUM_ION_TOKEN</code> to <code>.env.local</code> and
              restart the dev server.
            </p>
          )}
        </header>

        <section className={styles.section}>
          <h2>Lessons</h2>
          <div className={styles.buttons}>
            {LESSONS.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                disabled={!ready}
                onClick={() => void runLesson(lesson)}
                className={lesson.id === activeLessonId ? styles.buttonActive : styles.button}
              >
                {lesson.title}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2>NOAA satellite layers</h2>
          <p className={styles.hint}>
            Live products from NOAA&apos;s GOES and NOAA-20 satellites, served as WMTS via
            NASA GIBS. Click again to remove.
          </p>
          <div className={styles.buttons}>
            {NOAA_LAYERS.map((layer) => (
              <button
                key={layer.id}
                type="button"
                disabled={!ready}
                onClick={() => showNoaaLayer(layer.id)}
                className={layer.id === activeNoaaId ? styles.buttonActive : styles.button}
              >
                {layer.label}
              </button>
            ))}
          </div>
        </section>

        {activeLesson && (
          <section className={styles.section}>
            <h2>What this does</h2>
            <p className={styles.hint}>{activeLesson.summary}</p>
            <pre className={styles.snippet}>
              <code>{activeLesson.snippet}</code>
            </pre>
          </section>
        )}

        <section className={styles.section}>
          <h2>Output</h2>
          <div className={styles.log}>
            {logLines.length === 0 ? (
              <span className={styles.hint}>Pick a lesson to begin.</span>
            ) : (
              logLines.map((line, index) => <div key={index}>{line}</div>)
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
