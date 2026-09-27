/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Worker } from 'node:worker_threads';
import { serialize } from 'node:v8';
import { validQualityProtocol } from './sourcePairQualityContract.mjs';
import { validSourcePairQualityReport } from './sourcePairQualityReport.mjs';
import { validQualityEvidence } from './qualityEvidenceContract.mjs';
import { validQualityReviewPacket } from './qualityReviewPacket.mjs';
import { prepareEvaluationTransport, MAX_EVALUATION_INPUT_BYTES } from './evaluationVectorTransport.mjs';

/** Reuse the offline role's environment/database prohibition, with a fixed quality-only entrypoint. */
export async function runSourcePairQualityThread(snapshot, protocol = null, reference = null,
  { signal, WorkerClass = Worker, timeoutMs = 120000, operation = 'report' } = {}) {
  if (!['report', 'collect', 'packet'].includes(operation) || operation !== 'report' && !protocol) throw new Error('quality_operation_invalid');
  signal?.throwIfAborted();
  const transport = prepareEvaluationTransport(snapshot);
  const workerData = { role: 'automatic-source-pair', snapshot: transport.snapshot,
    vectorManifest: transport.vectorManifest, protocol, reference, operation };
  if (serialize(workerData).byteLength > MAX_EVALUATION_INPUT_BYTES) throw new Error('quality_input_budget');
  const worker = new WorkerClass(new URL('./sourcePairQualityThread.mjs', import.meta.url), {
    workerData,
    env: { LOG_LEVEL: 'fatal', FILE_LOGGING_ENABLED: 'false' }, execArgv: [], stdout: true, stderr: true,
    resourceLimits: { maxOldGenerationSizeMb: 512, maxYoungGenerationSizeMb: 32 },
  });
  worker.stdout?.resume(); worker.stderr?.resume();
  const sender = transport.createSender(worker);
  let abort, timer;
  try {
    return await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => { if (!settled) { settled = true; callback(value); } };
      const fail = () => finish(reject, new Error('quality_worker_unavailable'));
      abort = () => finish(reject, new Error('quality_cancelled'));
      timer = setTimeout(() => finish(reject, new Error('quality_deadline')), timeoutMs);
      worker.on('message', message => {
        if (settled) return;
        try { if (sender.handle(message)) return; } catch { return fail(); }
        if (!sender.complete) return fail();
        if (['quality_cohort_changed', 'quality_evidence_changed'].includes(message?.failure)) return finish(reject, new Error(message.failure));
        const result = message?.result;
        const valid = operation === 'collect' ? validQualityEvidence(result, protocol) : operation === 'packet' ? validQualityReviewPacket(result, protocol)
          : protocol === null ? validQualityProtocol(result) : validSourcePairQualityReport(result) && result.protocolId === protocol.id;
        if (!valid) return fail();
        finish(resolve, result);
      });
      worker.once('error', fail); worker.once('exit', fail); worker.once('messageerror', fail);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    });
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort); await worker.terminate();
  }
}
