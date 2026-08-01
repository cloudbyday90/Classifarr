/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  LEGACY_COMPATIBILITY_REMOVAL_CONDITION_IDS,
} from './policyBuilderLegacyCompatibilityBoundary.mjs';
import {
  listPolicyAuthoringLegacyBridgeDeletionRequirements,
} from './policyAuthoringLegacyBridgeBoundary.mjs';
import {
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS,
  asArray,
  cleanString,
  listPolicyCompatibilityComponentDeletionDependencies,
} from './policyCompatibilityComponentDeletionDependencyInventory.mjs';
import {
  listPolicyCompatibilityMaintenanceTestRecords,
} from './policyCompatibilityMaintenanceTestOwnership.mjs';
import {
  POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_DELETION_EVIDENCE_IDS,
  listPolicyNativeStorageCutoverTestHandoffs,
} from './policyNativeStorageCutoverTestHandoff.mjs';
import {
  POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS,
  listPolicyStarterTemplateCompatibilityBridgeArtifacts,
} from './policyStarterTemplateCompatibilityBridgeInventory.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_VERSION,
  buildPolicyCompatibilityRetirementManifestEntry,
} from './policyCompatibilityRetirementManifestInventory.mjs';

const POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS = Object.freeze({
  RECONCILIATION_READY: 'reconciliation_ready',
  BLOCKED_BY_DEPENDENCY_AUDIT: 'blocked_by_dependency_audit',
  BLOCKED_BY_RECONCILIATION: 'blocked_by_reconciliation',
  BLOCKED_BY_SIDE_EFFECT: 'blocked_by_side_effect',
});

const POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS = Object.freeze({
  DEPENDENCY_AUDIT_MISSING: 'dependency_audit_missing',
  DEPENDENCY_AUDIT_NOT_READY: 'dependency_audit_not_ready',
  DEPENDENCY_AUDIT_AUTHORIZES_DELETION: 'dependency_audit_authorizes_deletion',
  NATIVE_REHOME_REMAINS: 'native_rehome_remains',
  DEPENDENCY_COUNT_MISMATCH: 'dependency_count_mismatch',
  DEPENDENCY_CLASSIFICATION_COUNT_MISMATCH: 'dependency_classification_count_mismatch',
  DUPLICATE_MANIFEST_ENTRY: 'duplicate_manifest_entry',
  MANIFEST_ENTRY_MISSING: 'manifest_entry_missing',
  UNKNOWN_MANIFEST_ENTRY: 'unknown_manifest_entry',
  MANIFEST_ENTRY_DEPENDENCY_DRIFT: 'manifest_entry_dependency_drift',
  UNKNOWN_CLASSIFICATION: 'unknown_classification',
  COMPONENT_ARTIFACT_MISSING: 'component_artifact_missing',
  COMPONENT_DISPOSITION_INVALID: 'component_disposition_invalid',
  COMPONENT_ALLOWED_IN_NORMAL_AUTHORING: 'component_allowed_in_normal_authoring',
  COMPONENT_MUTATES_RAW_PAYLOAD: 'component_mutates_raw_payload',
  REMOVAL_CONDITION_INVALID: 'removal_condition_invalid',
  DELETION_GATES_INCOMPLETE: 'deletion_gates_incomplete',
  COMPONENT_HANDOFF_MISSING: 'component_handoff_missing',
  SOURCE_TEST_HANDOFF_MISSING: 'source_test_handoff_missing',
  NAMED_SCOPE_MISSING: 'named_scope_missing',
  NAMED_SCOPE_HANDOFF_MISSING: 'named_scope_handoff_missing',
  NAMED_SCOPE_DISPOSITION_INVALID: 'named_scope_disposition_invalid',
  TEST_DISPOSITION_UNRESOLVED: 'test_disposition_unresolved',
  DELETION_EVIDENCE_INCOMPLETE: 'deletion_evidence_incomplete',
  NATIVE_WORKFLOW_SUCCESSOR_MISSING: 'native_workflow_successor_missing',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  DELETION_AUTHORIZED: 'deletion_authorized',
  MANIFEST_NOT_READ_ONLY: 'manifest_not_read_only',
});

