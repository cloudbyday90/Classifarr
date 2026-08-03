/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

export async function tryLockNativePolicyCreateIdempotencyKey({ client, lockKey }) {
  const result = await client.query(
    'SELECT pg_try_advisory_xact_lock($1::bigint) AS acquired',
    [lockKey]
  );

  return firstRow(result)?.acquired === true;
}

export async function lockNativePolicyCreateReceipt({ client, idempotencyKey }) {
  const result = await client.query(
    `SELECT
       establishment.policy_id,
       establishment.library_id,
       establishment.intent_id,
       establishment.request_fingerprint,
       establishment.accepted_by,
       establishment.state,
       native_policy.name AS policy_name,
       COALESCE((
         SELECT COUNT(*)
         FROM policy_intent_rules rule
         WHERE rule.intent_id = establishment.intent_id
       ), 0)::integer AS rule_count,
       EXISTS(
         SELECT 1
         FROM policy_intent_routing_targets routing_target
         WHERE routing_target.intent_id = establishment.intent_id
           AND routing_target.target_status = 'configured'
       ) AS routing_configured
     FROM policy_initial_intent_establishments establishment
     JOIN library_policies native_policy ON native_policy.id = establishment.policy_id
     WHERE establishment.idempotency_key = $1
     FOR UPDATE OF establishment, native_policy`,
    [idempotencyKey]
  );

  return firstRow(result);
}

export async function insertNativeIntentPolicy({ client, policy }) {
  const result = await client.query(
    `INSERT INTO library_policies (
       library_id, name, description, enabled, priority, sort_order,
       auto_classify_threshold, prompt_threshold, require_ai_validation,
       trust_patterns, trust_rag, trust_history,
       preset_weight, profile_weight, pattern_weight, rag_weight, history_weight,
       combination_mode
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING *`,
    [
      policy.libraryId,
      policy.name,
      policy.description,
      policy.enabled,
      policy.priority,
      policy.sortOrder,
      policy.autoClassifyThreshold,
      policy.promptThreshold,
      policy.requireAiValidation,
      policy.trustPatterns,
      policy.trustRag,
      policy.trustHistory,
      policy.presetWeight,
      policy.profileWeight,
      policy.patternWeight,
      policy.ragWeight,
      policy.historyWeight,
      policy.combinationMode,
    ]
  );

  return firstRow(result);
}
