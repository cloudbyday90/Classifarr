/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createHash } from 'node:crypto';

const POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_CONTEXT_FINGERPRINT_VERSION =
  'policy.compatibility_deletion_release_prerequisite_context_fingerprint.v1';
const POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_EVIDENCE_VERSION =
  'policy.compatibility_deletion_release_prerequisite_evidence.v1';
const POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_EVALUATION_VERSION =
  'policy.compatibility_deletion_release_prerequisite_evaluation.v1';

const POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_EVIDENCE_STATUS_IDS = Object.freeze({
  BLOCKED: 'blocked',
  READY: 'ready',
});

const POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS = Object.freeze({
  DELETION_MANIFEST_APPROVAL: 'deletion_manifest_approval',
  ROLLBACK_SUPPORT: 'rollback_support',
  SUPPORT_DIAGNOSTICS: 'support_diagnostics',
});

const POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS = Object.freeze({
  CONTEXT_FINGERPRINT_MALFORMED: 'context_fingerprint_malformed',
  CONTEXT_FINGERPRINT_MISMATCH: 'context_fingerprint_mismatch',
  EVIDENCE_FUTURE: 'evidence_future',
  EVIDENCE_MISSING: 'evidence_missing',
  EVIDENCE_STALE: 'evidence_stale',
  EVIDENCE_TIMESTAMP_INVALID: 'evidence_timestamp_invalid',
  EVIDENCE_VERSION_INVALID: 'evidence_version_invalid',
  PREREQUISITE_DUPLICATE: 'prerequisite_duplicate',
  PREREQUISITE_MISSING: 'prerequisite_missing',
  PREREQUISITE_STATUS_INVALID: 'prerequisite_status_invalid',
  PREREQUISITE_UNKNOWN: 'prerequisite_unknown',
  SUBJECT_INVALID: 'subject_invalid',
  UNKNOWN_FIELD: 'unknown_field',
});

const REQUIRED_PREREQUISITES = Object.freeze([
  {
    id: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS.ROLLBACK_SUPPORT,
    statusId: 'verified',
  },
  {
    id: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS.SUPPORT_DIAGNOSTICS,
    statusId: 'verified',
  },
  {
    id: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS.DELETION_MANIFEST_APPROVAL,
    statusId: 'approved',
  },
]);

const DEFAULT_MAX_EVIDENCE_AGE_MS = 5 * 60 * 1000;
const MAX_FUTURE_TIMESTAMP_SKEW_MS = 1000;
const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const SUBJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/u;
const SUBJECT_TYPE = 'release_operator';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildRisk(riskId, message) {
  return { riskId, message };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(item => stableValue(item));
  if (!value || typeof value !== 'object') {
    return typeof value === 'bigint' ? value.toString() : value;
  }

  return Object.keys(value)
    .filter(key => !['function', 'symbol', 'undefined'].includes(typeof value[key]))
    .sort()
    .reduce((normalized, key) => {
      normalized[key] = stableValue(value[key]);
      return normalized;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function parseTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { timestampMs: value.getTime(), value: value.toISOString() };
  }

  if (typeof value !== 'string' || !value.trim()) return null;

  const timestampMs = Date.parse(value);
  return Number.isNaN(timestampMs) ? null : { timestampMs, value: value.trim() };
}

function resolveTimestamp(value) {
  return parseTimestamp(value) || { timestampMs: Date.now(), value: new Date().toISOString() };
}

function normalizeMaximumEvidenceAge(value) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 &&
    normalized <= DEFAULT_MAX_EVIDENCE_AGE_MS
    ? normalized
    : DEFAULT_MAX_EVIDENCE_AGE_MS;
}

function normalizeResidualReferences(references = []) {
  return asArray(references)
    .map(reference => {
      const value = typeof reference === 'string' ? { path: reference } : asObject(reference);
      return {
        owner: value.owner || null,
        path: value.path || null,
        replacement: value.replacement || null,
      };
    })
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
}

function buildEvidenceSourceProjection(source = {}, fields = []) {
  const value = asObject(source);
  const projection = {
    generatedAt: value.generatedAt || null,
    statusId: value.statusId || null,
    validationOk: value.validation?.ok === true || value.validationOk === true,
    version: value.version || null,
  };

  fields.forEach(fieldName => {
    projection[fieldName] = value[fieldName] ??
      value.policyCounts?.[fieldName] ??
      value.verification?.[fieldName] ??
      null;
  });

  return projection;
}

