/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { EVALUATION_FAILURE_STAGE } from './automaticEvaluationFailureStage.mjs';

const stages = new Set(Object.values(EVALUATION_FAILURE_STAGE));
const resultFailures = new WeakMap();
const taskFailures = new WeakMap();

export function bindSourcePairFailureStage(result, { stage, originStage }) {
  if (!stages.has(stage)) return;
  const failure = { stage };
  if (stage === EVALUATION_FAILURE_STAGE.FAILURE_RECORD && stages.has(originStage)) failure.originStage = originStage;
  resultFailures.set(result, Object.freeze(failure));
}

export function createSourcePairTaskError(result) {
  let reportedReason;
  try { reportedReason = result?.reason; } catch { /* Only the fixed fallback is safe. */ }
  const reason = ['evidence_budget', 'deadline'].includes(reportedReason) ? reportedReason : 'evaluation_unavailable';
  const error = new Error(`automatic_source_pair_evaluation_unavailable:${reason}`);
  const failure = resultFailures.get(result);
  if (failure) taskFailures.set(error, Object.freeze({ failure }));
  return error;
}

export function readSourcePairTaskFailure(error) {
  return taskFailures.get(error) ?? null;
}
