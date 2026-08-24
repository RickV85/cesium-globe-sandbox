"use client";

import dynamic from "next/dynamic";

/**
 * Cesium touches `window` and `document` as soon as it loads, so it can never
 * render on the server. Loading the viewer with `ssr: false` keeps it out of
 * the server bundle entirely.
 */
const CesiumViewer = dynamic(() => import("@/components/CesiumViewer"), {
  ssr: false,
  loading: () => <div style={{ padding: 24, color: "#93a1ad" }}>Loading globe…</div>,
});

export default function Home() {
  return <CesiumViewer />;
}