function buildPolicyCompatibilityDeletionReleasePrerequisiteContextProjection({
  backupRestoreEvidence = null,
  currentPolicyInventory = null,
  cutoverVerification = null,
  deletionGatePlan = null,
  reconciliationStateInventory = null,
  residualCompatibilityReferences = [],
} = {}) {
  return {
    version: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_CONTEXT_FINGERPRINT_VERSION,
    backupRestoreEvidence: buildEvidenceSourceProjection(backupRestoreEvidence, [
      'backupRestoreVerified',
      'latestVerifiedAt',
    ]),
    currentPolicyInventory: buildEvidenceSourceProjection(currentPolicyInventory, [
      'unconvertedPolicyCount',
    ]),
    cutoverVerification: buildEvidenceSourceProjection(cutoverVerification),
    deletionGatePlan: buildEvidenceSourceProjection(deletionGatePlan, [
      'requiresMaintenanceStateCount',
      'unconvertedPolicyCount',
    ]),
    reconciliationStateInventory: buildEvidenceSourceProjection(
      reconciliationStateInventory,
      ['requiresMaintenanceStateCount']
    ),
    residualCompatibilityReferences: normalizeResidualReferences(residualCompatibilityReferences),
  };
}

function buildPolicyCompatibilityDeletionReleasePrerequisiteContextFingerprint(input = {}) {
  const projection = buildPolicyCompatibilityDeletionReleasePrerequisiteContextProjection(input);

  return {
    algorithm: 'sha256',
    fingerprint: createHash('sha256')
      .update(stableStringify(projection))
      .digest('hex'),
    version: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_CONTEXT_FINGERPRINT_VERSION,
  };
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(asObject(value)).every(key => allowedKeys.includes(key));
}

function isExpectedContextFingerprint(value, expected) {
  const fingerprint = asObject(value);
  return fingerprint.version === expected.version &&
    fingerprint.algorithm === expected.algorithm &&
    fingerprint.fingerprint === expected.fingerprint &&
    SHA256_FINGERPRINT_PATTERN.test(String(fingerprint.fingerprint || '')) &&
    hasOnlyKeys(fingerprint, ['algorithm', 'fingerprint', 'version']);
}

function buildEmptyPrerequisiteState() {
  return {
    deletionManifestApproved: false,
    rollbackSupportVerified: false,
    supportDiagnosticsVerified: false,
  };
}

function assignPrerequisiteState(state, prerequisiteId, verified) {
  if (prerequisiteId === POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS.ROLLBACK_SUPPORT) {
    state.rollbackSupportVerified = verified;
  }
  if (prerequisiteId === POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS.SUPPORT_DIAGNOSTICS) {
    state.supportDiagnosticsVerified = verified;
  }
  if (prerequisiteId === POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS
    .DELETION_MANIFEST_APPROVAL) {
    state.deletionManifestApproved = verified;
  }
}

function validateSubject(subject, risks) {
  const value = asObject(subject);
  const valid = value.subjectType === SUBJECT_TYPE &&
    SUBJECT_ID_PATTERN.test(String(value.subjectId || '')) &&
    hasOnlyKeys(value, ['subjectId', 'subjectType']);

  if (!valid) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.SUBJECT_INVALID,
      'Release-prerequisite evidence requires one constrained release-review subject.'
    ));
    return null;
  }

  return {
    subjectId: value.subjectId,
    subjectType: value.subjectType,
  };
}

