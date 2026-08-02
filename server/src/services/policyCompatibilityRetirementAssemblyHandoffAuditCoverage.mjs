/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS,
} from './policyCompatibilityRetirementCandidatePlanAssemblyGate.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS,
} from './policyCompatibilityRetirementExecutionManifestTargets.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_COVERAGE_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS,
  asArray,
  asObject,
  buildRisk,
  cleanString,
  normalizePath,
  sameStringList,
} from './policyCompatibilityRetirementAssemblyHandoffAuditShared.mjs';

function manifestEntryMatchesCandidate(entry = {}, mapping = {}) {
  const candidate = asObject(mapping.candidate);
  const isNamedScope = candidate.kindId ===
    POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.NAMED_TEST_SCOPE;

  return cleanString(entry.categoryId) === cleanString(mapping.categoryId) &&
    cleanString(entry.actionId) === cleanString(candidate.actionId) &&
    normalizePath(entry.path) === normalizePath(candidate.path) &&
    cleanString(entry.targetKindId) === cleanString(candidate.kindId) &&
    normalizePath(entry.componentPath) === normalizePath(candidate.componentPath) &&
    sameStringList(entry.dependencyIds, candidate.dependencyIds) &&
    sameStringList(entry.sourceTextFragments, candidate.sourceTextFragments) &&
    sameStringList(entry.testNameFragments, candidate.testNameFragments) &&
    (!isNamedScope || entry.wholeFileDeletion === false);
}

function buildPolicyCompatibilityRetirementAssemblyArtifactCoverage(assembly = {}, artifact = {}) {
  const manifestEntries = asArray(artifact.executionPlan?.manifest?.entries);

  return asArray(assembly.mappings)
    .filter(mapping => mapping.statusId ===
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS.MAPPED)
    .map(mapping => {
      const matches = manifestEntries.filter(entry => manifestEntryMatchesCandidate(entry, mapping));
      const statusId = matches.length === 0
        ? POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_COVERAGE_STATUS_IDS.MISSING
        : matches.length === 1
          ? POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_COVERAGE_STATUS_IDS.COVERED
          : POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_COVERAGE_STATUS_IDS
            .AMBIGUOUS;

      return {
        categoryId: mapping.categoryId || null,
        candidate: mapping.candidate || null,
        statusId,
        matchingEntryCount: matches.length,
      };
    });
}

function validatePolicyCompatibilityRetirementAssemblyArtifactCoverage(coverage = []) {
  const issues = [];

  asArray(coverage).forEach(record => {
    if (record.statusId ===
        POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_COVERAGE_STATUS_IDS.MISSING) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.ARTIFACT_TARGET_MISSING,
        'Every assembled candidate must be represented exactly once by the approved execution artifact.',
        { categoryId: record.categoryId, candidate: record.candidate },
      ));
    }

    if (record.statusId ===
        POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_COVERAGE_STATUS_IDS.AMBIGUOUS) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
          .ARTIFACT_TARGET_AMBIGUOUS,
        'The approved execution artifact cannot represent one assembled target more than once.',
        { categoryId: record.categoryId, candidate: record.candidate },
      ));
    }
  });

  return issues;
}

export {
  buildPolicyCompatibilityRetirementAssemblyArtifactCoverage,
  validatePolicyCompatibilityRetirementAssemblyArtifactCoverage,
};
