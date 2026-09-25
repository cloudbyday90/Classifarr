/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Worker } from 'node:worker_threads';
import { serialize } from 'node:v8';
import { readAutomaticSourcePairReport } from './automaticSourcePairReport.mjs';
import { validSourcePairCohort } from './automaticSourcePairCohort.mjs';

/** Fixed-code worker, no provider credentials or inherited preloads, always joined before unlock. */
export async function runAutomaticSourcePairThread(snapshot, state, signal, { WorkerClass = Worker, timeoutMs = 120000 } = {}) {
  signal?.throwIfAborted();
  const workerData = { snapshot, state, role: 'automatic-source-pair' };
  if (serialize(workerData).byteLength > 64 * 1024 * 1024) throw new Error('automatic_source_pair_input_budget');
  const worker = new WorkerClass(new URL('./automaticSourcePairThread.mjs', import.meta.url), {
    workerData, env: { LOG_LEVEL: 'fatal', FILE_LOGGING_ENABLED: 'false' }, execArgv: [], stdout: true, stderr: true,
    resourceLimits: { maxOldGenerationSizeMb: 512, maxYoungGenerationSizeMb: 32 },
  });
  worker.stdout?.resume(); worker.stderr?.resume();
  let abort, timer;
  try {
    return await new Promise((resolve, reject) => {
      const fail = () => reject(new Error('automatic_source_pair_worker_unavailable'));
      abort = () => reject(new Error('automatic_source_pair_cancelled'));
      timer = setTimeout(() => reject(new Error('automatic_source_pair_deadline')), timeoutMs);
      worker.once('message', message => {
        const result = message?.result;
        if (!result || !readAutomaticSourcePairReport(result.report) || !validSourcePairCohort(result.cohort) ||
          (snapshot.inputs?.source?.policies && result.report.version !== 'automatic_source_pair.v2') ||
          !/^[a-f0-9]{64}$/.test(result.fingerprint) || typeof result.unchanged !== 'boolean') return fail();
        resolve(result);
      });
      worker.once('error', fail); worker.once('exit', fail);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    });
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
    await worker.terminate();
  }
}
