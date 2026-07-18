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

async function lockPolicyForInitialIntentEstablishment(client, policyId) {
  const result = await client.query(
    `SELECT lp.*
     FROM library_policies lp
     WHERE lp.id = $1
     FOR UPDATE`,
    [policyId]
  );

  return firstRow(result);
}

async function lockInitialEstablishmentByIdempotencyKey(client, idempotencyKey) {
  const result = await client.query(
    `SELECT
       establishment.id,
       establishment.policy_id,
       establishment.library_id,
       establishment.intent_id,
       establishment.migration_event_id,
       establishment.rollback_snapshot_id,
       establishment.idempotency_key,
       establishment.request_fingerprint,
       establishment.authority_source_id,
       establishment.accepted_by,
       establishment.state,
       intent.active AS native_intent_active
     FROM policy_initial_intent_establishments establishment
     LEFT JOIN policy_intents intent ON intent.id = establishment.intent_id
     WHERE establishment.idempotency_key = $1
     FOR UPDATE OF establishment`,
    [idempotencyKey]
  );

  return firstRow(result);
}

async function lockInitialEstablishmentByPolicyId(client, policyId) {
  const result = await client.query(
    `SELECT
       id,
       policy_id,
       intent_id,
       idempotency_key,
       request_fingerprint,
       accepted_by,
       state
     FROM policy_initial_intent_establishments
     WHERE policy_id = $1
     FOR UPDATE`,
    [policyId]
  );

  return firstRow(result);
}

async function lockLegacyPolicyConfiguration(client, policyId) {
  const [presetResult, overrideResult] = await Promise.all([
    client.query(
      `SELECT id
       FROM policy_presets
       WHERE policy_id = $1
       ORDER BY id
       FOR UPDATE`,
      [policyId]
    ),
    client.query(
      `SELECT id
       FROM policy_overrides
       WHERE policy_id = $1
       ORDER BY id
       FOR UPDATE`,
      [policyId]
    ),
  ]);

  return {
    presetCount: presetResult.rows?.length || 0,
    overrideCount: overrideResult.rows?.length || 0,
  };
}

async function lockNativeIntentHistory(client, policyId) {
  const result = await client.query(
    `SELECT id, intent_version, active
     FROM policy_intents
     WHERE policy_id = $1
     ORDER BY id
     FOR UPDATE`,
    [policyId]
  );

  return Array.isArray(result?.rows) ? result.rows : [];
}

async function lockLibraryRoutingTarget(client, libraryId) {
  const result = await client.query(
    `SELECT
       library_id,
       arr_type,
       arr_config_id,
       arr_root_folder_id,
       arr_root_folder_path,
       quality_profile_id
     FROM library_arr_mappings
     WHERE library_id = $1
     FOR UPDATE`,
    [libraryId]
  );

  return firstRow(result);
}

async function reserveInitialEstablishment({
  client,
  policyId,
  libraryId,
  idempotencyKey,
  requestFingerprint,
  actorId,
}) {
  const result = await client.query(
    `INSERT INTO policy_initial_intent_establishments (
       policy_id,
       library_id,
       idempotency_key,
       request_fingerprint,
       authority_source_id,
       accepted_by,
       state
     )
     VALUES ($1, $2, $3, $4, 'operator_declared_intent', $5, 'pending')
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [policyId, libraryId, idempotencyKey, requestFingerprint, actorId]
  );

  return firstRow(result)?.id ?? null;
}

async function insertInitialNativeIntentHeader({ client, policy, contract, actorId, establishedAt }) {
  const result = await client.query(
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
     VALUES ($1, $2, $3, 1, TRUE, 'native_intent', 'inferred', $4::jsonb, $5, $6, $7, $6)
     RETURNING id`,
    [
      policy.id,
      policy.library_id,
      contract.schema_version,
      JSON.stringify(contract.review_behavior),
      contract.validation.warning_count > 0 ? 'warning' : 'valid',
      actorId,
      establishedAt,
    ]
  );

  return firstRow(result)?.id ?? null;
}

async function insertInitialIntentRules({ client, intentId, contract }) {
  const entries = [
    ...contract.purpose.map(entry => ({ ...entry, collection: 'purpose' })),
    ...contract.hard_limits.map(entry => ({ ...entry, collection: 'hard_limits' })),
    ...contract.helpful_hints.map(entry => ({ ...entry, collection: 'helpful_hints' })),
    ...contract.avoid.map(entry => ({ ...entry, collection: 'avoid' })),
  ];

  for (const [sortOrder, entry] of entries.entries()) {
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
        entry.collection,
        entry.signal_type,
        entry.operator,
        JSON.stringify(entry.values),
        entry.constraint_mode,
        entry.semantics,
        entry.source,
        entry.inference_state,
        sortOrder,
      ]
    );
  }

  return entries.length;
}

