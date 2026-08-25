import path from "node:path";
import type { NextConfig } from "next";

/*
 * @cesium/engine's glTF pipeline (Source/Scene/ResourceCache.js ->
 * Source/Scene/GltfSpzLoader.js) statically imports @spz-loader/core to
 * decode the KHR_spz_gaussian_splats_compression extension -- a feature
 * LightningGlobe never touches, but the static import still pulls the whole
 * package into every bundle that imports `cesium`.
 *
 * @spz-loader/core embeds its entire compiled WebAssembly decoder (~250KB)
 * directly in its JS as an Emscripten "single file" build (there's no
 * separate .wasm to redirect the bundler to). Confirmed via source map:
 * Next's production minifier (SWC -- used by both the Turbopack and webpack
 * build paths, which is why switching bundlers didn't help) fails to escape
 * at least one raw backslash byte when re-serializing that giant embedded
 * string. That lone unescaped backslash lands next to two literal '0' bytes
 * from the binary payload, forming the illegal `\00` legacy octal escape --
 * banned unconditionally inside a template literal. That's the production
 * -only SyntaxError that was taking down the whole Cesium chunk.
 *
 * Fix: never let the bundler see that import -- alias it to a stub, since
 * the feature is unused. See stubs/spz-loader-stub.js.
 *
 * Turbopack's resolveAlias wants a path relative to this file; webpack's
 * resolve.alias wants an absolute one -- each errors ("module not found")
 * if given the other's form, so both are spelled out rather than shared.
 */
const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "@spz-loader/core": "./stubs/spz-loader-stub.js",
    },
  },
  webpack: (config) => {
    config.resolve.alias["@spz-loader/core"] = path.resolve(__dirname, "stubs/spz-loader-stub.js");
    return config;
  },
};

export default nextConfig;
