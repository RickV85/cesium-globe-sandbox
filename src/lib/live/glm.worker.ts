import h5wasm from 'h5wasm';
import type { Flash } from '@/lib/types';
import { decodeGlm } from './decodeGlm';
import { fileUrl } from './glmS3';
import { readGlmFile } from './readGlmFile';

/*
 * Fetches and decodes one GLM file off the main thread. The feed sends one key
 * at a time and waits for the reply, so messages need no ids.
 */

export type GlmWorkerResponse = { flashes: Flash[] } | { error: string };

/** One file at a time, so one fixed path in h5wasm's in-memory filesystem is enough. */
const PATH = '/glm.nc';

function reply(message: GlmWorkerResponse) {
  self.postMessage(message);
}

self.onmessage = async ({ data: key }: MessageEvent<string>) => {
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
      reply({ flashes: decodeGlm(readGlmFile(file)) });
    } finally {
      file.close();
      FS.unlink(PATH);
    }
  } catch (cause) {
    reply({ error: cause instanceof Error ? cause.message : String(cause) });
  }
};
