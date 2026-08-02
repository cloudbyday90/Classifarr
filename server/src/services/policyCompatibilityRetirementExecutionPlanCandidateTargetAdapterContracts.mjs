/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS,
  validatePolicyCompatibilityRetirementCandidatePlanAssemblyGate,
} from './policyCompatibilityRetirementCandidatePlanAssemblyGate.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS,
  validatePolicyCompatibilityRetirementCandidatePlanProjection,
} from './policyCompatibilityRetirementCandidatePlanProjection.mjs';
import {
  buildPolicyCompatibilityRetirementCandidateTargetKey,
} from './policyCompatibilityRetirementCandidateTaxonomy.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS,
} from './policyCompatibilityRetirementExecutionManifestTargets.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_RISK_IDS,
  asArray,
  buildExecutionPlanTargetInputKey,
  buildRisk,
  cleanString,
} from './policyCompatibilityRetirementExecutionPlanCandidateTargetAdapterShared.mjs';

function validateCandidateProjection(candidateProjection) {
  const riskIds = POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_RISK_IDS;
  const issues = [];

  if (!candidateProjection || typeof candidateProjection !== 'object') {
    return [buildRisk(
      riskIds.CANDIDATE_MISSING,
      'Candidate-target adaptation requires the source-backed retirement candidate projection.',
    )];
  }

  if (candidateProjection.statusId !==
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS
        .CANDIDATE_PLAN_READY || candidateProjection.candidatePlanReady !== true) {
    issues.push(buildRisk(
      riskIds.CANDIDATE_NOT_READY,
      'Candidate-target adaptation requires a ready candidate projection.',
      { statusId: candidateProjection.statusId || null },
    ));
  }

  if (candidateProjection.readOnly !== true) {
    issues.push(buildRisk(
      riskIds.CANDIDATE_NOT_READ_ONLY,
      'Candidate-target adaptation requires a read-only candidate projection.',
    ));
  }

  if (candidateProjection.deletionAuthorized !== false) {
    issues.push(buildRisk(
      riskIds.CANDIDATE_AUTHORIZES_DELETION,
      'Candidate-target adaptation cannot accept a candidate projection that authorizes deletion.',
    ));
  }

  const validation = validatePolicyCompatibilityRetirementCandidatePlanProjection(
    candidateProjection,
  );
  if (candidateProjection.validation?.ok !== true || !validation.ok) {
    issues.push(buildRisk(
      riskIds.CANDIDATE_VALIDATION_FAILED,
      'Candidate-target adaptation requires a structurally valid candidate projection.',
      { issueCount: validation.issueCount },
    ));
  }

  return issues;
}

function validateCandidateAssembly(candidateAssembly) {
  const riskIds = POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_RISK_IDS;
  const issues = [];

  if (!candidateAssembly || typeof candidateAssembly !== 'object') {
    return [buildRisk(
      riskIds.ASSEMBLY_MISSING,
      'Candidate-target adaptation requires the read-only candidate-plan assembly.',
    )];
  }

  if (candidateAssembly.statusId !==
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
        .ASSEMBLY_READY || candidateAssembly.assemblyReady !== true) {
    issues.push(buildRisk(
      riskIds.ASSEMBLY_NOT_READY,
      'Candidate-target adaptation requires an assembly with every exact target mapped.',
      { statusId: candidateAssembly.statusId || null },
    ));
  }

  if (candidateAssembly.readOnly !== true) {
    issues.push(buildRisk(
      riskIds.ASSEMBLY_NOT_READ_ONLY,
      'Candidate-target adaptation requires a read-only candidate-plan assembly.',
    ));
  }

  if (candidateAssembly.deletionAuthorized !== false) {
    issues.push(buildRisk(
      riskIds.ASSEMBLY_AUTHORIZES_DELETION,
      'Candidate-target adaptation cannot accept an assembly that authorizes deletion.',
    ));
  }

  if (candidateAssembly.executionManifestWritten !== false) {
    issues.push(buildRisk(
      riskIds.ASSEMBLY_MANIFEST_WRITTEN,
      'Candidate-target adaptation cannot accept an assembly that wrote an execution manifest.',
    ));
  }

  const validation = validatePolicyCompatibilityRetirementCandidatePlanAssemblyGate(
    candidateAssembly,
  );
  if (candidateAssembly.validation?.ok !== true || !validation.ok) {
    issues.push(buildRisk(
      riskIds.ASSEMBLY_VALIDATION_FAILED,
      'Candidate-target adaptation requires a structurally valid candidate-plan assembly.',
      { issueCount: validation.issueCount },
    ));
  }

  return issues;
}

function buildCandidateMappingIndex(mappings = []) {
  const mappingsByTargetKey = new Map();

  asArray(mappings).forEach(mapping => {
    const targetKey = buildPolicyCompatibilityRetirementCandidateTargetKey(mapping.candidate);
    const existingMappings = mappingsByTargetKey.get(targetKey) || [];
    mappingsByTargetKey.set(targetKey, [...existingMappings, mapping]);
  });

  return mappingsByTargetKey;
}

