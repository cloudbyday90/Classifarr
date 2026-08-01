/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from './policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS,
} from './policyCompatibilityRetirementManifestReconciliation.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_ACTION_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS,
  buildPolicyCompatibilityRetirementExecutionManifestTargets,
} from './policyCompatibilityRetirementExecutionManifestTargets.mjs';

const POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_VERSION =
  'policy.compatibility_retirement_execution_manifest_binding.v1';

const POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_STATUS_IDS = Object.freeze({
  BINDING_READY: 'binding_ready',
  BLOCKED_BY_RECONCILIATION: 'blocked_by_reconciliation',
  BLOCKED_BY_EXECUTION_PLAN: 'blocked_by_execution_plan',
  BLOCKED_BY_MANIFEST_COVERAGE: 'blocked_by_manifest_coverage',
  BLOCKED_BY_SIDE_EFFECT: 'blocked_by_side_effect',
});

const POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS = Object.freeze({
  RECONCILIATION_MISSING: 'reconciliation_missing',
  RECONCILIATION_NOT_READY: 'reconciliation_not_ready',
  RECONCILIATION_AUTHORIZES_DELETION: 'reconciliation_authorizes_deletion',
  RECONCILIATION_NOT_READ_ONLY: 'reconciliation_not_read_only',
  RECONCILIATION_VALIDATION_FAILED: 'reconciliation_validation_failed',
  EXECUTION_PLAN_MISSING: 'execution_plan_missing',
  EXECUTION_PLAN_NOT_READY: 'execution_plan_not_ready',
  EXECUTION_PLAN_NOT_APPROVED: 'execution_plan_not_approved',
  EXECUTION_PLAN_VALIDATION_FAILED: 'execution_plan_validation_failed',
  EXECUTION_PLAN_SIDE_EFFECT_REPORTED: 'execution_plan_side_effect_reported',
  TARGET_PATH_MISSING: 'target_path_missing',
  TARGET_ACTION_UNKNOWN: 'target_action_unknown',
  NAMED_SCOPE_FRAGMENT_MISSING: 'named_scope_fragment_missing',
  TARGET_DEPENDENCY_MISSING: 'target_dependency_missing',
  EXECUTION_TARGET_MISSING_FROM_MANIFEST: 'execution_target_missing_from_manifest',
  NAMED_SCOPE_ACTION_UNSUPPORTED: 'named_scope_action_unsupported',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  BINDING_AUTHORIZES_DELETION: 'binding_authorizes_deletion',
});

const SUPPORTED_EXECUTION_PLAN_ACTION_IDS = Object.freeze(
  Object.values(POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS),
);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).map(cleanString).filter(Boolean))];
}

function sameStringList(left, right) {
  return JSON.stringify(uniqueStrings(left)) === JSON.stringify(uniqueStrings(right));
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

function validateReconciliation(reconciliation) {
  const issues = [];

  if (!reconciliation || typeof reconciliation !== 'object') {
    return [{
      riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .RECONCILIATION_MISSING,
      message: 'Execution-manifest binding requires the read-only retirement reconciliation.',
    }];
  }

  if (reconciliation.statusId !==
      POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS
        .RECONCILIATION_READY || reconciliation.reconciliationReady !== true) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .RECONCILIATION_NOT_READY,
      statusId: reconciliation.statusId || null,
      message: 'Execution-manifest binding requires a ready compatibility retirement reconciliation.',
    });
  }

  if (reconciliation.deletionAuthorized !== false) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .RECONCILIATION_AUTHORIZES_DELETION,
      message: 'The prerequisite reconciliation must not authorize deletion.',
    });
  }

  if (reconciliation.readOnly !== true) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .RECONCILIATION_NOT_READ_ONLY,
      message: 'The prerequisite reconciliation must remain read-only.',
    });
  }

  if (reconciliation.validation?.ok !== true) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .RECONCILIATION_VALIDATION_FAILED,
      message: 'The prerequisite reconciliation must have no validation findings.',
    });
  }

  return issues;
}

