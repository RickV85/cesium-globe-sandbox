/**
 * Cesium ships its Workers, Assets, Widgets and ThirdParty files as static
 * files that the library fetches at runtime from `window.CESIUM_BASE_URL`.
 * They are NOT part of the JS bundle, so a bundler alone will not deliver them.
 *
 * Next 16 uses Turbopack, which does not run webpack plugins such as
 * copy-webpack-plugin, so we copy the directories ourselves before dev/build.
 */
import { cp, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const SOURCE = join(process.cwd(), "node_modules", "cesium", "Build", "Cesium");
const TARGET = join(process.cwd(), "public", "cesium");
const DIRS = ["Assets", "ThirdParty", "Widgets", "Workers"];

try {
  await stat(SOURCE);
} catch {
  console.error("[cesium] node_modules/cesium/Build/Cesium not found. Run `npm install` first.");
  process.exit(1);
}

await rm(TARGET, { recursive: true, force: true });
for (const dir of DIRS) {
  await cp(join(SOURCE, dir), join(TARGET, dir), { recursive: true });
}

console.log(`[cesium] copied ${DIRS.join(", ")} -> public/cesium`);
