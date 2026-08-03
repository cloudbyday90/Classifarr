/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  listPolicyAuthoringLegacyBridgeDeletionRequirements,
} from './policyAuthoringLegacyBridgeBoundary.mjs';
import {
  getPolicyCompatibilityMaintenanceTestRecord,
  listPolicyCompatibilityMaintenanceTestRecords,
} from './policyCompatibilityMaintenanceTestOwnership.mjs';
import {
  POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS,
  buildPolicyNativeStorageTestReset,
  validatePolicyNativeStorageTestReset,
} from './policyNativeStorageTestReset.mjs';
import {
  POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS,
  listPolicyStarterTemplateCompatibilityBridgeArtifacts,
} from './policyStarterTemplateCompatibilityBridgeInventory.mjs';

const POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_VERSION =
  'policy.native_storage_cutover_test_handoff.v1';

const POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS = Object.freeze({
  DELETE_TEST_FILE_WITH_BRIDGE: 'delete_test_file_with_bridge',
  REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE: 'remove_named_scope_retain_test_file',
});

const POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_DELETION_EVIDENCE_IDS = Object.freeze({
  NATIVE_WORKFLOW_REGRESSION: 'native_workflow_regression',
  NATIVE_STORAGE_TEST_COVERAGE: 'native_storage_test_coverage',
  COMPLETE_DELETION_GATE_SET: 'complete_deletion_gate_set',
  AUTHORIZED_REMOVAL_COMPLETION: 'authorized_removal_completion',
  FINAL_REFERENCE_SCAN: 'final_reference_scan',
  FOCUSED_AND_FULL_VALIDATION: 'focused_and_full_validation',
});

const POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS = Object.freeze({
  UNKNOWN_HANDOFF: 'unknown_handoff',
  UNKNOWN_COMPATIBILITY_SCOPE: 'unknown_compatibility_scope',
  DUPLICATE_HANDOFF_ID: 'duplicate_handoff_id',
  DUPLICATE_COMPATIBILITY_SCOPE: 'duplicate_compatibility_scope',
  MISSING_COMPATIBILITY_SCOPE_HANDOFF: 'missing_compatibility_scope_handoff',
  INVALID_SOURCE_DISPOSITION: 'invalid_source_disposition',
  HANDOFF_NOT_MARKED_FOR_BRIDGE_RETIREMENT: 'handoff_not_marked_for_bridge_retirement',
  MISSING_NATIVE_WORKFLOW_TEST_PATH: 'missing_native_workflow_test_path',
  MISSING_NATIVE_WORKFLOW_TEST_ASSERTION: 'missing_native_workflow_test_assertion',
  MISSING_NATIVE_STORAGE_COVERAGE: 'missing_native_storage_coverage',
  NATIVE_STORAGE_COVERAGE_NOT_PROVEN: 'native_storage_coverage_not_proven',
  NATIVE_STORAGE_TEST_RESET_NOT_READY: 'native_storage_test_reset_not_ready',
  MISSING_COMPATIBILITY_ARTIFACT: 'missing_compatibility_artifact',
  NORMAL_AUTHORING_COMPONENT: 'normal_authoring_component',
  RAW_PAYLOAD_MUTATION_COMPONENT: 'raw_payload_mutation_component',
  INVALID_COMPONENT_DISPOSITION: 'invalid_component_disposition',
  MISSING_DELETION_GATE: 'missing_deletion_gate',
  MISSING_DELETION_EVIDENCE: 'missing_deletion_evidence',
  MISSING_COMPATIBILITY_SOURCE_TEST_TEXT: 'missing_compatibility_source_test_text',
  MISSING_COMPATIBILITY_SOURCE_TEST_ASSERTION: 'missing_compatibility_source_test_assertion',
  MISSING_NATIVE_WORKFLOW_SOURCE_TEST_TEXT: 'missing_native_workflow_source_test_text',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

const REQUIRED_DELETION_EVIDENCE_IDS = Object.freeze(
  Object.values(POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_DELETION_EVIDENCE_IDS),
);

const REQUIRED_DELETION_GATE_IDS = Object.freeze(
  listPolicyAuthoringLegacyBridgeDeletionRequirements(),
);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).map(cleanString).filter(Boolean))];
}