function evaluatePolicyCompatibilityDeletionReleasePrerequisiteEvidence({
  evidence = null,
  expectedContextFingerprint = null,
  maxEvidenceAgeMs = DEFAULT_MAX_EVIDENCE_AGE_MS,
  now = null,
} = {}) {
  const risks = [];
  const prerequisiteState = buildEmptyPrerequisiteState();
  const attestationStatuses = {};
  const expectedFingerprint = asObject(expectedContextFingerprint);
  const source = evidence && typeof evidence === 'object' && !Array.isArray(evidence)
    ? evidence
    : null;
  const evaluationTimestamp = resolveTimestamp(now);
  const maximumEvidenceAgeMs = normalizeMaximumEvidenceAge(maxEvidenceAgeMs);

  if (!source) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.EVIDENCE_MISSING,
      'Compatibility deletion requires release-prerequisite evidence.'
    ));
  }

  if (source && !hasOnlyKeys(source, [
    'attestations',
    'contextFingerprint',
    'generatedAt',
    'subject',
    'version',
  ])) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.UNKNOWN_FIELD,
      'Release-prerequisite evidence contains unsupported fields.'
    ));
  }

  if (source && source.version !== POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_EVIDENCE_VERSION) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.EVIDENCE_VERSION_INVALID,
      'Release-prerequisite evidence must use the current contract version.'
    ));
  }

  const generatedAt = parseTimestamp(source?.generatedAt);
  if (!generatedAt) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.EVIDENCE_TIMESTAMP_INVALID,
      'Release-prerequisite evidence must include a valid ISO timestamp.'
    ));
  } else {
    const ageMs = evaluationTimestamp.timestampMs - generatedAt.timestampMs;
    if (ageMs < -MAX_FUTURE_TIMESTAMP_SKEW_MS) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.EVIDENCE_FUTURE,
        'Release-prerequisite evidence cannot be dated after the current evidence window.'
      ));
    } else if (ageMs > maximumEvidenceAgeMs) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.EVIDENCE_STALE,
        'Release-prerequisite evidence must be refreshed for the current release context.'
      ));
    }
  }

  const subject = validateSubject(source?.subject, risks);

  if (!isExpectedContextFingerprint(source?.contextFingerprint, expectedFingerprint)) {
    const provided = asObject(source?.contextFingerprint);
    risks.push(buildRisk(
      provided.version !== expectedFingerprint.version ||
        provided.algorithm !== expectedFingerprint.algorithm ||
        !SHA256_FINGERPRINT_PATTERN.test(String(provided.fingerprint || ''))
        ? POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS
          .CONTEXT_FINGERPRINT_MALFORMED
        : POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS
          .CONTEXT_FINGERPRINT_MISMATCH,
      'Release-prerequisite evidence must bind the current release context fingerprint.'
    ));
  }

  const seenPrerequisites = new Set();
  const attestations = Array.isArray(source?.attestations) ? source.attestations : null;
  if (!attestations) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.PREREQUISITE_MISSING,
      'Release-prerequisite evidence must include every required attestation.'
    ));
  } else {
    attestations.forEach(attestation => {
      const value = asObject(attestation);
      const prerequisite = REQUIRED_PREREQUISITES.find(
        candidate => candidate.id === value.prerequisiteId
      );

      if (!prerequisite) {
        risks.push(buildRisk(
          POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.PREREQUISITE_UNKNOWN,
          'Release-prerequisite evidence contains an unknown attestation.'
        ));
        return;
      }
      if (!hasOnlyKeys(value, ['prerequisiteId', 'statusId'])) {
        risks.push(buildRisk(
          POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.UNKNOWN_FIELD,
          'Release-prerequisite attestation contains unsupported fields.'
        ));
      }
      if (seenPrerequisites.has(prerequisite.id)) {
        risks.push(buildRisk(
          POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.PREREQUISITE_DUPLICATE,
          'Release-prerequisite evidence cannot repeat an attestation.'
        ));
        return;
      }

      seenPrerequisites.add(prerequisite.id);
      attestationStatuses[prerequisite.id] =
        typeof value.statusId === 'string' ? value.statusId : null;
      const verified = value.statusId === prerequisite.statusId;
      assignPrerequisiteState(prerequisiteState, prerequisite.id, verified);
      if (!verified) {
        risks.push(buildRisk(
          POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.PREREQUISITE_STATUS_INVALID,
          'Release-prerequisite attestation has an invalid status.'
        ));
      }
    });
  }

  REQUIRED_PREREQUISITES.forEach(prerequisite => {
    if (!seenPrerequisites.has(prerequisite.id)) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.PREREQUISITE_MISSING,
        'Release-prerequisite evidence must include every required attestation.'
      ));
    }
  });

  const ready = risks.length === 0;
  return {
    version: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_EVALUATION_VERSION,
    statusId: ready
      ? POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_EVIDENCE_STATUS_IDS.READY
      : POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_EVIDENCE_STATUS_IDS.BLOCKED,
    ready,
    generatedAt: generatedAt?.value || null,
    subject,
    contextFingerprint: {
      algorithm: expectedFingerprint.algorithm || null,
      fingerprint: expectedFingerprint.fingerprint || null,
      version: expectedFingerprint.version || null,
    },
    prerequisites: prerequisiteState,
    evidence: {
      version: source?.version || null,
      generatedAt: generatedAt?.value || null,
      subject,
      contextFingerprint: {
        algorithm: expectedFingerprint.algorithm || null,
        fingerprint: expectedFingerprint.fingerprint || null,
        version: expectedFingerprint.version || null,
      },
      attestations: REQUIRED_PREREQUISITES.map(prerequisite => ({
        prerequisiteId: prerequisite.id,
        statusId: attestationStatuses[prerequisite.id] || null,
      })),
    },
    riskCount: risks.length,
    risks,
  };
}

export {
  DEFAULT_MAX_EVIDENCE_AGE_MS,
  POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_CONTEXT_FINGERPRINT_VERSION,
  POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_EVALUATION_VERSION,
  POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_EVIDENCE_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_EVIDENCE_VERSION,
  POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS,
  POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS,
  buildPolicyCompatibilityDeletionReleasePrerequisiteContextFingerprint,
  buildPolicyCompatibilityDeletionReleasePrerequisiteContextProjection,
  evaluatePolicyCompatibilityDeletionReleasePrerequisiteEvidence,
};
