/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from './policyCompatibilityDeletionExecutionActions.mjs';
import {
  normalizePolicyCompatibilityDeletionExecutionManifestEntry,
  validatePolicyCompatibilityDeletionExecutionManifestEntry,
} from './policyCompatibilityDeletionExecutionManifestEntry.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS,
  buildPolicyCompatibilityRetirementExecutionManifestTargets,
} from './policyCompatibilityRetirementExecutionManifestTargets.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS,
} from './policyCompatibilityRetirementManifestReconciliation.mjs';

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_VERSION =
  'policy.compatibility_retirement_candidate_plan_projection.v1';

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_INPUT_VERSION =
  'policy.compatibility_retirement_candidate_plan_input.v1';

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS = Object.freeze({
  CANDIDATE_PLAN_READY: 'candidate_plan_ready',
  BLOCKED_BY_RECONCILIATION: 'blocked_by_reconciliation',
  BLOCKED_BY_TARGETS: 'blocked_by_targets',
  BLOCKED_BY_SIDE_EFFECT: 'blocked_by_side_effect',
});

const POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS = Object.freeze({
  RECONCILIATION_MISSING: 'reconciliation_missing',
  RECONCILIATION_NOT_READY: 'reconciliation_not_ready',
  RECONCILIATION_AUTHORIZES_DELETION: 'reconciliation_authorizes_deletion',
  RECONCILIATION_NOT_READ_ONLY: 'reconciliation_not_read_only',
  RECONCILIATION_VALIDATION_FAILED: 'reconciliation_validation_failed',
  CANDIDATE_TARGETS_MISSING: 'candidate_targets_missing',
  TARGET_KIND_UNKNOWN: 'target_kind_unknown',
  TARGET_ACTION_UNKNOWN: 'target_action_unknown',
  TARGET_PATH_MISSING: 'target_path_missing',
  TARGET_DEPENDENCY_MISSING: 'target_dependency_missing',
  TARGET_DEPENDENCY_UNKNOWN: 'target_dependency_unknown',
  CANDIDATE_TARGET_COUNT_MISMATCH: 'candidate_target_count_mismatch',
  CANDIDATE_DEPENDENCY_COVERAGE_MISMATCH: 'candidate_dependency_coverage_mismatch',
  NATIVE_SUCCESSOR_MISSING: 'native_successor_missing',
  NATIVE_SUCCESSOR_INVALID: 'native_successor_invalid',
  NAMED_SCOPE_INVALID: 'named_scope_invalid',
  CANDIDATE_INPUT_MISMATCH: 'candidate_input_mismatch',
  CANDIDATE_MANIFEST_APPROVED: 'candidate_manifest_approved',
  CANDIDATE_EXECUTION_REQUESTED: 'candidate_execution_requested',
  CANDIDATE_AUTHORIZES_DELETION: 'candidate_authorizes_deletion',
  CANDIDATE_NOT_READ_ONLY: 'candidate_not_read_only',
  ISSUE_COUNT_MISMATCH: 'issue_count_mismatch',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).map(cleanString).filter(Boolean))].sort();
}

function hasOwn(value, propertyName) {
  return Object.prototype.hasOwnProperty.call(value || {}, propertyName);
}

function buildSideEffects(sideEffects = {}) {
  return {
    filesDeleted: sideEffects.filesDeleted === true,
    testsDeleted: sideEffects.testsDeleted === true,
    sourceFilesRewritten: sideEffects.sourceFilesRewritten === true,
    storageChanged: sideEffects.storageChanged === true,
    executionManifestWritten: sideEffects.executionManifestWritten === true,
  };
}

