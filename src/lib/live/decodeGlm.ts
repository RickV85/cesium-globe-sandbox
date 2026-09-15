import { ROCKIES_BBOX } from '@/constants';
import type { Flash } from '@/lib/types';

/*
 * GLM L2 LCFA variables -> Flash[], without touching HDF5.
 *
 * Reading the file lives in readGlmFile.ts (h5wasm). This module only applies
 * the CF packing rules to plain arrays, so it runs under Jest with no wasm.
 *
 * The packed variables are int16 on disk and carry three attributes that all
 * have to be honoured -- raw HDF5 readers apply none of them:
 *
 *   _Unsigned = "true"         read the bits as uint16. Skipping this puts over
 *                              half the flash times 65536 * scale_factor =
 *                              25.000385 s early (see README).
 *   scale_factor / add_offset  value = raw * scale + offset.
 *   _FillValue                 "missing", compared against the packed value.
 *
 * Flash times are an offset from an epoch that each file writes into the
 * variable's `units` attribute ("seconds since 2026-09-14 20:59:40.000").
 */

export const GLM_VARIABLES = [
  'flash_id',
  'flash_time_offset_of_first_event',
  'flash_lat',
  'flash_lon',
  'flash_energy',
  'flash_area',
  'flash_quality_flag',
] as const;

type GlmVariableName = (typeof GLM_VARIABLES)[number];
export type RawVariable = { data: ArrayLike<number>; attrs: Record<string, unknown> };
export type RawGlmFile = Record<GlmVariableName, RawVariable>;
export type Bbox = { west: number; south: number; east: number; north: number };

const M2_PER_KM2 = 1_000_000;

/** h5wasm returns numeric attributes as one-element typed arrays. */
const firstValue = (attr: unknown) => (attr as ArrayLike<number> | undefined)?.[0];

/** Returns a reader for element `i` of a packed variable, or null when it is the fill value. */
export function makeUnpacker({ data, attrs }: RawVariable): (i: number) => number | null {
  const unsigned = attrs._Unsigned === 'true';
  const scale = firstValue(attrs.scale_factor) ?? 1;
  const offset = firstValue(attrs.add_offset) ?? 0;
  const fill = firstValue(attrs._FillValue);

  return (i) => {
    const raw = data[i];
    if (raw === fill) return null;
    // Every packed GLM variable is int16, so unsigned means negative bits wrap by 2^16.
    return (unsigned && raw < 0 ? raw + 65536 : raw) * scale + offset;
  };
}

const UNITS_RE = /^seconds since (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/;

/**
 * "seconds since 2026-09-14 20:59:40.000" -> epoch microseconds. Files start
 * on whole seconds, so the fractional part is always .000 and is ignored.
 */
export function parseEpochMicros(units: unknown): number {
  const match = UNITS_RE.exec(String(units));
  if (!match) throw new Error(`Unrecognised GLM time units: ${String(units)}`);
  return Date.parse(`${match[1]}T${match[2]}Z`) * 1000;
}

/**
 * Epoch microseconds -> "YYYY-MM-DDTHH:MM:SS.ffffffZ".
 *
 * Built by hand because Date holds milliseconds. Keeping microseconds gives
 * live flashes the same timestamp format replay gets from src/lib/flashes.ts.
 */
export function formatIsoMicros(totalMicros: number): string {
  const micros = totalMicros % 1e6;
  const seconds = (totalMicros - micros) / 1e6;
  return `${new Date(seconds * 1000).toISOString().slice(0, 19)}.${String(micros).padStart(6, '0')}Z`;
}

export function decodeGlm(raw: RawGlmFile, bbox: Bbox = ROCKIES_BBOX): Flash[] {
  const epochMicros = parseEpochMicros(raw.flash_time_offset_of_first_event.attrs.units);

  const id = makeUnpacker(raw.flash_id);
  const time = makeUnpacker(raw.flash_time_offset_of_first_event);
  const energy = makeUnpacker(raw.flash_energy);
  const area = makeUnpacker(raw.flash_area);
  const quality = makeUnpacker(raw.flash_quality_flag);

  const flashes: Flash[] = [];
  for (let i = 0; i < raw.flash_lat.data.length; i++) {
    // lat/lon are plain float32 -- no packing to undo.
    const lat = raw.flash_lat.data[i];
    const lon = raw.flash_lon.data[i];
    // Inclusive on every edge, matching the ingest's within_bbox().
    if (lat < bbox.south || lat > bbox.north || lon < bbox.west || lon > bbox.east) continue;

    const areaM2 = area(i);
    flashes.push({
      // flash_time_offset_of_first_event and flash_id declare no _FillValue, so they are never null.
      flash_time: formatIsoMicros(epochMicros + Math.round(time(i)! * 1e6)),
      lat,
      lon,
      energy_j: energy(i),
      area_km2: areaM2 === null ? null : areaM2 / M2_PER_KM2,
      quality_flag: quality(i),
      flash_id: id(i)!,
    });
  }
  return flashes;
}