const REQUIRED_DELETION_GATE_IDS = Object.freeze(
  listPolicyAuthoringLegacyBridgeDeletionRequirements(),
);

const REQUIRED_DELETION_EVIDENCE_IDS = Object.freeze(
  Object.values(POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_DELETION_EVIDENCE_IDS),
);

function buildSideEffects(sideEffects = {}) {
  return {
    componentsDeleted: sideEffects.componentsDeleted === true,
    testsDeleted: sideEffects.testsDeleted === true,
    sourceFilesRewritten: sideEffects.sourceFilesRewritten === true,
    storageChanged: sideEffects.storageChanged === true,
    executionManifestWritten: sideEffects.executionManifestWritten === true,
  };
}

function hasSideEffects(sideEffects = {}) {
  return Object.values(sideEffects).some(Boolean);
}

function getClassificationCounts(records) {
  return Object.fromEntries(
    Object.values(POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS)
      .map(classificationId => [
        classificationId,
        asArray(records).filter(record => record.classificationId === classificationId).length,
      ]),
  );
}

function findDuplicateValues(values) {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

function validateDependencyAudit(dependencyAudit, dependencies) {
  const issues = [];
  const expectedClassificationCounts = getClassificationCounts(dependencies);

  if (!dependencyAudit || typeof dependencyAudit !== 'object') {
    return [{
      riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
        .DEPENDENCY_AUDIT_MISSING,
      message: 'Retirement manifest reconciliation requires the source-backed dependency audit.',
    }];
  }

  if (dependencyAudit.ok !== true || dependencyAudit.sourceAudit?.ok !== true ||
      dependencyAudit.routeAudit?.ok !== true || dependencyAudit.statusId !==
        POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS
          .READY_FOR_RETIREMENT_AND_MANIFEST_RECONCILIATION) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
        .DEPENDENCY_AUDIT_NOT_READY,
      statusId: dependencyAudit.statusId || null,
      message: 'Retirement reconciliation requires a ready source- and route-backed dependency audit after all native rehomes complete.',
    });
  }

  if (dependencyAudit.deletionAuthorized !== false) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
        .DEPENDENCY_AUDIT_AUTHORIZES_DELETION,
      message: 'The prerequisite dependency audit must remain read-only and cannot authorize deletion.',
    });
  }

  if (expectedClassificationCounts[
    POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS.NATIVE_REHOME
  ] !== 0) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
        .NATIVE_REHOME_REMAINS,
      message: 'Native contract rehoming must finish before compatibility retirement manifest reconciliation begins.',
    });
  }

  if (dependencyAudit.checkedDependencyCount !== asArray(dependencies).length) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
        .DEPENDENCY_COUNT_MISMATCH,
      expectedCount: asArray(dependencies).length,
      actualCount: dependencyAudit.checkedDependencyCount ?? null,
      message: 'The dependency audit count must match the immutable reconciliation inventory.',
    });
  }

  Object.entries(expectedClassificationCounts).forEach(([classificationId, expectedCount]) => {
    if (dependencyAudit.classificationCounts?.[classificationId] !== expectedCount) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .DEPENDENCY_CLASSIFICATION_COUNT_MISMATCH,
        classificationId,
        expectedCount,
        actualCount: dependencyAudit.classificationCounts?.[classificationId] ?? null,
        message: 'The dependency audit classification counts must match the immutable reconciliation inventory.',
      });
    }
  });

  return issues;
}