function hasSideEffects(sideEffects = {}) {
  return Object.values(sideEffects).some(Boolean);
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function normalizeNativeSuccessor(successor = {}, dependencyId) {
  return {
    dependencyId,
    handoffId: cleanString(successor.handoffId),
    nativeWorkflowTestPath: cleanString(successor.nativeWorkflowTestPath),
    nativeWorkflowTestNameFragments: uniqueStrings(successor.nativeWorkflowTestNameFragments),
  };
}

function nativeSuccessorKey(successor = {}) {
  return JSON.stringify([
    successor.dependencyId,
    successor.handoffId,
    successor.nativeWorkflowTestPath,
    successor.nativeWorkflowTestNameFragments,
  ]);
}

function buildNativeSuccessorEvidence(target, reconciliationEntriesByDependencyId) {
  const successorsByKey = new Map();

  uniqueStrings(target.dependencyIds).forEach(dependencyId => {
    const entry = reconciliationEntriesByDependencyId.get(dependencyId);

    asArray(entry?.nativeStorageCutover?.nativeWorkflowSuccessors).forEach(successor => {
      const normalizedSuccessor = normalizeNativeSuccessor(successor, dependencyId);
      successorsByKey.set(nativeSuccessorKey(normalizedSuccessor), normalizedSuccessor);
    });
  });

  return [...successorsByKey.values()].sort((left, right) => (
    nativeSuccessorKey(left).localeCompare(nativeSuccessorKey(right))
  ));
}

function buildCandidateTargetEntry(target, reconciliationEntriesByDependencyId) {
  const namedTestScope = target.kindId ===
    POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.NAMED_TEST_SCOPE;

  return {
    kindId: cleanString(target.kindId) || null,
    actionId: cleanString(target.actionId) || null,
    path: cleanString(target.path) || null,
    componentPath: cleanString(target.componentPath) || null,
    dependencyIds: uniqueStrings(target.dependencyIds),
    sourceTextFragments: uniqueStrings(target.sourceTextFragments),
    testNameFragments: uniqueStrings(target.testNameFragments),
    wholeFileDeletion: namedTestScope ? false : null,
    nativeSuccessorEvidence: buildNativeSuccessorEvidence(
      target,
      reconciliationEntriesByDependencyId,
    ),
  };
}

function candidateTargetKey(entry = {}) {
  return JSON.stringify([
    entry.kindId,
    entry.actionId,
    entry.path,
    entry.componentPath,
    entry.dependencyIds,
    entry.sourceTextFragments,
    entry.testNameFragments,
    entry.wholeFileDeletion,
    entry.nativeSuccessorEvidence,
  ]);
}

function buildNamedTestScopePlanInput(entry) {
  return {
    actionId: entry.actionId,
    path: entry.path,
    componentPath: entry.componentPath,
    sourceTextFragments: entry.sourceTextFragments,
    testNameFragments: entry.testNameFragments,
    wholeFileDeletion: false,
  };
}

function validateReconciliation(reconciliation) {
  const issues = [];

  if (!reconciliation || typeof reconciliation !== 'object') {
    return [buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .RECONCILIATION_MISSING,
      'Candidate-plan projection requires the read-only source-backed compatibility retirement reconciliation.',
    )];
  }

  if (reconciliation.statusId !==
      POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS
        .RECONCILIATION_READY || reconciliation.reconciliationReady !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .RECONCILIATION_NOT_READY,
      'Candidate-plan projection requires a ready compatibility retirement reconciliation.',
      { statusId: reconciliation.statusId || null },
    ));
  }

  if (reconciliation.deletionAuthorized !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .RECONCILIATION_AUTHORIZES_DELETION,
      'Candidate-plan projection requires a reconciliation that does not authorize deletion.',
    ));
  }

  if (reconciliation.readOnly !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .RECONCILIATION_NOT_READ_ONLY,
      'Candidate-plan projection requires a read-only reconciliation.',
    ));
  }

  if (reconciliation.validation?.ok !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .RECONCILIATION_VALIDATION_FAILED,
      'Candidate-plan projection requires a reconciliation with no validation findings.',
    ));
  }

  return issues;
}

