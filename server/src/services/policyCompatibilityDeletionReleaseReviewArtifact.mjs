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

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION,
} from './policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_CONTEXT_FINGERPRINT_VERSION,
  POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS,
  buildPolicyCompatibilityDeletionReleasePrerequisiteContextFingerprint,
} from './policyCompatibilityDeletionReleasePrerequisiteEvidence.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_FINGERPRINT_VERSION,
  SHA256_FINGERPRINT_PATTERN,
  buildPolicyCompatibilityDeletionReleaseReviewArtifactFingerprint,
  buildPolicyCompatibilityDeletionReleaseReviewArtifactProjection,
  buildPolicyCompatibilityDeletionReleaseReviewSourceProjection,
  buildReleasePrerequisiteContextFromEvidenceBundle,
  buildReleasePrerequisiteContextFromSourceProjection,
  buildSourceEvidence,
  buildSourceBundleFingerprint,
  isExpectedFingerprint,
} from './policyCompatibilityDeletionReleaseReviewArtifactFingerprint.mjs';
import { stableStringify } from './policyEvidenceFingerprint.mjs';

const POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_VERSION =
  'policy.compatibility_deletion_release_review_artifact.v1';
const POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_STATUS_IDS = Object.freeze({
  BLOCKED: 'blocked',
  REVIEW_REQUIRED: 'review_required',
});

const POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS = Object.freeze({
  ARTIFACT_FINGERPRINT_INVALID: 'artifact_fingerprint_invalid',
  EVIDENCE_BUNDLE_FUTURE: 'evidence_bundle_future',
  EVIDENCE_BUNDLE_STALE: 'evidence_bundle_stale',
  EVIDENCE_BUNDLE_TIMESTAMP_INVALID: 'evidence_bundle_timestamp_invalid',
  EVIDENCE_BUNDLE_VERSION_INVALID: 'evidence_bundle_version_invalid',
  INPUT_NOT_OBJECT: 'input_not_object',
  RELEASE_CONTEXT_FINGERPRINT_INVALID: 'release_context_fingerprint_invalid',
  RELEASE_CONTEXT_FINGERPRINT_MISMATCH: 'release_context_fingerprint_mismatch',
  REVIEW_REQUIREMENTS_INVALID: 'review_requirements_invalid',
  REVIEW_STATE_INVALID: 'review_state_invalid',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
  SOURCE_BUNDLE_FINGERPRINT_INVALID: 'source_bundle_fingerprint_invalid',
  SOURCE_RISK_COUNT_MISMATCH: 'source_risk_count_mismatch',
  UNKNOWN_ARTIFACT_FIELD: 'unknown_artifact_field',
  UNKNOWN_STATUS: 'unknown_status',
  VERSION_INVALID: 'version_invalid',
});

const DEFAULT_MAX_EVIDENCE_AGE_MS = 5 * 60 * 1000;
const MAX_FUTURE_TIMESTAMP_SKEW_MS = 1000;

