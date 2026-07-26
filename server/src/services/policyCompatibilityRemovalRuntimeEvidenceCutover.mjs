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
  POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS,
  POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_VERSION,
  validatePolicyPostRemovalRuntimeEvidenceArtifact,
} from './policyPostRemovalRuntimeEvidenceArtifact.mjs';

const POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_VERSION =
  'policy.compatibility_removal_runtime_evidence_cutover.v1';

const POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_STATUS_IDS =
  Object.freeze({
    READY: 'ready',
    BLOCKED: 'blocked',
  });

const POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_REASON_IDS =
  Object.freeze({
    RUNTIME_EVIDENCE_MISSING: 'runtime_evidence_missing',
    RUNTIME_EVIDENCE_CONTRACT_UNSUPPORTED:
      'runtime_evidence_contract_unsupported',
    EXECUTION_PLAN_FINGERPRINT_MISSING:
      'execution_plan_fingerprint_missing',
    EXECUTION_PLAN_FINGERPRINT_INVALID:
      'execution_plan_fingerprint_invalid',
    EXECUTION_PLAN_FINGERPRINT_MISMATCH:
      'execution_plan_fingerprint_mismatch',
    RUNTIME_EVIDENCE_INVALID: 'runtime_evidence_invalid',
  });

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/iu;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeFingerprint(value = '') {
  return String(value || '').trim().toLowerCase();
}

function hasIssue(validation = {}, riskId = '') {
  return (Array.isArray(validation.issues) ? validation.issues : [])
    .some(issue => issue?.riskId === riskId);
}

function buildNextStep() {
  return {
    stepId: 'regenerate_current_runtime_evidence',
    label: 'Regenerate Current Runtime Evidence',
    reason:
      'The public compatibility-removal chain requires the current runtime-evidence contract bound to the current execution-plan artifact.',
  };
}

function evaluatePolicyCompatibilityRemovalRuntimeEvidenceCutover({
  runtimeEvidenceArtifact = null,
  expectedExecutionPlanArtifactFingerprint = '',
} = {}) {
  const artifact = asObject(runtimeEvidenceArtifact);
  const validation = validatePolicyPostRemovalRuntimeEvidenceArtifact(
    runtimeEvidenceArtifact
  );
  const reasonIds = [];
  const receivedVersion = String(artifact.version || '').trim() || null;
  const hasUnsupportedVersion =
    receivedVersion !== null &&
    receivedVersion !== POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_VERSION;
  const executionPlanArtifactFingerprint = normalizeFingerprint(
    validation.executionPlanArtifactFingerprint
  );
  const expectedFingerprint = normalizeFingerprint(
    expectedExecutionPlanArtifactFingerprint
  );

  if (Object.keys(artifact).length === 0) {
    reasonIds.push(
      POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_REASON_IDS
        .RUNTIME_EVIDENCE_MISSING
    );
  } else if (hasUnsupportedVersion) {
    reasonIds.push(
      POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_REASON_IDS
        .RUNTIME_EVIDENCE_CONTRACT_UNSUPPORTED
    );
  }

  if (!executionPlanArtifactFingerprint) {
    reasonIds.push(
      POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_REASON_IDS
        .EXECUTION_PLAN_FINGERPRINT_MISSING
    );
  } else if (!SHA256_FINGERPRINT_PATTERN.test(executionPlanArtifactFingerprint)) {
    reasonIds.push(
      POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_REASON_IDS
        .EXECUTION_PLAN_FINGERPRINT_INVALID
    );
  } else if (
    expectedFingerprint &&
    !SHA256_FINGERPRINT_PATTERN.test(expectedFingerprint)
  ) {
    reasonIds.push(
      POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_REASON_IDS
        .EXECUTION_PLAN_FINGERPRINT_INVALID
    );
  } else if (
    SHA256_FINGERPRINT_PATTERN.test(expectedFingerprint) &&
    executionPlanArtifactFingerprint !== expectedFingerprint
  ) {
    reasonIds.push(
      POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_REASON_IDS
        .EXECUTION_PLAN_FINGERPRINT_MISMATCH
    );
  }

  if (
    validation.ok !== true &&
    !hasIssue(
      validation,
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .MISSING_RUNTIME_EVIDENCE_ARTIFACT
    ) &&
    !hasIssue(
      validation,
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .APPLIED_EXECUTION_PLAN_FINGERPRINT_MISSING
    ) &&
    !hasIssue(
      validation,
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .APPLIED_EXECUTION_PLAN_FINGERPRINT_MALFORMED
    ) &&
    hasUnsupportedVersion !== true
  ) {
    reasonIds.push(
      POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_REASON_IDS
        .RUNTIME_EVIDENCE_INVALID
    );
  }

  const uniqueReasonIds = [...new Set(reasonIds)];
  const ready = uniqueReasonIds.length === 0 && validation.ok === true;

  return {
    version: POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_VERSION,
    statusId: ready
      ? POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_STATUS_IDS.READY
      : POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_STATUS_IDS.BLOCKED,
    ready,
    requiredRuntimeEvidenceVersion:
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_VERSION,
    reasonIds: uniqueReasonIds,
    nextStep: buildNextStep(),
  };
}

export {
  POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_REASON_IDS,
  POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_STATUS_IDS,
  POLICY_COMPATIBILITY_REMOVAL_RUNTIME_EVIDENCE_CUTOVER_VERSION,
  evaluatePolicyCompatibilityRemovalRuntimeEvidenceCutover,
};
