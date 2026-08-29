/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  isOllamaVerificationCapabilityOutcomeStatusId,
} from './ollamaVerificationCapabilityOutcomeHistory.mjs';

function assertQueryDatabase(database, operation) {
  if (!database || typeof database.query !== 'function') {
    throw new TypeError(`Ollama verification outcome history ${operation} requires a query-capable database.`);
  }
}

/**
 * Stores one fixed daily counter and prunes rows outside the fixed 30-day
 * window. The database supplies both dates, so neither callers nor browsers
 * can select a reporting dimension or timestamp.
 */
export async function recordOllamaVerificationCapabilityOutcomeHistory(database, statusId) {
  assertQueryDatabase(database, 'recording');
  if (!isOllamaVerificationCapabilityOutcomeStatusId(statusId)) {
    throw new TypeError('Ollama verification outcome history status is invalid.');
  }

  await database.query(`
    WITH pruned AS (
      DELETE FROM ollama_verification_capability_test_outcomes
      WHERE observed_on < CURRENT_DATE - 29
    ), recorded AS (
      INSERT INTO ollama_verification_capability_test_outcomes (
        observed_on,
        status_id,
        outcome_count,
        last_observed_at
      )
      VALUES (CURRENT_DATE, $1, 1, NOW())
      ON CONFLICT (observed_on, status_id)
      DO UPDATE SET
        outcome_count = ollama_verification_capability_test_outcomes.outcome_count + 1,
        last_observed_at = NOW()
      RETURNING observed_on
    )
    SELECT observed_on FROM recorded
  `, [statusId]);
}

/**
 * Reads the fixed aggregate only. This intentionally selects neither a
 * per-test row nor any provider, model, endpoint, prompt, response, error,
 * media, actor, or configuration data.
 */
export async function loadOllamaVerificationCapabilityOutcomeHistory(database) {
  assertQueryDatabase(database, 'reading');

  const result = await database.query(`
    SELECT
      status_id,
      COALESCE(SUM(outcome_count), 0)::text AS outcome_count,
      MAX(last_observed_at) AS last_observed_at
    FROM ollama_verification_capability_test_outcomes
    WHERE observed_on >= CURRENT_DATE - 29
    GROUP BY status_id
  `);

  return result.rows || [];
}