const REVIEW_REQUIREMENTS = Object.freeze([
  {
    prerequisiteId: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS
      .ROLLBACK_SUPPORT,
    requiredStatusId: 'verified',
  },
  {
    prerequisiteId: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS
      .SUPPORT_DIAGNOSTICS,
    requiredStatusId: 'verified',
  },
  {
    prerequisiteId: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS
      .DELETION_MANIFEST_APPROVAL,
    requiredStatusId: 'approved',
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(asObject(value)).every(key => allowedKeys.includes(key));
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

function evaluateSourceEvidence({
  executionPlanEvidenceBundle = null,
  generatedAt,
  now,
} = {}) {
  const risks = [];
  const bundle = asObject(executionPlanEvidenceBundle);
  const bundleTimestamp = parseTimestamp(bundle.generatedAt);
  const evaluationTimestamp = resolveTimestamp(now);
  const maximumEvidenceAgeMs = normalizeMaximumEvidenceAge(
    bundle.freshness?.maximumEvidenceAgeMs
  );

  if (bundle.version !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
        .EVIDENCE_BUNDLE_VERSION_INVALID,
      'Release review requires the current execution-plan evidence-bundle contract.'
    ));
  }

  if (!bundleTimestamp) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
        .EVIDENCE_BUNDLE_TIMESTAMP_INVALID,
      'Release review requires a valid execution-plan evidence collection timestamp.'
    ));
  } else {
    const ageMs = evaluationTimestamp.timestampMs - bundleTimestamp.timestampMs;

    if (ageMs < -MAX_FUTURE_TIMESTAMP_SKEW_MS) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
          .EVIDENCE_BUNDLE_FUTURE,
        'Release review cannot use execution-plan evidence dated after the review window.'
      ));
    } else if (ageMs > maximumEvidenceAgeMs) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
          .EVIDENCE_BUNDLE_STALE,
        'Release review requires newly collected execution-plan evidence.'
      ));
    }
  }

  const providedContextFingerprint =
    asObject(bundle.deletionReadiness).releasePrerequisiteContextFingerprint;
  const expectedContextFingerprint =
    buildPolicyCompatibilityDeletionReleasePrerequisiteContextFingerprint(
      buildReleasePrerequisiteContextFromEvidenceBundle(bundle)
    );

  if (!isExpectedFingerprint(providedContextFingerprint, expectedContextFingerprint)) {
    const provided = asObject(providedContextFingerprint);
    risks.push(buildRisk(
      provided.version !== POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_CONTEXT_FINGERPRINT_VERSION ||
        provided.algorithm !== 'sha256' ||
        !SHA256_FINGERPRINT_PATTERN.test(String(provided.fingerprint || ''))
        ? POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
          .RELEASE_CONTEXT_FINGERPRINT_INVALID
        : POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
          .RELEASE_CONTEXT_FINGERPRINT_MISMATCH,
      'Release review requires a release-prerequisite context fingerprint bound to its source evidence.'
    ));
  }

  const artifactTimestamp = parseTimestamp(generatedAt);
  if (!artifactTimestamp) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
        .EVIDENCE_BUNDLE_TIMESTAMP_INVALID,
      'Release review artifact generation requires a valid timestamp.'
    ));
  }

  return {
    maximumEvidenceAgeMs,
    risks,
    sourceEvidence: buildSourceEvidence({ executionPlanEvidenceBundle: bundle }),
    sourceTimestamp: bundleTimestamp,
  };
}

function buildReviewRequirements() {
  return {
    requiredSubjectType: 'release_operator',
    attestations: REVIEW_REQUIREMENTS.map(requirement => ({ ...requirement })),
    approvalIsNotAutomatic: true,
  };
}

function reviewRequirementsMatch(value) {
  const requirements = asObject(value);
  const attestations = asArray(requirements.attestations);

  return hasOnlyKeys(requirements, [
    'approvalIsNotAutomatic',
    'attestations',
    'requiredSubjectType',
  ]) &&
    requirements.requiredSubjectType === 'release_operator' &&
    requirements.approvalIsNotAutomatic === true &&
    stableStringify(attestations) === stableStringify(REVIEW_REQUIREMENTS);
}

