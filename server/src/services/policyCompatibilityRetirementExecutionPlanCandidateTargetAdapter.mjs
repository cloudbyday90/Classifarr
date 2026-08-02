/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildCandidateMappingIssues,
  buildExecutionPlanCandidateTargetEntries,
  hasOnlyExecutionPlanTargetFields,
  sameTargetEntryList,
  validateCandidateAssembly,
  validateCandidateProjection,
} from './policyCompatibilityRetirementExecutionPlanCandidateTargetAdapterContracts.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_VERSION,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_INPUT_VERSION,
  asArray,
  buildRisk,
  buildSideEffects,
  hasSideEffects,
} from './policyCompatibilityRetirementExecutionPlanCandidateTargetAdapterShared.mjs';

function collectAdapterFacts({ candidateProjection, candidateAssembly } = {}) {
  const candidateIssues = validateCandidateProjection(candidateProjection);
  const assemblyIssues = validateCandidateAssembly(candidateAssembly);
  const candidateTargetEntries = candidateIssues.length === 0
    ? asArray(candidateProjection.candidateTargetEntries)
    : [];
  const mappings = assemblyIssues.length === 0
    ? asArray(candidateAssembly.mappings)
    : [];
  const mappingIssues = candidateIssues.length === 0 && assemblyIssues.length === 0
    ? buildCandidateMappingIssues({ candidateTargetEntries, mappings })
    : [];
  const executionPlanCandidateTargetEntries = mappingIssues.length === 0
    ? buildExecutionPlanCandidateTargetEntries({ candidateTargetEntries, mappings })
    : [];

  return {
    candidateIssues,
    assemblyIssues,
    candidateTargetEntries,
    mappings,
    mappingIssues,
    executionPlanCandidateTargetEntries,
  };
}

function determineStatusId({ candidateIssues, assemblyIssues, mappingIssues, sideEffects }) {
  if (hasSideEffects(sideEffects)) {
    return POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS
      .BLOCKED_BY_SIDE_EFFECT;
  }
  if (candidateIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS
      .BLOCKED_BY_CANDIDATE;
  }
  if (assemblyIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS
      .BLOCKED_BY_ASSEMBLY;
  }
  if (mappingIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS
      .BLOCKED_BY_MAPPING;
  }
  return POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS
    .ADAPTER_READY;
}

function buildPolicyCompatibilityRetirementExecutionPlanCandidateTargetAdapter({
  candidateProjection = null,
  candidateAssembly = null,
  sideEffects = {},
} = {}) {
  const normalizedSideEffects = buildSideEffects(sideEffects);
  const facts = collectAdapterFacts({ candidateProjection, candidateAssembly });
  const issues = [
    ...facts.candidateIssues,
    ...facts.assemblyIssues,
    ...facts.mappingIssues,
  ];

  if (hasSideEffects(normalizedSideEffects)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_RISK_IDS
        .SIDE_EFFECT_REPORTED,
      'Candidate-target adaptation cannot create an artifact, approve a plan, invoke an execution gate, delete files, rewrite source, or change storage.',
    ));
  }

  const statusId = determineStatusId({
    ...facts,
    sideEffects: normalizedSideEffects,
  });
  const adapter = {
    version: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_VERSION,
    statusId,
    adapterReady: statusId ===
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS
        .ADAPTER_READY,
    readOnly: true,
    deletionAuthorized: false,
    executionManifestWritten: false,
    executionPlanArtifactWritten: false,
    executionGateInvoked: false,
    candidateProjection,
    candidateAssembly,
    candidateTargetCount: facts.candidateTargetEntries.length,
    mappingCount: facts.mappings.length,
    executionPlanInput: {
      version: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_INPUT_VERSION,
      manifestApproved: false,
      approvedBy: null,
      candidateTargetEntries: facts.executionPlanCandidateTargetEntries,
    },
    sideEffects: normalizedSideEffects,
    issueCount: issues.length,
    issues,
    nextStep: {
      stepId: 'compatibility_deletion_execution_gate_named_scope_observation_identity',
      label: 'Compatibility Deletion Execution-Gate Named-Scope Observation Identity',
      reason: 'The exact targets now enter the existing execution-plan input without approval or execution. The preflight observation model must distinguish several exact scopes in a retained test file before controlled removal can proceed.',
    },
  };

  return {
    ...adapter,
    validation: validatePolicyCompatibilityRetirementExecutionPlanCandidateTargetAdapter(adapter),
  };
}

