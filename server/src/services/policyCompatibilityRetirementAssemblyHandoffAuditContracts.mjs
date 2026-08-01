/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_VERSION,
  validatePolicyCompatibilityDeletionExecutionGate,
} from './policyCompatibilityDeletionExecutionGate.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION,
  validatePolicyCompatibilityDeletionExecutionPlanArtifact,
} from './policyCompatibilityDeletionExecutionPlanArtifact.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from './policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_READINESS_VERSION,
  validatePolicyCompatibilityDeletionReadiness,
} from './policyCompatibilityDeletionReadiness.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_VERSION,
  validatePolicyCompatibilityRetirementCandidatePlanAssemblyGate,
} from './policyCompatibilityRetirementCandidatePlanAssemblyGate.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS,
  asObject,
  buildRisk,
  cleanString,
} from './policyCompatibilityRetirementAssemblyHandoffAuditShared.mjs';

function summarizeCandidateAssembly(assembly = {}) {
  const value = asObject(assembly);

  return {
    version: value.version || null,
    statusId: value.statusId || null,
    assemblyReady: value.assemblyReady === true,
    validationOk: value.validation?.ok === true,
    targetCount: value.candidate?.targetCount ?? null,
    mappedTargetCount: value.mappedTargetCount ?? null,
  };
}

function validateCandidateAssembly(assembly) {
  const issues = [];

  if (!assembly || typeof assembly !== 'object') {
    return [buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.ASSEMBLY_MISSING,
      'Assembly handoff audit requires a candidate-plan assembly result.',
    )];
  }

  if (assembly.version !== POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_VERSION) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .ASSEMBLY_VERSION_UNKNOWN,
      'Assembly handoff audit requires a recognized candidate-plan assembly version.',
      { version: assembly.version || null },
    ));
  }

  if (assembly.statusId !==
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS.ASSEMBLY_READY ||
      assembly.assemblyReady !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.ASSEMBLY_NOT_READY,
      'Assembly handoff requires every source-backed candidate to map before release evidence is considered.',
      { statusId: assembly.statusId || null },
    ));
  }

  if (assembly.readOnly !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.ASSEMBLY_NOT_READ_ONLY,
      'Candidate-plan assembly must remain read-only at the handoff boundary.',
    ));
  }

  if (assembly.deletionAuthorized !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .ASSEMBLY_AUTHORIZES_DELETION,
      'Candidate-plan assembly cannot authorize compatibility retirement.',
    ));
  }

  if (assembly.executionManifestWritten !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .ASSEMBLY_MANIFEST_WRITTEN,
      'Candidate-plan assembly cannot write an execution manifest.',
    ));
  }

  const validation = validatePolicyCompatibilityRetirementCandidatePlanAssemblyGate(assembly);
  if (assembly.validation?.ok !== true || !validation.ok) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .ASSEMBLY_VALIDATION_FAILED,
      'Candidate-plan assembly must validate before it enters the release-readiness boundary.',
      { issueCount: validation.issueCount },
    ));
  }

  return issues;
}

function summarizeReleaseReadiness(readiness = {}) {
  const value = asObject(readiness);

  return {
    version: value.version || null,
    statusId: value.statusId || null,
    readyForDeletionExecutionPlan: value.readyForDeletionExecutionPlan === true,
    validationOk: value.validation?.ok === true,
    riskCount: value.riskCount ?? null,
  };
}

function validateReleaseReadiness(readiness) {
  const issues = [];

  if (!readiness || typeof readiness !== 'object') {
    return [buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .RELEASE_READINESS_MISSING,
      'Assembly handoff requires the existing compatibility deletion-readiness result.',
    )];
  }

  if (readiness.version !== POLICY_COMPATIBILITY_DELETION_READINESS_VERSION) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .RELEASE_READINESS_VERSION_UNKNOWN,
      'Assembly handoff requires the recognized compatibility deletion-readiness version.',
      { version: readiness.version || null },
    ));
  }

  if (readiness.statusId !==
      POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS.READY_FOR_DELETION_EXECUTION_PLAN ||
      readiness.readyForDeletionExecutionPlan !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .RELEASE_READINESS_NOT_READY,
      'A ready candidate assembly cannot bypass the existing release-readiness boundary.',
      { statusId: readiness.statusId || null },
    ));
  }

  const validation = validatePolicyCompatibilityDeletionReadiness(readiness);
  if (readiness.validation?.ok !== true || !validation.ok) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .RELEASE_READINESS_VALIDATION_FAILED,
      'Compatibility deletion readiness must validate before an approved execution artifact is considered.',
      { issueCount: validation.issueCount },
    ));
  }

  return issues;
}

