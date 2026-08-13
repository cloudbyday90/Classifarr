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
      ollama_model
    FROM ai_provider_config
    WHERE id = 1
  `);

  return result.rows?.[0] || null;
}
