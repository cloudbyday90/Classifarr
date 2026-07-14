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
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION,
  buildPolicyCompatibilityRemovalCompletionAuditArtifact,
  validatePolicyCompatibilityRemovalCompletionAuditArtifact,
} from './policyCompatibilityRemovalCompletionAuditArtifact.mjs';

const POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_INTEGRITY_VERSION =
  'policy.compatibility_removal_completion_audit_artifact_integrity.v1';

const POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_INTEGRITY_RISK_IDS =
  Object.freeze({
    COMPLETION_AUDIT_ARTIFACT_MISSING: 'completion_audit_artifact_missing',
    COMPLETION_AUDIT_ARTIFACT_INVALID: 'completion_audit_artifact_invalid',
    COMPLETION_AUDIT_ARTIFACT_NOT_REPLAYABLE:
      'completion_audit_artifact_not_replayable',
    COMPLETION_AUDIT_REPLAY_MISMATCH: 'completion_audit_replay_mismatch',
  });

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

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function hasReplayInputs(artifact = {}) {
  const value = asObject(artifact);
  const auditInput = asObject(value.auditInput);

  return Object.keys(asObject(value.nextBatchAuthorizationArtifact)).length > 0 &&
    Object.keys(asObject(value.executionPlan)).length > 0 &&
    typeof auditInput.reviewArtifactFingerprint === 'string' &&
    Object.keys(asObject(auditInput.finalImportScan)).length > 0 &&
    Object.keys(asObject(auditInput.validationEvidence)).length > 0;
}

async function validatePolicyCompatibilityRemovalCompletionAuditArtifactIntegrity({
  completionAuditArtifact = null,
} = {}) {
  const risks = [];
  const artifact = asObject(completionAuditArtifact);

  if (Object.keys(artifact).length === 0) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_INTEGRITY_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_MISSING,
      'Policy storage completion checkpoint requires a compatibility-removal completion-audit artifact.'
    ));
  }

  const artifactValidation =
    validatePolicyCompatibilityRemovalCompletionAuditArtifact(artifact);
  if (
    artifact.version !== POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION ||
    artifact.validation?.ok !== true ||
    artifactValidation.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_INTEGRITY_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_INVALID,
      'Policy storage completion checkpoint requires a current fingerprint-valid completion-audit artifact.',
      {
        artifactVersion: artifact.version || null,
        issueCount: artifactValidation.issueCount,
        issueRiskIds: artifactValidation.issues.map(issue => issue.riskId),
      }
    ));
  }

  if (!hasReplayInputs(artifact)) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_INTEGRITY_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_NOT_REPLAYABLE,
      'Completion-audit artifact must retain its authorization artifact, execution plan, and audit input for deterministic verification.'
    ));
  }

  let replayedArtifact = null;
  if (risks.length === 0) {
    const replayInput = asObject(artifact.auditInput);
    replayedArtifact = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: artifact.nextBatchAuthorizationArtifact,
      executionPlan: artifact.executionPlan,
      input: replayInput,
      generatedAt: artifact.generatedAt,
      sideEffects: artifact.sideEffects,
    });

    if (stableStringify(artifact) !== stableStringify(replayedArtifact)) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_INTEGRITY_RISK_IDS
          .COMPLETION_AUDIT_REPLAY_MISMATCH,
        'Completion-audit artifact does not match the retained authorization artifact, execution plan, and audit input.',
        {
          artifactStatusId: artifact.statusId || null,
          replayStatusId: replayedArtifact.statusId || null,
        }
      ));
    }
  }

  return {
    version:
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_INTEGRITY_VERSION,
    ok: risks.length === 0,
    issueCount: risks.length,
    issues: risks,
    completionAuditArtifact: artifact,
    audit: risks.length === 0 ? asObject(replayedArtifact?.audit) : {},
    artifactFingerprint: artifact.artifactFingerprint?.fingerprint || null,
    policy: {
      requireCurrentFingerprintValidArtifact: true,
      requireRetainedReplayInputs: true,
      requireArtifactReplay: true,
      allowSideEffects: false,
    },
  };
}

export {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_INTEGRITY_RISK_IDS,
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_INTEGRITY_VERSION,
  validatePolicyCompatibilityRemovalCompletionAuditArtifactIntegrity,
};
