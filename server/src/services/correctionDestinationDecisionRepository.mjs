/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CORRECTION_DECISION_ROW_LIMIT, evaluateCorrectionDestinationDecisions } from './correctionDestinationDecisionEvaluation.mjs';
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

export async function readCorrectionDestinationDecisions(client) {
  const { rows } = await client.query(CORRECTION_DESTINATION_DECISION_SQL, [CORRECTION_DECISION_ROW_LIMIT + 1]);
  return evaluateCorrectionDestinationDecisions(rows);
}

/** Private CLI only. The runtime flags must be set before loading the database module. */
export async function runCorrectionDestinationDecisionEvaluation({ logging = LOG_CONFIG,
  loadDatabase = () => import('../config/database.mjs') } = {}) {
  if (logging.level !== 'fatal' || logging.fileLoggingEnabled !== false ||
      !process.env.PGOPTIONS?.includes('default_transaction_read_only=on')) throw new Error('saved_decisions_private_runtime_required');
  const { pool } = await loadDatabase();
  try {
    return await runDatabaseTransaction(await pool.connect(), async client => {
      await client.query("SET LOCAL statement_timeout = '15s'");
      await client.query("SET LOCAL lock_timeout = '1s'");
      return readCorrectionDestinationDecisions(client);
    }, { readOnlyRepeatable: true });
  }
  finally { await pool.end(); }
}
