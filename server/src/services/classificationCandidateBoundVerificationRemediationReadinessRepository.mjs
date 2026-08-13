/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Reads only the configuration fields required to model current verification
 * admission. Credentials, endpoint URLs, provider names, and model names must
 * not cross the remediation-readiness boundary.
 */
export async function loadCandidateBoundVerificationProviderConfiguration(database) {
  const result = await database.query(`
    SELECT
      primary_provider,
      model,
      ollama_fallback_enabled,
      ollama_for_budget_exhausted,
      monthly_budget_usd,
      current_month_usage_usd,
      pause_on_budget_exhausted
    FROM ai_provider_config
    WHERE id = 1
  `);

  return result.rows?.[0] || null;
}

/**
 * Reduces active policy configuration to anonymous readiness counts. The
 * query deliberately returns neither policy nor library identities, profile
 * evidence, classifications, or routing destinations.
 */
export async function loadCandidateBoundVerificationPolicyReadiness(database) {
  const result = await database.query(`
    WITH active_policies AS (
      SELECT lp.id AS policy_id, lp.library_id
      FROM library_policies lp
      JOIN libraries library ON library.id = lp.library_id
      WHERE lp.enabled = TRUE
        AND library.is_active = TRUE
    ),
    active_intents AS (
      SELECT
        policy_id,
        COUNT(*)::integer AS active_intent_count,
        MAX(id) AS active_intent_id
      FROM policy_intents
      WHERE active = TRUE
      GROUP BY policy_id
    ),
    purpose_rules AS (
      SELECT intent_id, COUNT(*)::integer AS purpose_rule_count
      FROM policy_intent_rules
      WHERE intent_role = 'purpose'
      GROUP BY intent_id
    ),
    readiness AS (
      SELECT CASE
        WHEN COALESCE(active_intents.active_intent_count, 0) <> 1
          OR COALESCE(purpose_rules.purpose_rule_count, 0) < 1
          THEN 'native_intent_unavailable'
        WHEN NOT EXISTS (
          SELECT 1
          FROM library_arr_mappings mapping
          WHERE mapping.library_id = active_policies.library_id
            AND mapping.arr_config_id IS NOT NULL
            AND NULLIF(BTRIM(mapping.arr_type), '') IS NOT NULL
            AND NULLIF(BTRIM(mapping.arr_root_folder_path), '') IS NOT NULL
        ) THEN 'routing_unavailable'
        ELSE 'ready'
      END AS status_id
      FROM active_policies
      LEFT JOIN active_intents ON active_intents.policy_id = active_policies.policy_id
      LEFT JOIN purpose_rules ON purpose_rules.intent_id = active_intents.active_intent_id
    )
    SELECT status_id, COUNT(*)::integer AS policy_count
    FROM readiness
    GROUP BY status_id
    ORDER BY status_id ASC
  `);

  return result.rows || [];
}
