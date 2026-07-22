/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createHash } from 'node:crypto';
import {
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_VERSION,
} from './policyObservedEvidenceProvenanceContract.mjs';
import { stableStringify } from './policyEvidenceFingerprint.mjs';

const POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_VERSION =
  'policy.observed_evidence_provenance_retention.v1';
const POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_MARKER_VERSION = 1;
const DEFAULT_POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_BATCH_SIZE = 100;
const MAX_POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_BATCH_SIZE = 500;

const POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS = Object.freeze({
  COMPLETED: 'completed',
  CLEANUP_LOCKED: 'cleanup_locked',
  TRANSACTION_BOUNDARY_REQUIRED: 'transaction_boundary_required',
  FAILED_ROLLED_BACK: 'failed_rolled_back',
});

const POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_RISK_IDS = Object.freeze({
  CLEANUP_LOCK_NOT_ACQUIRED: 'cleanup_lock_not_acquired',
  TRANSACTION_BOUNDARY_REQUIRED: 'transaction_boundary_required',
  SNAPSHOT_REDACTION_NOT_APPLIED: 'snapshot_redaction_not_applied',
  TRANSACTION_FAILED: 'transaction_failed',
});

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value, fallback = null) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeTimestamp(value, fallback = new Date()) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? fallback : timestamp;
}

function toIsoTimestamp(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;

  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? fallback : timestamp.toISOString();
}

function normalizeRetentionBatchSize(value) {
  const parsed = normalizePositiveInteger(
    value,
    DEFAULT_POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_BATCH_SIZE
  );

  return Math.min(
    MAX_POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_BATCH_SIZE,
    Math.max(1, parsed)
  );
}

function buildPayloadDigest(payload) {
  return `sha256:${createHash('sha256')
    .update(stableStringify(asPlainObject(payload)), 'utf8')
    .digest('hex')}`;
}

function buildRedactedObservedEvidenceProvenancePayload({ snapshot = {}, now = new Date() } = {}) {
  const originalPayload = asPlainObject(snapshot.snapshot_payload);
  const serializedPayload = stableStringify(originalPayload);
  const redactedAt = normalizeTimestamp(now).toISOString();

  return {
    retention_marker: {
      version: POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_MARKER_VERSION,
      state: 'expired_payload_redacted',
      redacted_at: redactedAt,
      provenance_version: POLICY_OBSERVED_EVIDENCE_PROVENANCE_VERSION,
      policy_id: normalizePositiveInteger(snapshot.policy_id),
      library_id: normalizePositiveInteger(snapshot.library_id),
      intent_id: normalizePositiveInteger(snapshot.intent_id),
      establishment_id: normalizePositiveInteger(snapshot.establishment_id),
      snapshot_version: normalizePositiveInteger(snapshot.snapshot_version),
      source_id: typeof snapshot.source_id === 'string' ? snapshot.source_id : null,
      capture_state: typeof snapshot.capture_state === 'string' ? snapshot.capture_state : null,
      capture_reason_id: typeof snapshot.capture_reason_id === 'string'
        ? snapshot.capture_reason_id
        : null,
      profile_freshness_state: typeof snapshot.profile_freshness_state === 'string'
        ? snapshot.profile_freshness_state
        : null,
      source_profile_generated_at: toIsoTimestamp(snapshot.source_profile_generated_at),
      source_profile_updated_at: toIsoTimestamp(snapshot.source_profile_updated_at),
      evidence_fingerprint: typeof snapshot.evidence_fingerprint === 'string'
        ? snapshot.evidence_fingerprint
        : null,
      created_at: toIsoTimestamp(snapshot.created_at),
      expires_at: toIsoTimestamp(snapshot.expires_at),
      payload_digest: buildPayloadDigest(originalPayload),
      payload_bytes: Buffer.byteLength(serializedPayload, 'utf8'),
    },
  };
}

function buildObservedEvidenceProvenanceRetentionResult({
  statusId,
  evaluatedAt = new Date(),
  batchSize = DEFAULT_POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_BATCH_SIZE,
  redactedSnapshotIds = [],
  hasMore = false,
  riskId = null,
  message = null,
} = {}) {
  const ids = [...new Set(
    (Array.isArray(redactedSnapshotIds) ? redactedSnapshotIds : [])
      .map(value => normalizePositiveInteger(value))
      .filter(Boolean)
  )];
  const knownStatus = Object.values(
    POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS
  ).includes(statusId)
    ? statusId
    : POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS.FAILED_ROLLED_BACK;

  return {
    version: POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_VERSION,
    statusId: knownStatus,
    evaluatedAt: normalizeTimestamp(evaluatedAt).toISOString(),
    batchSize: normalizeRetentionBatchSize(batchSize),
    redactedSnapshotCount: ids.length,
    redactedSnapshotIds: ids,
    hasMore: hasMore === true,
    rawPayloadExposed: false,
    sideEffects: {
      payloadsRedacted: ids.length > 0,
      snapshotsDeleted: false,
      policyAuthorityChanged: false,
      policyRoutingChanged: false,
    },
    reason: riskId || message
      ? { reasonId: riskId, message: message || null }
      : null,
  };
}

export {
  DEFAULT_POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_BATCH_SIZE,
  MAX_POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_BATCH_SIZE,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_MARKER_VERSION,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_RISK_IDS,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_VERSION,
  buildObservedEvidenceProvenanceRetentionResult,
  buildPayloadDigest,
  buildRedactedObservedEvidenceProvenancePayload,
  normalizeRetentionBatchSize,
  normalizeTimestamp,
};