function createHandoff({
  id,
  compatibilityScopeId,
  sourceTestFileDispositionId,
  nativeWorkflowTestPath,
  nativeWorkflowTestNameFragments,
  nativeStorageCoverageIds,
  notes,
}) {
  return {
    id,
    compatibilityScopeId,
    sourceTestFileDispositionId,
    retireWithBridge: true,
    nativeWorkflowTestPath,
    nativeWorkflowTestNameFragments,
    nativeStorageCoverageIds,
    requiredDeletionEvidenceIds: REQUIRED_DELETION_EVIDENCE_IDS,
    deletionAuthorized: false,
    notes,
  };
}

const POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFFS = deepFreeze([
  createHandoff({
    id: 'compatibility_maintenance_surface_handoff',
    compatibilityScopeId: 'compatibility_maintenance_surface',
    sourceTestFileDispositionId:
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS.DELETE_TEST_FILE_WITH_BRIDGE,
    nativeWorkflowTestPath: 'client/src/__tests__/PolicyBuilderWorkflowShell.test.js',
    nativeWorkflowTestNameFragments: [
      'renders the five destination-first questions with observed library suggestions',
    ],
    nativeStorageCoverageIds: [
      POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.NATIVE_RUNTIME_READ_PATH_TESTS,
      POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.LEGACY_WRITE_BLOCKING_TESTS,
    ],
    notes: 'The dedicated maintenance surface retires with its bridge; the native workflow shell owns destination-first context and observed-evidence behavior.',
  }),
  createHandoff({
    id: 'compatibility_maintenance_editor_handoff',
    compatibilityScopeId: 'compatibility_maintenance_editor',
    sourceTestFileDispositionId:
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS.REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE,
    nativeWorkflowTestPath: 'client/src/__tests__/PolicyBuilderDestinationQuestions.test.js',
    nativeWorkflowTestNameFragments: [
      'renders observed signal selection only for selectable server projection',
      'withholds selection while the observed profile is stale',
    ],
    nativeStorageCoverageIds: [
      POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.NATIVE_RUNTIME_READ_PATH_TESTS,
      POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.LEGACY_WRITE_BLOCKING_TESTS,
    ],
    notes: 'Only the context-first compatibility assertions retire; the shared test file retains separately owned native editing regression coverage.',
  }),
  createHandoff({
    id: 'compatibility_maintenance_modal_handoff',
    compatibilityScopeId: 'compatibility_maintenance_modal',
    sourceTestFileDispositionId:
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS.REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE,
    nativeWorkflowTestPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    nativeWorkflowTestNameFragments: [
      'submits the narrow native creation contract only after observed values are explicitly accepted',
      'keeps native creation open for a persisted server-owned policy handoff',
    ],
    nativeStorageCoverageIds: [
      POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.EXPLICIT_CONVERSION_TESTS,
      POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.NATIVE_RUNTIME_READ_PATH_TESTS,
      POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.LEGACY_WRITE_BLOCKING_TESTS,
    ],
    notes: 'The shared modal retains native-creation coverage while only named compatibility-maintenance assertions retire with the bridge.',
  }),
  createHandoff({
    id: 'compatibility_migration_notice_handoff',
    compatibilityScopeId: 'compatibility_migration_notice',
    sourceTestFileDispositionId:
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS.DELETE_TEST_FILE_WITH_BRIDGE,
    nativeWorkflowTestPath: 'client/src/__tests__/PolicyNativeIntentReconciliation.test.js',
    nativeWorkflowTestNameFragments: [
      'shows automatic scheduler status and bounded blocker evidence without conversion controls',
    ],
    nativeStorageCoverageIds: [
      POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.EXPLICIT_CONVERSION_TESTS,
      POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.DELETION_GATE_TESTS,
    ],
    notes: 'The non-blocking migration notice retires with compatibility maintenance; native reconciliation status replaces manual migration feedback.',
  }),
]);

function getPolicyNativeStorageCutoverTestHandoff(id) {
  return POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFFS.find(record => record.id === id) || null;
}

function listPolicyNativeStorageCutoverTestHandoffs() {
  return POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFFS;
}

function getSourceText(sourceTextByPath, sourcePath) {
  if (sourceTextByPath instanceof Map) {
    return sourceTextByPath.get(sourcePath);
  }

  return sourceTextByPath?.[sourcePath];
}

