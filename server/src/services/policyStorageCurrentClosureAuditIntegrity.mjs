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
  POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_COLLECTOR_VERSION,
} from './policyStorageClosureCurrentEvidenceCollector.mjs';
import {
  buildPolicyStorageClosureEvidenceRun,
} from './policyStorageClosureEvidenceRun.mjs';
import {
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_VERSION,
  buildPolicyStorageCurrentClosureAuditFromEvidence,
  validatePolicyStorageCurrentClosureAudit,
} from './policyStorageCurrentClosureAudit.mjs';

const POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_INTEGRITY_VERSION =
  'policy.storage_current_closure_audit_integrity.v1';

const POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_INTEGRITY_RISK_IDS = Object.freeze({
  CURRENT_CLOSURE_AUDIT_MISSING: 'current_closure_audit_missing',
  CURRENT_CLOSURE_AUDIT_INVALID: 'current_closure_audit_invalid',
  CURRENT_CLOSURE_AUDIT_NOT_REPLAYABLE: 'current_closure_audit_not_replayable',
  CURRENT_CLOSURE_AUDIT_REPLAY_MISMATCH: 'current_closure_audit_replay_mismatch',
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

function hasOwnObject(value, key) {
  const source = asObject(value);
  return Object.hasOwn(source, key) &&
    source[key] &&
    typeof source[key] === 'object' &&
    !Array.isArray(source[key]);
}

function hasReplayInputs(audit = {}) {
  const value = asObject(audit);
  const closureInput = asObject(value.closureInput);
  const currentEvidence = asObject(closureInput.currentEvidence);
  const artifactInventory = asObject(currentEvidence.artifactInventory);

  return currentEvidence.version ===
    POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_COLLECTOR_VERSION &&
    typeof currentEvidence.roadmapPath === 'string' &&
    typeof currentEvidence.changelogPath === 'string' &&
    hasOwnObject(currentEvidence, 'artifactInventory') &&
    hasOwnObject(artifactInventory, 'artifactInventory') &&
    hasOwnObject(currentEvidence, 'roadmapEvidence') &&
    hasOwnObject(currentEvidence, 'changelogEvidence') &&
    hasOwnObject(closureInput, 'completionAuditArtifact') &&
    hasOwnObject(closureInput, 'validationEvidence') &&
    hasOwnObject(closureInput, 'sideEffects');
}

async function rebuildCurrentEvidence({ closureInput = {} } = {}) {
  const input = asObject(closureInput);
  const currentEvidenceInput = asObject(input.currentEvidence);
  const artifactInventory = asObject(currentEvidenceInput.artifactInventory);
  const evidenceRun = await buildPolicyStorageClosureEvidenceRun({
    artifactInventory: artifactInventory.artifactInventory,
    roadmapEvidence: currentEvidenceInput.roadmapEvidence,
    completionAuditArtifact: input.completionAuditArtifact,
    validationEvidence: input.validationEvidence,
    changelogEvidence: currentEvidenceInput.changelogEvidence,
    sideEffects: input.sideEffects,
  });

  return {
    version: currentEvidenceInput.version,
    roadmapPath: currentEvidenceInput.roadmapPath,
    changelogPath: currentEvidenceInput.changelogPath,
    artifactInventory,
    roadmapEvidence: currentEvidenceInput.roadmapEvidence,
    changelogEvidence: currentEvidenceInput.changelogEvidence,
    evidenceRun,
  };
}

async function validatePolicyStorageCurrentClosureAuditIntegrity({
  currentClosureAudit = null,
} = {}) {
  const risks = [];
  const audit = asObject(currentClosureAudit);

  if (Object.keys(audit).length === 0) {
    risks.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_INTEGRITY_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_MISSING,
      'Policy storage closure requirement audit requires a current closure audit artifact.'
    ));
  }

  const auditValidation = validatePolicyStorageCurrentClosureAudit(audit);
  if (
    audit.version !== POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_VERSION ||
    audit.validation?.ok !== true ||
    auditValidation.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_INTEGRITY_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_INVALID,
      'Policy storage closure requirement audit requires a current fingerprint-valid current closure audit artifact.',
      {
        auditVersion: audit.version || null,
        issueCount: auditValidation.issueCount,
        issueRiskIds: auditValidation.issues.map(issue => issue.riskId),
      }
    ));
  }

  if (!hasReplayInputs(audit)) {
    risks.push(buildRisk(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_INTEGRITY_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_NOT_REPLAYABLE,
      'Current closure audit artifact must retain normalized closure evidence, completion-audit evidence, validation evidence, and side-effect input for deterministic verification.'
    ));
  }

  let replayedAudit = null;
  if (risks.length === 0) {
    const closureInput = asObject(audit.closureInput);
    const currentEvidence = await rebuildCurrentEvidence({ closureInput });
    replayedAudit = await buildPolicyStorageCurrentClosureAuditFromEvidence({
      currentEvidence,
      completionAuditArtifact: closureInput.completionAuditArtifact,
      validationEvidence: closureInput.validationEvidence,
      generatedAt: audit.generatedAt,
      sideEffects: closureInput.sideEffects,
    });

    if (stableStringify(audit) !== stableStringify(replayedAudit)) {
      risks.push(buildRisk(
        POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_INTEGRITY_RISK_IDS
          .CURRENT_CLOSURE_AUDIT_REPLAY_MISMATCH,
        'Current closure audit artifact does not match its retained normalized closure evidence and completion-audit input.',
        {
          auditStatusId: audit.statusId || null,
          replayStatusId: replayedAudit.statusId || null,
        }
      ));
    }
  }

  return {
    version: POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_INTEGRITY_VERSION,
    ok: risks.length === 0,
    issueCount: risks.length,
    issues: risks,
    currentClosureAudit: audit,
    audit: risks.length === 0 ? replayedAudit : {},
    artifactFingerprint: audit.artifactFingerprint?.fingerprint || null,
    policy: {
      requireCurrentFingerprintValidArtifact: true,
      requireRetainedClosureInputs: true,
      requireArtifactReplay: true,
      allowSideEffects: false,
    },
  };
}

export {
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_INTEGRITY_RISK_IDS,
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_INTEGRITY_VERSION,
  validatePolicyStorageCurrentClosureAuditIntegrity,
};