function validateExecutionPlan(executionPlan) {
  const issues = [];

  if (!executionPlan || typeof executionPlan !== 'object') {
    return [{
      riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .EXECUTION_PLAN_MISSING,
      message: 'Execution-manifest binding requires an approved read-only execution plan.',
    }];
  }

  if (executionPlan.statusId !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE ||
      executionPlan.readyForExecutionGate !== true) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .EXECUTION_PLAN_NOT_READY,
      statusId: executionPlan.statusId || null,
      message: 'Execution-manifest binding requires a ready execution plan before its separate execution gate.',
    });
  }

  if (executionPlan.manifest?.approved !== true) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .EXECUTION_PLAN_NOT_APPROVED,
      message: 'Execution-manifest binding requires explicit execution-plan manifest approval.',
    });
  }

  if (executionPlan.validation?.ok !== true) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .EXECUTION_PLAN_VALIDATION_FAILED,
      message: 'Execution-manifest binding requires a valid execution plan.',
    });
  }

  Object.entries(executionPlan.sideEffects || {}).forEach(([sideEffectId, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
          .EXECUTION_PLAN_SIDE_EFFECT_REPORTED,
        sideEffectId,
        message: 'Execution planning must remain observational while compatibility targets are bound.',
      });
    }
  });

  return issues;
}

function validateTargets(targets, reconciliationEntries) {
  const issues = [];
  const reconciliationDependencyIds = new Set(asArray(reconciliationEntries)
    .map(entry => cleanString(entry.dependencyId))
    .filter(Boolean));
  const representedDependencyIds = new Set();

  asArray(targets).forEach(target => {
    const targetDependencyIds = uniqueStrings(target.dependencyIds);

    if (!cleanString(target.path)) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
          .TARGET_PATH_MISSING,
        dependencyIds: targetDependencyIds,
        message: 'Every execution-manifest binding target must name an exact source or component path.',
      });
    }

    if (!Object.values(POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_ACTION_IDS)
      .includes(target.actionId)) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
          .TARGET_ACTION_UNKNOWN,
        path: target.path || null,
        actionId: target.actionId || null,
        message: 'Every execution-manifest binding target must name a recognized action.',
      });
    }

    if (target.kindId ===
        POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.NAMED_TEST_SCOPE &&
        uniqueStrings(target.testNameFragments).length === 0) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
          .NAMED_SCOPE_FRAGMENT_MISSING,
        path: target.path || null,
        message: 'A retained shared test file requires exact named assertions for a scope-only retirement.',
      });
    }

    targetDependencyIds.forEach(dependencyId => representedDependencyIds.add(dependencyId));
  });

  reconciliationDependencyIds.forEach(dependencyId => {
    if (!representedDependencyIds.has(dependencyId)) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
          .TARGET_DEPENDENCY_MISSING,
        dependencyId,
        message: 'Every reconciled dependency must be represented by at least one exact execution target.',
      });
    }
  });

  return issues;
}

function findManifestEntry(target, manifestEntries) {
  return asArray(manifestEntries).find(entry => (
    cleanString(entry.path) === cleanString(target.path) &&
    cleanString(entry.actionId) === cleanString(target.actionId) &&
    (target.kindId !== POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS
      .NAMED_TEST_SCOPE || sameStringList(
      entry.testNameFragments,
      target.testNameFragments,
    ))
  )) || null;
}

function buildManifestCoverage(targets, executionPlan = {}) {
  const manifestEntries = asArray(executionPlan.manifest?.entries);

  return asArray(targets).map(target => ({
    target,
    manifestEntry: findManifestEntry(target, manifestEntries),
    covered: Boolean(findManifestEntry(target, manifestEntries)),
    supportedByCurrentExecutionPlan:
      SUPPORTED_EXECUTION_PLAN_ACTION_IDS.includes(target.actionId),
  }));
}

function validateManifestCoverage(coverage) {
  const issues = [];

  asArray(coverage).forEach(record => {
    if (!record.supportedByCurrentExecutionPlan) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
          .NAMED_SCOPE_ACTION_UNSUPPORTED,
        dependencyIds: record.target.dependencyIds,
        path: record.target.path,
        actionId: record.target.actionId,
        message: 'The current file-oriented execution plan cannot represent a named shared-test scope; extend that plan before binding it for execution.',
      });
    }

    if (!record.covered) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
          .EXECUTION_TARGET_MISSING_FROM_MANIFEST,
        dependencyIds: record.target.dependencyIds,
        path: record.target.path,
        actionId: record.target.actionId,
        message: 'Every exact reconciliation target must be represented by the approved execution manifest before the separate execution gate can consider it.',
      });
    }
  });

  return issues;
}

