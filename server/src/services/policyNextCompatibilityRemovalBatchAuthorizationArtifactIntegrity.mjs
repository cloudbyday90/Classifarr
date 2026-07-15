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
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_VERSION,
  validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
} from './policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs';
import {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS,
  buildPolicyNextCompatibilityRemovalBatchAuthorization,
} from './policyNextCompatibilityRemovalBatchAuthorization.mjs';
import {
  validatePolicyPostRemovalRuntimeEvidenceArtifact,
} from './policyPostRemovalRuntimeEvidenceArtifact.mjs';

const POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_VERSION =
  'policy.next_compatibility_removal_batch_authorization_artifact_integrity.v1';

const POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS =
  Object.freeze({
    AUTHORIZATION_ARTIFACT_MISSING: 'authorization_artifact_missing',
    AUTHORIZATION_ARTIFACT_INVALID: 'authorization_artifact_invalid',
    AUTHORIZATION_ARTIFACT_NOT_AUTHORIZABLE: 'authorization_artifact_not_authorizable',
    RUNTIME_EVIDENCE_ARTIFACT_INVALID: 'runtime_evidence_artifact_invalid',
    REVIEW_ARTIFACT_FINGERPRINT_MISSING: 'review_artifact_fingerprint_missing',
    REVIEW_ARTIFACT_FINGERPRINT_MISMATCH: 'review_artifact_fingerprint_mismatch',
    EXECUTION_PLAN_ARTIFACT_FINGERPRINT_MISSING:
      'execution_plan_artifact_fingerprint_missing',
    EXECUTION_PLAN_ARTIFACT_FINGERPRINT_MISMATCH:
      'execution_plan_artifact_fingerprint_mismatch',
    PATH_STATE_EVIDENCE_INVALID: 'path_state_evidence_invalid',
    AUTHORIZATION_REPLAY_MISMATCH: 'authorization_replay_mismatch',
  });

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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