function validateManifestEntries(entries, dependencies) {
  const issues = [];
  const dependencyIds = asArray(dependencies).map(dependency => cleanString(dependency.id));
  const dependenciesById = new Map(asArray(dependencies).map(dependency => [
    cleanString(dependency.id),
    dependency,
  ]));
  const entryIds = asArray(entries).map(entry => cleanString(entry.dependencyId));
  const expectedEntryIds = new Set(dependencyIds);

  findDuplicateValues(entryIds.filter(Boolean)).forEach(dependencyId => {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
        .DUPLICATE_MANIFEST_ENTRY,
      dependencyId,
      message: 'Every compatibility dependency must have exactly one retirement manifest entry.',
    });
  });

  dependencyIds.filter(Boolean).forEach(dependencyId => {
    if (!entryIds.includes(dependencyId)) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .MANIFEST_ENTRY_MISSING,
        dependencyId,
        message: 'Every dependency from the source-backed audit must be reconciled exactly once.',
      });
    }
  });

  entryIds.filter(Boolean).forEach(dependencyId => {
    if (!expectedEntryIds.has(dependencyId)) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .UNKNOWN_MANIFEST_ENTRY,
        dependencyId,
        message: 'Retirement manifest reconciliation cannot add dependencies outside the immutable audit inventory.',
      });
    }
  });

  asArray(entries).forEach(entry => {
    const dependency = dependenciesById.get(cleanString(entry.dependencyId)) || null;
    const isNamedRetirement = dependency?.classificationId ===
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .NAMED_COMPATIBILITY_RETIREMENT;
    const isTestDependency = dependency?.kindId ===
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.TEST_DEPENDENCY;
    const cutover = entry.nativeStorageCutover || {};
    const missingDeletionGateIds = REQUIRED_DELETION_GATE_IDS
      .filter(gateId => !asArray(cutover.deletionGateIds).includes(gateId));
    const missingDeletionEvidenceIds = REQUIRED_DELETION_EVIDENCE_IDS
      .filter(evidenceId => !asArray(cutover.requiredDeletionEvidenceIds).includes(evidenceId));

    if (!Object.values(POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS)
      .includes(entry.classificationId)) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .UNKNOWN_CLASSIFICATION,
        dependencyId: entry.dependencyId || null,
        classificationId: entry.classificationId || null,
        message: 'Each retirement manifest entry must preserve a recognized dependency classification.',
      });
    }

    if (dependency && (
      entry.sourcePath !== dependency.sourcePath ||
      entry.componentPath !== dependency.componentPath ||
      entry.dependencyKindId !== dependency.kindId ||
      entry.classificationId !== dependency.classificationId ||
      JSON.stringify(asArray(entry.testNameFragments)) !==
        JSON.stringify(asArray(dependency.testNameFragments)) ||
      (dependency.compatibilityScopeId || null) !== (entry.compatibilityScope?.id || null)
    )) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .MANIFEST_ENTRY_DEPENDENCY_DRIFT,
        dependencyId: entry.dependencyId || null,
        message: 'Each manifest entry must preserve the exact source, component, classification, named assertions, and compatibility scope from the dependency audit.',
      });
    }

    if (!entry.componentArtifact) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .COMPONENT_ARTIFACT_MISSING,
        dependencyId: entry.dependencyId || null,
        componentPath: entry.componentPath || null,
        message: 'Each entry must retain its native-storage-gated compatibility component artifact.',
      });
    } else {
      if (entry.componentArtifact.dispositionId !==
          POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS
            .DELETE_AFTER_NATIVE_STORAGE) {
        issues.push({
          riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
            .COMPONENT_DISPOSITION_INVALID,
          dependencyId: entry.dependencyId || null,
          dispositionId: entry.componentArtifact.dispositionId || null,
          message: 'This manifest only reconciles components declared for deletion after native storage is authoritative.',
        });
      }

      if (entry.componentArtifact.normalAuthoringAllowed === true) {
        issues.push({
          riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
            .COMPONENT_ALLOWED_IN_NORMAL_AUTHORING,
          dependencyId: entry.dependencyId || null,
          message: 'A retiring compatibility component cannot be allowed in normal authoring.',
        });
      }

      if (entry.componentArtifact.rawPayloadMutationAllowed === true) {
        issues.push({
          riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
            .COMPONENT_MUTATES_RAW_PAYLOAD,
          dependencyId: entry.dependencyId || null,
          message: 'A retiring compatibility component cannot retain raw legacy payload mutation authority.',
        });
      }
    }

    if (cutover.removalConditionId !==
        LEGACY_COMPATIBILITY_REMOVAL_CONDITION_IDS.NATIVE_INTENT_STORAGE_AUTHORITATIVE) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .REMOVAL_CONDITION_INVALID,
        dependencyId: entry.dependencyId || null,
        message: 'Each retirement entry must be gated on native intent storage becoming authoritative.',
      });
    }

    if (missingDeletionGateIds.length > 0) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .DELETION_GATES_INCOMPLETE,
        dependencyId: entry.dependencyId || null,
        gateIds: missingDeletionGateIds,
        message: 'Each retirement entry must retain every native-storage deletion gate.',
      });
    }

    if (asArray(cutover.componentHandoffIds).length === 0) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .COMPONENT_HANDOFF_MISSING,
        dependencyId: entry.dependencyId || null,
        message: 'Each component dependency requires at least one declared native-storage cutover handoff.',
      });
    }

    if (isTestDependency && asArray(cutover.sourceTestHandoffIds).length === 0) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .SOURCE_TEST_HANDOFF_MISSING,
        dependencyId: entry.dependencyId || null,
        sourcePath: entry.sourcePath || null,
        message: 'Each test dependency requires the handoff that determines whether its test file or named scope retires.',
      });
    }

    if (isNamedRetirement) {
      if (!entry.compatibilityScope) {
        issues.push({
          riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
            .NAMED_SCOPE_MISSING,
          dependencyId: entry.dependencyId || null,
          message: 'Named compatibility retirement must preserve its declared test ownership scope.',
        });
      }

      if (!cutover.namedScopeHandoffId) {
        issues.push({
          riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
            .NAMED_SCOPE_HANDOFF_MISSING,
          dependencyId: entry.dependencyId || null,
          message: 'Named compatibility retirement must preserve the exact native-storage cutover handoff.',
        });
      }

      if (entry.entryDispositionId !==
          POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS
            .REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE) {
        issues.push({
          riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
            .NAMED_SCOPE_DISPOSITION_INVALID,
          dependencyId: entry.dependencyId || null,
          entryDispositionId: entry.entryDispositionId || null,
          message: 'Named compatibility retirements must remove only their declared assertions from shared test files.',
        });
      }
    }

    if (isTestDependency && entry.entryDispositionId ===
        POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS.UNRESOLVED) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .TEST_DISPOSITION_UNRESOLVED,
        dependencyId: entry.dependencyId || null,
        sourcePath: entry.sourcePath || null,
        message: 'Test dependencies must resolve to deleting a dedicated bridge test file or removing a named scope from a retained file.',
      });
    }

    if (missingDeletionEvidenceIds.length > 0) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .DELETION_EVIDENCE_INCOMPLETE,
        dependencyId: entry.dependencyId || null,
        evidenceIds: missingDeletionEvidenceIds,
        message: 'Each retirement entry must declare all evidence required before a later authorized deletion.',
      });
    }

    if (asArray(cutover.nativeWorkflowSuccessors).length === 0) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .NATIVE_WORKFLOW_SUCCESSOR_MISSING,
        dependencyId: entry.dependencyId || null,
        message: 'Each retirement entry must retain named native workflow successor evidence.',
      });
    }
  });

  return issues;
}

