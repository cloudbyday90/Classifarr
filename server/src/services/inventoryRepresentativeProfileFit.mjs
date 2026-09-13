/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Worker } from 'node:worker_threads';
import { REPRESENTATIVE_PROFILE_COMPONENT_LIMIT } from './inventoryRepresentativeProfile.mjs';

/** Fixed code only; no database, provider config, titles or plaintext in the worker. */
export async function fitInventoryRepresentativeProfile(snapshot, dimensions, { signal } = {}) {
  signal?.throwIfAborted();
  if (!Number.isSafeInteger(dimensions) || dimensions < 1 || dimensions > 16000 ||
      snapshot.libraries.length > 64 || snapshot.corpus.documents.length > 50000 ||
      snapshot.corpus.texts.size > 10000 || snapshot.corpus.texts.size * dimensions > REPRESENTATIVE_PROFILE_COMPONENT_LIMIT ||
      snapshot.vectors.size !== snapshot.corpus.texts.size) throw new Error('inventory_representative_fit_input_budget');
  const worker = new Worker(new URL('./inventoryRepresentativeProfileThread.mjs', import.meta.url), {
    workerData: { dimensions, snapshot: {
      libraries: snapshot.libraries.map(({ id, media_type }) => ({ id, media_type })),
      corpus: { documents: snapshot.corpus.documents.map(({ type, hash, libraryIds }) => ({ type, hash, libraryIds })),
        texts: new Map([...snapshot.corpus.texts.keys()].map(hash => [hash, null])) },
      vectors: snapshot.vectors,
    } },
    env: {}, execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 512, maxYoungGenerationSizeMb: 32 },
  });
  let abort;
  try {
    return await new Promise((resolve, reject) => {
      const fail = () => reject(new Error('inventory_representative_fit_unavailable'));
      abort = () => reject(new Error('inventory_representative_fit_cancelled'));
      worker.once('message', message => message?.model ? resolve(message.model) : fail());
      worker.once('error', fail);
      worker.once('exit', fail);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    });
  } finally {
    signal?.removeEventListener('abort', abort);
    await worker.terminate();
  }
}