function validateCandidateTargetEntries({
  candidateTargetEntries = [],
  reconciliationEntries = [],
  requireKnownDependencies = true,
} = {}) {
  const issues = [];
  const reconciliationEntriesByDependencyId = new Map(asArray(reconciliationEntries)
    .map(entry => [cleanString(entry.dependencyId), entry])
    .filter(([dependencyId]) => Boolean(dependencyId)));

  if (candidateTargetEntries.length === 0 && reconciliationEntriesByDependencyId.size > 0) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .CANDIDATE_TARGETS_MISSING,
      'Every ready reconciliation must project at least one exact candidate target.',
    ));
  }

  candidateTargetEntries.forEach(entry => {
    if (!Object.values(POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS)
      .includes(entry.kindId)) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS.TARGET_KIND_UNKNOWN,
        'Candidate retirement targets require a recognized target kind.',
        { kindId: entry.kindId || null, path: entry.path || null },
      ));
    }

    if (!Object.values(POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS)
      .includes(entry.actionId)) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
          .TARGET_ACTION_UNKNOWN,
        'Candidate retirement targets require a recognized future execution action.',
        { actionId: entry.actionId || null, path: entry.path || null },
      ));
    }

    if (!entry.path) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS.TARGET_PATH_MISSING,
        'Candidate retirement targets require an exact repository path.',
      ));
    }

    if (entry.dependencyIds.length === 0) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
          .TARGET_DEPENDENCY_MISSING,
        'Candidate retirement targets require at least one source-backed dependency.',
        { path: entry.path || null },
      ));
    }

    entry.dependencyIds.forEach(dependencyId => {
      if (requireKnownDependencies && !reconciliationEntriesByDependencyId.has(dependencyId)) {
        issues.push(buildRisk(
          POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
            .TARGET_DEPENDENCY_UNKNOWN,
          'Candidate retirement targets cannot introduce dependencies outside the reconciliation.',
          { dependencyId, path: entry.path || null },
        ));
      }
    });

    if (entry.nativeSuccessorEvidence.length === 0) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
          .NATIVE_SUCCESSOR_MISSING,
        'Each candidate retirement target requires declared native workflow successor evidence.',
        { dependencyIds: entry.dependencyIds, path: entry.path || null },
      ));
    }

    entry.nativeSuccessorEvidence.forEach(successor => {
      if (!successor.dependencyId || !successor.handoffId ||
          !successor.nativeWorkflowTestPath ||
          successor.nativeWorkflowTestNameFragments.length === 0) {
        issues.push(buildRisk(
          POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
            .NATIVE_SUCCESSOR_INVALID,
          'Native workflow successor evidence requires its dependency, handoff, test path, and exact test-name fragments.',
          {
            dependencyId: successor.dependencyId || null,
            handoffId: successor.handoffId || null,
            path: entry.path || null,
          },
        ));
      }
    });

    if (entry.kindId ===
        POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.NAMED_TEST_SCOPE) {
      const scopeValidation = validatePolicyCompatibilityDeletionExecutionManifestEntry(
        normalizePolicyCompatibilityDeletionExecutionManifestEntry({
          actionId: entry.actionId,
          path: entry.path,
          componentPath: entry.componentPath,
          sourceTextFragments: entry.sourceTextFragments,
          testNameFragments: entry.testNameFragments,
          wholeFileDeletion: entry.wholeFileDeletion,
        }),
      );

      scopeValidation.issues.forEach(issue => {
        issues.push(buildRisk(
          POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
            .NAMED_SCOPE_INVALID,
          'Named test-scope candidates must remain exact and explicitly prohibit whole-file deletion.',
          {
            entryRiskId: issue.riskId,
            path: entry.path || null,
          },
        ));
      });
    }
  });

  return issues;
}

function determineStatusId({ reconciliationIssues, targetIssues, sideEffects }) {
  if (hasSideEffects(sideEffects)) {
    return POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS
      .BLOCKED_BY_SIDE_EFFECT;
  }

  if (reconciliationIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS
      .BLOCKED_BY_RECONCILIATION;
  }

  if (targetIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS
      .BLOCKED_BY_TARGETS;
  }

  return POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS
    .CANDIDATE_PLAN_READY;
}

function buildPolicyCompatibilityRetirementCandidatePlanProjection({
  reconciliation = null,
  sideEffects = {},
} = {}) {
  const normalizedSideEffects = buildSideEffects(sideEffects);
  const reconciliationIssues = validateReconciliation(reconciliation);
  const reconciliationEntries = reconciliationIssues.length === 0
    ? asArray(reconciliation.entries)
    : [];
  const reconciliationEntriesByDependencyId = new Map(reconciliationEntries
    .map(entry => [cleanString(entry.dependencyId), entry])
    .filter(([dependencyId]) => Boolean(dependencyId)));
  const targets = reconciliationIssues.length === 0
    ? buildPolicyCompatibilityRetirementExecutionManifestTargets(reconciliationEntries)
    : [];
  const candidateTargetEntries = targets
    .map(target => buildCandidateTargetEntry(target, reconciliationEntriesByDependencyId))
    .sort((left, right) => candidateTargetKey(left).localeCompare(candidateTargetKey(right)));
  const namedTestScopeEntries = candidateTargetEntries
    .filter(entry => entry.kindId ===
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.NAMED_TEST_SCOPE)
    .map(buildNamedTestScopePlanInput);
  const targetIssues = reconciliationIssues.length === 0
    ? validateCandidateTargetEntries({ candidateTargetEntries, reconciliationEntries })
    : [];
  const issues = [...reconciliationIssues, ...targetIssues];

  if (hasSideEffects(normalizedSideEffects)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .SIDE_EFFECT_PERFORMED,
      'Candidate-plan projection cannot delete files, rewrite source, change storage, or write an execution manifest.',
    ));
  }

  const statusId = determineStatusId({
    reconciliationIssues,
    targetIssues,
    sideEffects: normalizedSideEffects,
  });
  const projection = {
    version: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_VERSION,
    statusId,
    candidatePlanReady: statusId ===
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS
        .CANDIDATE_PLAN_READY,
    readOnly: true,
    deletionAuthorized: false,
    executionManifestWritten: false,
    reconciliation: {
      statusId: reconciliation?.statusId || null,
      reconciliationReady: reconciliation?.reconciliationReady === true,
      validationOk: reconciliation?.validation?.ok === true,
      entryCount: reconciliationEntries.length,
      dependencyIds: uniqueStrings(reconciliationEntries.map(entry => entry.dependencyId)),
    },
    targetCount: targets.length,
    candidateTargetEntries,
    candidatePlanInput: {
      version: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_INPUT_VERSION,
      manifestApproved: false,
      approvedBy: null,
      candidateTargetEntries,
      namedTestScopeEntries,
    },
    sideEffects: normalizedSideEffects,
    issueCount: issues.length,
    issues,
    nextStep: {
      stepId: 'compatibility_deletion_category_taxonomy_reconciliation',
      label: 'Compatibility Deletion-Category Taxonomy Reconciliation',
      reason: 'Derive exact action-owned taxonomy targets from the read-only candidate projection before assembling a later plan artifact.',
    },
  };

  return {
    ...projection,
    validation: validatePolicyCompatibilityRetirementCandidatePlanProjection(projection),
  };
}

