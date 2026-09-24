/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { DESTINATION_OUTCOME_ROW_LIMIT } from './destinationOutcomeGrouping.mjs';
import { evaluateDestinationOutcomes } from './destinationOutcomeEvaluation.mjs';
import { readFeedbackOutcomeSnapshot } from './feedbackOutcomeSnapshot.mjs';
import { runDatabaseTransaction } from '../utils/databaseTransaction.mjs';
import { LOG_CONFIG } from '../utils/logging/logConfig.mjs';

export const CORRECTION_DESTINATION_DECISION_SQL = `
  SELECT c.media_type, c.identity_key, c.selected_library_id,
    CASE WHEN octet_length(c.decision_context::text) <= 1024 THEN c.decision_context END AS decision_context,
    (l.is_active IS TRUE AND l.media_type = c.media_type) AS target_available
  FROM classification_correction_outcomes c
  LEFT JOIN libraries l ON l.id = c.selected_library_id
  WHERE c.observed_at > NOW() - INTERVAL '30 days' AND c.observed_at <= NOW()
  ORDER BY c.observed_at, c.correction_id LIMIT $1`;

export const FEEDBACK_DESTINATION_OUTCOME_SQL = `
  SELECT receipt.classification_id, receipt.outcome_snapshot,
    (destination.is_active IS TRUE AND destination.media_type = receipt.outcome_snapshot->>'mediaType') AS target_available
  FROM policy_feedback_sources receipt
  LEFT JOIN libraries destination ON destination.id::text = receipt.outcome_snapshot->>'selectedLibraryId'
  WHERE receipt.outcome_snapshot IS NOT NULL AND receipt.created_at > NOW() - INTERVAL '30 days'
    AND receipt.created_at <= NOW()
  ORDER BY receipt.created_at, receipt.classification_id LIMIT $1`;

export const DESTINATION_INTAKE_COVERAGE_SQL = `
  SELECT classification_id, status_id, decision_context FROM classification_intake_receipts
  WHERE queued_at > NOW() - INTERVAL '30 days' AND queued_at <= NOW()
  ORDER BY queued_at, queue_task_id LIMIT $1`;

export async function readDestinationOutcomes(client) {
  const { rows } = await client.query(CORRECTION_DESTINATION_DECISION_SQL, [DESTINATION_OUTCOME_ROW_LIMIT + 1]);
  const feedback = (await client.query(FEEDBACK_DESTINATION_OUTCOME_SQL, [DESTINATION_OUTCOME_ROW_LIMIT + 1])).rows;
  if (rows.length + feedback.length > DESTINATION_OUTCOME_ROW_LIMIT) throw new Error('saved_decisions_row_budget');
  for (const row of feedback) {
    const snapshot = readFeedbackOutcomeSnapshot(row.outcome_snapshot);
    // A malformed receipt invalidates the report instead of silently improving its rate.
    if (!snapshot || (snapshot.decisionContext && String(snapshot.decisionContext.classificationId) !== String(row.classification_id))) {
      throw new Error('saved_decisions_feedback_invalid');
    }
    rows.push({ classification_id: row.classification_id, media_type: snapshot.mediaType, identity_key: `${snapshot.mediaType}:${snapshot.tmdbId}`,
      selected_library_id: snapshot.selectedLibraryId, decision_context: snapshot.decisionContext, target_available: row.target_available });
  }
  const intake = (await client.query(DESTINATION_INTAKE_COVERAGE_SQL, [DESTINATION_OUTCOME_ROW_LIMIT + 1])).rows;
  return evaluateDestinationOutcomes(rows, intake);
}

/** Private CLI only. The runtime flags must be set before loading the database module. */
export async function runDestinationOutcomeEvaluation({ logging = LOG_CONFIG,
  loadDatabase = () => import('../config/database.mjs') } = {}) {
  if (logging.level !== 'fatal' || logging.fileLoggingEnabled !== false ||
      !process.env.PGOPTIONS?.includes('default_transaction_read_only=on')) throw new Error('saved_decisions_private_runtime_required');
  const { pool } = await loadDatabase();
  try {
    return await runDatabaseTransaction(await pool.connect(), async client => {
      await client.query("SET LOCAL statement_timeout = '15s'");
      await client.query("SET LOCAL lock_timeout = '1s'");
      return readDestinationOutcomes(client);
    }, { readOnlyRepeatable: true });
  }
  finally { await pool.end(); }
}
