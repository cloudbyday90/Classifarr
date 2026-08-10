/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_RUNTIME_QUESTION_DECISION_STATUS_IDS,
} from './policyRuntimeQuestionDecisionPresentation.mjs';
import {
  buildPolicyRuntimeQuestionAnswerContract,
} from './policyRuntimeQuestionAnswerContract.mjs';

export const POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_REASON_ID =
  'historical_route_safety_details_unavailable';
export const POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_NOT_REQUIRED_REASON_ID =
  'historic_route_safety_refresh_not_required';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parsePersistedObject(value) {
  if (typeof value !== 'string') return asObject(value);

  try {
    return asObject(JSON.parse(value));
  } catch {
    return {};
  }
}

/**
 * Re-evaluates the persisted pending-question projection against the currently
 * locked classification row. It intentionally grants no authority beyond
 * recognizing the one historic condition that requires a current retry.
 */
export function evaluateHistoricRouteSafetyRefreshEligibility(classification = {}) {
  const source = asObject(classification);
  const question = parsePersistedObject(source.policy_question);
  const answerContract = buildPolicyRuntimeQuestionAnswerContract({
    classification: {
      id: source.id,
      title: source.title,
      year: source.year,
      media_type: source.media_type,
      status: source.status,
      confidence: source.confidence,
      method: source.method,
      metadata: parsePersistedObject(source.metadata),
    },
    question,
  });
  const decisionStatusId = answerContract?.decision_summary?.deterministic?.status_id || null;
  const eligible = decisionStatusId ===
    POLICY_RUNTIME_QUESTION_DECISION_STATUS_IDS.HISTORICAL_ROUTE_SAFETY_DETAILS_UNAVAILABLE;

  return Object.freeze({
    eligible,
    reasonId: eligible
      ? POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_REASON_ID
      : POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_NOT_REQUIRED_REASON_ID,
    candidateItem: answerContract?.candidate_item || null,
  });
}
