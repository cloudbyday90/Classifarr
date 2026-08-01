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
  POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS,
  listPolicyStarterTemplateCompatibilityBridgeArtifacts,
} from './policyStarterTemplateCompatibilityBridgeInventory.mjs';

const POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS = Object.freeze({
  CONTEXT_PRECEDES_EDITABLE_CONTROLS: 'context_precedes_editable_controls',
  TYPED_DRAFT_COMMANDS_FORWARDED: 'typed_draft_commands_forwarded',
  NATIVE_STORAGE_REMOVAL_READY: 'native_storage_removal_ready',
});

const POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS = Object.freeze({
  UNKNOWN_TEST_SCOPE: 'unknown_test_scope',
  UNKNOWN_BEHAVIOR: 'unknown_behavior',
  NORMAL_AUTHORING_OWNERSHIP: 'normal_authoring_ownership',
  LEGACY_LAYOUT_FROZEN: 'legacy_layout_frozen',
  DIAGNOSTIC_BEHAVIOR_PROTECTED: 'diagnostic_behavior_protected',
  REMOVAL_READINESS_NOT_DECLARED: 'removal_readiness_not_declared',
  MISSING_REQUIRED_BEHAVIOR_COVERAGE: 'missing_required_behavior_coverage',
  DUPLICATE_TEST_SCOPE: 'duplicate_test_scope',
  MISSING_COMPONENT_PATH: 'missing_component_path',
  MISSING_COMPATIBILITY_ARTIFACT: 'missing_compatibility_artifact',
  NORMAL_AUTHORING_COMPONENT: 'normal_authoring_component',
  RAW_PAYLOAD_MUTATION_COMPONENT: 'raw_payload_mutation_component',
  INVALID_REMOVAL_DISPOSITION: 'invalid_removal_disposition',
  MISSING_NATIVE_STORAGE_GATE: 'missing_native_storage_gate',
  MISSING_SOURCE_TEST_TEXT: 'missing_source_test_text',
  MISSING_NAMED_TEST_ASSERTION: 'missing_named_test_assertion',
});

const REQUIRED_POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS = Object.freeze([
  POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.CONTEXT_PRECEDES_EDITABLE_CONTROLS,
  POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.TYPED_DRAFT_COMMANDS_FORWARDED,
  POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.NATIVE_STORAGE_REMOVAL_READY,
]);

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

function createCompatibilityMaintenanceTestRecord({
  id,
  sourceTestPath,
  testNameFragments,
  componentPaths,
  protectedBehaviorIds,
  notes,
}) {
  return {
    id,
    sourceTestPath,
    testNameFragments,
    componentPaths,
    protectedBehaviorIds,
    normalAuthoringPath: false,
    preservesLegacyLayout: false,
    protectsDiagnosticBehavior: false,
    nativeStorageRemovalReady: true,
    notes,
  };
}

const POLICY_COMPATIBILITY_MAINTENANCE_TEST_RECORDS = deepFreeze([
  createCompatibilityMaintenanceTestRecord({
    id: 'compatibility_maintenance_surface',
    sourceTestPath: 'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js',
    testNameFragments: [
      'uses one context-first purpose statement for compatibility maintenance',
      'forwards retained compatibility intent commands without raw scoring updates',
    ],
    componentPaths: [
      'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
    ],
    protectedBehaviorIds: [
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.CONTEXT_PRECEDES_EDITABLE_CONTROLS,
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.TYPED_DRAFT_COMMANDS_FORWARDED,
    ],
    notes: 'Owns the boundary-level purpose, context, and typed command forwarding contract.',
  }),
  createCompatibilityMaintenanceTestRecord({
    id: 'compatibility_maintenance_editor',
    sourceTestPath: 'client/src/__tests__/PolicyIntentEditor.test.js',
    testNameFragments: [
      'renders policy context before editable compatibility controls',
      'emits draft add-signal commands instead of legacy signal events',
    ],
    componentPaths: [
      'client/src/components/policies/PolicyIntentEditor.vue',
    ],
    protectedBehaviorIds: [
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.CONTEXT_PRECEDES_EDITABLE_CONTROLS,
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.TYPED_DRAFT_COMMANDS_FORWARDED,
    ],
    notes: 'Owns context-first editor behavior and command-only editing without becoming a normal authoring requirement.',
  }),
  createCompatibilityMaintenanceTestRecord({
    id: 'compatibility_maintenance_modal',
    sourceTestPath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    testNameFragments: [
      'isolates compatibility maintenance from the destination-first workflow and retired diagnostics',
      'shows context-first compatibility editing and saves intent edits as structured custom signals',
    ],
    componentPaths: [
      'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
      'client/src/components/policies/PolicyIntentEditor.vue',
    ],
    protectedBehaviorIds: [
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.CONTEXT_PRECEDES_EDITABLE_CONTROLS,
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.TYPED_DRAFT_COMMANDS_FORWARDED,
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.NATIVE_STORAGE_REMOVAL_READY,
    ],
    notes: 'Owns the legacy-edit entry boundary while normal workflow assertions remain separately owned by the same modal test file.',
  }),
  createCompatibilityMaintenanceTestRecord({
    id: 'compatibility_migration_notice',
    sourceTestPath: 'client/src/__tests__/PolicyPresetMigrationNotice.test.js',
    testNameFragments: [
      'renders only the supplied migration outcome and preview',
      'emits dismiss when the operator dismisses the notice',
    ],
    componentPaths: [
      'client/src/components/policies/PolicyPresetMigrationNotice.vue',
    ],
    protectedBehaviorIds: [
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.NATIVE_STORAGE_REMOVAL_READY,
    ],
    notes: 'Owns non-blocking migration feedback that remains removable with the compatibility component after native storage cutover.',
  }),
]);

