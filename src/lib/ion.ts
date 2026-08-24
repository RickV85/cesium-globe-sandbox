/**
 * Whether *you* have configured a Cesium ion token.
 *
 * Careful: `Cesium.Ion.defaultAccessToken` is NOT a reliable test. CesiumJS
 * ships with a built-in demo token baked into the bundle, so that property is
 * never empty and ion-hosted assets will quietly load on Cesium's own shared,
 * rate-limited quota. Always gate on your own environment variable instead.
 */
export const ION_TOKEN = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? "";

export const hasIonToken = ION_TOKEN.length > 0;
