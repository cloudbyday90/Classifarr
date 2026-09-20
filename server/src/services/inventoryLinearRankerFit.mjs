/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Worker } from 'node:worker_threads';
import { validateLinearTraining } from './inventoryLinearRankerMath.mjs';

/** Numeric-only worker; termination is awaited before the caller can release admission. */
export async function fitLinearRanker(input, { signal } = {}) {
  signal?.throwIfAborted();
  validateLinearTraining(input);
  const abort = AbortSignal.any([AbortSignal.timeout(300_000), ...(signal ? [signal] : [])]);
  const { matrix, labels, dimensions, classCount } = input;
  const worker = new Worker(new URL('./inventoryLinearRankerThread.mjs', import.meta.url), {
    workerData: { matrix, labels, dimensions, classCount }, env: {}, execArgv: [],
    resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 },
  });
  let cancel;
  try {
    return await new Promise((resolve, reject) => {
      const fail = () => reject(new Error('inventory_linear_fit_unavailable'));
      cancel = () => reject(new Error('inventory_linear_fit_cancelled'));
      worker.once('message', message => message?.model ? resolve(message.model) : fail());
      worker.once('error', fail); worker.once('exit', fail);
      abort.addEventListener('abort', cancel, { once: true });
      if (abort.aborted) cancel();
    });
  } finally { abort.removeEventListener('abort', cancel); await worker.terminate(); }
}
