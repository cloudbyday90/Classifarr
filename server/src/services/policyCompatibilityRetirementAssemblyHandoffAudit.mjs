/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildPolicyCompatibilityRetirementAssemblyArtifactCoverage,
  validatePolicyCompatibilityRetirementAssemblyArtifactCoverage,
} from './policyCompatibilityRetirementAssemblyHandoffAuditCoverage.mjs';
import {
  summarizeApprovedArtifact,
  summarizeCandidateAssembly,
  summarizeExecutionGate,
  summarizeReleaseReadiness,
  validateApprovedArtifact,
  validateCandidateAssembly,
  validateExecutionGate,
  validateReleaseReadiness,
} from './policyCompatibilityRetirementAssemblyHandoffAuditContracts.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_COVERAGE_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS,
  asArray,
  buildRisk,
  buildSideEffects,
  hasSideEffects,
} from './policyCompatibilityRetirementAssemblyHandoffAuditShared.mjs';

const POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_VERSION =
  'policy.compatibility_retirement_assembly_handoff_audit.v1';

function determineStatusId({ assemblyIssues, releaseReadinessIssues, artifactIssues, coverageIssues,
  executionGateIssues, sideEffects }) {
  if (hasSideEffects(sideEffects)) {
    return POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
      .BLOCKED_BY_SIDE_EFFECT;
  }
  if (assemblyIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
      .BLOCKED_BY_ASSEMBLY;
  }
  if (releaseReadinessIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
      .BLOCKED_BY_RELEASE_READINESS;
  }
  if (artifactIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
      .BLOCKED_BY_APPROVED_ARTIFACT;
  }
  if (coverageIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
      .BLOCKED_BY_ARTIFACT_COVERAGE;
  }
  if (executionGateIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
      .BLOCKED_BY_EXECUTION_GATE;
  }
  return POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS.HANDOFF_READY;
}

function buildNextStep(statusId) {
  const stepByStatus = {
    [POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
      .BLOCKED_BY_ASSEMBLY]: {
      stepId: 'compatibility_retirement_candidate_plan_assembly',
      label: 'Compatibility Retirement Candidate Plan Assembly',
    },
    [POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
      .BLOCKED_BY_RELEASE_READINESS]: {
      stepId: 'compatibility_deletion_release_readiness',
      label: 'Compatibility Deletion Release Readiness',
    },
    [POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
      .BLOCKED_BY_APPROVED_ARTIFACT]: {
      stepId: 'compatibility_retirement_execution_plan_candidate_target_adapter',
      label: 'Compatibility Retirement Execution-Plan Candidate-Target Adapter',
    },
    [POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
      .BLOCKED_BY_ARTIFACT_COVERAGE]: {
      stepId: 'compatibility_retirement_execution_plan_candidate_target_adapter',
      label: 'Compatibility Retirement Execution-Plan Candidate-Target Adapter',
    },
    [POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
      .BLOCKED_BY_EXECUTION_GATE]: {
      stepId: 'compatibility_deletion_execution_gate_named_scope_observation_identity',
      label: 'Compatibility Deletion Execution-Gate Named-Scope Observation Identity',
    },
  };
  const nextStep = stepByStatus[statusId] || {
    stepId: 'controlled_compatibility_path_removal',
    label: 'Controlled Compatibility Path Removal',
  };

  return {
    ...nextStep,
    reason: statusId === POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
      .HANDOFF_READY
      ? 'The audit confirms exact candidate coverage through the existing readiness, artifact, and execution gates. A separate controlled-removal workflow still owns any mutation.'
      : 'The audit records the first existing boundary that must be satisfied without creating or approving another execution artifact.',
  };
}