function findDuplicateValues(records, propertyName) {
  const values = asArray(records)
    .map(record => cleanString(record?.[propertyName]))
    .filter(Boolean);

  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

function buildSideEffects(sideEffects = {}) {
  return {
    testsDeleted: sideEffects.testsDeleted === true,
    componentsDeleted: sideEffects.componentsDeleted === true,
    testFilesRewritten: sideEffects.testFilesRewritten === true,
    storageChanged: sideEffects.storageChanged === true,
  };
}

function hasSideEffects(sideEffects = {}) {
  return Object.values(sideEffects).some(Boolean);
}

function getCoverageRequirement(nativeStorageTestReset, coverageId) {
  return asArray(nativeStorageTestReset?.coverageRequirements)
    .find(requirement => requirement.coverageId === coverageId) || null;
}

function validatePolicyNativeStorageCutoverTestHandoff(
  handoff = {},
  {
    artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts(),
    nativeStorageTestReset = buildPolicyNativeStorageTestReset(),
  } = {},
) {
  const knownHandoff = getPolicyNativeStorageCutoverTestHandoff(handoff.id);
  const candidate = { ...knownHandoff, ...handoff };
  const issues = [];
  const compatibilityScope = getPolicyCompatibilityMaintenanceTestRecord(
    candidate.compatibilityScopeId,
  );
  const sourceTestFileDispositionId = cleanString(candidate.sourceTestFileDispositionId);
  const nativeWorkflowTestPath = cleanString(candidate.nativeWorkflowTestPath);
  const nativeWorkflowTestNameFragments = uniqueStrings(candidate.nativeWorkflowTestNameFragments);
  const nativeStorageCoverageIds = uniqueStrings(candidate.nativeStorageCoverageIds);
  const deletionEvidenceIds = uniqueStrings(candidate.requiredDeletionEvidenceIds);

  if (!knownHandoff) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.UNKNOWN_HANDOFF,
      handoffId: cleanString(handoff.id) || null,
      message: 'Native-storage cutover handoff must be declared by the immutable handoff inventory.',
    });
  }

  if (!compatibilityScope) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.UNKNOWN_COMPATIBILITY_SCOPE,
      compatibilityScopeId: cleanString(candidate.compatibilityScopeId) || null,
      message: 'Native-storage cutover handoff must reference a declared compatibility-maintenance test scope.',
    });
  }

  if (!Object.values(POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS)
    .includes(sourceTestFileDispositionId)) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.INVALID_SOURCE_DISPOSITION,
      sourceTestFileDispositionId: sourceTestFileDispositionId || null,
      message: 'Cutover handoff must declare whether the compatibility test file retires or only its named scope retires.',
    });
  }

  if (candidate.retireWithBridge !== true || candidate.deletionAuthorized !== false) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.HANDOFF_NOT_MARKED_FOR_BRIDGE_RETIREMENT,
      message: 'The handoff must retire with the bridge and cannot authorize deletion by itself.',
    });
  }

  if (!nativeWorkflowTestPath) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.MISSING_NATIVE_WORKFLOW_TEST_PATH,
      message: 'Cutover handoff must name a native workflow regression test path.',
    });
  }

  if (nativeWorkflowTestNameFragments.length === 0) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.MISSING_NATIVE_WORKFLOW_TEST_ASSERTION,
      nativeWorkflowTestPath: nativeWorkflowTestPath || null,
      message: 'Cutover handoff must name an observable native workflow regression assertion.',
    });
  }

  if (nativeStorageCoverageIds.length === 0) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.MISSING_NATIVE_STORAGE_COVERAGE,
      message: 'Cutover handoff must name the native-storage coverage that supports its successor behavior.',
    });
  }

  if (validatePolicyNativeStorageTestReset(nativeStorageTestReset).ok !== true ||
      nativeStorageTestReset?.resetReady !== true) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.NATIVE_STORAGE_TEST_RESET_NOT_READY,
      message: 'Cutover handoff requires a valid ready native-storage test reset plan.',
    });
  }

  nativeStorageCoverageIds.forEach(coverageId => {
    const coverageRequirement = getCoverageRequirement(nativeStorageTestReset, coverageId);

    if (coverageRequirement?.provided !== true) {
      issues.push({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.NATIVE_STORAGE_COVERAGE_NOT_PROVEN,
        coverageId,
        message: 'Cutover handoff native-storage coverage must have explicit evidence tests.',
      });
    }
  });

  asArray(compatibilityScope?.componentPaths).forEach(componentPath => {
    const artifact = asArray(artifacts).find(record => record.sourcePath === componentPath);

    if (!artifact) {
      issues.push({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.MISSING_COMPATIBILITY_ARTIFACT,
        componentPath,
        message: 'Each retiring compatibility component must remain in the native-storage bridge inventory.',
      });
      return;
    }

    if (artifact.normalAuthoringAllowed === true) {
      issues.push({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.NORMAL_AUTHORING_COMPONENT,
        componentPath,
        message: 'Retiring compatibility components cannot be admitted to normal authoring.',
      });
    }

    if (artifact.rawPayloadMutationAllowed === true) {
      issues.push({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.RAW_PAYLOAD_MUTATION_COMPONENT,
        componentPath,
        message: 'Retiring compatibility components cannot gain raw legacy-payload mutation authority.',
      });
    }

    if (![
      POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS.DELETE_AFTER_NATIVE_STORAGE,
      POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS.REPLACE_AFTER_NATIVE_STORAGE,
    ].includes(artifact.dispositionId)) {
      issues.push({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.INVALID_COMPONENT_DISPOSITION,
        componentPath,
        dispositionId: artifact.dispositionId || null,
        message: 'Retiring compatibility components require a delete-or-replace native-storage disposition.',
      });
    }

    const missingDeletionGateIds = REQUIRED_DELETION_GATE_IDS
      .filter(gateId => !asArray(artifact.deletionGateIds).includes(gateId));

    if (missingDeletionGateIds.length > 0) {
      issues.push({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.MISSING_DELETION_GATE,
        componentPath,
        gateIds: missingDeletionGateIds,
        message: 'Retiring compatibility components require every native-storage deletion gate.',
      });
    }
  });

  const missingDeletionEvidenceIds = REQUIRED_DELETION_EVIDENCE_IDS
    .filter(evidenceId => !deletionEvidenceIds.includes(evidenceId));

  if (missingDeletionEvidenceIds.length > 0) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.MISSING_DELETION_EVIDENCE,
      evidenceIds: missingDeletionEvidenceIds,
      message: 'Cutover handoff must enumerate all evidence required before deletion.',
    });
  }

  return {
    ok: issues.length === 0,
    id: cleanString(candidate.id) || null,
    compatibilityScopeId: cleanString(candidate.compatibilityScopeId) || null,
    issues,
  };
}

