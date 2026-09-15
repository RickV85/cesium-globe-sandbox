import type { Dataset, File as H5File } from 'h5wasm';
import { GLM_VARIABLES, type RawGlmFile, type RawVariable } from './decodeGlm';

/** Only these attributes affect decoding; the rest (long CF descriptions, dimension refs) are skipped. */
const PACKING_ATTRS = ['_Unsigned', 'scale_factor', 'add_offset', '_FillValue', 'units'] as const;

/**
 * Pull the flash variables and their packing attributes out of an open GLM file.
 */
export function readGlmFile(file: H5File): RawGlmFile {
  const entries = GLM_VARIABLES.map((name): [string, RawVariable] => {
    const entity = file.get(name);
    if (!entity || !('dtype' in entity)) throw new Error(`GLM file has no ${name} dataset`);
    const dataset = entity as Dataset;

    const attrs: Record<string, unknown> = {};
    for (const attrName of PACKING_ATTRS) {
      const attr = dataset.attrs[attrName];
      if (attr) attrs[attrName] = attr.value;
    }
    return [name, { data: dataset.value as ArrayLike<number>, attrs }];
  });
  return Object.fromEntries(entries) as RawGlmFile;
}