function normalizeFingerprint(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function authorizationRequestedPaths(authorization = {}) {
  return asArray(authorization.authorizedBatch?.entries)
    .map(entry => normalizePath(entry?.path))
    .filter(Boolean);
}

function authorizationReplayInput(authorization = {}) {
  return {
    requestedPaths: authorizationRequestedPaths(authorization),
    maxBatchSize: authorization.authorizedBatch?.maxBatchSize,
    authorizationReason: authorization.authorizedBatch?.authorizationReason,
    authorizedBy: authorization.authorizedBatch?.authorizedBy,
    reviewArtifactFingerprint:
      authorization.authorizationContext?.reviewArtifactFingerprint,
  };
}

function isAuthorizableArtifact(artifact = {}) {
  return [
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
      .READY_FOR_NEXT_BATCH,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
      .COMPLETE_NO_REMAINING_PATHS,
  ].includes(artifact.statusId);
}

function isAuthorizableAuthorization(authorization = {}) {
  return [
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .READY_FOR_NEXT_BATCH,
    POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
      .COMPLETE_NO_REMAINING_PATHS,
  ].includes(authorization.statusId) && authorization.validation?.ok === true;
}

function listAppliedPaths(runtimeEvidenceArtifact = {}) {
  return asArray(runtimeEvidenceArtifact.provenance?.appliedPaths)
    .map(normalizePath)
    .filter(Boolean);
}

async function validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifactIntegrity({
  authorizationArtifact = null,
  expectedExecutionPlanArtifactFingerprint = '',
  reviewArtifactFingerprint = '',
} = {}) {
  const risks = [];
  const artifact = asObject(authorizationArtifact);
  const authorization = asObject(artifact.authorization);

  if (Object.keys(artifact).length === 0) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS
        .AUTHORIZATION_ARTIFACT_MISSING,
      'Compatibility removal completion audit requires a next-batch authorization artifact.'
    ));
  }

  const artifactValidation =
    validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifact(artifact);
  if (
    artifact.version !== POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_VERSION ||
    artifact.validation?.ok !== true ||
    artifactValidation.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS
        .AUTHORIZATION_ARTIFACT_INVALID,
      'Compatibility removal completion audit requires a current fingerprint-valid next-batch authorization artifact.',
      {
        artifactVersion: artifact.version || null,
        issueCount: artifactValidation.issueCount,
        issueRiskIds: artifactValidation.issues.map(issue => issue.riskId),
      }
    ));
  }

  if (!isAuthorizableArtifact(artifact) || !isAuthorizableAuthorization(authorization)) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS
        .AUTHORIZATION_ARTIFACT_NOT_AUTHORIZABLE,
      'Compatibility removal completion audit requires ready or complete next-batch authorization evidence.',
      {
        artifactStatusId: artifact.statusId || null,
        authorizationStatusId: authorization.statusId || null,
      }
    ));
  }

  const runtimeEvidenceValidation = validatePolicyPostRemovalRuntimeEvidenceArtifact(
    artifact.runtimeEvidenceArtifact
  );
  if (!runtimeEvidenceValidation.ok) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS
        .RUNTIME_EVIDENCE_ARTIFACT_INVALID,
      'Compatibility removal completion audit requires the authorization artifact to retain intact runtime evidence.',
      {
        issueCount: runtimeEvidenceValidation.issueCount,
        issueRiskIds: runtimeEvidenceValidation.issues.map(issue => issue.riskId),
      }
    ));
  }

  const expectedReviewArtifactFingerprint =
    runtimeEvidenceValidation.reviewArtifactFingerprint || null;
  const artifactExecutionPlanArtifactFingerprint = normalizeFingerprint(
    artifact.executionPlanArtifact?.artifactFingerprint?.fingerprint
  );
  const expectedExecutionPlanFingerprint = normalizeFingerprint(
    expectedExecutionPlanArtifactFingerprint
  );
  const auditReviewArtifactFingerprint = normalizeFingerprint(reviewArtifactFingerprint);
  const authorizationReviewArtifactFingerprint = normalizeFingerprint(
    authorization.authorizationContext?.reviewArtifactFingerprint
  );

  if (!auditReviewArtifactFingerprint) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS
        .REVIEW_ARTIFACT_FINGERPRINT_MISSING,
      'Compatibility removal completion audit context must name the applied removal-review artifact fingerprint.'
    ));
  } else if (
    !expectedReviewArtifactFingerprint ||
    auditReviewArtifactFingerprint !== expectedReviewArtifactFingerprint
  ) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS
        .REVIEW_ARTIFACT_FINGERPRINT_MISMATCH,
      'Compatibility removal completion audit context must be bound to the applied removal-review artifact.',
      {
        expectedReviewArtifactFingerprint,
        actualReviewArtifactFingerprint: auditReviewArtifactFingerprint,
      }
    ));
  }

  if (
    expectedReviewArtifactFingerprint &&
    authorizationReviewArtifactFingerprint !== expectedReviewArtifactFingerprint
  ) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS
        .REVIEW_ARTIFACT_FINGERPRINT_MISMATCH,
      'Next-batch authorization context must be bound to the applied removal-review artifact.',
      {
        expectedReviewArtifactFingerprint,
        actualReviewArtifactFingerprint: authorizationReviewArtifactFingerprint || null,
        context: 'authorization_artifact',
      }
    ));
  }

  if (!artifactExecutionPlanArtifactFingerprint) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_FINGERPRINT_MISSING,
      'Next-batch authorization artifact must retain the approved execution-plan artifact fingerprint.'
    ));
  } else if (
    expectedExecutionPlanFingerprint &&
    artifactExecutionPlanArtifactFingerprint !== expectedExecutionPlanFingerprint
  ) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_FINGERPRINT_MISMATCH,
      'Next-batch authorization artifact must be bound to the execution-plan artifact expected by its consumer.',
      {
        expectedExecutionPlanArtifactFingerprint: expectedExecutionPlanFingerprint,
        actualExecutionPlanArtifactFingerprint: artifactExecutionPlanArtifactFingerprint,
      }
    ));
  }

  const replayedAuthorization = await buildPolicyNextCompatibilityRemovalBatchAuthorization({
    runtimeEvidenceArtifact: artifact.runtimeEvidenceArtifact,
    executionPlanArtifact: artifact.executionPlanArtifact,
    pathStateEvidence: artifact.pathStateEvidence,
    ...authorizationReplayInput(authorization),
  });

  if (replayedAuthorization.pathStateEvidence?.valid !== true) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS
        .PATH_STATE_EVIDENCE_INVALID,
      'Next-batch authorization artifact must retain replay-verified path-state evidence bound to its execution-plan artifact.',
      {
        authorizationStatusId: replayedAuthorization.statusId || null,
        pathStateEvidenceFingerprint:
          replayedAuthorization.pathStateEvidence?.fingerprint || null,
      }
    ));
  }

  if (stableStringify(authorization) !== stableStringify(replayedAuthorization)) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS
        .AUTHORIZATION_REPLAY_MISMATCH,
      'Next-batch authorization artifact does not match the current runtime evidence, review context, and execution manifest.',
      {
        artifactAuthorizationStatusId: authorization.statusId || null,
        replayAuthorizationStatusId: replayedAuthorization.statusId || null,
      }
    ));
  }

  return {
    version:
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_VERSION,
    ok: risks.length === 0,
    issueCount: risks.length,
    issues: risks,
    authorizationArtifact: artifact,
    authorization: replayedAuthorization,
    runtimeEvidenceValidation: {
      ok: runtimeEvidenceValidation.ok,
      issueCount: runtimeEvidenceValidation.issueCount,
      issueRiskIds: runtimeEvidenceValidation.issues.map(issue => issue.riskId),
    },
    reviewArtifactFingerprint: expectedReviewArtifactFingerprint,
    executionPlanArtifactFingerprint: artifactExecutionPlanArtifactFingerprint || null,
    pathStateEvidenceFingerprint:
      replayedAuthorization.pathStateEvidence?.fingerprint || null,
    appliedPaths: runtimeEvidenceValidation.ok
      ? listAppliedPaths(artifact.runtimeEvidenceArtifact)
      : [],
    policy: {
      requireFingerprintValidAuthorizationArtifact: true,
      requireRuntimeEvidenceArtifactIntegrity: true,
      requireReviewArtifactContext: true,
      requireExecutionPlanArtifactBinding: true,
      requireReplayVerifiedPathStateEvidence: true,
      requireAuthorizationReplay: true,
      allowSideEffects: false,
    },
  };
}

export {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_VERSION,
  validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifactIntegrity,
};