function determineStatusId({ reconciliationIssues, executionPlanIssues, targetIssues, coverageIssues, sideEffects }) {
  if (hasSideEffects(sideEffects)) {
    return POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_STATUS_IDS
      .BLOCKED_BY_SIDE_EFFECT;
  }

  if (reconciliationIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_STATUS_IDS
      .BLOCKED_BY_RECONCILIATION;
  }

  if (executionPlanIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_STATUS_IDS
      .BLOCKED_BY_EXECUTION_PLAN;
  }

  if (targetIssues.length > 0 || coverageIssues.length > 0) {
    return POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_STATUS_IDS
      .BLOCKED_BY_MANIFEST_COVERAGE;
  }

  return POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_STATUS_IDS
    .BINDING_READY;
}

function buildPolicyCompatibilityRetirementExecutionManifestBinding({
  reconciliation = null,
  executionPlan = null,
  sideEffects = {},
} = {}) {
  const normalizedSideEffects = buildSideEffects(sideEffects);
  const reconciliationIssues = validateReconciliation(reconciliation);
  const executionPlanIssues = validateExecutionPlan(executionPlan);
  const targets = reconciliation && typeof reconciliation === 'object'
    ? buildPolicyCompatibilityRetirementExecutionManifestTargets(reconciliation.entries)
    : [];
  const targetIssues = validateTargets(targets, reconciliation?.entries);
  const coverage = buildManifestCoverage(targets, executionPlan || {});
  const coverageIssues = validateManifestCoverage(coverage);
  const issues = [
    ...reconciliationIssues,
    ...executionPlanIssues,
    ...targetIssues,
    ...coverageIssues,
  ];

  if (hasSideEffects(normalizedSideEffects)) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .SIDE_EFFECT_PERFORMED,
      message: 'Execution-manifest binding cannot delete files, rewrite source, change storage, or write an execution manifest.',
    });
  }

  const statusId = determineStatusId({
    reconciliationIssues,
    executionPlanIssues,
    targetIssues,
    coverageIssues,
    sideEffects: normalizedSideEffects,
  });
  const binding = {
    version: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_VERSION,
    statusId,
    bindingReady: statusId ===
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_STATUS_IDS.BINDING_READY,
    deletionAuthorized: false,
    reconciliation: {
      statusId: reconciliation?.statusId || null,
      reconciliationReady: reconciliation?.reconciliationReady === true,
      validationOk: reconciliation?.validation?.ok === true,
    },
    executionPlan: {
      statusId: executionPlan?.statusId || null,
      readyForExecutionGate: executionPlan?.readyForExecutionGate === true,
      manifestApproved: executionPlan?.manifest?.approved === true,
      validationOk: executionPlan?.validation?.ok === true,
      manifestEntryCount: asArray(executionPlan?.manifest?.entries).length,
    },
    targetCount: targets.length,
    targets,
    coverage,
    sideEffects: normalizedSideEffects,
    issueCount: issues.length,
    issues,
    nextStep: {
      stepId: 'compatibility_execution_manifest_named_scope_model',
      label: 'Compatibility Execution-Manifest Named-Scope Model',
      reason: 'The current execution manifest is file-oriented. Add an authorized, fingerprinted named-test-scope entry model before binding shared test-file assertion retirements to the existing execution path. No deletion or storage change is authorized.',
    },
  };

  return {
    ...binding,
    validation: validatePolicyCompatibilityRetirementExecutionManifestBinding(binding),
  };
}

function validatePolicyCompatibilityRetirementExecutionManifestBinding(binding = {}) {
  const issues = [];

  if (binding.deletionAuthorized !== false) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .BINDING_AUTHORIZES_DELETION,
      message: 'Execution-manifest binding remains observational and cannot authorize deletion.',
    });
  }

  if (binding.issueCount !== asArray(binding.issues).length) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .EXECUTION_TARGET_MISSING_FROM_MANIFEST,
      message: 'Execution-manifest binding issue count must match its issue list.',
    });
  }

  Object.entries(binding.sideEffects || {}).forEach(([sideEffectId, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
          .SIDE_EFFECT_PERFORMED,
        sideEffectId,
        message: 'Execution-manifest binding cannot perform side effects.',
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_VERSION,
  buildPolicyCompatibilityRetirementExecutionManifestBinding,
  validatePolicyCompatibilityRetirementExecutionManifestBinding,
};
