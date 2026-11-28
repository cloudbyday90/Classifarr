/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { normalizeDatabaseBigintId } from './databaseIntegerValues.mjs';
import {
  INITIAL_ESTABLISHMENT_ROLLBACK_MANIFEST_SQL,
  INITIAL_ESTABLISHMENT_ROLLBACK_PROOF_SQL,
} from './policyInitialEstablishmentRollbackSql.mjs';

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
       established_intent.id AS established_intent_id,
       snapshot.id AS rollback_snapshot_id,
       establishment.established_at,
       established_intent.active AS established_intent_active,
       snapshot.expires_at AS rollback_expires_at,
       snapshot.restored_at AS rollback_restored_at,
       snapshot.payload_redacted AS rollback_payload_redacted,
       native_history.current_library_active_count AS rollback_active_intent_count,
       ${INITIAL_ESTABLISHMENT_ROLLBACK_PROOF_SQL} AS rollback_proof_verified,
       ${INITIAL_ESTABLISHMENT_ROLLBACK_MANIFEST_SQL} AS rollback_manifest_valid
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
         COUNT(*) FILTER (WHERE active = TRUE)::int AS active_intent_count,
         COUNT(*) FILTER (WHERE active = TRUE AND library_id = policy.library_id)::int AS current_library_active_count
       FROM policy_intents
       WHERE policy_id = policy.id
     ) native_history ON TRUE
     LEFT JOIN policy_initial_intent_establishments establishment
       ON establishment.policy_id = policy.id
     LEFT JOIN policy_intents established_intent
       ON established_intent.id = establishment.intent_id
       AND established_intent.policy_id = policy.id
       AND established_intent.library_id = policy.library_id
     LEFT JOIN policy_intent_rollback_snapshots snapshot
       ON snapshot.id = establishment.rollback_snapshot_id
       AND snapshot.policy_id = policy.id
     WHERE policy.id = $1
     LIMIT 1`,
    [policyId]
  );

  const readiness = firstRow(policyResult);
  if (!readiness) {
    return { readiness: null, rules: [] };
  }

  const intentId = normalizeDatabaseBigintId(readiness.established_intent_id);
  if (intentId === null) {
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
     FROM policy_intent_rules rule
     WHERE rule.intent_id = $1
       AND EXISTS (
         SELECT 1 FROM policy_intents intent
         WHERE intent.id = rule.intent_id AND intent.policy_id = $2 AND intent.library_id = $3
       )
     ORDER BY rule.collection, rule.sort_order, rule.id
     LIMIT 129`,
    [intentId, policyId, readiness.library_id]
  );

  return {
    readiness,
    rules: Array.isArray(rulesResult?.rows) ? rulesResult.rows : [],
  };
}

export {
  fetchPolicyInitialIntentEstablishmentReadiness,
};