function buildPolicyNativeStorageCutoverTestHandoffSourceAudit(
  sourceTextByPath = {},
  handoffs = POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFFS,
) {
  const issues = [];

  asArray(handoffs).forEach(handoff => {
    const compatibilityScope = getPolicyCompatibilityMaintenanceTestRecord(
      handoff.compatibilityScopeId,
    );
    const compatibilitySourceTestPath = compatibilityScope?.sourceTestPath || null;
    const compatibilitySourceText = getSourceText(sourceTextByPath, compatibilitySourceTestPath);
    const nativeWorkflowTestPath = cleanString(handoff.nativeWorkflowTestPath);
    const nativeWorkflowSourceText = getSourceText(sourceTextByPath, nativeWorkflowTestPath);

    if (typeof compatibilitySourceText !== 'string') {
      issues.push({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.MISSING_COMPATIBILITY_SOURCE_TEST_TEXT,
        handoffId: handoff.id || null,
        sourceTestPath: compatibilitySourceTestPath,
        message: 'Cutover handoff source audit requires compatibility regression source text.',
      });
    } else {
      asArray(compatibilityScope?.testNameFragments).forEach(testNameFragment => {
        if (!compatibilitySourceText.includes(testNameFragment)) {
          issues.push({
            riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.MISSING_COMPATIBILITY_SOURCE_TEST_ASSERTION,
            handoffId: handoff.id || null,
            sourceTestPath: compatibilitySourceTestPath,
            testNameFragment,
            message: 'Cutover handoff compatibility scope must continue to name an executable regression assertion.',
          });
        }
      });
    }

    if (typeof nativeWorkflowSourceText !== 'string') {
      issues.push({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.MISSING_NATIVE_WORKFLOW_SOURCE_TEST_TEXT,
        handoffId: handoff.id || null,
        sourceTestPath: nativeWorkflowTestPath || null,
        message: 'Cutover handoff source audit requires native workflow regression source text.',
      });
    } else {
      uniqueStrings(handoff.nativeWorkflowTestNameFragments).forEach(testNameFragment => {
        if (!nativeWorkflowSourceText.includes(testNameFragment)) {
          issues.push({
            riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.MISSING_NATIVE_WORKFLOW_TEST_ASSERTION,
            handoffId: handoff.id || null,
            sourceTestPath: nativeWorkflowTestPath,
            testNameFragment,
            message: 'Cutover handoff must point to a named executable native workflow regression assertion.',
          });
        }
      });
    }
  });

  return {
    ok: issues.length === 0,
    checkedHandoffCount: asArray(handoffs).length,
    issues,
  };
}