function validatePolicyCompatibilityRetirementExecutionPlanCandidateTargetAdapter(adapter = {}) {
  const riskIds = POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_RISK_IDS;
  const issues = [];
  const facts = collectAdapterFacts({
    candidateProjection: adapter.candidateProjection,
    candidateAssembly: adapter.candidateAssembly,
  });

  if (adapter.version !== POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_VERSION) {
    issues.push(buildRisk(
      riskIds.UNKNOWN_VERSION,
      'Candidate-target adapter version must be recognized.',
      { version: adapter.version || null },
    ));
  }

  if (!Object.values(POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS)
    .includes(adapter.statusId)) {
    issues.push(buildRisk(
      riskIds.UNKNOWN_STATUS,
      'Candidate-target adapter status must be known.',
    ));
  }

  if (adapter.readOnly !== true) {
    issues.push(buildRisk(riskIds.ADAPTER_NOT_READ_ONLY,
      'Candidate-target adapter must remain read-only.'));
  }
  if (adapter.deletionAuthorized !== false) {
    issues.push(buildRisk(riskIds.ADAPTER_AUTHORIZES_DELETION,
      'Candidate-target adapter cannot authorize deletion.'));
  }
  if (adapter.executionManifestWritten !== false) {
    issues.push(buildRisk(riskIds.ADAPTER_MANIFEST_WRITTEN,
      'Candidate-target adapter cannot write an execution manifest.'));
  }
  if (adapter.executionPlanArtifactWritten !== false) {
    issues.push(buildRisk(riskIds.ADAPTER_ARTIFACT_WRITTEN,
      'Candidate-target adapter cannot create an execution-plan artifact.'));
  }
  if (adapter.executionGateInvoked !== false) {
    issues.push(buildRisk(riskIds.ADAPTER_EXECUTION_GATE_INVOKED,
      'Candidate-target adapter cannot invoke the execution gate.'));
  }

  issues.push(...facts.candidateIssues, ...facts.assemblyIssues, ...facts.mappingIssues);

  if (adapter.candidateTargetCount !== facts.candidateTargetEntries.length ||
      adapter.mappingCount !== facts.mappings.length ||
      !hasOnlyExecutionPlanTargetFields(
        adapter.executionPlanInput?.candidateTargetEntries,
      ) ||
      !sameTargetEntryList(
        adapter.executionPlanInput?.candidateTargetEntries,
        facts.executionPlanCandidateTargetEntries,
      )) {
    issues.push(buildRisk(
      riskIds.EXECUTION_PLAN_INPUT_MISMATCH,
      'Candidate-target adapter execution-plan inputs must be re-derived from the exact current candidate projection and assembly.',
    ));
  }

  if (adapter.executionPlanInput?.version !==
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_INPUT_VERSION ||
      adapter.executionPlanInput?.manifestApproved !== false ||
      adapter.executionPlanInput?.approvedBy !== null) {
    issues.push(buildRisk(
      riskIds.EXECUTION_PLAN_INPUT_APPROVED,
      'Candidate-target adapter inputs must remain explicitly unapproved and unassigned.',
    ));
  }

  if (adapter.executionPlanInput?.executeDeletionNow === true ||
      adapter.executionPlanInput?.executionAuthorized === true ||
      Object.hasOwn(adapter.executionPlanInput || {}, 'executionManifest')) {
    issues.push(buildRisk(
      riskIds.EXECUTION_PLAN_INPUT_EXECUTION_REQUESTED,
      'Candidate-target adapter cannot request execution or embed an execution manifest.',
    ));
  }

  if (adapter.issueCount !== asArray(adapter.issues).length) {
    issues.push(buildRisk(
      riskIds.ISSUE_COUNT_MISMATCH,
      'Candidate-target adapter issue count must match its issue list.',
    ));
  }

  Object.entries(adapter.sideEffects || {}).forEach(([sideEffectId, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        riskIds.SIDE_EFFECT_REPORTED,
        'Candidate-target adapter cannot report side effects.',
        { sideEffectId },
      ));
    }
  });

  const shouldBeReady = adapter.statusId ===
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS
        .ADAPTER_READY &&
    adapter.issueCount === 0 &&
    !hasSideEffects(adapter.sideEffects);
  if (adapter.adapterReady !== shouldBeReady) {
    issues.push(buildRisk(
      riskIds.READY_STATE_MISMATCH,
      'Candidate-target adapter readiness must match its status, findings, and side-effect boundary.',
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_VERSION,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_INPUT_VERSION,
  buildPolicyCompatibilityRetirementExecutionPlanCandidateTargetAdapter,
  validatePolicyCompatibilityRetirementExecutionPlanCandidateTargetAdapter,
};
