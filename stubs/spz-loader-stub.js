/**
 * Stub for @spz-loader/core.
 *
 * @cesium/engine's glTF pipeline (Scene/ResourceCache.js -> Scene/GltfSpzLoader.js)
 * statically imports `loadSpz` from this package to decode the
 * KHR_spz_gaussian_splats_compression glTF extension. LightningGlobe never
 * loads a model using that extension, but the static import still pulls the
 * whole package into the bundle.
 *
 * @spz-loader/core embeds its entire compiled WebAssembly decoder (~250KB)
 * directly in dist/index.js as an Emscripten "single file" build -- there is
 * no separate .wasm asset to redirect the bundler to. When Next's production
 * minifier (SWC, used by both the Turbopack and webpack build paths --
 * confirmed via source map, see next.config.ts) re-serializes that giant
 * embedded-binary string, it fails to escape at least one raw backslash byte
 * in the payload. That lone unescaped backslash happens to sit next to two
 * ASCII '0' bytes from the binary data, forming the illegal `\00` legacy
 * octal escape, which is unconditionally banned inside a template literal --
 * a production-only, minified-only SyntaxError that took down this whole
 * chunk (and with it, the Cesium globe).
 *
 * `loadSpz`/`loadSpzFromUrl` are only ever called if a loaded glTF actually
 * uses the SPZ extension, which never happens here -- so throwing is safe.
 */
function unavailable(name) {
  return () => {
    throw new Error(
      `@spz-loader/core is stubbed out in this build (see stubs/spz-loader-stub.js); ${name}() is unavailable.`,
    );
  };
}

export const loadSpz = unavailable("loadSpz");
export const loadSpzFromUrl = unavailable("loadSpzFromUrl");
