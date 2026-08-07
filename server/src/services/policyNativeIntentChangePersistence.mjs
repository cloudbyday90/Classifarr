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

async function lockPolicyForNativeIntentChange(client, policyId) {
  const result = await client.query(
    `SELECT id, library_id
     FROM library_policies
     WHERE id = $1
     FOR UPDATE`,
    [policyId],
  );

  return firstRow(result);
}

async function lockActiveNativeIntentForChange(client, { policyId, libraryId }) {
  const result = await client.query(
    `SELECT
       id,
       policy_id,
       library_id,
       intent_version,
       active,
       source,
       inference_state,
       validation_status,
       review_behavior
     FROM policy_intents
     WHERE policy_id = $1
       AND library_id = $2
       AND active = TRUE
     ORDER BY id
     LIMIT 1
     FOR UPDATE`,
    [policyId, libraryId],
  );

  return firstRow(result);
}

async function deactivateActiveNativeIntentForChange({
  client,
  intentId,
  updated_at,
}) {
  const result = await client.query(
    `UPDATE policy_intents
     SET active = FALSE,
         updated_at = $2
     WHERE id = $1
       AND active = TRUE`,
    [intentId, updated_at],
  );

  return result?.rowCount === 1;
}

async function insertNewNativeIntentVersion({
  client,
  policyId,
  libraryId,
  intentVersion,
  source = 'native_intent',
  inferenceState = 'inferred',
  validationStatus = 'valid',
  reviewBehavior = {},
  createdAt,
}) {
  const result = await client.query(
    `INSERT INTO policy_intents (
       policy_id,
       library_id,
       intent_version,
       active,
       source,
       inference_state,
       validation_status,
       review_behavior,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7::jsonb, $8, $8)
     RETURNING id, intent_version`,
    [policyId, libraryId, intentVersion, source, inferenceState, validationStatus,
      JSON.stringify(reviewBehavior ?? {}), createdAt],
  );

  return firstRow(result);
}

async function insertNativeIntentChangeEvent({
  client,
  intentId,
  policyId,
  actorType,
  actorId,
  sourceVersion,
  targetVersion,
  reasonCode,
  summary,
  metadata,
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
     VALUES ($1, $2, 'change_applied', $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id`,
    [
      intentId,
      policyId,
      actorType,
      actorId,
      sourceVersion,
      targetVersion,
      reasonCode,
      summary,
      JSON.stringify(metadata),
    ],
  );

  return firstRow(result)?.id ?? null;
}

async function copyRulesFromPreviousIntent({
  client,
  oldIntentId,
  newIntentId,
  excludeCollections = [],
}) {
  if (excludeCollections.length > 0) {
    const placeholders = excludeCollections.map((_, i) => `$${i + 3}`).join(', ');
    const result = await client.query(
      `INSERT INTO policy_intent_rules (
         intent_id, intent_role, collection, signal_type, operator,
         values, constraint_mode, semantics, source, inference_state, sort_order
       )
       SELECT $2, intent_role, collection, signal_type, operator,
              values, constraint_mode, semantics, source, inference_state, sort_order
       FROM policy_intent_rules
       WHERE intent_id = $1
         AND collection NOT IN (${placeholders})`,
      [oldIntentId, newIntentId, ...excludeCollections],
    );
    return result?.rowCount ?? 0;
  }

  const result = await client.query(
    `INSERT INTO policy_intent_rules (
       intent_id, intent_role, collection, signal_type, operator,
       values, constraint_mode, semantics, source, inference_state, sort_order
     )
     SELECT $2, intent_role, collection, signal_type, operator,
            values, constraint_mode, semantics, source, inference_state, sort_order
     FROM policy_intent_rules
     WHERE intent_id = $1`,
    [oldIntentId, newIntentId],
  );
  return result?.rowCount ?? 0;
}

async function insertRulesForCollection({
  client,
  intentId,
  collection,
  entries = [],
}) {
  let inserted = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const intentRole = collection === 'purpose' ? 'purpose'
      : collection === 'hard_limits' ? 'hard_limit'
      : collection === 'helpful_hints' ? 'helpful_hint'
      : collection === 'avoid' ? 'avoid'
      : entry.intent_role;

    await client.query(
      `INSERT INTO policy_intent_rules (
         intent_id, intent_role, collection, signal_type, operator,
         values, constraint_mode, semantics, source, inference_state, sort_order
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)`,
      [
        intentId,
        intentRole,
        collection,
        entry.signal_type ?? entry.signalType ?? 'genres',
        entry.operator ?? 'require_any',
        JSON.stringify(entry.values ?? {}),
        entry.constraint_mode ?? entry.constraintMode ?? null,
        entry.semantics ?? null,
        entry.source ?? 'native_intent',
        entry.inference_state ?? entry.inferenceState ?? 'inferred',
        i,
      ],
    );
    inserted++;
  }
  return inserted;
}

async function copyRoutingTargetFromPreviousIntent({
  client,
  oldIntentId,
  newIntentId,
  libraryId: _libraryId,
}) {
  const result = await client.query(
    `INSERT INTO policy_intent_routing_targets (
       intent_id, library_id, arr_type, arr_config_id,
       arr_root_folder_id, arr_root_folder_path, quality_profile_id, target_status
     )
     SELECT $2, library_id, arr_type, arr_config_id,
            arr_root_folder_id, arr_root_folder_path, quality_profile_id, target_status
     FROM policy_intent_routing_targets
     WHERE intent_id = $1
     ORDER BY id
     LIMIT 1`,
    [oldIntentId, newIntentId],
  );
  return result?.rowCount ?? 0;
}

async function insertRoutingTargetForChange({
  client,
  intentId,
  libraryId,
  routingTarget = {},
}) {
  const result = await client.query(
    `INSERT INTO policy_intent_routing_targets (
       intent_id, library_id, arr_type, arr_config_id,
       arr_root_folder_id, arr_root_folder_path, quality_profile_id, target_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      intentId,
      libraryId,
      routingTarget.arr_type ?? routingTarget.arrType ?? null,
      routingTarget.arr_config_id ?? routingTarget.arrConfigId ?? null,
      routingTarget.arr_root_folder_id ?? routingTarget.arrRootFolderId ?? null,
      routingTarget.arr_root_folder_path ?? routingTarget.arrRootFolderPath ?? null,
      routingTarget.quality_profile_id ?? routingTarget.qualityProfileId ?? null,
      routingTarget.target_status ?? routingTarget.targetStatus ?? 'configured',
    ],
  );
  return result?.rowCount ?? 0;
}

async function updateReviewBehavior({
  client,
  intentId,
  reviewBehavior,
}) {
  const result = await client.query(
    `UPDATE policy_intents
     SET review_behavior = $2::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [intentId, JSON.stringify(reviewBehavior ?? {})],
  );
  return result?.rowCount === 1;
}

export {
  copyRoutingTargetFromPreviousIntent,
  copyRulesFromPreviousIntent,
  deactivateActiveNativeIntentForChange,
  insertNativeIntentChangeEvent,
  insertNewNativeIntentVersion,
  insertRoutingTargetForChange,
  insertRulesForCollection,
  lockActiveNativeIntentForChange,
  lockPolicyForNativeIntentChange,
  updateReviewBehavior,
};
