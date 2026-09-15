import h5wasm from 'h5wasm';
import type { Flash } from '@/lib/types';
import { decodeGlm } from './decodeGlm';
import { fileUrl } from './glmS3';
import { readGlmFile } from './readGlmFile';

/*
 * Fetches and decodes one GLM file off the main thread. The feed sends one key
 * at a time and waits for the reply, but tags each request with an id and
 * ignores replies that do not match: a decode can be abandoned before its
 * answer arrives, and the answer must not be mistaken for the next one's.
 */

export type GlmWorkerRequest = { id: number; key: string };
export type GlmWorkerResponse = { id: number } & ({ flashes: Flash[] } | { error: string });

/** One file at a time, so one fixed path in h5wasm's in-memory filesystem is enough. */
const PATH = '/glm.nc';

function reply(message: GlmWorkerResponse) {
  self.postMessage(message);
}

self.onmessage = async ({ data: { id, key } }: MessageEvent<GlmWorkerRequest>) => {
  try {
    const response = await fetch(fileUrl(key));
    if (!response.ok) throw new Error(`download returned ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());

    // h5wasm reads through Emscripten's in-memory filesystem, so each file is
    // written in, decoded, and unlinked again -- nothing accumulates.
    const { FS } = await h5wasm.ready;
    FS.writeFile(PATH, bytes);
    const file = new h5wasm.File(PATH, 'r');
    try {
      reply({ id, flashes: decodeGlm(readGlmFile(file)) });
    } finally {
      file.close();
      FS.unlink(PATH);
    }
  } catch (cause) {
    reply({ id, error: cause instanceof Error ? cause.message : String(cause) });
  }
};