function listPolicyCompatibilityMaintenanceTestRecords() {
  return POLICY_COMPATIBILITY_MAINTENANCE_TEST_RECORDS;
}

function listPolicyCompatibilityMaintenanceTestSourcePaths() {
  return Object.freeze([...new Set(
    POLICY_COMPATIBILITY_MAINTENANCE_TEST_RECORDS.map(record => record.sourceTestPath)
  )]);
}

function getPolicyCompatibilityMaintenanceTestRecord(id) {
  return POLICY_COMPATIBILITY_MAINTENANCE_TEST_RECORDS.find(record => record.id === id) || null;
}

function findDuplicateIds(records) {
  const ids = asArray(records).map(record => cleanString(record?.id)).filter(Boolean);
  return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
}

function validatePolicyCompatibilityMaintenanceTestRecord(
  record = {},
  {
    artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts(),
    requiredDeletionGateIds = listPolicyAuthoringLegacyBridgeDeletionRequirements(),
  } = {}
) {
  const knownRecord = getPolicyCompatibilityMaintenanceTestRecord(record.id);
  const candidate = {
    ...knownRecord,
    ...record,
  };
  const issues = [];
  const protectedBehaviorIds = asArray(candidate.protectedBehaviorIds);
  const componentPaths = asArray(candidate.componentPaths);

  if (!knownRecord) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.UNKNOWN_TEST_SCOPE,
      testScopeId: cleanString(record.id) || null,
      message: 'Compatibility maintenance test scope must be declared by the ownership inventory.',
    });
  }

  for (const behaviorId of protectedBehaviorIds) {
    if (!REQUIRED_POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.includes(behaviorId)) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.UNKNOWN_BEHAVIOR,
        behaviorId,
        message: 'Compatibility maintenance test scope references an unknown protected behavior.',
      });
    }
  }

  if (candidate.normalAuthoringPath !== false) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.NORMAL_AUTHORING_OWNERSHIP,
      message: 'Compatibility maintenance coverage must remain outside the normal authoring path.',
    });
  }

  if (candidate.preservesLegacyLayout !== false) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.LEGACY_LAYOUT_FROZEN,
      message: 'Compatibility maintenance coverage cannot preserve legacy layout structure.',
    });
  }

  if (candidate.protectsDiagnosticBehavior !== false) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.DIAGNOSTIC_BEHAVIOR_PROTECTED,
      message: 'Compatibility maintenance coverage cannot protect retired diagnostic behavior.',
    });
  }

  if (candidate.nativeStorageRemovalReady !== true) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.REMOVAL_READINESS_NOT_DECLARED,
      message: 'Compatibility maintenance coverage must remain explicitly removable after native storage cutover.',
    });
  }

  if (componentPaths.length === 0) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.MISSING_COMPONENT_PATH,
      message: 'Compatibility maintenance test scope must identify its retained compatibility component.',
    });
  }

  for (const componentPath of componentPaths) {
    const artifact = asArray(artifacts).find(item => item.sourcePath === componentPath);

    if (!artifact) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.MISSING_COMPATIBILITY_ARTIFACT,
        componentPath,
        message: 'Compatibility maintenance test scope must map to a retained native-storage-gated artifact.',
      });
      continue;
    }

    if (artifact.normalAuthoringAllowed) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.NORMAL_AUTHORING_COMPONENT,
        componentPath,
        message: 'Compatibility maintenance test scope cannot point to a normal authoring component.',
      });
    }

    if (artifact.rawPayloadMutationAllowed) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.RAW_PAYLOAD_MUTATION_COMPONENT,
        componentPath,
        message: 'Compatibility maintenance components cannot gain raw legacy payload mutation authority.',
      });
    }

    if (![
      POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS.DELETE_AFTER_NATIVE_STORAGE,
      POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS.REPLACE_AFTER_NATIVE_STORAGE,
    ].includes(artifact.dispositionId)) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.INVALID_REMOVAL_DISPOSITION,
        componentPath,
        dispositionId: artifact.dispositionId || null,
        message: 'Compatibility maintenance components must have a native-storage removal or replacement disposition.',
      });
    }

    const missingDeletionGateIds = asArray(requiredDeletionGateIds)
      .filter(gateId => !asArray(artifact.deletionGateIds).includes(gateId));

    if (missingDeletionGateIds.length > 0) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.MISSING_NATIVE_STORAGE_GATE,
        componentPath,
        gateIds: missingDeletionGateIds,
        message: 'Compatibility maintenance components must retain every native-storage deletion gate.',
      });
    }
  }

  return {
    ok: issues.length === 0,
    id: cleanString(candidate.id) || null,
    issues,
  };
}

