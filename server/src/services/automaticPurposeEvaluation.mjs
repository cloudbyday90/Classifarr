/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createAutomaticEvaluationWorker } from './automaticEvaluationWorker.mjs';
import { createInventoryDiscoveryAdmission } from './inventoryDiscoveryAdmission.mjs';
import { createPurposeEvaluationRepository } from './purposeEvaluationRepository.mjs';
import { runPurposeEvaluationThread } from './purposeEvaluationThreadClient.mjs';
import { PURPOSE_EVALUATION_DEFERRALS } from './purposeEvaluationContract.mjs';

export const PURPOSE_EVALUATION_LOCK = 0x50555245;
const budgetErrors = new Set(['purpose_evaluation_input_budget', 'purpose_cohort_input_budget']);
export function purposeEvaluationFailure(error) {
  if (PURPOSE_EVALUATION_DEFERRALS.includes(error?.reason)) return error.reason;
  if (error?.message === 'purpose_evaluation_busy') return 'busy';
  if (error?.message === 'purpose_evaluation_sources_unavailable' || ['42P01', '42703'].includes(error?.code)) return 'sources_unavailable';
  if (budgetErrors.has(error?.message)) return 'evidence_budget';
  if (error?.code === '57014' || error?.name === 'AbortError' || error?.message === 'purpose_evaluation_deadline') return 'deadline';
  if (/^(authorized_evaluation_invalid_|purpose_cohort_|purpose_cases_|purpose_evaluation_invalid_)/.test(error?.message ?? '')) return 'invalid_evidence';
  return 'evaluation_unavailable';
}

export function createAutomaticPurposeEvaluation(database, {
  repository = createPurposeEvaluationRepository(database), withAdmission = createInventoryDiscoveryAdmission(database),
  runThread = runPurposeEvaluationThread, now = Date.now,
} = {}) {
  return createAutomaticEvaluationWorker({ repository, withSessionAdvisoryLock: database.withSessionAdvisoryLock,
    lock: PURPOSE_EVALUATION_LOCK, now, failureCode: purposeEvaluationFailure, deferredCodes: PURPOSE_EVALUATION_DEFERRALS,
    withEvaluation: (callback, signal) => withAdmission(async admitted => {
      await repository.assertIdle(admitted);
      return callback(admitted);
    }, { signal }),
    runEvaluation: runThread,
  });
}
