import { createLiveFeed } from './createLiveFeed';

export { EMPTY_LIVE_SNAPSHOT, type LiveFeedSnapshot, type LiveFeedStatus } from './createLiveFeed';

/*
 * The page's one live feed. Creating it touches no browser APIs; start() does.
 *
 * The worker is created here rather than in createLiveFeed.ts because
 * `new Worker(new URL(..., import.meta.url))` has to appear literally for the
 * bundler to emit the worker, and Jest cannot load `import.meta`.
 *
 * Kept on globalThis so a dev hot reload reuses the running feed instead of
 * starting a second one next to it. The trade-off, as with src/lib/db.ts:
 * edits to the feed only take effect after a browser refresh.
 */
const globalForLiveFeed = globalThis as unknown as { __liveFeed?: ReturnType<typeof createLiveFeed> };

export const liveFeed = (globalForLiveFeed.__liveFeed ??= createLiveFeed(
  () => new Worker(new URL('./glm.worker.ts', import.meta.url), { type: 'module' }),
));
