/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const POLICY_LIBRARY_REBUILD_REPLACEMENT_STATE_IDS = Object.freeze({
  SNAPSHOT_PERSISTED: 'snapshot_persisted',
  REPLACEMENT_APPLIED: 'replacement_applied',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getFirstRow(result) {
  return asArray(result?.rows)[0] || null;
}

function nextIntentVersion(intent) {
  const current = Number(intent?.intent_version);
  if (!Number.isInteger(current) || current < 1) {
    throw new TypeError('Library rebuild replacement requires a current native intent version.');
  }

  return current + 1;
}

async function lockExecutionGateByIdempotencyKey(client, idempotencyKey) {
  const result = await client.query(
    `SELECT
       id,
       policy_id,
       intent_id,
       library_id,
       state,
       idempotency_key,
       transition_fingerprint,
       proposal_fingerprint,
       rollback_plan_fingerprint,
       acceptance_expires_at,
       rollback_snapshot_id,
       migration_event_id,
       replacement_intent_id,
       replacement_event_id,
       replacement_applied_at
     FROM policy_library_rebuild_execution_gates
     WHERE idempotency_key = $1
     FOR UPDATE`,
    [idempotencyKey]
  );

  return getFirstRow(result);
}

async function lockRollbackSnapshot({ client, snapshotId, policyId, intentId, now }) {
  const result = await client.query(
    `SELECT id, intent_id, policy_id, snapshot_version, expires_at, restored_at
     FROM policy_intent_rollback_snapshots
     WHERE id = $1
       AND policy_id = $2
       AND intent_id = $3
       AND expires_at > $4
       AND restored_at IS NULL
     FOR UPDATE`,
    [snapshotId, policyId, intentId, now.toISOString()]
  );

  return getFirstRow(result);
}

async function insertNativeIntentHeader({ client, policy, previousIntent, contract, now }) {
  const targetVersion = nextIntentVersion(previousIntent);
  const deactivate = await client.query(
    `UPDATE policy_intents
     SET active = FALSE,
         updated_at = $2
     WHERE id = $1
       AND policy_id = $3
       AND library_id = $4
       AND active = TRUE`,
    [previousIntent.id, now.toISOString(), policy.id, policy.library_id]
  );
  if (deactivate.rowCount !== 1) {
    throw new Error('Current native intent was not active when replacement began.');
  }

  const inserted = await client.query(
    `INSERT INTO policy_intents (
       policy_id,
       library_id,
       schema_version,
       intent_version,
       active,
       source,
       inference_state,
       review_behavior,
       validation_status,
       created_by,
       accepted_at,
       accepted_by
     )
     VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7::jsonb, $8, NULL, $9, NULL)
     RETURNING id, intent_version`,
    [
      policy.id,
      policy.library_id,
      contract.schema_version,
      targetVersion,
      contract.source,
      contract.inference_state,
      JSON.stringify(asObject(contract.review_behavior)),
      contract.validation?.warning_count > 0 ? 'warning' : 'valid',
      now.toISOString(),
    ]
  );
  const replacementIntent = getFirstRow(inserted);
  if (!replacementIntent?.id) {
    throw new Error('Replacement native intent insert did not return an identifier.');
  }

  await client.query(
    `UPDATE policy_intents
     SET replaced_by_intent_id = $1,
         updated_at = $2
     WHERE id = $3`,
    [replacementIntent.id, now.toISOString(), previousIntent.id]
  );

  return {
    intentId: Number(replacementIntent.id),
    intentVersion: Number(replacementIntent.intent_version),
  };
}

async function insertNativeIntentRules({ client, intentId, contract }) {
  const collections = [
    ['purpose', contract.purpose],
    ['hard_limits', contract.hard_limits],
    ['helpful_hints', contract.helpful_hints],
    ['avoid', contract.avoid],
  ];
  let insertedCount = 0;

  for (const [collection, entries] of collections) {
    for (const [sortOrder, entry] of asArray(entries).entries()) {
      await client.query(
        `INSERT INTO policy_intent_rules (
           intent_id,
           intent_role,
           collection,
           signal_type,
           operator,
           values,
           constraint_mode,
           semantics,
           source,
           inference_state,
           sort_order
         )
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)`,
        [
          intentId,
          entry.intent_role,
          collection,
          entry.signal_type,
          entry.operator,
          JSON.stringify(asObject(entry.values)),
          entry.constraint_mode ?? null,
          entry.semantics ?? null,
          entry.source ?? 'library_rebuild',
          entry.inference_state,
          sortOrder,
        ]
      );
      insertedCount += 1;
    }
  }

  return insertedCount;
}

async function insertNativeRoutingTarget({ client, intentId, policy, routingTarget, now }) {
  const target = asObject(routingTarget);
  if (!target.arr_type || !target.arr_config_id || !target.arr_root_folder_path) {
    throw new Error('Replacement requires a current configured routing target.');
  }

  await client.query(
    `INSERT INTO policy_intent_routing_targets (
       intent_id,
       library_id,
       arr_type,
       arr_config_id,
       arr_root_folder_id,
       arr_root_folder_path,
       quality_profile_id,
       target_status,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'configured', $8, $8)`,
    [
      intentId,
      policy.library_id,
      target.arr_type,
      target.arr_config_id,
      target.arr_root_folder_id ?? null,
      target.arr_root_folder_path,
      target.quality_profile_id ?? null,
      now.toISOString(),
    ]
  );
}

async function insertNativeValidationStatus({ client, intentId, contract, now }) {
  const validation = asObject(contract.validation);
  await client.query(
    `INSERT INTO policy_intent_validation_status (
       intent_id,
       schema_version,
       status,
       validator_version,
       error_count,
       warning_count,
       errors,
       warnings,
       validated_at
     )
     VALUES ($1, $2, $3, 'policy_library_rebuild_replacement', $4, $5, $6::jsonb, $7::jsonb, $8)`,
    [
      intentId,
      contract.schema_version,
      validation.warning_count > 0 ? 'warning' : 'valid',
      validation.error_count ?? 0,
      validation.warning_count ?? 0,
      JSON.stringify(asArray(validation.errors)),
      JSON.stringify(asArray(validation.warnings)),
      now.toISOString(),
    ]
  );
}

async function insertReplacementMigrationEvent({
  client,
  replacementIntent,
  previousIntent,
  execution,
  verifierReport,
}) {
  const result = await client.query(
    `INSERT INTO policy_intent_migration_events (
       intent_id,
       policy_id,
       event_type,
       actor_type,
       actor_id,
       source_version,
       target_version,
       reason_code,
       summary,
       metadata
     )
     VALUES ($1, $2, 'library_rebuild_replacement_applied', 'operator', NULL, $3, $4, $5, $6, $7::jsonb)
     RETURNING id`,
    [
      replacementIntent.intentId,
      execution.policy_id,
      previousIntent.intent_version,
      replacementIntent.intentVersion,
      'library_rebuild_replacement_applied',
      'Accepted library rebuild replacement applied from a persisted rollback snapshot.',
      JSON.stringify({
        executionGateId: Number(execution.id),
        transitionFingerprint: execution.transition_fingerprint,
        proposalFingerprint: execution.proposal_fingerprint,
        rollbackPlanFingerprint: execution.rollback_plan_fingerprint,
        rollbackSnapshotId: Number(execution.rollback_snapshot_id),
        sampleSetFingerprint: verifierReport.sampleSetFingerprint?.fingerprint ?? null,
      }),
    ]
  );

  return getFirstRow(result)?.id ?? null;
}

async function markExecutionReplacementApplied({
  client,
  executionId,
  replacementIntentId,
  replacementEventId,
  now,
}) {
  const result = await client.query(
    `UPDATE policy_library_rebuild_execution_gates
     SET state = $2,
         replacement_intent_id = $3,
         replacement_event_id = $4,
         replacement_applied_at = $5,
         updated_at = $5
     WHERE id = $1
       AND state = $6
     RETURNING id`,
    [
      executionId,
      POLICY_LIBRARY_REBUILD_REPLACEMENT_STATE_IDS.REPLACEMENT_APPLIED,
      replacementIntentId,
      replacementEventId,
      now.toISOString(),
      POLICY_LIBRARY_REBUILD_REPLACEMENT_STATE_IDS.SNAPSHOT_PERSISTED,
    ]
  );

  return getFirstRow(result)?.id ?? null;
}

export {
  POLICY_LIBRARY_REBUILD_REPLACEMENT_STATE_IDS,
  insertNativeIntentHeader,
  insertNativeIntentRules,
  insertNativeRoutingTarget,
  insertNativeValidationStatus,
  insertReplacementMigrationEvent,
  lockExecutionGateByIdempotencyKey,
  lockRollbackSnapshot,
  markExecutionReplacementApplied,
};
