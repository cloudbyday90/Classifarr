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
       validation_status
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
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, $7)
     RETURNING id, intent_version`,
    [policyId, libraryId, intentVersion, source, inferenceState, validationStatus, createdAt],
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

export {
  deactivateActiveNativeIntentForChange,
  insertNativeIntentChangeEvent,
  insertNewNativeIntentVersion,
  lockActiveNativeIntentForChange,
  lockPolicyForNativeIntentChange,
};
