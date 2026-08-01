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
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS,
  asArray,
  cleanString,
  uniqueStrings,
} from './policyCompatibilityComponentDeletionDependencyInventory.mjs';
import {
  listPolicyCompatibilityMaintenanceTestRecords,
} from './policyCompatibilityMaintenanceTestOwnership.mjs';
import {
  POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS,
  listPolicyNativeStorageCutoverTestHandoffs,
} from './policyNativeStorageCutoverTestHandoff.mjs';
import {
  listPolicyStarterTemplateCompatibilityBridgeArtifacts,
} from './policyStarterTemplateCompatibilityBridgeInventory.mjs';

const POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_VERSION =
  'policy.compatibility_retirement_manifest_reconciliation.v1';

const POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS = Object.freeze({
  REMOVE_RUNTIME_REFERENCE_WITH_COMPONENT: 'remove_runtime_reference_with_component',
  DELETE_TEST_FILE_WITH_BRIDGE: 'delete_test_file_with_bridge',
  REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE: 'remove_named_scope_retain_test_file',
  UNRESOLVED: 'unresolved',
});

function findScope(records, scopeId) {
  return asArray(records).find(record => record.id === scopeId) || null;
}

function findArtifact(artifacts, componentPath) {
  return asArray(artifacts).find(artifact => artifact.sourcePath === componentPath) || null;
}

function findHandoff(handoffs, compatibilityScopeId) {
  return asArray(handoffs)
    .find(handoff => handoff.compatibilityScopeId === compatibilityScopeId) || null;
}

function uniqueHandoffs(handoffs) {
  const handoffsById = new Map();

  asArray(handoffs).forEach(handoff => {
    const id = cleanString(handoff?.id);

    if (id) {
      handoffsById.set(id, handoff);
    }
  });

  return [...handoffsById.values()];
}

function findComponentHandoffs(componentPath, maintenanceTestRecords, handoffs) {
  const componentScopeIds = asArray(maintenanceTestRecords)
    .filter(scope => asArray(scope.componentPaths).includes(componentPath))
    .map(scope => scope.id);

  return asArray(handoffs)
    .filter(handoff => componentScopeIds.includes(handoff.compatibilityScopeId));
}

function findSourceTestHandoffs(sourcePath, maintenanceTestRecords, handoffs) {
  const sourceScopeIds = asArray(maintenanceTestRecords)
    .filter(scope => scope.sourceTestPath === sourcePath)
    .map(scope => scope.id);

  return asArray(handoffs)
    .filter(handoff => sourceScopeIds.includes(handoff.compatibilityScopeId));
}

function determineEntryDisposition(dependency, sourceTestHandoffs) {
  if (dependency.classificationId ===
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .NAMED_COMPATIBILITY_RETIREMENT) {
    return POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS
      .REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE;
  }

  if (dependency.kindId ===
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.RUNTIME_IMPORT) {
    return POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS
      .REMOVE_RUNTIME_REFERENCE_WITH_COMPONENT;
  }

  const sourceDispositions = uniqueStrings(sourceTestHandoffs
    .map(handoff => handoff.sourceTestFileDispositionId));

  if (sourceDispositions.includes(
    POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS
      .DELETE_TEST_FILE_WITH_BRIDGE,
  )) {
    return POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS
      .DELETE_TEST_FILE_WITH_BRIDGE;
  }

  if (sourceDispositions.includes(
    POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS
      .REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE,
  )) {
    return POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS
      .REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE;
  }

  return POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS.UNRESOLVED;
}

function buildNativeWorkflowSuccessors(handoffs) {
  return asArray(handoffs).map(handoff => ({
    handoffId: handoff.id,
    nativeWorkflowTestPath: handoff.nativeWorkflowTestPath,
    nativeWorkflowTestNameFragments: uniqueStrings(handoff.nativeWorkflowTestNameFragments),
  }));
}

function buildPolicyCompatibilityRetirementManifestEntry(
  dependency,
  {
    artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts(),
    maintenanceTestRecords = listPolicyCompatibilityMaintenanceTestRecords(),
    handoffs = listPolicyNativeStorageCutoverTestHandoffs(),
  } = {},
) {
  const componentPath = cleanString(dependency?.componentPath);
  const sourcePath = cleanString(dependency?.sourcePath);
  const compatibilityScopeId = cleanString(dependency?.compatibilityScopeId) || null;
  const artifact = findArtifact(artifacts, componentPath);
  const namedScope = compatibilityScopeId
    ? findScope(maintenanceTestRecords, compatibilityScopeId)
    : null;
  const namedScopeHandoff = compatibilityScopeId
    ? findHandoff(handoffs, compatibilityScopeId)
    : null;
  const componentHandoffs = findComponentHandoffs(
    componentPath,
    maintenanceTestRecords,
    handoffs,
  );
  const sourceTestHandoffs = dependency?.kindId ===
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.TEST_DEPENDENCY
    ? findSourceTestHandoffs(sourcePath, maintenanceTestRecords, handoffs)
    : [];
  const requiredHandoffs = uniqueHandoffs([
    ...componentHandoffs,
    ...sourceTestHandoffs,
    namedScopeHandoff,
  ]);

  return {
    dependencyId: cleanString(dependency?.id) || null,
    sourcePath: sourcePath || null,
    componentPath: componentPath || null,
    dependencyKindId: cleanString(dependency?.kindId) || null,
    classificationId: cleanString(dependency?.classificationId) || null,
    entryDispositionId: determineEntryDisposition(dependency || {}, sourceTestHandoffs),
    testNameFragments: uniqueStrings(dependency?.testNameFragments),
    compatibilityScope: namedScope
      ? {
        id: namedScope.id,
        sourceTestPath: namedScope.sourceTestPath,
        testNameFragments: uniqueStrings(namedScope.testNameFragments),
      }
      : null,
    componentArtifact: artifact
      ? {
        id: artifact.id,
        dispositionId: artifact.dispositionId,
        replacementTarget: artifact.replacementTarget,
        normalAuthoringAllowed: artifact.normalAuthoringAllowed === true,
        rawPayloadMutationAllowed: artifact.rawPayloadMutationAllowed === true,
      }
      : null,
    nativeStorageCutover: {
      removalConditionId:
        LEGACY_COMPATIBILITY_REMOVAL_CONDITION_IDS.NATIVE_INTENT_STORAGE_AUTHORITATIVE,
      deletionGateIds: uniqueStrings(artifact?.deletionGateIds),
      requiredHandoffIds: requiredHandoffs.map(handoff => handoff.id),
      componentHandoffIds: componentHandoffs.map(handoff => handoff.id),
      sourceTestHandoffIds: sourceTestHandoffs.map(handoff => handoff.id),
      namedScopeHandoffId: namedScopeHandoff?.id || null,
      nativeStorageCoverageIds: uniqueStrings(requiredHandoffs
        .flatMap(handoff => handoff.nativeStorageCoverageIds)),
      requiredDeletionEvidenceIds: uniqueStrings(requiredHandoffs
        .flatMap(handoff => handoff.requiredDeletionEvidenceIds)),
      nativeWorkflowSuccessors: buildNativeWorkflowSuccessors(requiredHandoffs),
    },
    notes: cleanString(dependency?.notes) || null,
  };
}

export {
  POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_VERSION,
  buildPolicyCompatibilityRetirementManifestEntry,
  findComponentHandoffs,
  findSourceTestHandoffs,
};
