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

export async function loadNativeIntentReconciliationControl({ db }) {
  const result = await db.query(
    `SELECT automation_enabled, circuit_state, recovery_requirement,
            failure_count, failure_window_started_at, last_failure_category,
            opened_at, recovery_probe_started_at, recovered_at,
            manual_disabled_at, manual_disabled_reason_id
     FROM policy_native_intent_reconciliation_controls
     WHERE control_id = 1`,
  );
  return firstRow(result);
}

export async function lockNativeIntentReconciliationControl({ client }) {
  const result = await client.query(
    `SELECT automation_enabled, circuit_state, recovery_requirement,
            failure_count, failure_window_started_at, last_failure_category,
            opened_at, recovery_probe_started_at, recovered_at,
            manual_disabled_at, manual_disabled_reason_id
     FROM policy_native_intent_reconciliation_controls
     WHERE control_id = 1
     FOR UPDATE`,
  );
  return firstRow(result);
}

export async function persistNativeIntentReconciliationControl({ client, control }) {
  const result = await client.query(
    `UPDATE policy_native_intent_reconciliation_controls
     SET automation_enabled = $1,
         circuit_state = $2,
         recovery_requirement = $3,
         failure_count = $4,
         failure_window_started_at = $5,
         last_failure_category = $6,
         opened_at = $7,
         recovery_probe_started_at = $8,
         recovered_at = $9,
         manual_disabled_at = $10,
         manual_disabled_reason_id = $11,
         updated_at = NOW()
     WHERE control_id = 1
     RETURNING automation_enabled, circuit_state, recovery_requirement,
               failure_count, failure_window_started_at, last_failure_category,
               opened_at, recovery_probe_started_at, recovered_at,
               manual_disabled_at, manual_disabled_reason_id`,
    [
      control.automationEnabled,
      control.circuitState,
      control.recoveryRequirement,
      control.failureCount,
      control.failureWindowStartedAt,
      control.lastFailureCategory,
      control.openedAt,
      control.recoveryProbeStartedAt,
      control.recoveredAt,
      control.manualDisabledAt,
      control.manualDisabledReasonId,
    ],
  );
  return firstRow(result);
}

export async function insertNativeIntentReconciliationControlEvent({
  client,
  eventType,
  reasonId,
  failureCategory = null,
  actorType,
  actorId = null,
  occurredAt,
}) {
  const result = await client.query(
    `INSERT INTO policy_native_intent_reconciliation_control_events (
       event_type, reason_id, failure_category, actor_type, actor_id, occurred_at
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [eventType, reasonId, failureCategory, actorType, actorId, occurredAt],
  );
  return firstRow(result)?.id ?? null;
}
