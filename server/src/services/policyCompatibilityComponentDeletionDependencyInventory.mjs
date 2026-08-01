/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_VERSION =
  'policy.compatibility_component_deletion_dependencies.v1';

const POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS = Object.freeze({
  RUNTIME_IMPORT: 'runtime_import',
  TEST_DEPENDENCY: 'test_dependency',
});

const POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS = Object.freeze({
  NATIVE_REHOME: 'native_rehome',
  NAMED_COMPATIBILITY_RETIREMENT: 'named_compatibility_retirement',
  REMOVAL_MANIFEST_CANDIDATE: 'removal_manifest_candidate',
});

const POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS = Object.freeze({
  READY_FOR_REHOME_AND_MANIFEST_RECONCILIATION:
    'ready_for_rehome_and_manifest_reconciliation',
  BLOCKED_BY_DEPENDENCY_EVIDENCE: 'blocked_by_dependency_evidence',
  BLOCKED_BY_SOURCE_EVIDENCE: 'blocked_by_source_evidence',
  BLOCKED_BY_ROUTE_REFERENCE: 'blocked_by_route_reference',
  BLOCKED_BY_SIDE_EFFECT: 'blocked_by_side_effect',
});

const POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS = Object.freeze({
  UNKNOWN_DEPENDENCY_KIND: 'unknown_dependency_kind',
  UNKNOWN_CLASSIFICATION: 'unknown_classification',
  DUPLICATE_DEPENDENCY_ID: 'duplicate_dependency_id',
  RETIRING_COMPONENT_ARTIFACT_MISSING: 'retiring_component_artifact_missing',
  RETIRING_COMPONENT_ARTIFACT_INVALID: 'retiring_component_artifact_invalid',
  RETIRING_COMPONENT_IN_NORMAL_AUTHORING: 'retiring_component_in_normal_authoring',
  RETIRING_COMPONENT_MUTATES_RAW_PAYLOAD: 'retiring_component_mutates_raw_payload',
  DEPENDENCY_SOURCE_MISSING: 'dependency_source_missing',
  DEPENDENCY_SOURCE_FRAGMENT_MISSING: 'dependency_source_fragment_missing',
  DEPENDENCY_TEST_ASSERTION_MISSING: 'dependency_test_assertion_missing',
  ACTIVE_REGRESSION_RECORD_MISSING: 'active_regression_record_missing',
  ACTIVE_REGRESSION_NOT_REHOMED: 'active_regression_not_rehomed',
  NATIVE_REHOME_TARGET_MISSING: 'native_rehome_target_missing',
  NATIVE_REHOME_TARGET_ASSERTION_MISSING: 'native_rehome_target_assertion_missing',
  COMPATIBILITY_SCOPE_MISSING: 'compatibility_scope_missing',
  COMPATIBILITY_SCOPE_DRIFT: 'compatibility_scope_drift',
  CUTOVER_HANDOFF_MISSING: 'cutover_handoff_missing',
  MANIFEST_CANDIDATE_RETAINS_ACTIVE_REGRESSION: 'manifest_candidate_retains_active_regression',
  RETIRING_COMPONENT_DEPENDENCY_MISSING: 'retiring_component_dependency_missing',
  ROUTE_SOURCE_MISSING: 'route_source_missing',
  ROUTE_REFERENCE_RETAINED: 'route_reference_retained',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

const RETIRING_COMPONENT_PATHS = Object.freeze([
  'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
  'client/src/components/policies/PolicyIntentEditor.vue',
  'client/src/components/policies/PolicyPresetMigrationNotice.vue',
]);

const POLICY_COMPATIBILITY_COMPONENT_DELETION_ROUTE_SOURCE_PATHS = Object.freeze([
  'client/src/router/index.js',
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

function uniqueStrings(values) {
  return [...new Set(asArray(values).map(cleanString).filter(Boolean))];
}

function getSourceText(sourceTextByPath, sourcePath) {
  if (sourceTextByPath instanceof Map) {
    return sourceTextByPath.get(sourcePath);
  }

  return sourceTextByPath?.[sourcePath];
}

function createDependency({
  id,
  sourcePath,
  componentPath,
  kindId,
  classificationId,
  sourceTextFragments,
  testNameFragments = [],
  compatibilityScopeId = null,
  nativeRehomeTargets = [],
  notes,
}) {
  return {
    id,
    sourcePath,
    componentPath,
    kindId,
    classificationId,
    sourceTextFragments,
    testNameFragments,
    compatibilityScopeId,
    nativeRehomeTargets,
    notes,
  };
}

const POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCIES = deepFreeze([
  createDependency({
    id: 'policy_builder_modal_legacy_maintenance_branch',
    sourcePath: 'client/src/components/policies/PolicyBuilderModal.vue',
    componentPath: 'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
    kindId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.RUNTIME_IMPORT,
    classificationId:
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .REMOVAL_MANIFEST_CANDIDATE,
    sourceTextFragments: [
      "import PolicyCompatibilityMaintenanceSurface from '@/components/policies/PolicyCompatibilityMaintenanceSurface.vue'",
      'v-else-if="experienceMode.isLegacyEdit"',
    ],
    notes: 'The modal legacy-edit branch retires with the compatibility maintenance surface.',
  }),
  createDependency({
    id: 'maintenance_surface_editor_import',
    sourcePath: 'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
    componentPath: 'client/src/components/policies/PolicyIntentEditor.vue',
    kindId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.RUNTIME_IMPORT,
    classificationId:
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .REMOVAL_MANIFEST_CANDIDATE,
    sourceTextFragments: [
      "import PolicyIntentEditor from '@/components/policies/PolicyIntentEditor.vue'",
    ],
    notes: 'The editor is an internal child of the retiring maintenance surface.',
  }),
  createDependency({
    id: 'maintenance_surface_migration_notice_import',
    sourcePath: 'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
    componentPath: 'client/src/components/policies/PolicyPresetMigrationNotice.vue',
    kindId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.RUNTIME_IMPORT,
    classificationId:
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .REMOVAL_MANIFEST_CANDIDATE,
    sourceTextFragments: [
      "import PolicyPresetMigrationNotice from '@/components/policies/PolicyPresetMigrationNotice.vue'",
    ],
    notes: 'The completed compatibility migration notice retires with its maintenance parent.',
  }),
  createDependency({
    id: 'maintenance_surface_test_surface_import',
    sourcePath: 'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js',
    componentPath: 'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
    kindId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.TEST_DEPENDENCY,
    classificationId:
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .REMOVAL_MANIFEST_CANDIDATE,
    sourceTextFragments: ['PolicyCompatibilityMaintenanceSurface'],
    notes: 'The dedicated surface regression file retires with the compatibility parent.',
  }),
  createDependency({
    id: 'maintenance_surface_test_editor_import',
    sourcePath: 'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js',
    componentPath: 'client/src/components/policies/PolicyIntentEditor.vue',
    kindId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.TEST_DEPENDENCY,
    classificationId:
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .REMOVAL_MANIFEST_CANDIDATE,
    sourceTextFragments: ['PolicyIntentEditor'],
    notes: 'The dedicated surface regression file directly stubs the retiring editor.',
  }),
  createDependency({
    id: 'maintenance_surface_test_migration_notice_import',
    sourcePath: 'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js',
    componentPath: 'client/src/components/policies/PolicyPresetMigrationNotice.vue',
    kindId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.TEST_DEPENDENCY,
    classificationId:
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .REMOVAL_MANIFEST_CANDIDATE,
    sourceTextFragments: ['PolicyPresetMigrationNotice'],
    notes: 'The dedicated surface regression file directly stubs the retiring migration notice.',
  }),
  createDependency({
    id: 'migration_notice_test_import',
    sourcePath: 'client/src/__tests__/PolicyPresetMigrationNotice.test.js',
    componentPath: 'client/src/components/policies/PolicyPresetMigrationNotice.vue',
    kindId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.TEST_DEPENDENCY,
    classificationId:
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .REMOVAL_MANIFEST_CANDIDATE,
    sourceTextFragments: ['PolicyPresetMigrationNotice'],
    notes: 'The dedicated migration-notice regression file retires with its component.',
  }),
  createDependency({
    id: 'policy_intent_editor_named_maintenance_scope',
    sourcePath: 'client/src/__tests__/PolicyIntentEditor.test.js',
    componentPath: 'client/src/components/policies/PolicyIntentEditor.vue',
    kindId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.TEST_DEPENDENCY,
    classificationId:
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .NAMED_COMPATIBILITY_RETIREMENT,
    sourceTextFragments: ['PolicyIntentEditor'],
    testNameFragments: [
      'emits draft add-signal commands instead of legacy signal events',
      'renders policy context before editable compatibility controls',
    ],
    compatibilityScopeId: 'compatibility_maintenance_editor',
    notes: 'The named maintenance assertions retire while the shared source path is reconciled separately.',
  }),
  createDependency({
    id: 'policy_intent_editor_active_command_scope',
    sourcePath: 'client/src/__tests__/PolicyIntentEditor.test.js',
    componentPath: 'client/src/components/policies/PolicyIntentEditor.vue',
    kindId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.TEST_DEPENDENCY,
    classificationId:
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS.NATIVE_REHOME,
    sourceTextFragments: ['PolicyIntentEditor'],
    testNameFragments: [
      'shows a labelled selector only when multiple attached policy contexts exist',
      'keeps the no-compatibility-context empty state as a focusable status target',
      'emits review trigger draft commands from the review behavior section',
      'emits draft signal config and clear commands',
      'emits draft remove commands for removable intent chips',
      'does not emit duplicate draft add commands for already configured section values',
      'emits value-specific remove commands for avoid-rating chips',
    ],
    nativeRehomeTargets: [
      {
        path: 'client/src/__tests__/PolicyBuilderDestinationQuestions.test.js',
        testNameFragment: 'renders observed signal selection only for selectable server projection',
      },
      {
        path: 'client/src/__tests__/PolicyIntentReviewTriggerControl.test.js',
        testNameFragment: 'emits one typed add-value event for each selected trigger',
      },
      {
        path: 'client/src/__tests__/PolicyIntentConstraintControlSurface.test.js',
        testNameFragment: 'requires an explicit confirmation before staging a blocking hard limit',
      },
    ],
    notes: 'Active command, accessibility, duplicate-prevention, and removal behavior must be rehomed before the editor can retire.',
  }),
  createDependency({
    id: 'policy_intent_editor_parity_scope',
    sourcePath: 'client/src/__tests__/PolicyIntentEditorParity.test.js',
    componentPath: 'client/src/components/policies/PolicyIntentEditor.vue',
    kindId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.TEST_DEPENDENCY,
    classificationId:
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS.NATIVE_REHOME,
    sourceTextFragments: ['PolicyIntentEditor'],
    testNameFragments: ['keeps $name editor commands compatible with legacy customSignals'],
    nativeRehomeTargets: [
      {
        path: 'client/src/__tests__/PolicyBuilderDestinationQuestions.test.js',
        testNameFragment: 'renders observed signal selection only for selectable server projection',
      },
      {
        path: 'client/src/__tests__/PolicyIntentConstraintControlSurface.test.js',
        testNameFragment: 'requires an explicit confirmation before staging a blocking hard limit',
      },
    ],
    notes: 'The active command and provenance regression must be rewritten for the native intent model rather than deleted with legacy customSignals.',
  }),
  createDependency({
    id: 'policy_builder_modal_named_surface_scope',
    sourcePath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    componentPath: 'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
    kindId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.TEST_DEPENDENCY,
    classificationId:
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .NAMED_COMPATIBILITY_RETIREMENT,
    sourceTextFragments: ['#policy-compatibility-maintenance'],
    testNameFragments: [
      'isolates compatibility maintenance from the destination-first workflow and retired diagnostics',
    ],
    compatibilityScopeId: 'compatibility_maintenance_modal',
    notes: 'The shared modal test retains native workflow coverage after this named maintenance assertion retires.',
  }),
  createDependency({
    id: 'policy_builder_modal_named_editor_scope',
    sourcePath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    componentPath: 'client/src/components/policies/PolicyIntentEditor.vue',
    kindId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.TEST_DEPENDENCY,
    classificationId:
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .NAMED_COMPATIBILITY_RETIREMENT,
    sourceTextFragments: ['legacy_policy_builder'],
    testNameFragments: [
      'shows context-first compatibility editing and saves intent edits as structured custom signals',
    ],
    compatibilityScopeId: 'compatibility_maintenance_modal',
    notes: 'The modal custom-signals assertion is compatibility-only and retires by named scope.',
  }),
  createDependency({
    id: 'policy_builder_modal_migration_notice_scope',
    sourcePath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    componentPath: 'client/src/components/policies/PolicyPresetMigrationNotice.vue',
    kindId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.TEST_DEPENDENCY,
    classificationId:
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .REMOVAL_MANIFEST_CANDIDATE,
    sourceTextFragments: ['presetMigrationNotice'],
    testNameFragments: [
      'shows preset migration notice when auto-drop report exists',
      'lets users dismiss the preset migration notice and keeps it hidden for the same report',
    ],
    notes: 'Completed legacy migration feedback has no normal-authoring successor and needs a named removal-manifest entry.',
  }),
]);

function listPolicyCompatibilityComponentDeletionDependencies() {
  return POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCIES;
}

function listPolicyCompatibilityComponentDeletionRouteSourcePaths() {
  return POLICY_COMPATIBILITY_COMPONENT_DELETION_ROUTE_SOURCE_PATHS;
}

export {
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCIES,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_VERSION,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_ROUTE_SOURCE_PATHS,
  RETIRING_COMPONENT_PATHS,
  asArray,
  cleanString,
  getSourceText,
  listPolicyCompatibilityComponentDeletionDependencies,
  listPolicyCompatibilityComponentDeletionRouteSourcePaths,
  uniqueStrings,
};