function buildPolicyCompatibilityRetirementAssemblyHandoffAudit({
  candidateAssembly = null,
  deletionReadiness = null,
  executionPlanArtifact = null,
  executionGate = null,
  sideEffects = {},
} = {}) {
  const normalizedSideEffects = buildSideEffects(sideEffects);
  const assemblyIssues = validateCandidateAssembly(candidateAssembly);
  const releaseReadinessIssues = assemblyIssues.length === 0
    ? validateReleaseReadiness(deletionReadiness)
    : [];
  const artifactIssues = assemblyIssues.length === 0 && releaseReadinessIssues.length === 0
    ? validateApprovedArtifact(executionPlanArtifact)
    : [];
  const coverage = assemblyIssues.length === 0 && releaseReadinessIssues.length === 0 &&
      artifactIssues.length === 0
    ? buildPolicyCompatibilityRetirementAssemblyArtifactCoverage(
      candidateAssembly,
      executionPlanArtifact,
    )
    : [];
  const coverageIssues = validatePolicyCompatibilityRetirementAssemblyArtifactCoverage(coverage);
  const executionGateIssues = assemblyIssues.length === 0 &&
      releaseReadinessIssues.length === 0 && artifactIssues.length === 0 &&
      coverageIssues.length === 0
    ? validateExecutionGate({ executionGate, approvedArtifact: executionPlanArtifact })
    : [];
  const issues = [
    ...assemblyIssues,
    ...releaseReadinessIssues,
    ...artifactIssues,
    ...coverageIssues,
    ...executionGateIssues,
  ];

  if (hasSideEffects(normalizedSideEffects)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
      'Assembly handoff audit cannot write an artifact, execute a gate, delete files, rewrite source, or change storage.',
    ));
  }

  const statusId = determineStatusId({
    assemblyIssues,
    releaseReadinessIssues,
    artifactIssues,
    coverageIssues,
    executionGateIssues,
    sideEffects: normalizedSideEffects,
  });
  const audit = {
    version: POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_VERSION,
    statusId,
    handoffReady: statusId ===
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS.HANDOFF_READY,
    readOnly: true,
    deletionAuthorized: false,
    executionManifestWritten: false,
    executionPlanArtifactWritten: false,
    executionGateInvoked: false,
    assembly: summarizeCandidateAssembly(candidateAssembly),
    releaseReadiness: summarizeReleaseReadiness(deletionReadiness),
    approvedArtifact: summarizeApprovedArtifact(executionPlanArtifact),
    executionGate: summarizeExecutionGate(executionGate),
    coverageCount: coverage.length,
    coveredTargetCount: coverage.filter(record => record.statusId ===
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_COVERAGE_STATUS_IDS.COVERED).length,
    uncoveredTargetCount: coverage.filter(record => record.statusId !==
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_COVERAGE_STATUS_IDS.COVERED).length,
    coverage,
    sideEffects: normalizedSideEffects,
    issueCount: issues.length,
    issues,
    nextStep: buildNextStep(statusId),
  };

  return {
    ...audit,
    validation: validatePolicyCompatibilityRetirementAssemblyHandoffAudit(audit),
  };
}

function validatePolicyCompatibilityRetirementAssemblyHandoffAudit(audit = {}) {
  const issues = [];
  const coverage = asArray(audit.coverage);

  if (audit.version !== POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_VERSION) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.UNKNOWN_VERSION,
      'Assembly handoff audit version must be recognized.',
      { version: audit.version || null },
    ));
  }

  if (!Object.values(POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS)
    .includes(audit.statusId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.UNKNOWN_STATUS,
      'Assembly handoff audit status must be known.',
    ));
  }

  if (audit.readOnly !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.AUDIT_NOT_READ_ONLY,
      'Assembly handoff audit must remain read-only.',
    ));
  }

  if (audit.deletionAuthorized !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .AUDIT_AUTHORIZES_DELETION,
      'Assembly handoff audit cannot authorize deletion.',
    ));
  }

  if (audit.executionManifestWritten !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .AUDIT_MANIFEST_WRITTEN,
      'Assembly handoff audit cannot write an execution manifest.',
    ));
  }

  if (audit.executionPlanArtifactWritten !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .AUDIT_ARTIFACT_WRITTEN,
      'Assembly handoff audit cannot write an execution-plan artifact.',
    ));
  }

  if (audit.executionGateInvoked !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .AUDIT_EXECUTION_GATE_INVOKED,
      'Assembly handoff audit cannot invoke the execution gate.',
    ));
  }

  const coveredTargetCount = coverage.filter(record => record.statusId ===
    POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_COVERAGE_STATUS_IDS.COVERED).length;
  if (audit.coverageCount !== coverage.length || audit.coveredTargetCount !== coveredTargetCount ||
      audit.uncoveredTargetCount !== coverage.length - coveredTargetCount) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.COVERAGE_COUNT_MISMATCH,
      'Assembly handoff audit coverage counts must equal the exact coverage records.',
    ));
  }

  const shouldBeReady = audit.statusId ===
    POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS.HANDOFF_READY &&
    audit.issueCount === 0;
  if (audit.handoffReady !== shouldBeReady) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.READY_STATE_MISMATCH,
      'Assembly handoff readiness must match its status and findings.',
    ));
  }

  if (audit.issueCount !== asArray(audit.issues).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.ISSUE_COUNT_MISMATCH,
      'Assembly handoff audit issue count must match its issue list.',
    ));
  }

  Object.entries(audit.sideEffects || {}).forEach(([sideEffectId, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
        'Assembly handoff audit cannot perform side effects.',
        { sideEffectId },
      ));
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_COVERAGE_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_VERSION,
  buildPolicyCompatibilityRetirementAssemblyHandoffAudit,
  validatePolicyCompatibilityRetirementAssemblyHandoffAudit,
};
