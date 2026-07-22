/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createHash } from 'node:crypto';
import {
  AUTHORITY_LEVELS,
  AUTHORITY_SOURCE_IDS,
} from './policyAuthorityVocabulary.mjs';
import {
  buildBoundedPolicyEvidenceProjection,
  buildPolicyEvidenceBoundaryAudit,
} from './policyEvidenceBoundary.mjs';
import { stableStringify } from './policyEvidenceFingerprint.mjs';
import {
  buildPolicyLibraryProfileEvidence,
  buildPolicyLibraryProfileEvidenceAudit,
} from './policyLibraryProfileEvidence.mjs';
import {
  buildPolicyLibraryProfileFreshness,
} from './policyLibraryProfileEvidenceLoader.mjs';

const POLICY_OBSERVED_EVIDENCE_PROVENANCE_VERSION =
  'policy.observed_evidence_provenance.v1';
const POLICY_OBSERVED_EVIDENCE_PROVENANCE_SNAPSHOT_VERSION = 1;
const POLICY_OBSERVED_EVIDENCE_PROVENANCE_SOURCE_ID = 'stored_library_profile';
const POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_DAYS = 14;
const POLICY_OBSERVED_EVIDENCE_PROVENANCE_MAX_PAYLOAD_BYTES = 16 * 1024;

const POLICY_OBSERVED_EVIDENCE_PROVENANCE_CAPTURE_STATES = Object.freeze({
  CAPTURED: 'captured',
  PROFILE_UNAVAILABLE: 'profile_unavailable',
  PROFILE_REJECTED: 'profile_rejected',
});

const POLICY_OBSERVED_EVIDENCE_PROVENANCE_REASON_IDS = Object.freeze({
  STORED_PROFILE_CAPTURED: 'stored_profile_captured',
  STORED_PROFILE_MISSING: 'stored_profile_missing',
  STORED_PROFILE_REJECTED: 'stored_profile_rejected',
});

const POLICY_OBSERVED_EVIDENCE_PROVENANCE_FRESHNESS_STATES = Object.freeze({
  CURRENT: 'current',
  STALE: 'stale',
  UNAVAILABLE: 'unavailable',
});

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeTimestamp(value, fallback = new Date()) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? fallback : timestamp;
}

function toIsoTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;

  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function hasStoredProfile(profile) {
  return Boolean(profile) && typeof profile === 'object' && !Array.isArray(profile);
}

function buildPayloadFingerprint(payload) {
  return createHash('sha256')
    .update(stableStringify(payload), 'utf8')
    .digest('hex');
}