function buildPolicyNativeStorageCutoverTestHandoffAudit(
  {
    handoffs = POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFFS,
    nativeStorageTestReset = buildPolicyNativeStorageTestReset(),
    artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts(),
    sideEffects = {},
  } = {},
) {
  const candidates = asArray(handoffs);
  const normalizedSideEffects = buildSideEffects(sideEffects);
  const validationResults = candidates.map(handoff =>
    validatePolicyNativeStorageCutoverTestHandoff(handoff, {
      artifacts,
      nativeStorageTestReset,
    }));
  const handoffScopeIds = new Set(candidates.map(handoff => handoff.compatibilityScopeId));
  const missingCompatibilityScopeIds = listPolicyCompatibilityMaintenanceTestRecords()
    .map(record => record.id)
    .filter(scopeId => !handoffScopeIds.has(scopeId));
  const issues = [
    ...validationResults.flatMap(result => result.issues),
    ...findDuplicateValues(candidates, 'id').map(handoffId => ({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.DUPLICATE_HANDOFF_ID,
      handoffId,
      message: 'Native-storage cutover handoff IDs must be unique.',
    })),
    ...findDuplicateValues(candidates, 'compatibilityScopeId').map(compatibilityScopeId => ({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.DUPLICATE_COMPATIBILITY_SCOPE,
      compatibilityScopeId,
      message: 'Each compatibility-maintenance regression scope must have one cutover handoff owner.',
    })),
    ...missingCompatibilityScopeIds.map(compatibilityScopeId => ({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.MISSING_COMPATIBILITY_SCOPE_HANDOFF,
      compatibilityScopeId,
      message: 'Every retained compatibility-maintenance regression scope requires a native-storage cutover handoff.',
    })),
  ];

  if (hasSideEffects(normalizedSideEffects)) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.SIDE_EFFECT_PERFORMED,
      message: 'Cutover handoff audit cannot delete, rewrite, or mutate tests, components, or storage.',
    });
  }

  return {
    version: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_VERSION,
    statusId: issues.length === 0
      ? 'ready_for_cutover_evidence'
      : 'blocked_by_handoff_evidence',
    ok: issues.length === 0,
    deletionAuthorized: false,
    checkedHandoffCount: candidates.length,
    deleteTestFileWithBridgeCount: candidates.filter(handoff => (
      handoff.sourceTestFileDispositionId ===
        POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS.DELETE_TEST_FILE_WITH_BRIDGE
    )).length,
    retainTestFileRemoveNamedScopeCount: candidates.filter(handoff => (
      handoff.sourceTestFileDispositionId ===
        POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS
          .REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE
    )).length,
    requiredDeletionEvidenceIds: REQUIRED_DELETION_EVIDENCE_IDS,
    remainingDeletionEvidenceIds: [
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_DELETION_EVIDENCE_IDS
        .AUTHORIZED_REMOVAL_COMPLETION,
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_DELETION_EVIDENCE_IDS.FINAL_REFERENCE_SCAN,
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_DELETION_EVIDENCE_IDS
        .FOCUSED_AND_FULL_VALIDATION,
    ],
    sideEffects: normalizedSideEffects,
    issueCount: issues.length,
    issues,
    nextStep: {
      stepId: 'native_storage_cutover_deletion_evidence',
      label: 'Native-Storage Cutover Deletion-Evidence Integration',
      reason: 'Map this read-only handoff inventory to authorized removal completion, final reference scans, and focused plus full validation before deleting any bridge component or test scope.',
    },
  };
}

function summarizePolicyNativeStorageCutoverTestHandoff() {
  const audit = buildPolicyNativeStorageCutoverTestHandoffAudit();

  return {
    handoffCount: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFFS.length,
    compatibilityScopeCount: listPolicyCompatibilityMaintenanceTestRecords().length,
    deleteTestFileWithBridgeCount: audit.deleteTestFileWithBridgeCount,
    retainTestFileRemoveNamedScopeCount: audit.retainTestFileRemoveNamedScopeCount,
    deletionAuthorized: false,
    cutoverEvidenceReady: audit.ok,
  };
}

export {
  POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_DELETION_EVIDENCE_IDS,
  POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS,
  POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS,
  POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_VERSION,
  buildPolicyNativeStorageCutoverTestHandoffAudit,
  buildPolicyNativeStorageCutoverTestHandoffSourceAudit,
  getPolicyNativeStorageCutoverTestHandoff,
  listPolicyNativeStorageCutoverTestHandoffs,
  summarizePolicyNativeStorageCutoverTestHandoff,
  validatePolicyNativeStorageCutoverTestHandoff,
};