function buildArtifactRisks(artifact = {}) {
  const value = asObject(artifact);
  const risks = [];

  if (artifact === null || typeof artifact !== 'object' || Array.isArray(artifact)) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS.INPUT_NOT_OBJECT,
      'Release review artifact must be an object.'
    ));
  }

  if (!hasOnlyKeys(value, [
    'artifactFingerprint',
    'generatedAt',
    'reviewExpiresAt',
    'reviewRequired',
    'reviewRequirements',
    'sideEffects',
    'sourceEvidence',
    'sourceRiskCount',
    'sourceRisks',
    'statusId',
    'validation',
    'version',
  ])) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS.UNKNOWN_ARTIFACT_FIELD,
      'Release review artifact contains unsupported fields.'
    ));
  }

  if (!Object.values(POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_STATUS_IDS)
    .includes(value.statusId)) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      'Release review artifact status must be known.'
    ));
  }

  if (value.version !== POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_VERSION) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS.VERSION_INVALID,
      'Release review artifact must use the current contract version.'
    ));
  }

  const expectedState = value.statusId ===
    POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_STATUS_IDS.REVIEW_REQUIRED;
  if (value.reviewRequired !== expectedState) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS.REVIEW_STATE_INVALID,
      'Release review artifacts may require review but can never represent approval.'
    ));
  }

  if (!reviewRequirementsMatch(value.reviewRequirements)) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS.REVIEW_REQUIREMENTS_INVALID,
      'Release review artifact requirements must retain the exact non-automatic review contract.'
    ));
  }

  if (value.sourceRiskCount !== asArray(value.sourceRisks).length) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
        .SOURCE_RISK_COUNT_MISMATCH,
      'Release review artifact source risk count must match its bounded risk list.'
    ));
  }

  const sourceEvidence = asObject(value.sourceEvidence);
  const sourceProjection = asObject(sourceEvidence.executionPlanEvidenceBundle);
  const expectedSourceFingerprint = buildSourceBundleFingerprint(sourceProjection);
  if (!isExpectedFingerprint(sourceEvidence.sourceBundleFingerprint, expectedSourceFingerprint)) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
        .SOURCE_BUNDLE_FINGERPRINT_INVALID,
      'Release review source evidence must retain its bounded SHA-256 fingerprint.'
    ));
  }

  const expectedContextFingerprint =
    buildPolicyCompatibilityDeletionReleasePrerequisiteContextFingerprint(
      buildReleasePrerequisiteContextFromSourceProjection(sourceProjection)
    );
  if (!isExpectedFingerprint(
    sourceEvidence.releasePrerequisiteContextFingerprint,
    expectedContextFingerprint
  )) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
        .RELEASE_CONTEXT_FINGERPRINT_MISMATCH,
      'Release review artifact must retain the context fingerprint derived from its bounded source evidence.'
    ));
  }

  const expectedArtifactFingerprint =
    buildPolicyCompatibilityDeletionReleaseReviewArtifactFingerprint({ artifact: value });
  if (!isExpectedFingerprint(value.artifactFingerprint, expectedArtifactFingerprint)) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS
        .ARTIFACT_FINGERPRINT_INVALID,
      'Release review artifact fingerprint must bind its complete bounded review request.'
    ));
  }

  Object.entries(asObject(value.sideEffects)).forEach(([key, sideEffect]) => {
    if (sideEffect === true) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Release review artifact cannot report side effect "${key}".`
      ));
    }
  });

  return risks;
}

function validatePolicyCompatibilityDeletionReleaseReviewArtifact(artifact = {}) {
  const issues = buildArtifactRisks(artifact);

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyCompatibilityDeletionReleaseReviewArtifact({
  executionPlanEvidenceBundle = null,
  generatedAt = null,
  now = null,
  sideEffects = {},
} = {}) {
  const generationTimestamp = resolveTimestamp(generatedAt || now);
  const source = evaluateSourceEvidence({
    executionPlanEvidenceBundle,
    generatedAt: generationTimestamp.value,
    now: now || generationTimestamp.value,
  });
  const reviewExpiresAt = source.sourceTimestamp
    ? new Date(source.sourceTimestamp.timestampMs + source.maximumEvidenceAgeMs).toISOString()
    : null;
  const statusId = source.risks.length === 0
    ? POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_STATUS_IDS.REVIEW_REQUIRED
    : POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_STATUS_IDS.BLOCKED;
  const artifact = {
    version: POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_VERSION,
    generatedAt: generationTimestamp.value,
    statusId,
    reviewRequired:
      statusId === POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_STATUS_IDS.REVIEW_REQUIRED,
    reviewExpiresAt,
    sourceEvidence: source.sourceEvidence,
    reviewRequirements: buildReviewRequirements(),
    sourceRiskCount: source.risks.length,
    sourceRisks: source.risks.map(risk => ({ riskId: risk.riskId })),
    sideEffects: {
      filesDeleted: sideEffects.filesDeleted === true,
      gitCommandsRun: sideEffects.gitCommandsRun === true,
      storageChanged: sideEffects.storageChanged === true,
    },
  };
  const artifactWithFingerprint = {
    ...artifact,
    artifactFingerprint:
      buildPolicyCompatibilityDeletionReleaseReviewArtifactFingerprint({ artifact }),
  };

  return {
    ...artifactWithFingerprint,
    validation: validatePolicyCompatibilityDeletionReleaseReviewArtifact(artifactWithFingerprint),
  };
}

export {
  POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_FINGERPRINT_VERSION,
  POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_VERSION,
  buildPolicyCompatibilityDeletionReleaseReviewArtifact,
  buildPolicyCompatibilityDeletionReleaseReviewArtifactFingerprint,
  buildPolicyCompatibilityDeletionReleaseReviewArtifactProjection,
  buildPolicyCompatibilityDeletionReleaseReviewSourceProjection,
  validatePolicyCompatibilityDeletionReleaseReviewArtifact,
};
