/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Worker } from 'node:worker_threads';
import { serialize } from 'node:v8';
import { validQualityProtocol } from './sourcePairQualityContract.mjs';
import { validSourcePairQualityReport } from './sourcePairQualityReport.mjs';
import { createAutomaticSourcePairRepository } from './automaticSourcePairRepository.mjs';
import { createInventoryDiscoveryAdmission } from './inventoryDiscoveryAdmission.mjs';
import { LOG_CONFIG } from '../utils/logging/logConfig.mjs';

/** Reuse the offline role's environment/database prohibition, with a fixed quality-only entrypoint. */
export async function runSourcePairQualityThread(snapshot, protocol = null, reference = null,
  { signal, WorkerClass = Worker, timeoutMs = 120000 } = {}) {
  signal?.throwIfAborted();
  const workerData = { role: 'automatic-source-pair', snapshot, protocol, reference };
  if (serialize(workerData).byteLength > 64 * 1024 * 1024) throw new Error('quality_input_budget');
  const worker = new WorkerClass(new URL('./sourcePairQualityThread.mjs', import.meta.url), {
    workerData, env: { LOG_LEVEL: 'fatal', FILE_LOGGING_ENABLED: 'false' }, execArgv: [], stdout: true, stderr: true,
    resourceLimits: { maxOldGenerationSizeMb: 512, maxYoungGenerationSizeMb: 32 },
  });
  worker.stdout?.resume(); worker.stderr?.resume();
  let abort, timer;
  try {
    return await new Promise((resolve, reject) => {
      const fail = () => reject(new Error('quality_worker_unavailable'));
      abort = () => reject(new Error('quality_cancelled'));
      timer = setTimeout(() => reject(new Error('quality_deadline')), timeoutMs);
      worker.once('message', message => {
        const result = message?.result;
        if (!(protocol === null ? validQualityProtocol(result) : validSourcePairQualityReport(result) && result.protocolId === protocol.id)) return fail();
        resolve(result);
      });
      worker.once('error', fail); worker.once('exit', fail);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    });
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort); await worker.terminate();
  }
}

export async function runSourcePairQualityRuntime({ protocol = null, reference = null } = {},
  { signal, logging = LOG_CONFIG, loadDatabase = () => import('../config/database.mjs'), runThread = runSourcePairQualityThread } = {}) {
  if (logging.level !== 'fatal' || logging.fileLoggingEnabled !== false ||
      !process.env.PGOPTIONS?.includes('default_transaction_read_only=on')) throw new Error('quality_private_runtime_required');
  const database = await loadDatabase();
  try {
    const withAdmission = createInventoryDiscoveryAdmission(database);
    return await withAdmission(async abort => {
      // Deliberately never use readState: that maintenance path prunes retained rows.
      const snapshot = await createAutomaticSourcePairRepository(database).readSnapshot(abort);
      return runThread(snapshot, protocol, reference, { signal: abort });
    }, { signal: AbortSignal.any([AbortSignal.timeout(180000), ...[signal].filter(Boolean)]) });
  } finally { await database.pool.end(); }
}
