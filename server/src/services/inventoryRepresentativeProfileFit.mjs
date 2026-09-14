/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Worker } from 'node:worker_threads';
import { assertRepresentativeSnapshotBudget } from './inventoryRepresentativeCoverage.mjs';

/** Fixed code only; no database, provider config, titles or plaintext in the worker. */
export async function fitInventoryRepresentativeProfile(snapshot, dimensions, { signal } = {}) {
  signal?.throwIfAborted();
  assertRepresentativeSnapshotBudget(snapshot, dimensions, 'inventory_representative_fit_input_budget');
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