function validatePolicyCompatibilityRetirementManifestReconciliation(
  manifest = {},
  { dependencies = listPolicyCompatibilityComponentDeletionDependencies() } = {},
) {
  const dependencyAuditIssues = validateDependencyAudit(
    manifest.dependencyAudit,
    dependencies,
  );
  const entryIssues = validateManifestEntries(manifest.entries, dependencies);
  const issues = [
    ...dependencyAuditIssues,
    ...entryIssues,
  ];

  if (manifest.deletionAuthorized !== false) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
        .DELETION_AUTHORIZED,
      message: 'Retirement manifest reconciliation is read-only and cannot authorize deletion.',
    });
  }

  if (manifest.readOnly !== true) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
        .MANIFEST_NOT_READ_ONLY,
      message: 'Retirement manifest reconciliation cannot write an execution manifest or mutate storage.',
    });
  }

  Object.entries(manifest.sideEffects || {}).forEach(([sideEffectId, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .SIDE_EFFECT_PERFORMED,
        sideEffectId,
        message: 'Retirement manifest reconciliation cannot delete components or tests, rewrite source, change storage, or write an execution manifest.',
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function determineStatusId({ validation, sideEffects }) {
  if (hasSideEffects(sideEffects)) {
    return POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS
      .BLOCKED_BY_SIDE_EFFECT;
  }

  if (validation.issues.some(issue => [
    POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS.DEPENDENCY_AUDIT_MISSING,
    POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS.DEPENDENCY_AUDIT_NOT_READY,
    POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
      .DEPENDENCY_AUDIT_AUTHORIZES_DELETION,
    POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS.NATIVE_REHOME_REMAINS,
    POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS.DEPENDENCY_COUNT_MISMATCH,
    POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
      .DEPENDENCY_CLASSIFICATION_COUNT_MISMATCH,
  ].includes(issue.riskId))) {
    return POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS
      .BLOCKED_BY_DEPENDENCY_AUDIT;
  }

  return validation.ok
    ? POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS.RECONCILIATION_READY
    : POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS
      .BLOCKED_BY_RECONCILIATION;
}

function buildPolicyCompatibilityRetirementManifestReconciliation(
  {
    dependencies = listPolicyCompatibilityComponentDeletionDependencies(),
    artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts(),
    maintenanceTestRecords = listPolicyCompatibilityMaintenanceTestRecords(),
    handoffs = listPolicyNativeStorageCutoverTestHandoffs(),
    dependencyAudit = null,
    sideEffects = {},
  } = {},
) {
  const candidates = asArray(dependencies);
  const normalizedSideEffects = buildSideEffects(sideEffects);
  const entries = candidates.map(dependency => buildPolicyCompatibilityRetirementManifestEntry(
    dependency,
    {
      artifacts,
      maintenanceTestRecords,
      handoffs,
    },
  ));
  const manifest = {
    version: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_VERSION,
    readOnly: true,
    deletionAuthorized: false,
    executionManifestWritten: false,
    dependencyAudit: dependencyAudit
      ? {
        statusId: dependencyAudit.statusId || null,
        ok: dependencyAudit.ok === true,
        deletionAuthorized: dependencyAudit.deletionAuthorized,
        checkedDependencyCount: dependencyAudit.checkedDependencyCount ?? null,
        classificationCounts: dependencyAudit.classificationCounts || {},
        sourceAudit: { ok: dependencyAudit.sourceAudit?.ok === true },
        routeAudit: { ok: dependencyAudit.routeAudit?.ok === true },
      }
      : null,
    entries,
    classificationCounts: getClassificationCounts(candidates),
    sideEffects: normalizedSideEffects,
  };
  const validation = validatePolicyCompatibilityRetirementManifestReconciliation(manifest, {
    dependencies: candidates,
  });
  const statusId = determineStatusId({ validation, sideEffects: normalizedSideEffects });

  return {
    ...manifest,
    statusId,
    reconciliationReady: statusId ===
      POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS
        .RECONCILIATION_READY,
    issueCount: validation.issueCount,
    issues: validation.issues,
    validation,
    nextStep: {
      stepId: 'compatibility_retirement_execution_manifest_binding',
      label: 'Compatibility Retirement Execution-Manifest Binding',
      reason: 'Bind these eleven exact read-only reconciliations to the existing authorized execution-manifest path only after native storage is authoritative and every declared gate and successor test remains proven. This task does not delete components or alter storage.',
    },
  };
}

export {
  POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS,
  buildPolicyCompatibilityRetirementManifestReconciliation,
  validatePolicyCompatibilityRetirementManifestReconciliation,
};
