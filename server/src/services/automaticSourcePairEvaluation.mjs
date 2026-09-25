/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createAutomaticEvaluationWorker } from './automaticEvaluationWorker.mjs';
import { runAutomaticSourcePairThread } from './automaticSourcePairThreadClient.mjs';

export const AUTOMATIC_SOURCE_PAIR_LOCK = 0x41535045;
const deferredCodes = ['busy', 'memory_pressure', 'memory_unknown', 'disabled', 'unsupported_provider', 'representation_unavailable'];
function failureCode(error) {
  if (error?.message === 'inventory_discovery_deferred') return error.reason;
  if (deferredCodes.includes(error?.message)) return error.message;
  if (/budget|limit_exceeded/.test(error?.message ?? '')) return 'evidence_budget';
  if (error?.name === 'TimeoutError' || error?.message === 'automatic_source_pair_deadline') return 'deadline';
  return 'evaluation_unavailable';
}

export function createAutomaticSourcePairEvaluation({ repository, withSessionAdvisoryLock, withAdmission,
  evaluate = runAutomaticSourcePairThread, now = Date.now }) {
  return createAutomaticEvaluationWorker({ repository, withSessionAdvisoryLock, now, runEvaluation: evaluate,
    lock: AUTOMATIC_SOURCE_PAIR_LOCK, failureCode, deferredCodes,
    withEvaluation: (callback, signal) => withAdmission(callback,
      { signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]) }),
  });
}
