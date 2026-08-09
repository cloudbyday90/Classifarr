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
  buildPolicyOperatorDecisionMetric,
} from './policyOperatorDecisionMetric.mjs';

const POLICY_OPERATOR_DECISION_METRIC_QUERY = `
  SELECT
    COUNT(*) AS "classifiedOutcomeCount",
    COUNT(*) FILTER (WHERE status = 'awaiting_decision') AS "openOperatorReviewCount",
    COUNT(*) FILTER (WHERE status = 'pending_retry') AS "pendingRetryCount",
    COUNT(*) FILTER (WHERE status = 'routed') AS "automaticallyRoutedCount",
    COUNT(*) FILTER (
      WHERE method IN ('policy_auto', 'policy_engine')
        AND status IN ('completed', 'routed', 'verified')
    ) AS "policyAutomaticOutcomeCount"
  FROM classification_history
  WHERE created_at >= $1
    AND created_at < $2
`;

async function collectPolicyOperatorDecisionMetric({
  db,
  measurementScopeId,
  windowStartedAt,
  windowEndedAt,
  generatedAt = null,
} = {}) {
  if (!db || typeof db.query !== 'function') {
    throw new Error('Operator-decision metric collection requires a database query function.');
  }

  const result = await db.query(POLICY_OPERATOR_DECISION_METRIC_QUERY, [
    windowStartedAt,
    windowEndedAt,
  ]);

  return buildPolicyOperatorDecisionMetric({
    measurementScopeId,
    windowStartedAt,
    windowEndedAt,
    counts: result.rows?.[0] || {},
    generatedAt,
  });
}

export {
  POLICY_OPERATOR_DECISION_METRIC_QUERY,
  collectPolicyOperatorDecisionMetric,
};
