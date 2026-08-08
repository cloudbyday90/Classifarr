/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createHash } from 'node:crypto';

const POLICY_ROLLBACK_SNAPSHOT_RETENTION_VERSION =
  'policy.rollback_snapshot_retention.v1';

const POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS = Object.freeze({
  COMPLETED: 'completed',
  CLEANUP_LOCKED: 'cleanup_locked',
  TRANSACTION_BOUNDARY_REQUIRED: 'transaction_boundary_required',
  FAILED_ROLLED_BACK: 'failed_rolled_back',
});

const POLICY_ROLLBACK_SNAPSHOT_RETENTION_RISK_IDS = Object.freeze({
  INVALID_BATCH_SIZE: 'invalid_batch_size',
  INVALID_TIMESTAMP: 'invalid_timestamp',
  CLEANUP_LOCK_NOT_ACQUIRED: 'cleanup_lock_not_acquired',
  TRANSACTION_BOUNDARY_REQUIRED: 'transaction_boundary_required',
  SNAPSHOT_REDACTION_NOT_APPLIED: 'snapshot_redaction_not_applied',
  AUDIT_EVENT_NOT_WRITTEN: 'audit_event_not_written',
  TRANSACTION_FAILED: 'transaction_failed',
});

const POLICY_ROLLBACK_SNAPSHOT_RETENTION_MARKER_VERSION = 1;
const DEFAULT_POLICY_ROLLBACK_SNAPSHOT_RETENTION_BATCH_SIZE = 100;
const MAX_POLICY_ROLLBACK_SNAPSHOT_RETENTION_BATCH_SIZE = 500;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value, fallback = null) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeNullableInteger(value) {
  return value === null || value === undefined || value === ''
    ? null
    : normalizePositiveInteger(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeTimestamp(value, fallback = new Date()) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? fallback : timestamp;
}

function toIsoTimestamp(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? fallback : timestamp.toISOString();
}

function normalizeRetentionBatchSize(value) {
  const parsed = normalizePositiveInteger(
    value,
    DEFAULT_POLICY_ROLLBACK_SNAPSHOT_RETENTION_BATCH_SIZE
  );

  return Math.min(
    MAX_POLICY_ROLLBACK_SNAPSHOT_RETENTION_BATCH_SIZE,
    Math.max(1, parsed)
  );
}

function canonicalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((normalized, key) => {
        normalized[key] = canonicalizeJson(value[key]);
        return normalized;
      }, {});
  }

  return value;
}

function serializeSnapshotPayload(payload) {
  return JSON.stringify(canonicalizeJson(asObject(payload)));
}

function buildPayloadDigest(payload) {
  return `sha256:${createHash('sha256')
    .update(serializeSnapshotPayload(payload), 'utf8')
    .digest('hex')}`;
}

function buildSnapshotAuditMetadata(sourceEvent = {}) {
  const eventMetadata = asObject(sourceEvent.metadata);

  return {
    migration_event_id: normalizeNullableInteger(sourceEvent.id),
    actor_type: normalizeNullableString(sourceEvent.actor_type),
    actor_id: normalizeNullableInteger(sourceEvent.actor_id),
    actor_source_id: normalizeNullableString(
      eventMetadata.actorSourceId ?? eventMetadata.actor_source_id
    ),
    reason_code: normalizeNullableString(sourceEvent.reason_code),
  };
}

function buildRedactedRollbackSnapshotPayload({ snapshot = {}, sourceEvent = {}, now = new Date() } = {}) {
  const originalPayload = asObject(snapshot.snapshot_payload);
  const serializedPayload = serializeSnapshotPayload(originalPayload);
  const redactedAt = normalizeTimestamp(now).toISOString();

  return {
    retention_marker: {
      version: POLICY_ROLLBACK_SNAPSHOT_RETENTION_MARKER_VERSION,
      state: 'expired_payload_redacted',
      redacted_at: redactedAt,
      policy_id: normalizePositiveInteger(snapshot.policy_id),
      intent_id: normalizePositiveInteger(snapshot.intent_id),
      snapshot_version: normalizePositiveInteger(snapshot.snapshot_version),
      created_at: toIsoTimestamp(snapshot.created_at),
      expires_at: toIsoTimestamp(snapshot.expires_at),
      restored_at: toIsoTimestamp(snapshot.restored_at),
      restore_path: normalizeNullableString(snapshot.restore_path),
      payload_digest: buildPayloadDigest(originalPayload),
      payload_bytes: Buffer.byteLength(serializedPayload, 'utf8'),
      source_audit: buildSnapshotAuditMetadata(sourceEvent),
    },
  };
}

function buildPolicyRollbackSnapshotRetentionResult({
  statusId,
  evaluatedAt = new Date(),
  batchSize = DEFAULT_POLICY_ROLLBACK_SNAPSHOT_RETENTION_BATCH_SIZE,
  redactedSnapshotIds = [],
  hasMore = false,
  riskId = null,
  message = null,
} = {}) {
  const normalizedIds = [...new Set(
    (Array.isArray(redactedSnapshotIds) ? redactedSnapshotIds : [])
      .map(value => normalizePositiveInteger(value))
      .filter(Boolean)
  )];
  const normalizedStatusId = Object.values(POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS)
    .includes(statusId)
    ? statusId
    : POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS.FAILED_ROLLED_BACK;

  return {
    version: POLICY_ROLLBACK_SNAPSHOT_RETENTION_VERSION,
    statusId: normalizedStatusId,
    evaluatedAt: normalizeTimestamp(evaluatedAt).toISOString(),
    batchSize: normalizeRetentionBatchSize(batchSize),
    redactedSnapshotCount: normalizedIds.length,
    redactedSnapshotIds: normalizedIds,
    hasMore: hasMore === true,
    rawPayloadExposed: false,
    sideEffects: {
      payloadsRedacted: normalizedIds.length > 0,
      migrationEventsWritten: normalizedIds.length > 0,
      rollbackSnapshotsDeleted: false,
      nativeAuthorityChanged: false,
      legacyRowsChanged: false,
    },
    reason: riskId || message
      ? { reasonId: riskId, message: message || null }
      : null,
  };
}

export {
  DEFAULT_POLICY_ROLLBACK_SNAPSHOT_RETENTION_BATCH_SIZE,
  MAX_POLICY_ROLLBACK_SNAPSHOT_RETENTION_BATCH_SIZE,
  POLICY_ROLLBACK_SNAPSHOT_RETENTION_MARKER_VERSION,
  POLICY_ROLLBACK_SNAPSHOT_RETENTION_RISK_IDS,
  POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS,
  POLICY_ROLLBACK_SNAPSHOT_RETENTION_VERSION,
  buildPayloadDigest,
  buildPolicyRollbackSnapshotRetentionResult,
  buildRedactedRollbackSnapshotPayload,
  normalizeRetentionBatchSize,
  normalizeTimestamp,
};
