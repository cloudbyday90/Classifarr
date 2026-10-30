/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Worker } from 'node:worker_threads';
import { serialize } from 'node:v8';
import { PURPOSE_EVALUATION_MAX_REPORT_BYTES, purposeExact, readPurposeEvaluationReport } from './purposeEvaluationContract.mjs';

/** Fixed code, bounded transport/heap/deadline, joined before releasing admission or ownership. */
export async function runPurposeEvaluationThread(snapshot, state, signal, { WorkerClass = Worker, timeoutMs = 60000 } = {}) {
  signal?.throwIfAborted();
  const workerData = { role: 'purpose-evaluation', inputs: snapshot.inputs,
    state: state ? { input_fingerprint: state.input_fingerprint, report: state.report } : null };
  if (serialize(workerData).byteLength > 67108864) throw new Error('purpose_evaluation_input_budget');
  const worker = new WorkerClass(new URL('./purposeEvaluationThread.mjs', import.meta.url), { workerData,
    env: { LOG_LEVEL: 'fatal', FILE_LOGGING_ENABLED: 'false' }, execArgv: [], stdout: true, stderr: true,
    resourceLimits: { maxOldGenerationSizeMb: 512, maxYoungGenerationSizeMb: 32 } });
  worker.stdout?.resume(); worker.stderr?.resume();
  let abort, timer;
  try {
    return await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => { if (!settled) { settled = true; callback(value); } };
      const fail = () => finish(reject, new Error('purpose_evaluation_thread_unavailable'));
      abort = () => finish(reject, new Error('purpose_evaluation_cancelled'));
      timer = setTimeout(() => finish(reject, new Error('purpose_evaluation_deadline')), timeoutMs);
      worker.on('message', result => {
        if (settled) return;
        if (purposeExact(result, ['failure']) && ['evidence_budget', 'invalid_evidence', 'evaluation_unavailable'].includes(result.failure)) {
          const message = result.failure === 'evidence_budget' ? 'purpose_evaluation_input_budget'
            : result.failure === 'invalid_evidence' ? 'purpose_evaluation_invalid_report' : 'purpose_evaluation_thread_unavailable';
          return finish(reject, new Error(message));
        }
        if (!purposeExact(result, ['fingerprint', 'report', 'unchanged']) || !/^[a-f0-9]{64}$/.test(result.fingerprint) ||
            typeof result.unchanged !== 'boolean' || !readPurposeEvaluationReport(result.report) ||
            result.report.window.until !== snapshot.observedAt || Buffer.byteLength(JSON.stringify(result.report)) > PURPOSE_EVALUATION_MAX_REPORT_BYTES) return fail();
        finish(resolve, result);
      });
      worker.once('error', fail); worker.once('messageerror', fail); worker.once('exit', fail);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    });
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); await worker.terminate(); }
}
