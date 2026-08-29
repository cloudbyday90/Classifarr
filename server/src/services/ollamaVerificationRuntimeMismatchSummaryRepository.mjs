/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const OLLAMA_PROVIDER_ID = 'ollama';
const VERIFICATION_AUTHORITY_MODE = 'verification';

/**
 * Reads a cross-model aggregate without returning any model identity or
 * individual observation. BIGINT is returned as text to preserve its exact
 * value across the JavaScript boundary.
 */
export async function loadOllamaVerificationRuntimeMismatchSummary(database) {
  const result = await database.query(`
    SELECT
      COALESCE(SUM(model_digest_mismatch_count), 0)::text AS model_digest_mismatch_count,
      MAX(last_model_digest_mismatch_at) AS last_model_digest_mismatch_at
    FROM ai_provider_capability_metrics
    WHERE provider_id = $1
      AND authority_mode = $2
  `, [OLLAMA_PROVIDER_ID, VERIFICATION_AUTHORITY_MODE]);

  return result.rows?.[0] || null;
}
