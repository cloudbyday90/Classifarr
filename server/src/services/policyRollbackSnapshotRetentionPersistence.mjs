/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';
import {
  buildRebuildCaptureEvidence,
  hasRebuildRollbackAcceptance,
  REBUILD_CAPTURE_REASON,
} from './policyRollbackSnapshotRebuildProvenance.mjs';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

async function tryLockPolicyRollbackSnapshotRetention(client, lockKey) {
  const result = await client.query(
    'SELECT pg_try_advisory_xact_lock($1) AS acquired',
    [lockKey]
  );

  return firstRow(result)?.acquired === true;
}

async function lockExpiredRollbackSnapshotsForRetention({ client, now, limit }) {
  const result = await client.query(
    `SELECT
       id,
       intent_id,
       policy_id,
       snapshot_version,
       snapshot_payload,
       payload_redacted,
       restore_path,
       expires_at,
       created_at,
       restored_at
     FROM policy_intent_rollback_snapshots
     WHERE payload_redacted = FALSE
       AND expires_at <= $1::timestamptz
     ORDER BY expires_at ASC, id ASC
     LIMIT $2
     FOR UPDATE SKIP LOCKED`,
    [now, limit]
  );

  return Array.isArray(result?.rows) ? result.rows : [];
}

async function findRebuildCaptureEvent(client, snapshot, evidence) {
  const { rows } = await client.query(
    `SELECT id, actor_type, actor_id, reason_code, metadata,
       metadata ->> 'snapshotId' AS capture_snapshot_id
     FROM policy_intent_migration_events
     CROSS JOIN LATERAL (
       SELECT CASE WHEN metadata ? 'retentionSnapshotId'
         THEN metadata -> 'retentionSnapshotId'
         ELSE metadata -> 'snapshotId'
       END AS value
     ) AS reference
     WHERE policy_id = $1
       AND intent_id = $2
       AND event_type = 'rollback_snapshot_created'
       AND source_version = $3
       AND target_version = $3
       AND reference.value #>> '{}' = $4::text
       AND (
         jsonb_typeof(reference.value) = 'string'
         OR ($5::boolean AND jsonb_typeof(reference.value) = 'number')
       )
       AND reason_code = $6
       AND actor_type = 'operator'
       AND actor_id IS NULL
       AND metadata @> $7::jsonb
     LIMIT 2`,
    [
      snapshot.policy_id,
      snapshot.intent_id,
      snapshot.snapshot_version,
      snapshot.id,
      typeof snapshot.id === 'number',
      REBUILD_CAPTURE_REASON,
      JSON.stringify(evidence),
    ]
  );
  if (rows.length !== 1) return null;
  const event = rows[0];
  const originalId = canonicalDatabaseBigintId(event.metadata?.snapshotId);
  return originalId !== null && originalId === event.capture_snapshot_id ? event : null;
}

async function findRollbackSnapshotAuditEvent({ client, snapshot }) {
  if (hasRebuildRollbackAcceptance(snapshot.snapshot_payload)) {
    const evidence = buildRebuildCaptureEvidence(snapshot.snapshot_payload);
    return evidence ? findRebuildCaptureEvent(client, snapshot, evidence) : null;
  }

  const result = await client.query(
    `SELECT
       id,
       actor_type,
       actor_id,
       reason_code,
       metadata
     FROM policy_intent_migration_events
     WHERE policy_id = $1
       AND intent_id = $2
       AND event_type = 'rollback_snapshot_created'
       AND reason_code <> $6
       AND target_version = $3
       AND metadata ->> 'snapshotId' = $4::text
       AND (
         jsonb_typeof(metadata -> 'snapshotId') = 'string'
         OR ($5::boolean AND jsonb_typeof(metadata -> 'snapshotId') = 'number')
       )
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [
      snapshot.policy_id,
      snapshot.intent_id,
      snapshot.snapshot_version,
      snapshot.id,
      typeof snapshot.id === 'number',
      REBUILD_CAPTURE_REASON,
    ]
  );

  return firstRow(result);
}

async function redactRollbackSnapshotPayload({ client, snapshotId, now, marker }) {
  const result = await client.query(
    `UPDATE policy_intent_rollback_snapshots
     SET snapshot_payload = $2::jsonb,
         payload_redacted = TRUE
     WHERE id = $1
       AND payload_redacted = FALSE
       AND expires_at <= $3::timestamptz
     RETURNING id`,
    [snapshotId, JSON.stringify(marker), now]
  );

  return firstRow(result)?.id ?? null;
}

async function insertRollbackSnapshotRetentionEvent({
  client,
  snapshot,
  marker,
}) {
  const retentionMarker = marker.retention_marker || {};
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
     VALUES (
       $1,
       $2,
       'rollback_snapshot_payload_redacted',
       'maintainer',
       NULL,
       $3,
       $3,
       'rollback_snapshot_retention',
       'Expired rollback snapshot payload redacted after its restore window closed.',
       $4::jsonb
     )
     RETURNING id, intent_id,
       metadata -> 'snapshotId' AS snapshot_id,
       metadata -> 'sourceAuditEventId' AS source_audit_event_id`,
    [
      snapshot.intent_id,
      snapshot.policy_id,
      snapshot.snapshot_version,
      JSON.stringify({
        snapshotId: snapshot.id,
        restorePath: retentionMarker.restore_path ?? null,
        expiresAt: retentionMarker.expires_at ?? null,
        payloadDigest: retentionMarker.payload_digest ?? null,
        payloadBytes: retentionMarker.payload_bytes ?? null,
        markerVersion: retentionMarker.version ?? null,
        sourceAuditEventId: retentionMarker.source_audit?.migration_event_id ?? null,
      }),
    ]
  );

  return firstRow(result);
}

export {
  findRollbackSnapshotAuditEvent,
  insertRollbackSnapshotRetentionEvent,
  lockExpiredRollbackSnapshotsForRetention,
  redactRollbackSnapshotPayload,
  tryLockPolicyRollbackSnapshotRetention,
};
