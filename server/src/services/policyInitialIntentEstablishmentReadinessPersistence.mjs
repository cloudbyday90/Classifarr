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

/**
 * Returns only the storage facts needed to explain whether a policy can receive
 * its first native authority. It intentionally excludes library observations,
 * idempotency material, actors, migration metadata, and rollback payloads.
 */
async function fetchPolicyInitialIntentEstablishmentReadiness(dbClient, policyId) {
  const policyResult = await dbClient.query(
    `SELECT
       policy.id AS policy_id,
       policy.library_id,
       COALESCE(legacy.preset_attachment_count, 0)::int AS preset_attachment_count,
       COALESCE(legacy.override_count, 0)::int AS override_count,
       COALESCE(native_history.intent_count, 0)::int AS native_intent_count,
       COALESCE(native_history.active_intent_count, 0)::int AS active_native_intent_count,
       establishment.id AS establishment_id,
       establishment.state AS establishment_state,
       establishment.intent_id AS established_intent_id,
       establishment.rollback_snapshot_id,
       establishment.established_at,
       established_intent.active AS established_intent_active,
       snapshot.expires_at AS rollback_expires_at,
       snapshot.restored_at AS rollback_restored_at,
       snapshot.payload_redacted AS rollback_payload_redacted
     FROM library_policies policy
     LEFT JOIN LATERAL (
       SELECT
         COALESCE(SUM(preset_attachment_count), 0)::int AS preset_attachment_count,
         COALESCE(SUM(override_count), 0)::int AS override_count
       FROM (
         SELECT
           COUNT(*)::int AS preset_attachment_count,
           0::int AS override_count
         FROM policy_presets
         WHERE policy_id = policy.id
         UNION ALL
         SELECT
           0::int AS preset_attachment_count,
           COUNT(*)::int AS override_count
         FROM policy_overrides
         WHERE policy_id = policy.id
       ) legacy_counts
     ) legacy ON TRUE
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*)::int AS intent_count,
         COUNT(*) FILTER (WHERE active = TRUE)::int AS active_intent_count
       FROM policy_intents
       WHERE policy_id = policy.id
     ) native_history ON TRUE
     LEFT JOIN policy_initial_intent_establishments establishment
       ON establishment.policy_id = policy.id
     LEFT JOIN policy_intents established_intent
       ON established_intent.id = establishment.intent_id
     LEFT JOIN policy_intent_rollback_snapshots snapshot
       ON snapshot.id = establishment.rollback_snapshot_id
     WHERE policy.id = $1
     LIMIT 1`,
    [policyId]
  );

  const readiness = firstRow(policyResult);
  if (!readiness) {
    return { readiness: null, rules: [] };
  }

  const intentId = Number(readiness.established_intent_id);
  if (!Number.isInteger(intentId) || intentId <= 0) {
    return { readiness, rules: [] };
  }

  const rulesResult = await dbClient.query(
    `SELECT
       collection,
       intent_role,
       signal_type,
       operator,
       values,
       constraint_mode,
       semantics,
       sort_order
     FROM policy_intent_rules
     WHERE intent_id = $1
     ORDER BY collection, sort_order, id
     LIMIT 129`,
    [intentId]
  );

  return {
    readiness,
    rules: Array.isArray(rulesResult?.rows) ? rulesResult.rows : [],
  };
}

export {
  fetchPolicyInitialIntentEstablishmentReadiness,
};