async function insertInitialIntentRoutingTarget({ client, intentId, policy, routingTarget }) {
  const configured = Boolean(routingTarget);
  await client.query(
    `INSERT INTO policy_intent_routing_targets (
       intent_id,
       library_id,
       arr_type,
       arr_config_id,
       arr_root_folder_id,
       arr_root_folder_path,
       quality_profile_id,
       target_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      intentId,
      policy.library_id,
      routingTarget?.arr_type ?? null,
      routingTarget?.arr_config_id ?? null,
      routingTarget?.arr_root_folder_id ?? null,
      routingTarget?.arr_root_folder_path ?? null,
      routingTarget?.quality_profile_id ?? null,
      configured ? 'configured' : 'missing',
    ]
  );

  return configured;
}

async function insertInitialIntentValidationStatus({ client, intentId, contract }) {
  await client.query(
    `INSERT INTO policy_intent_validation_status (
       intent_id,
       schema_version,
       status,
       validator_version,
       error_count,
       warning_count,
       errors,
       warnings
     )
     VALUES ($1, $2, $3, 'policy_initial_intent_establishment', $4, $5, $6::jsonb, $7::jsonb)`,
    [
      intentId,
      contract.schema_version,
      contract.validation.warning_count > 0 ? 'warning' : 'valid',
      contract.validation.error_count,
      contract.validation.warning_count,
      JSON.stringify(contract.validation.errors),
      JSON.stringify(contract.validation.warnings),
    ]
  );
}

async function insertInitialIntentMigrationEvent({
  client,
  intentId,
  policyId,
  actorId,
  requestFingerprint,
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
     VALUES ($1, $2, 'initial_intent_established', 'operator', $3, NULL, 1,
       'operator_declared_initial_intent',
       'Established the first native intent from explicit operator-declared rules.',
       $4::jsonb)
     RETURNING id`,
    [
      intentId,
      policyId,
      actorId,
      JSON.stringify({
        authority_source_id: 'operator_declared_intent',
        request_fingerprint: requestFingerprint,
      }),
    ]
  );

  return firstRow(result)?.id ?? null;
}

async function insertInitialIntentRollbackSnapshot({
  client,
  intentId,
  policy,
  routingTarget,
  establishedAt,
}) {
  const expiresAt = new Date(new Date(establishedAt).getTime() + (14 * 24 * 60 * 60 * 1000)).toISOString();
  const payload = {
    policy_id: policy.id,
    library_id: policy.library_id,
    captured_at: establishedAt,
    payload_redacted: false,
    restore_sections: [
      'preset_attachments',
      'weights',
      'thresholds',
      'custom_signals',
      'routing_mapping_references',
      'migration_actor',
      'migration_reason',
    ],
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
    presets: [],
    routing_target: routingTarget ? {
      arr_type: routingTarget.arr_type,
      arr_config_id: routingTarget.arr_config_id,
      arr_root_folder_id: routingTarget.arr_root_folder_id,
      arr_root_folder_path: routingTarget.arr_root_folder_path,
      quality_profile_id: routingTarget.quality_profile_id,
    } : null,
  };

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
     VALUES ($1, $2, 1, $3::jsonb, FALSE, $4, $5)
     RETURNING id`,
    [
      intentId,
      policy.id,
      JSON.stringify(payload),
      `policy/initial-intent-establishment/rollback/policies/${policy.id}/v1`,
      expiresAt,
    ]
  );

  return firstRow(result)?.id ?? null;
}

async function completeInitialEstablishment({
  client,
  establishmentId,
  intentId,
  migrationEventId,
  rollbackSnapshotId,
  establishedAt,
}) {
  const result = await client.query(
    `UPDATE policy_initial_intent_establishments
     SET
       intent_id = $2,
       migration_event_id = $3,
       rollback_snapshot_id = $4,
       state = 'established',
       established_at = $5,
       updated_at = $5
     WHERE id = $1
       AND state = 'pending'
     RETURNING id`,
    [establishmentId, intentId, migrationEventId, rollbackSnapshotId, establishedAt]
  );

  return firstRow(result)?.id ?? null;
}

async function clearInitialEstablishmentReconciliationState({ client, policyId }) {
  const result = await client.query(
    `DELETE FROM policy_native_intent_reconciliation_states
     WHERE policy_id = $1
       AND candidate_status_id = 'requires_initial_policy_establishment'
       AND outcome_state = 'requires_maintenance'
       AND reason_id = 'requires_initial_policy_establishment'
     RETURNING policy_id`,
    [policyId]
  );

  return firstRow(result)?.policy_id ?? null;
}

export {
  clearInitialEstablishmentReconciliationState,
  completeInitialEstablishment,
  insertInitialIntentMigrationEvent,
  insertInitialIntentRollbackSnapshot,
  insertInitialIntentRoutingTarget,
  insertInitialIntentRules,
  insertInitialIntentValidationStatus,
  insertInitialNativeIntentHeader,
  lockInitialEstablishmentByIdempotencyKey,
  lockInitialEstablishmentByPolicyId,
  lockLegacyPolicyConfiguration,
  lockLibraryRoutingTarget,
  lockNativeIntentHistory,
  lockPolicyForInitialIntentEstablishment,
  reserveInitialEstablishment,
};