function buildExpirationTimestamp(capturedAt) {
  return new Date(
    capturedAt.getTime() +
    (POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  ).toISOString();
}

function buildUnavailablePayload({ capturedAt, state, reasonId }) {
  return {
    version: POLICY_OBSERVED_EVIDENCE_PROVENANCE_VERSION,
    classification: 'observed_context_not_policy_authority',
    captured_at: capturedAt.toISOString(),
    source: {
      id: POLICY_OBSERVED_EVIDENCE_PROVENANCE_SOURCE_ID,
      authority_source_id: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      authority_level: AUTHORITY_LEVELS.OBSERVED_EVIDENCE,
      durable_policy_authority: false,
    },
    capture: {
      state,
      reason_id: reasonId,
    },
    evidence: {
      available: false,
    },
  };
}

function buildCapturedPayload({
  capturedAt,
  profile,
  profileFreshness,
  evidenceBoundary,
}) {
  const projection = evidenceBoundary.projection;
  const fingerprint = evidenceBoundary.projectionFingerprint;

  return {
    version: POLICY_OBSERVED_EVIDENCE_PROVENANCE_VERSION,
    classification: 'observed_context_not_policy_authority',
    captured_at: capturedAt.toISOString(),
    source: {
      id: POLICY_OBSERVED_EVIDENCE_PROVENANCE_SOURCE_ID,
      authority_source_id: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      authority_level: AUTHORITY_LEVELS.OBSERVED_EVIDENCE,
      durable_policy_authority: false,
      profile_generated_at: toIsoTimestamp(profile.last_generated_at),
      profile_updated_at: toIsoTimestamp(profile.updated_at),
      profile_freshness: {
        state: profileFreshness.stale
          ? POLICY_OBSERVED_EVIDENCE_PROVENANCE_FRESHNESS_STATES.STALE
          : POLICY_OBSERVED_EVIDENCE_PROVENANCE_FRESHNESS_STATES.CURRENT,
        reason_id: profileFreshness.reasonCode,
      },
    },
    capture: {
      state: POLICY_OBSERVED_EVIDENCE_PROVENANCE_CAPTURE_STATES.CAPTURED,
      reason_id: POLICY_OBSERVED_EVIDENCE_PROVENANCE_REASON_IDS.STORED_PROFILE_CAPTURED,
    },
    evidence: {
      available: true,
      projection: {
        version: projection.version,
        buckets: projection.buckets,
        summary: projection.summary,
        quality: projection.quality,
        warnings: projection.warnings,
      },
      fingerprint: {
        version: fingerprint.version,
        algorithm: fingerprint.algorithm,
        value: fingerprint.fingerprint,
        provenance: fingerprint.provenance,
      },
    },
  };
}

function buildSnapshotResult({
  capturedAt,
  profile,
  captureState,
  captureReasonId,
  profileFreshnessState,
  payload,
}) {
  const serializedPayload = stableStringify(payload);
  const payloadBytes = Buffer.byteLength(serializedPayload, 'utf8');
  if (payloadBytes > POLICY_OBSERVED_EVIDENCE_PROVENANCE_MAX_PAYLOAD_BYTES) {
    throw new RangeError('Observed evidence provenance payload exceeds its bounded storage limit.');
  }

  return {
    snapshotVersion: POLICY_OBSERVED_EVIDENCE_PROVENANCE_SNAPSHOT_VERSION,
    sourceId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_SOURCE_ID,
    captureState,
    captureReasonId,
    profileFreshnessState,
    sourceProfileGeneratedAt: toIsoTimestamp(profile?.last_generated_at),
    sourceProfileUpdatedAt: toIsoTimestamp(profile?.updated_at),
    evidenceFingerprint: buildPayloadFingerprint(payload),
    snapshotPayload: payload,
    payloadBytes,
    expiresAt: buildExpirationTimestamp(capturedAt),
  };
}

function buildObservedEvidenceProvenanceSnapshot({
  profile = null,
  now = new Date(),
} = {}) {
  const capturedAt = normalizeTimestamp(now);
  if (!hasStoredProfile(profile)) {
    const payload = buildUnavailablePayload({
      capturedAt,
      state: POLICY_OBSERVED_EVIDENCE_PROVENANCE_CAPTURE_STATES.PROFILE_UNAVAILABLE,
      reasonId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_REASON_IDS.STORED_PROFILE_MISSING,
    });

    return buildSnapshotResult({
      capturedAt,
      profile: null,
      captureState: POLICY_OBSERVED_EVIDENCE_PROVENANCE_CAPTURE_STATES.PROFILE_UNAVAILABLE,
      captureReasonId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_REASON_IDS.STORED_PROFILE_MISSING,
      profileFreshnessState: POLICY_OBSERVED_EVIDENCE_PROVENANCE_FRESHNESS_STATES.UNAVAILABLE,
      payload,
    });
  }

  const normalizedProfile = asPlainObject(profile);
  const profileEvidence = buildPolicyLibraryProfileEvidence(normalizedProfile);
  const profileEvidenceAudit = buildPolicyLibraryProfileEvidenceAudit(profileEvidence);
  const profileFreshness = buildPolicyLibraryProfileFreshness({
    profile: normalizedProfile,
    now: capturedAt.getTime(),
  });
  const evidenceBoundary = profileEvidenceAudit.ok === true
    ? buildBoundedPolicyEvidenceProjection({
      evidenceInput: {
        libraryProfile: profileEvidence.libraryProfile,
        profileFreshness,
      },
    })
    : null;
  const boundaryAudit = evidenceBoundary
    ? buildPolicyEvidenceBoundaryAudit(evidenceBoundary)
    : { ok: false };

  if (profileEvidenceAudit.ok !== true || evidenceBoundary?.ok !== true || boundaryAudit.ok !== true) {
    const payload = buildUnavailablePayload({
      capturedAt,
      state: POLICY_OBSERVED_EVIDENCE_PROVENANCE_CAPTURE_STATES.PROFILE_REJECTED,
      reasonId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_REASON_IDS.STORED_PROFILE_REJECTED,
    });

    return buildSnapshotResult({
      capturedAt,
      profile: normalizedProfile,
      captureState: POLICY_OBSERVED_EVIDENCE_PROVENANCE_CAPTURE_STATES.PROFILE_REJECTED,
      captureReasonId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_REASON_IDS.STORED_PROFILE_REJECTED,
      profileFreshnessState: POLICY_OBSERVED_EVIDENCE_PROVENANCE_FRESHNESS_STATES.UNAVAILABLE,
      payload,
    });
  }

  const payload = buildCapturedPayload({
    capturedAt,
    profile: normalizedProfile,
    profileFreshness,
    evidenceBoundary,
  });

  return buildSnapshotResult({
    capturedAt,
    profile: normalizedProfile,
    captureState: POLICY_OBSERVED_EVIDENCE_PROVENANCE_CAPTURE_STATES.CAPTURED,
    captureReasonId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_REASON_IDS.STORED_PROFILE_CAPTURED,
    profileFreshnessState: profileFreshness.stale
      ? POLICY_OBSERVED_EVIDENCE_PROVENANCE_FRESHNESS_STATES.STALE
      : POLICY_OBSERVED_EVIDENCE_PROVENANCE_FRESHNESS_STATES.CURRENT,
    payload,
  });
}

export {
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_CAPTURE_STATES,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_FRESHNESS_STATES,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_MAX_PAYLOAD_BYTES,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_REASON_IDS,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_DAYS,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_SNAPSHOT_VERSION,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_SOURCE_ID,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_VERSION,
  buildObservedEvidenceProvenanceSnapshot,
  buildPayloadFingerprint,
};
