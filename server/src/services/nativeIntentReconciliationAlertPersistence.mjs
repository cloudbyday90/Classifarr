/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function asArray(value) {
  return Array.isArray(value?.rows) ? value.rows : [];
}

export async function loadNativeIntentReconciliationAlertStates({ client, alertTypeIds }) {
  const result = await client.query(
    `SELECT alert_type_id, alert_state, first_detected_at, last_detected_at,
            last_notified_at, last_resolved_at, occurrence_count
     FROM policy_native_intent_reconciliation_alert_states
     WHERE alert_type_id = ANY($1::text[])
     FOR UPDATE`,
    [alertTypeIds],
  );
  return asArray(result);
}

export async function upsertNativeIntentReconciliationAlertState({
  client,
  alert,
  evaluatedAt,
  notifiedAt = null,
}) {
  const result = await client.query(
    `INSERT INTO policy_native_intent_reconciliation_alert_states (
       alert_type_id, alert_state, first_detected_at, last_detected_at,
       last_notified_at, last_resolved_at, occurrence_count, updated_at
     )
     VALUES ($1::varchar, $2::varchar, $3::timestamptz, $3::timestamptz, $4::timestamptz,
       CASE WHEN $2::varchar = 'resolved'::varchar THEN $3::timestamptz ELSE NULL END,
       CASE WHEN $2::varchar = 'firing'::varchar THEN 1 ELSE 0 END,
       $3::timestamptz)
     ON CONFLICT (alert_type_id) DO UPDATE
     SET alert_state = EXCLUDED.alert_state,
         first_detected_at = CASE
           WHEN EXCLUDED.alert_state = 'firing'
            AND policy_native_intent_reconciliation_alert_states.alert_state = 'resolved'
             THEN EXCLUDED.first_detected_at
           ELSE policy_native_intent_reconciliation_alert_states.first_detected_at
         END,
         last_detected_at = CASE
           WHEN EXCLUDED.alert_state = 'firing' THEN EXCLUDED.last_detected_at
           ELSE policy_native_intent_reconciliation_alert_states.last_detected_at
         END,
         last_notified_at = CASE
           WHEN EXCLUDED.alert_state = 'firing'
            AND policy_native_intent_reconciliation_alert_states.alert_state = 'resolved'
             THEN EXCLUDED.last_notified_at
           ELSE COALESCE(
             EXCLUDED.last_notified_at,
             policy_native_intent_reconciliation_alert_states.last_notified_at
           )
         END,
         last_resolved_at = CASE
           WHEN EXCLUDED.alert_state = 'resolved' THEN EXCLUDED.last_resolved_at
           ELSE NULL
         END,
         occurrence_count = CASE
           WHEN EXCLUDED.alert_state = 'firing'
            AND policy_native_intent_reconciliation_alert_states.alert_state = 'firing'
             THEN policy_native_intent_reconciliation_alert_states.occurrence_count + 1
           WHEN EXCLUDED.alert_state = 'firing' THEN 1
           ELSE policy_native_intent_reconciliation_alert_states.occurrence_count
         END,
         updated_at = EXCLUDED.updated_at
     RETURNING alert_type_id, alert_state, first_detected_at, last_detected_at,
               last_notified_at, last_resolved_at, occurrence_count`,
    [alert.alertTypeId, alert.alertState, evaluatedAt, notifiedAt],
  );
  return asArray(result)[0] || null;
}

export async function insertNativeIntentReconciliationAlertNotification({ client, alert }) {
  await client.query(
    `INSERT INTO app_notifications (type, title, message, data, created_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW())`,
    [
      alert.notificationType,
      alert.title,
      alert.message,
      JSON.stringify({
        notificationType: 'native_intent_reconciliation_alert',
        alertTypeId: alert.alertTypeId,
        reasonId: alert.reasonId,
        targetPath: '/policies',
      }),
    ],
  );
}