function validatePolicyCompatibilityRetirementCandidatePlanProjection(projection = {}) {
  const issues = [];
  const candidateTargetEntries = asArray(projection.candidateTargetEntries);
  const candidatePlanInput = projection.candidatePlanInput || {};
  const reconciliationDependencyIds = uniqueStrings(projection.reconciliation?.dependencyIds);
  const candidateDependencyIds = uniqueStrings(candidateTargetEntries
    .flatMap(entry => entry.dependencyIds));
  const expectedScopeEntries = candidateTargetEntries
    .filter(entry => entry.kindId ===
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.NAMED_TEST_SCOPE)
    .map(buildNamedTestScopePlanInput);

  if (projection.readOnly !== true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS.CANDIDATE_NOT_READ_ONLY,
      'Candidate-plan projection must remain read-only.',
    ));
  }

  if (projection.deletionAuthorized !== false) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .CANDIDATE_AUTHORIZES_DELETION,
      'Candidate-plan projection cannot authorize deletion.',
    ));
  }

  validateCandidateTargetEntries({
    candidateTargetEntries,
    requireKnownDependencies: false,
  }).forEach(issue => issues.push(issue));

  if (projection.targetCount !== candidateTargetEntries.length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .CANDIDATE_TARGET_COUNT_MISMATCH,
      'Candidate-plan projection target count must match its exact target entries.',
    ));
  }

  if (JSON.stringify(candidateDependencyIds) !== JSON.stringify(reconciliationDependencyIds)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .CANDIDATE_DEPENDENCY_COVERAGE_MISMATCH,
      'Candidate targets must represent exactly the dependencies reported by the source reconciliation.',
    ));
  }

  if (candidatePlanInput.manifestApproved !== false || candidatePlanInput.approvedBy !== null) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .CANDIDATE_MANIFEST_APPROVED,
      'Candidate-plan projection must leave manifest approval false and unassigned.',
    ));
  }

  if (candidatePlanInput.executeDeletionNow === true ||
      candidatePlanInput.executionAuthorized === true ||
      hasOwn(candidatePlanInput, 'executionManifest')) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .CANDIDATE_EXECUTION_REQUESTED,
      'Candidate-plan projection cannot request execution or embed an execution manifest.',
    ));
  }

  if (JSON.stringify(asArray(candidatePlanInput.candidateTargetEntries)) !==
      JSON.stringify(candidateTargetEntries) ||
      JSON.stringify(asArray(candidatePlanInput.namedTestScopeEntries)) !==
      JSON.stringify(expectedScopeEntries)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .CANDIDATE_INPUT_MISMATCH,
      'Candidate plan input must exactly preserve the internally projected targets and named scope entries.',
    ));
  }

  if (projection.issueCount !== asArray(projection.issues).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS.ISSUE_COUNT_MISMATCH,
      'Candidate-plan projection issue count must match its issue list.',
    ));
  }

  Object.entries(projection.sideEffects || {}).forEach(([sideEffectId, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
          .SIDE_EFFECT_PERFORMED,
        'Candidate-plan projection cannot perform side effects.',
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
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_INPUT_VERSION,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_VERSION,
  buildPolicyCompatibilityRetirementCandidatePlanProjection,
  validatePolicyCompatibilityRetirementCandidatePlanProjection,
};