function buildCandidateMappingIssues({ candidateTargetEntries = [], mappings = [] } = {}) {
  const riskIds = POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_RISK_IDS;
  const issues = [];
  const mappingsByTargetKey = buildCandidateMappingIndex(mappings);

  if (asArray(mappings).length !== asArray(candidateTargetEntries).length) {
    issues.push(buildRisk(
      riskIds.MAPPING_COUNT_MISMATCH,
      'Candidate-target adaptation requires exactly one assembly mapping for every projected target.',
      {
        candidateTargetCount: asArray(candidateTargetEntries).length,
        mappingCount: asArray(mappings).length,
      },
    ));
  }

  asArray(candidateTargetEntries).forEach(target => {
    const targetKey = buildPolicyCompatibilityRetirementCandidateTargetKey(target);
    const matchingMappings = mappingsByTargetKey.get(targetKey) || [];

    if (matchingMappings.length === 0) {
      issues.push(buildRisk(
        riskIds.MAPPING_TARGET_MISSING,
        'Every projected candidate target requires one exact assembly mapping before it enters execution planning.',
        { path: target.path || null, actionId: target.actionId || null },
      ));
      return;
    }

    if (matchingMappings.length > 1) {
      issues.push(buildRisk(
        riskIds.MAPPING_TARGET_DUPLICATE,
        'Candidate-target adaptation cannot choose between duplicate assembly mappings.',
        { path: target.path || null, actionId: target.actionId || null },
      ));
      return;
    }

    const [mapping] = matchingMappings;
    if (mapping.statusId !==
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS.MAPPED) {
      issues.push(buildRisk(
        riskIds.MAPPING_NOT_READY,
        'Candidate-target adaptation requires every target mapping to be explicitly ready.',
        { path: target.path || null, mappingStatusId: mapping.statusId || null },
      ));
    }

    if (!cleanString(mapping.categoryId)) {
      issues.push(buildRisk(
        riskIds.MAPPING_CATEGORY_MISSING,
        'Candidate-target adaptation requires every exact target to retain its action-owned category.',
        { path: target.path || null },
      ));
    }

    if (cleanString(mapping.expectedActionId) !== cleanString(target.actionId) ||
        cleanString(mapping.candidate?.actionId) !== cleanString(target.actionId)) {
      issues.push(buildRisk(
        riskIds.MAPPING_ACTION_MISMATCH,
        'Candidate-target adaptation requires the projected action and assembled category action to remain identical.',
        {
          path: target.path || null,
          actionId: target.actionId || null,
          expectedActionId: mapping.expectedActionId || null,
        },
      ));
    }
  });

  return issues;
}

function buildExecutionPlanCandidateTargetEntries({
  candidateTargetEntries = [],
  mappings = [],
} = {}) {
  const mappingsByTargetKey = buildCandidateMappingIndex(mappings);

  return asArray(candidateTargetEntries)
    .flatMap(target => {
      const [mapping] = mappingsByTargetKey.get(
        buildPolicyCompatibilityRetirementCandidateTargetKey(target),
      ) || [];

      if (!mapping || !cleanString(mapping.categoryId)) return [];

      return [{
        categoryId: cleanString(mapping.categoryId),
        actionId: cleanString(target.actionId),
        path: cleanString(target.path),
        targetKindId: cleanString(target.kindId),
        componentPath: cleanString(target.componentPath) || null,
        dependencyIds: asArray(target.dependencyIds),
        sourceTextFragments: asArray(target.sourceTextFragments),
        testNameFragments: asArray(target.testNameFragments),
        wholeFileDeletion: target.kindId ===
          POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.NAMED_TEST_SCOPE
          ? false
          : null,
      }];
    })
    .sort((left, right) => buildExecutionPlanTargetInputKey(left)
      .localeCompare(buildExecutionPlanTargetInputKey(right)));
}

function sameTargetEntryList(left = [], right = []) {
  const leftKeys = asArray(left)
    .map(buildExecutionPlanTargetInputKey)
    .sort();
  const rightKeys = asArray(right)
    .map(buildExecutionPlanTargetInputKey)
    .sort();

  return JSON.stringify(leftKeys) === JSON.stringify(rightKeys);
}

function hasOnlyExecutionPlanTargetFields(entries = []) {
  const allowedFields = new Set([
    'categoryId',
    'actionId',
    'path',
    'targetKindId',
    'componentPath',
    'dependencyIds',
    'sourceTextFragments',
    'testNameFragments',
    'wholeFileDeletion',
  ]);

  return asArray(entries).every(entry => entry && typeof entry === 'object' &&
    !Array.isArray(entry) && Object.keys(entry).every(fieldName =>
      allowedFields.has(fieldName)));
}

export {
  buildCandidateMappingIssues,
  buildExecutionPlanCandidateTargetEntries,
  hasOnlyExecutionPlanTargetFields,
  sameTargetEntryList,
  validateCandidateAssembly,
  validateCandidateProjection,
};
