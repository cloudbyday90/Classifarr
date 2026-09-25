/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { evaluateDestinationOutcomes } from './destinationOutcomeEvaluation.mjs';
import { readAutomaticDestinationEvaluationReport } from './automaticDestinationEvaluationReport.mjs';
import { createAutomaticEvaluationWorker } from './automaticEvaluationWorker.mjs';

export const AUTOMATIC_DESTINATION_EVALUATION_LOCK = 0x41444556;
const REVISION = 'automatic_destination_evaluation.v1:destination_outcomes.v2';
function failureCode(error) {
  if (['saved_decisions_row_budget', 'saved_decisions_intake_budget'].includes(error?.message)) return 'evidence_budget';
  return error?.message === 'saved_decisions_feedback_invalid' ? 'invalid_feedback' : 'evaluation_unavailable';
}

export function createAutomaticDestinationEvaluation({ repository, withSessionAdvisoryLock,
  evaluate = evaluateDestinationOutcomes, now = Date.now }) {
  return createAutomaticEvaluationWorker({ repository, withSessionAdvisoryLock, now,
    lock: AUTOMATIC_DESTINATION_EVALUATION_LOCK, failureCode,
    runEvaluation(snapshot, state) {
      // Preserve even malformed JSON keys (including __proto__) in change detection.
      const canonical = JSON.stringify({ revision: REVISION, ...snapshot.inputs }, (_key, value) => {
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('automatic_evaluation_invalid_input');
        return value && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value;
      });
      const fingerprint = createHash('sha256').update(canonical).digest('hex');
      const unchanged = state?.status === 'complete' && state.input_fingerprint === fingerprint &&
        readAutomaticDestinationEvaluationReport(state.report) !== null;
      const report = unchanged ? state.report : evaluate(snapshot.inputs.rows, snapshot.inputs.intake);
      return { fingerprint, report, unchanged };
    },
  });
}
