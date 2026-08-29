/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

/**
 * Reads only non-secret configuration needed to merge a partial provider-save
 * proposal. API keys, endpoints, budgets, and usage values must not cross the
 * configuration-preflight boundary.
 */
export async function loadCandidateBoundVerificationProviderPreflightConfiguration(database) {
  const result = await database.query(`
    SELECT
      primary_provider,
      model,
      ollama_fallback_enabled,
      ollama_for_budget_exhausted,
      ollama_model,
      ollama_host,
      ollama_port,
      configuration_revision,
      ollama_verification_capability_status,
      ollama_verification_capability_fingerprint,
      ollama_verification_capability_configuration_revision,
      ollama_verification_capability_model_digest,
      ollama_verification_capability_checked_at,
      ollama_verification_capability_error_code
    FROM ai_provider_config
    WHERE id = 1
  `);

  return result.rows?.[0] || null;
}