function buildPolicyCompatibilityMaintenanceTestOwnershipAudit(
  records = POLICY_COMPATIBILITY_MAINTENANCE_TEST_RECORDS,
  options = {}
) {
  const candidates = asArray(records);
  const validationResults = candidates.map(record =>
    validatePolicyCompatibilityMaintenanceTestRecord(record, options));
  const protectedBehaviorIds = new Set(candidates.flatMap(record =>
    asArray(record.protectedBehaviorIds)));
  const missingRequiredBehaviorIds = REQUIRED_POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS
    .filter(behaviorId => !protectedBehaviorIds.has(behaviorId));
  const issues = [
    ...validationResults.flatMap(result => result.issues),
    ...findDuplicateIds(candidates).map(id => ({
      riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.DUPLICATE_TEST_SCOPE,
      testScopeId: id,
      message: 'Compatibility maintenance test scope IDs must be unique.',
    })),
    ...missingRequiredBehaviorIds.map(behaviorId => ({
      riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.MISSING_REQUIRED_BEHAVIOR_COVERAGE,
      behaviorId,
      message: 'A required compatibility maintenance behavior has no owned regression scope.',
    })),
  ];

  return {
    ok: issues.length === 0,
    checkedRecordCount: candidates.length,
    requiredBehaviorCount: REQUIRED_POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.length,
    protectedBehaviorIds: [...protectedBehaviorIds],
    missingRequiredBehaviorIds,
    issues,
  };
}

function buildPolicyCompatibilityMaintenanceTestSourceAudit(
  sourceTextByPath = {},
  records = POLICY_COMPATIBILITY_MAINTENANCE_TEST_RECORDS
) {
  const issues = [];

  for (const record of asArray(records)) {
    const sourceText = sourceTextByPath instanceof Map
      ? sourceTextByPath.get(record.sourceTestPath)
      : sourceTextByPath?.[record.sourceTestPath];

    if (typeof sourceText !== 'string') {
      issues.push({
        riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.MISSING_SOURCE_TEST_TEXT,
        sourceTestPath: record.sourceTestPath || null,
        message: 'Compatibility maintenance test source must be supplied for named-assertion verification.',
      });
      continue;
    }

    for (const testNameFragment of asArray(record.testNameFragments)) {
      if (!sourceText.includes(testNameFragment)) {
        issues.push({
          riskId: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.MISSING_NAMED_TEST_ASSERTION,
          sourceTestPath: record.sourceTestPath,
          testNameFragment,
          message: 'Compatibility maintenance ownership must point to a named observable-behavior test.',
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    checkedRecordCount: asArray(records).length,
    issues,
  };
}

function summarizePolicyCompatibilityMaintenanceTestOwnership() {
  const audit = buildPolicyCompatibilityMaintenanceTestOwnershipAudit();

  return {
    recordCount: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RECORDS.length,
    sourceTestPathCount: listPolicyCompatibilityMaintenanceTestSourcePaths().length,
    requiredBehaviorCount: REQUIRED_POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.length,
    normalAuthoringPathRecordCount: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RECORDS
      .filter(record => record.normalAuthoringPath).length,
    legacyLayoutFreezeRecordCount: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RECORDS
      .filter(record => record.preservesLegacyLayout).length,
    diagnosticProtectionRecordCount: POLICY_COMPATIBILITY_MAINTENANCE_TEST_RECORDS
      .filter(record => record.protectsDiagnosticBehavior).length,
    missingRequiredBehaviorIds: audit.missingRequiredBehaviorIds,
    nativeStorageRemovalReady: audit.ok,
  };
}

export {
  POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS,
  POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS,
  REQUIRED_POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS,
  buildPolicyCompatibilityMaintenanceTestOwnershipAudit,
  buildPolicyCompatibilityMaintenanceTestSourceAudit,
  getPolicyCompatibilityMaintenanceTestRecord,
  listPolicyCompatibilityMaintenanceTestRecords,
  listPolicyCompatibilityMaintenanceTestSourcePaths,
  summarizePolicyCompatibilityMaintenanceTestOwnership,
  validatePolicyCompatibilityMaintenanceTestRecord,
};
