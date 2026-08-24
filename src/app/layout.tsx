import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cesium globe sandbox",
  description: "A guided tour of CesiumJS, with live NOAA satellite imagery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/*
          Cesium fetches its Workers, Assets and Widgets at runtime relative to
          window.CESIUM_BASE_URL. This must be set before any Cesium module is
          evaluated, which is exactly what `beforeInteractive` guarantees.
          The files themselves are copied into public/cesium by
          scripts/copy-cesium-assets.mjs, run from the predev/prebuild hooks.
        */}
        <Script id="cesium-base-url" strategy="beforeInteractive">
          {`window.CESIUM_BASE_URL = "/cesium";`}
        </Script>
        {children}
      </body>
    </html>
  );
}
