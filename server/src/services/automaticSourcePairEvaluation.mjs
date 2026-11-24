/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createAutomaticEvaluationWorker } from './automaticEvaluationWorker.mjs';
import { runAutomaticSourcePairThread } from './automaticSourcePairThreadClient.mjs';
import { createProgressingSourcePairEvaluation } from './sourcePairWindowProgression.mjs';
import { bindSourcePairFailureStage } from './automaticSourcePairTaskFailure.mjs';
import { isEvidenceBudgetError } from './evaluationEvidenceBudget.mjs';

export const AUTOMATIC_SOURCE_PAIR_LOCK = 0x41535045;
const discoveryDeferrals = ['busy', 'memory_pressure', 'memory_unknown'];
const deferredCodes = [...discoveryDeferrals, 'disabled', 'unsupported_provider', 'representation_unavailable'];
function failureCode(error) {
  if (isEvidenceBudgetError(error)) return 'evidence_budget';
  try {
    const message = error?.message;
    if (message === 'inventory_discovery_deferred') {
      const reason = error.reason;
      return discoveryDeferrals.includes(reason) ? reason : 'evaluation_unavailable';
    }
    if (deferredCodes.includes(message)) return message;
    if (error?.name === 'TimeoutError' || message === 'automatic_source_pair_deadline') return 'deadline';
  } catch { /* Foreign error properties are not required for failure recording. */ }
  return 'evaluation_unavailable';
}

export function createAutomaticSourcePairEvaluation({ repository, withSessionAdvisoryLock, withAdmission,
  evaluate = runAutomaticSourcePairThread, now = Date.now }) {
  return createAutomaticEvaluationWorker({ repository, withSessionAdvisoryLock, now,
    runEvaluation: createProgressingSourcePairEvaluation({ repository, evaluate }),
    lock: AUTOMATIC_SOURCE_PAIR_LOCK, failureCode, deferredCodes, observeFailure: bindSourcePairFailureStage,
    withEvaluation: (callback, signal) => withAdmission(callback,
      { signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]) }),
  });
}