function summarizeApprovedArtifact(artifact = {}) {
  const value = asObject(artifact);

  return {
    version: value.version || null,
    statusId: value.statusId || null,
    ready: value.ready === true,
    validationOk: value.validation?.ok === true,
    manifestApproved: value.executionPlan?.manifest?.approved === true,
    executionPlanStatusId: value.executionPlan?.statusId || null,
    executionPlanReady: value.executionPlan?.readyForExecutionGate === true,
    manifestEntryCount: value.executionPlan?.manifest?.entryCount ?? null,
    fingerprint: value.artifactFingerprint?.fingerprint || null,
  };
}

function validateApprovedArtifact(artifact) {
  const issues = [];

  if (!artifact || typeof artifact !== 'object') {
    return [buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .APPROVED_ARTIFACT_MISSING,
      'Assembly handoff requires the existing approved execution-plan artifact.',
    )];
  }

  if (artifact.version !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .APPROVED_ARTIFACT_VERSION_UNKNOWN,
      'Assembly handoff requires the recognized execution-plan artifact version.',
      { version: artifact.version || null },
    ));
  }

  if (artifact.statusId !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.READY ||
      artifact.ready !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .APPROVED_ARTIFACT_NOT_READY,
      'Assembly handoff requires a ready approved execution-plan artifact.',
      { statusId: artifact.statusId || null },
    ));
  }

  const validation = validatePolicyCompatibilityDeletionExecutionPlanArtifact(artifact);
  if (artifact.validation?.ok !== true || !validation.ok) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .APPROVED_ARTIFACT_VALIDATION_FAILED,
      'The approved execution-plan artifact must validate and retain its fingerprint.',
      { issueCount: validation.issueCount },
    ));
  }

  if (artifact.executionPlan?.manifest?.approved !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .APPROVED_ARTIFACT_MANIFEST_UNAPPROVED,
      'Assembly handoff cannot treat an unapproved execution-plan manifest as an approved artifact.',
    ));
  }

  if (artifact.executionPlan?.statusId !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE ||
      artifact.executionPlan?.readyForExecutionGate !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .APPROVED_ARTIFACT_EXECUTION_PLAN_NOT_READY,
      'The approved artifact must contain an execution plan that passed the existing readiness and approval checks.',
      { statusId: artifact.executionPlan?.statusId || null },
    ));
  }

  return issues;
}

function summarizeExecutionGate(gate = {}) {
  const value = asObject(gate);

  return {
    version: value.version || null,
    statusId: value.statusId || null,
    allowControlledDeletion: value.allowControlledDeletion === true,
    validationOk: value.validation?.ok === true,
    artifactFingerprint: value.executionPlanArtifact?.artifactFingerprint?.fingerprint || null,
  };
}

function validateExecutionGate({ executionGate, approvedArtifact }) {
  const issues = [];

  if (!executionGate || typeof executionGate !== 'object') {
    return [buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.EXECUTION_GATE_MISSING,
      'Assembly handoff requires the existing execution gate after approved artifact coverage is complete.',
    )];
  }

  if (executionGate.version !== POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_VERSION) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .EXECUTION_GATE_VERSION_UNKNOWN,
      'Assembly handoff requires the recognized compatibility deletion execution-gate version.',
      { version: executionGate.version || null },
    ));
  }

  if (executionGate.statusId !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS.READY_FOR_CONTROLLED_DELETION ||
      executionGate.allowControlledDeletion !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.EXECUTION_GATE_NOT_READY,
      'Assembly handoff cannot bypass the existing fresh-evidence and operator-approval execution gate.',
      { statusId: executionGate.statusId || null },
    ));
  }

  const validation = validatePolicyCompatibilityDeletionExecutionGate(executionGate);
  if (executionGate.validation?.ok !== true || !validation.ok) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .EXECUTION_GATE_VALIDATION_FAILED,
      'The existing execution gate must validate before a controlled removal can be reviewed.',
      { issueCount: validation.issueCount },
    ));
  }

  if (cleanString(executionGate.executionPlanArtifact?.artifactFingerprint?.fingerprint) !==
      cleanString(approvedArtifact?.artifactFingerprint?.fingerprint)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .EXECUTION_GATE_ARTIFACT_MISMATCH,
      'The execution gate must be bound to the same approved execution-plan artifact audited for candidate coverage.',
    ));
  }

  return issues;
}

export {
  summarizeApprovedArtifact,
  summarizeCandidateAssembly,
  summarizeExecutionGate,
  summarizeReleaseReadiness,
  validateApprovedArtifact,
  validateCandidateAssembly,
  validateExecutionGate,
  validateReleaseReadiness,
};
