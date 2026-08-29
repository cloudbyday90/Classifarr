/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  OLLAMA_VERIFICATION_MODEL_DIGEST_MISMATCH_CODE,
} from './ollamaVerificationCapabilityRuntimeInvalidation.mjs';

/**
 * Atomically revokes only the current saved verification result that produced
 * the mismatch. The conditional update prevents a stale worker from changing
 * a configuration saved or re-tested after its request began.
 */
export async function markOllamaVerificationCapabilityModelChanged(database, target) {
  const result = await database.query(`
    UPDATE ai_provider_config
    SET
      ollama_verification_capability_status = 'model_changed',
      ollama_verification_capability_model_digest = NULL,
      ollama_verification_capability_checked_at = NOW(),
      ollama_verification_capability_error_code = $1,
      ollama_verification_capability_latency_ms = NULL
    WHERE id = 1
      AND primary_provider = 'ollama'
      AND ollama_model = $2
      AND configuration_revision = $3
      AND ollama_verification_capability_fingerprint = $4
      AND ollama_verification_capability_configuration_revision = $3
      AND ollama_verification_capability_status = 'verification_ready'
      AND ollama_verification_capability_model_digest = $5
    RETURNING id
  `, [
    OLLAMA_VERIFICATION_MODEL_DIGEST_MISMATCH_CODE,
    target.model,
    target.configurationRevision,
    target.configurationFingerprint,
    target.expectedModelDigest,
  ]);

  return Number(result?.rowCount ?? result?.rows?.length ?? 0) > 0;
}
