/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildNativeIntentAuthoritySqlPredicate,
} from './policyNativeIntentAuthorityEligibility.mjs';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstRow(result) {
  return asArray(result?.rows)[0] || null;
}

export async function loadNativeIntentReconciliationRestoreGate({ db }) {
  const result = await db.query(
    `SELECT gate_state, reason_id, restore_token, restore_started_at,
            restore_finished_at, verified_at
     FROM policy_native_intent_reconciliation_restore_gates
     WHERE gate_id = 1`,
  );
  return firstRow(result);
}

export async function beginNativeIntentReconciliationRestore({ db, restoreToken, startedAt }) {
  const result = await db.query(
    `INSERT INTO policy_native_intent_reconciliation_restore_gates (
       gate_id, gate_state, reason_id, restore_token, restore_started_at,
       restore_finished_at, verified_at, updated_at
     )
     VALUES (1, 'restore_in_progress', 'restore_in_progress', $1, $2, NULL, NULL, NOW())
     ON CONFLICT (gate_id) DO UPDATE
     SET gate_state = EXCLUDED.gate_state,
         reason_id = EXCLUDED.reason_id,
         restore_token = EXCLUDED.restore_token,
         restore_started_at = EXCLUDED.restore_started_at,
         restore_finished_at = NULL,
         verified_at = NULL,
         updated_at = NOW()
     WHERE policy_native_intent_reconciliation_restore_gates.gate_state <> 'restore_in_progress'
     RETURNING gate_state, reason_id, restore_token, restore_started_at`,
    [restoreToken, startedAt],
  );
  return firstRow(result);
}

export async function completeNativeIntentReconciliationRestore({
  db,
  restoreToken,
  finishedAt,
  reasonId,
}) {
  const result = await db.query(
    `UPDATE policy_native_intent_reconciliation_restore_gates
     SET gate_state = 'ready',
         reason_id = $2,
         restore_token = NULL,
         restore_finished_at = $3,
         verified_at = $3,
         updated_at = NOW()
     WHERE gate_id = 1
       AND gate_state = 'restore_in_progress'
       AND restore_token = $1
     RETURNING gate_state, reason_id, restore_finished_at, verified_at`,
    [restoreToken, reasonId, finishedAt],
  );
  return firstRow(result);
}

export async function failNativeIntentReconciliationRestore({
  db,
  restoreToken,
  finishedAt,
  reasonId,
}) {
  const result = await db.query(
    `UPDATE policy_native_intent_reconciliation_restore_gates
     SET gate_state = 'requires_maintenance',
         reason_id = $2,
         restore_token = NULL,
         restore_finished_at = $3,
         verified_at = NULL,
         updated_at = NOW()
     WHERE gate_id = 1
       AND gate_state = 'restore_in_progress'
       AND restore_token = $1
     RETURNING gate_state, reason_id, restore_finished_at`,
    [restoreToken, reasonId, finishedAt],
  );
  return firstRow(result);
}

export async function loadActiveNativeIntentReconciliationHolds({ db, policyIds }) {
  if (!Array.isArray(policyIds) || policyIds.length === 0) return [];
  const result = await db.query(
    `SELECT policy_id, source_event_id, reason_id, held_at
     FROM policy_native_intent_reconciliation_holds
     WHERE hold_state = 'active'
       AND policy_id = ANY($1::int[])`,
    [policyIds],
  );
  return asArray(result?.rows);
}

export async function lockActiveNativeIntentReconciliationHold({ client, policyId }) {
  const result = await client.query(
    `SELECT policy_id, source_event_id, reason_id, held_at
     FROM policy_native_intent_reconciliation_holds
     WHERE policy_id = $1
       AND hold_state = 'active'
     FOR UPDATE`,
    [policyId],
  );
  return firstRow(result);
}

export async function insertNativeIntentReconciliationHold({
  client,
  policyId,
  sourceEventId,
  reasonId,
  heldAt,
}) {
  const result = await client.query(
    `INSERT INTO policy_native_intent_reconciliation_holds (
       policy_id, source_event_id, hold_state, reason_id, held_at, updated_at
     )
     VALUES ($1, $2, 'active', $3, $4, $4)
     ON CONFLICT (policy_id) DO UPDATE
     SET source_event_id = EXCLUDED.source_event_id,
         hold_state = 'active',
         reason_id = EXCLUDED.reason_id,
         held_at = EXCLUDED.held_at,
         released_at = NULL,
         release_reason_id = NULL,
         released_event_id = NULL,
         updated_at = EXCLUDED.updated_at
     RETURNING policy_id`,
    [policyId, sourceEventId, reasonId, heldAt],
  );
  return firstRow(result)?.policy_id ?? null;
}

export async function lockNativeIntentReconciliationReentryPolicy({ client, policyId }) {
  const result = await client.query(
    `SELECT policy.id,
            EXISTS (
              SELECT 1
              FROM policy_intents intent
              WHERE intent.policy_id = policy.id
                AND ${buildNativeIntentAuthoritySqlPredicate({ intentAlias: 'intent' })}
            ) AS has_active_native_intent
     FROM library_policies policy
     WHERE policy.id = $1
     FOR UPDATE`,
    [policyId],
  );
  return firstRow(result);
}

export async function insertNativeIntentReconciliationReentryEvent({
  client,
  policyId,
  actorType,
  actorId,
  reasonCode,
  heldEventId,
}) {
  const result = await client.query(
    `INSERT INTO policy_intent_migration_events (
       intent_id, policy_id, event_type, actor_type, actor_id, reason_code,
       summary, metadata
     )
     VALUES (NULL, $1, 'reconciliation_reentry_approved', $2, $3, $4, $5, $6::jsonb)
     RETURNING id`,
    [
      policyId,
      actorType,
      actorId,
      reasonCode,
      'Native intent reconciliation re-entry approved.',
      JSON.stringify({ heldEventId }),
    ],
  );
  return firstRow(result)?.id ?? null;
}

export async function releaseNativeIntentReconciliationHold({
  client,
  policyId,
  releaseEventId,
  releaseReasonId,
  releasedAt,
}) {
  const result = await client.query(
    `UPDATE policy_native_intent_reconciliation_holds
     SET hold_state = 'released',
         released_at = $3,
         release_reason_id = $4,
         released_event_id = $2,
         updated_at = $3
     WHERE policy_id = $1
       AND hold_state = 'active'
     RETURNING policy_id`,
    [policyId, releaseEventId, releasedAt, releaseReasonId],
  );
  return firstRow(result)?.policy_id ?? null;
}

export async function resetNativeIntentReconciliationSchedulingState({ client }) {
  const result = await client.query(
    `DELETE FROM policy_native_intent_reconciliation_states
     RETURNING policy_id`,
  );
  return asArray(result?.rows).length;
}

export async function verifyNativeIntentReconciliationSchema({ db, expectedTables }) {
  const result = await db.query(
    `SELECT expected_table AS table_name,
            to_regclass('public.' || expected_table) IS NOT NULL AS present
     FROM unnest($1::text[]) AS expected_table`,
    [expectedTables],
  );
  return asArray(result?.rows);
}

export async function countNativeIntentPolicyLibraryMismatches({ db }) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS mismatch_count
     FROM policy_intents intent
     LEFT JOIN library_policies policy
       ON policy.id = intent.policy_id
      AND policy.library_id = intent.library_id
     WHERE policy.id IS NULL`,
  );
  return Number(firstRow(result)?.mismatch_count || 0);
}
