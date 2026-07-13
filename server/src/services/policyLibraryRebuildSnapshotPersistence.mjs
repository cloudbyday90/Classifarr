/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const POLICY_LIBRARY_REBUILD_EXECUTION_STATE_IDS = Object.freeze({
  SNAPSHOT_PERSISTING: 'snapshot_persisting',
  SNAPSHOT_PERSISTED: 'snapshot_persisted',
  ACCEPTANCE_EXPIRED: 'acceptance_expired',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getFirstRow(result) {
  return asArray(result?.rows)[0] || null;
}

function normalizeSnapshotVersion(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function buildSnapshotPayload({ policy, presets, routingTarget, transition, now }) {
  return {
    policy_id: policy.id,
    library_id: policy.library_id,
    captured_at: now.toISOString(),
    restore_sections: asArray(transition.rollbackWindowPlan?.snapshot?.payloadSections)
      .map(section => normalizeString(section?.sectionId))
      .filter(Boolean),
    legacy_policy: {
      name: policy.name ?? null,
      description: policy.description ?? null,
      auto_classify_threshold: policy.auto_classify_threshold ?? null,
      prompt_threshold: policy.prompt_threshold ?? null,
      require_ai_validation: policy.require_ai_validation ?? null,
      trust_patterns: policy.trust_patterns ?? null,
      trust_rag: policy.trust_rag ?? null,
      trust_history: policy.trust_history ?? null,
      preset_weight: policy.preset_weight ?? null,
      profile_weight: policy.profile_weight ?? null,
      pattern_weight: policy.pattern_weight ?? null,
      rag_weight: policy.rag_weight ?? null,
      history_weight: policy.history_weight ?? null,
      combination_mode: policy.combination_mode ?? null,
    },
    presets: asArray(presets).map(preset => ({
      preset_id: preset.preset_id ?? null,
      preset_key: preset.preset_key ?? null,
      preset_name: preset.preset_name ?? null,
      weight: preset.weight ?? null,
      custom_signals: preset.custom_signals ?? null,
      sort_order: preset.sort_order ?? null,
    })),
    routing_target: routingTarget || null,
    acceptance: {
      transition_fingerprint: transition.transitionFingerprint.fingerprint,
      proposal_fingerprint: transition.proposalFingerprint.fingerprint,
      rollback_plan_fingerprint: transition.rollbackPlanFingerprint.fingerprint,
      actor_source_id: transition.acceptance.actorSourceId,
      actor_reference: transition.acceptance.actorReference,
      accepted_at: transition.acceptance.acceptedAt,
    },
  };
}

async function lockPolicy(client, policyContext) {
  const result = await client.query(
    `SELECT *
     FROM library_policies
     WHERE id = $1
       AND library_id = $2
     FOR UPDATE`,
    [policyContext.policyId, policyContext.libraryId]
  );

  return getFirstRow(result);
}

async function lockIntent(client, policyContext) {
  const result = await client.query(
    `SELECT id, policy_id, library_id, intent_version, active
     FROM policy_intents
     WHERE id = $1
       AND policy_id = $2
       AND library_id = $3
       AND active = TRUE
     FOR UPDATE`,
    [policyContext.intentId, policyContext.policyId, policyContext.libraryId]
  );

  return getFirstRow(result);
}

async function loadPolicyPresets(client, policyId) {
  const result = await client.query(
    `SELECT
       pp.preset_id,
       cp.key AS preset_key,
       cp.name AS preset_name,
       pp.weight,
       pp.custom_signals,
       pp.sort_order
     FROM policy_presets pp
     JOIN content_presets cp ON cp.id = pp.preset_id
     WHERE pp.policy_id = $1
     ORDER BY pp.sort_order ASC, cp.display_order ASC, cp.name ASC`,
    [policyId]
  );

  return asArray(result?.rows);
}

async function loadRoutingTarget(client, libraryId) {
  const result = await client.query(
    `SELECT
       arr_type,
       arr_config_id,
       arr_root_folder_id,
       arr_root_folder_path,
       quality_profile_id
     FROM library_arr_mappings
     WHERE library_id = $1
     ORDER BY id ASC
     LIMIT 1`,
    [libraryId]
  );

  return getFirstRow(result);
}

async function expirePriorExecutionGates(client, policyId, now) {
  await client.query(
    `UPDATE policy_library_rebuild_execution_gates
     SET state = $2,
         updated_at = $3
     WHERE policy_id = $1
       AND state = $4
       AND acceptance_expires_at <= $3`,
    [
      policyId,
      POLICY_LIBRARY_REBUILD_EXECUTION_STATE_IDS.ACCEPTANCE_EXPIRED,
      now.toISOString(),
      POLICY_LIBRARY_REBUILD_EXECUTION_STATE_IDS.SNAPSHOT_PERSISTED,
    ]
  );
}

async function findExecutionByIdempotencyKey(client, idempotencyKey) {
  const result = await client.query(
    `SELECT
       id,
       policy_id,
       intent_id,
       library_id,
       state,
       transition_fingerprint,
       proposal_fingerprint,
       rollback_plan_fingerprint,
       acceptance_expires_at,
       rollback_snapshot_id,
       migration_event_id
     FROM policy_library_rebuild_execution_gates
     WHERE idempotency_key = $1
     FOR UPDATE`,
    [idempotencyKey]
  );

  return getFirstRow(result);
}

async function findActiveExecutionForPolicy(client, policyId) {
  const result = await client.query(
    `SELECT
       id,
       policy_id,
       intent_id,
       library_id,
       state,
       transition_fingerprint,
       acceptance_expires_at,
       rollback_snapshot_id,
       migration_event_id
     FROM policy_library_rebuild_execution_gates
     WHERE policy_id = $1
       AND state IN ($2, $3)
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE`,
    [
      policyId,
      POLICY_LIBRARY_REBUILD_EXECUTION_STATE_IDS.SNAPSHOT_PERSISTING,
      POLICY_LIBRARY_REBUILD_EXECUTION_STATE_IDS.SNAPSHOT_PERSISTED,
    ]
  );

  return getFirstRow(result);
}

async function createExecutionGate(client, transition, now) {
  const context = transition.policyContext;
  const result = await client.query(
    `INSERT INTO policy_library_rebuild_execution_gates (
       policy_id,
       intent_id,
       library_id,
       state,
       idempotency_key,
       transition_fingerprint,
       proposal_fingerprint,
       rollback_plan_fingerprint,
       actor_source_id,
       actor_reference,
       acceptance_expires_at,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
     RETURNING id`,
    [
      context.policyId,
      context.intentId,
      context.libraryId,
      POLICY_LIBRARY_REBUILD_EXECUTION_STATE_IDS.SNAPSHOT_PERSISTING,
      transition.replayProtection.idempotencyKey,
      transition.transitionFingerprint.fingerprint,
      transition.proposalFingerprint.fingerprint,
      transition.rollbackPlanFingerprint.fingerprint,
      transition.acceptance.actorSourceId,
      transition.acceptance.actorReference,
      transition.acceptance.expiresAt,
      now.toISOString(),
    ]
  );

  return getFirstRow(result)?.id ?? null;
}

async function createRollbackSnapshot({
  client,
  policy,
  intent,
  presets,
  routingTarget,
  transition,
  now,
}) {
  const snapshotVersion = normalizeSnapshotVersion(
    transition.rollbackWindowPlan?.snapshot?.snapshotVersion
  );
  if (!snapshotVersion || snapshotVersion !== Number(intent.intent_version)) {
    return null;
  }

  const payload = buildSnapshotPayload({
    policy,
    presets,
    routingTarget,
    transition,
    now,
  });
  const result = await client.query(
    `INSERT INTO policy_intent_rollback_snapshots (
       intent_id,
       policy_id,
       snapshot_version,
       snapshot_payload,
       payload_redacted,
       restore_path,
       expires_at
     )
     VALUES ($1, $2, $3, $4::jsonb, FALSE, $5, $6)
     RETURNING id`,
    [
      intent.id,
      policy.id,
      snapshotVersion,
      JSON.stringify(payload),
      transition.rollbackWindowPlan.snapshot.restorePath,
      transition.rollbackWindowPlan.snapshot.expiresAt,
    ]
  );

  return getFirstRow(result)?.id ?? null;
}

async function createMigrationEvent({ client, intent, transition, snapshotId }) {
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
     VALUES ($1, $2, 'rollback_snapshot_created', 'operator', NULL, $3, $3, $4, $5, $6::jsonb)
     RETURNING id`,
    [
      intent.id,
      transition.policyContext.policyId,
      intent.intent_version,
      'library_rebuild_snapshot_persisted',
      'Accepted library rebuild rollback snapshot persisted.',
      JSON.stringify({
        transitionFingerprint: transition.transitionFingerprint.fingerprint,
        proposalFingerprint: transition.proposalFingerprint.fingerprint,
        rollbackPlanFingerprint: transition.rollbackPlanFingerprint.fingerprint,
        idempotencyKey: transition.replayProtection.idempotencyKey,
        snapshotId: Number(snapshotId),
        actorSourceId: transition.acceptance.actorSourceId,
        actorReference: transition.acceptance.actorReference,
      }),
    ]
  );

  return getFirstRow(result)?.id ?? null;
}

async function markExecutionSnapshotPersisted({ client, gateId, snapshotId, eventId, now }) {
  await client.query(
    `UPDATE policy_library_rebuild_execution_gates
     SET state = $2,
         rollback_snapshot_id = $3,
         migration_event_id = $4,
         updated_at = $5
     WHERE id = $1
       AND state = $6`,
    [
      gateId,
      POLICY_LIBRARY_REBUILD_EXECUTION_STATE_IDS.SNAPSHOT_PERSISTED,
      snapshotId,
      eventId,
      now.toISOString(),
      POLICY_LIBRARY_REBUILD_EXECUTION_STATE_IDS.SNAPSHOT_PERSISTING,
    ]
  );
}

export {
  POLICY_LIBRARY_REBUILD_EXECUTION_STATE_IDS,
  createExecutionGate,
  createMigrationEvent,
  createRollbackSnapshot,
  expirePriorExecutionGates,
  findActiveExecutionForPolicy,
  findExecutionByIdempotencyKey,
  loadPolicyPresets,
  loadRoutingTarget,
  lockIntent,
  lockPolicy,
  markExecutionSnapshotPersisted,
};
