/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  LEGACY_COMPATIBILITY_ARTIFACT_IDS,
  LEGACY_COMPATIBILITY_DELETION_GATE_IDS,
  listLegacyCompatibilityModuleRecords,
} from './policyBuilderLegacyCompatibilityBoundary.mjs';
import {
  listPolicyAuthoringLegacyBridgeDeletionRequirements,
} from './policyAuthoringLegacyBridgeBoundary.mjs';
import {
  POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS,
  listPolicyAuthoringComponentInventory,
} from './policyAuthoringComponentInventory.mjs';
import {
  POLICY_AUTHORING_COMPONENT_DECISION_IDS,
} from './policyAuthoringComponentSystem.mjs';

const POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS = Object.freeze({
  ATTACHMENT_READER: 'attachment_reader',
  ATTACHMENT_ROUND_TRIP: 'attachment_round_trip',
  COMPATIBILITY_COMPONENT: 'compatibility_component',
});

const POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS = Object.freeze({
  DELETE_AFTER_NATIVE_STORAGE: 'delete_after_native_storage',
  REPLACE_AFTER_NATIVE_STORAGE: 'replace_after_native_storage',
});

const POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS = Object.freeze({
  UNKNOWN_KIND: 'unknown_kind',
  DUPLICATE_ARTIFACT_ID: 'duplicate_artifact_id',
  DUPLICATE_SOURCE_PATH: 'duplicate_source_path',
  MISSING_SOURCE_PATH: 'missing_source_path',
  MISSING_ENTRY_POINT: 'missing_entry_point',
  MISSING_ARTIFACT: 'missing_artifact',
  UNKNOWN_ARTIFACT: 'unknown_artifact',
  MISSING_DELETION_GATE: 'missing_deletion_gate',
  UNKNOWN_DELETION_GATE: 'unknown_deletion_gate',
  MISSING_REPLACEMENT_TARGET: 'missing_replacement_target',
  NORMAL_AUTHORING_COMPONENT: 'normal_authoring_component',
  RAW_PAYLOAD_COMPONENT: 'raw_payload_component',
  MISSING_BRIDGE_MODULE_COVERAGE: 'missing_bridge_module_coverage',
  MISSING_COMPATIBILITY_COMPONENT_COVERAGE: 'missing_compatibility_component_coverage',
});

const COMPATIBILITY_COMPONENT_ROLE_IDS = new Set([
  POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.COMPATIBILITY_MAINTENANCE,
  POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.COMPATIBILITY_SIGNAL_CONTROL,
  POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.MIGRATION_NOTICE,
]);

const ADDITIONAL_COMPATIBILITY_COMPONENT_IDS = new Set([
  'policy_intent_chip',
]);

const REQUIRED_DELETION_GATE_IDS = Object.freeze(
  listPolicyAuthoringLegacyBridgeDeletionRequirements(),
);

const REQUIRED_BRIDGE_MODULE_PATHS = Object.freeze([
  'client/src/utils/policyIntentDraftBridge.js',
  'client/src/composables/usePolicyIntentDraft.js',
  'client/src/composables/usePolicyBuilderState.js',
]);

const RETIRED_MECHANIC_PATHS = Object.freeze([
  'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function createRetainedArtifact({
  id,
  kindId,
  sourcePath,
  entryPoint,
  artifactIds,
  replacementTarget,
  dispositionId = POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS.DELETE_AFTER_NATIVE_STORAGE,
  normalAuthoringAllowed = false,
  rawPayloadMutationAllowed = false,
  notes,
}) {
  return {
    id,
    kindId,
    sourcePath,
    entryPoint,
    artifactIds,
    deletionGateIds: REQUIRED_DELETION_GATE_IDS,
    replacementTarget,
    dispositionId,
    normalAuthoringAllowed,
    rawPayloadMutationAllowed,
    notes,
  };
}

const SERVER_ATTACHMENT_ARTIFACTS = [
  createRetainedArtifact({
    id: 'preset_attachment_query_helper',
    kindId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS.ATTACHMENT_READER,
    sourcePath: 'server/src/routes/policiesRouteHelpers.mjs',
    entryPoint: 'fetchPolicyPresetAttachments',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.PRESET_ATTACHMENTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STARTER_TEMPLATE_WEIGHTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
    ],
    replacementTarget: 'native-intent migration verifier input reader',
    notes: 'Feeds compatibility migration maintenance only; it is not a normal policy-authoring source.',
  }),
  createRetainedArtifact({
    id: 'policy_read_attachment_projection',
    kindId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS.ATTACHMENT_READER,
    sourcePath: 'server/src/routes/policiesRoutePolicyRead.mjs',
    entryPoint: 'GET /:id attachment projection',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.PRESET_ATTACHMENTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STARTER_TEMPLATE_WEIGHTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
    ],
    replacementTarget: 'native policy intent read projection',
    notes: 'Supports existing-policy maintenance until converted policies no longer expose preset attachments.',
  }),
  createRetainedArtifact({
    id: 'policy_write_attachment_round_trip',
    kindId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS.ATTACHMENT_ROUND_TRIP,
    sourcePath: 'server/src/routes/policiesRoutePolicyWrite.mjs',
    entryPoint: 'POST / and PUT /:id legacy preset persistence',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.PRESET_ATTACHMENTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STARTER_TEMPLATE_WEIGHTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
    ],
    replacementTarget: 'native policy intent write transaction',
    notes: 'The legacy write guard permits this only for unconverted policies.',
  }),
  createRetainedArtifact({
    id: 'policy_preset_attachment_routes',
    kindId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS.ATTACHMENT_ROUND_TRIP,
    sourcePath: 'server/src/routes/policiesRoutePolicyPresets.mjs',
    entryPoint: 'GET, POST, and DELETE /:id/presets',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.PRESET_ATTACHMENTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STARTER_TEMPLATE_WEIGHTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
    ],
    replacementTarget: 'native policy intent read/write contract',
    notes: 'Direct attachment operations remain guarded legacy maintenance endpoints.',
  }),
  createRetainedArtifact({
    id: 'preset_attachment_migration_routes',
    kindId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS.ATTACHMENT_ROUND_TRIP,
    sourcePath: 'server/src/routes/policiesRoutePresets.mjs',
    entryPoint: 'GET and POST /presets/migration attachment maintenance',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.PRESET_ATTACHMENTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
    ],
    replacementTarget: 'native intent migration verifier and cleanup job',
    notes: 'No current browser caller uses these maintenance endpoints, but they remain a supported compatibility API until native cutover.',
  }),
];

function buildBridgeModuleArtifacts() {
  const bridgePaths = new Set(
    listLegacyCompatibilityModuleRecords().map(record => record.path),
  );

  return REQUIRED_BRIDGE_MODULE_PATHS
    .filter(sourcePath => bridgePaths.has(sourcePath))
    .map((sourcePath) => {
      const dispositionId = sourcePath === 'client/src/utils/policyIntentDraftBridge.js'
        ? POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS.DELETE_AFTER_NATIVE_STORAGE
        : POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS.REPLACE_AFTER_NATIVE_STORAGE;

      return createRetainedArtifact({
        id: `legacy_bridge_${sourcePath.split('/').pop().replace(/\.[^.]+$/, '')}`,
        kindId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS.ATTACHMENT_ROUND_TRIP,
        sourcePath,
        entryPoint: sourcePath.endsWith('policyIntentDraftBridge.js')
          ? 'buildPolicyIntentDraft and applyPolicyIntentDraftToSelectedPresets'
          : 'typed draft command and save-payload coordination',
        artifactIds: [
          LEGACY_COMPATIBILITY_ARTIFACT_IDS.PRESET_ATTACHMENTS,
          LEGACY_COMPATIBILITY_ARTIFACT_IDS.STARTER_TEMPLATE_WEIGHTS,
          LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
        ],
        replacementTarget: sourcePath.endsWith('policyIntentDraftBridge.js')
          ? 'native intent mapper'
          : 'native-intent-backed draft state',
        dispositionId,
        notes: 'Client compatibility coordination is non-authoritative and cannot expose raw attachment payloads to product components.',
      });
    });
}

function buildCompatibilityComponentArtifacts() {
  return listPolicyAuthoringComponentInventory()
    .filter(record => (
      COMPATIBILITY_COMPONENT_ROLE_IDS.has(record.roleId)
      || ADDITIONAL_COMPATIBILITY_COMPONENT_IDS.has(record.id)
    ))
    .map(record => createRetainedArtifact({
      id: `compatibility_component_${record.id}`,
      kindId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS.COMPATIBILITY_COMPONENT,
      sourcePath: record.path,
      entryPoint: record.id,
      artifactIds: [
        LEGACY_COMPATIBILITY_ARTIFACT_IDS.PRESET_ATTACHMENTS,
        LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      ],
      replacementTarget: record.targetComponentIds.length > 0
        ? `native component contract: ${record.targetComponentIds.join(', ')}`
        : 'native policy authoring workflow',
      dispositionId: record.decisionId === POLICY_AUTHORING_COMPONENT_DECISION_IDS.REPLACE_WITH_TARGET
        ? POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS.REPLACE_AFTER_NATIVE_STORAGE
        : POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS.DELETE_AFTER_NATIVE_STORAGE,
      normalAuthoringAllowed: record.normalAuthoringAllowed,
      notes: record.notes,
    }));
}

const POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_ARTIFACTS = deepFreeze([
  ...SERVER_ATTACHMENT_ARTIFACTS,
  ...buildBridgeModuleArtifacts(),
  ...buildCompatibilityComponentArtifacts(),
]);

function listPolicyStarterTemplateCompatibilityBridgeArtifacts() {
  return POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_ARTIFACTS;
}

function listPolicyStarterTemplateRetiredMechanicPaths() {
  return RETIRED_MECHANIC_PATHS;
}

function validatePolicyStarterTemplateCompatibilityBridgeArtifact(record = {}) {
  const issues = [];
  const knownKindIds = Object.values(POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS);
  const knownArtifactIds = Object.values(LEGACY_COMPATIBILITY_ARTIFACT_IDS);
  const knownGateIds = Object.values(LEGACY_COMPATIBILITY_DELETION_GATE_IDS);
  const artifactIds = Array.isArray(record.artifactIds) ? record.artifactIds : [];
  const deletionGateIds = Array.isArray(record.deletionGateIds) ? record.deletionGateIds : [];

  if (!knownKindIds.includes(record.kindId)) {
    issues.push({
      riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.UNKNOWN_KIND,
      message: 'Compatibility bridge artifact must declare a recognized role.',
    });
  }

  if (!record.sourcePath) {
    issues.push({
      riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.MISSING_SOURCE_PATH,
      message: 'Compatibility bridge artifact must declare its source path.',
    });
  }

  if (!record.entryPoint) {
    issues.push({
      riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.MISSING_ENTRY_POINT,
      message: 'Compatibility bridge artifact must declare the owning entry point.',
    });
  }

  if (artifactIds.length === 0) {
    issues.push({
      riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.MISSING_ARTIFACT,
      message: 'Compatibility bridge artifact must name at least one legacy storage artifact.',
    });
  }

  const unknownArtifactIds = artifactIds.filter(id => !knownArtifactIds.includes(id));
  if (unknownArtifactIds.length > 0) {
    issues.push({
      riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.UNKNOWN_ARTIFACT,
      artifactIds: unknownArtifactIds,
      message: 'Compatibility bridge artifact names an unknown legacy storage artifact.',
    });
  }

  const missingDeletionGateIds = REQUIRED_DELETION_GATE_IDS
    .filter(id => !deletionGateIds.includes(id));
  if (missingDeletionGateIds.length > 0) {
    issues.push({
      riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.MISSING_DELETION_GATE,
      gateIds: missingDeletionGateIds,
      message: 'Retained compatibility artifacts require every native-storage deletion gate.',
    });
  }

  const unknownDeletionGateIds = deletionGateIds.filter(id => !knownGateIds.includes(id));
  if (unknownDeletionGateIds.length > 0) {
    issues.push({
      riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.UNKNOWN_DELETION_GATE,
      gateIds: unknownDeletionGateIds,
      message: 'Compatibility bridge artifact names an unknown native-storage deletion gate.',
    });
  }

  if (!record.replacementTarget) {
    issues.push({
      riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.MISSING_REPLACEMENT_TARGET,
      message: 'Retained compatibility artifacts must name their native successor.',
    });
  }

  if (
    record.kindId === POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS.COMPATIBILITY_COMPONENT
    && record.normalAuthoringAllowed
  ) {
    issues.push({
      riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.NORMAL_AUTHORING_COMPONENT,
      message: 'Compatibility components cannot be admitted to the normal authoring workflow.',
    });
  }

  if (
    record.kindId === POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS.COMPATIBILITY_COMPONENT
    && record.rawPayloadMutationAllowed
  ) {
    issues.push({
      riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.RAW_PAYLOAD_COMPONENT,
      message: 'Compatibility components cannot receive raw legacy payload mutation authority.',
    });
  }

  return {
    valid: issues.length === 0,
    artifactId: record.id || null,
    issues,
  };
}

function buildPolicyStarterTemplateCompatibilityBridgeAudit({
  artifacts = POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_ARTIFACTS,
  bridgeModuleRecords = listLegacyCompatibilityModuleRecords(),
  componentInventory = listPolicyAuthoringComponentInventory(),
} = {}) {
  const records = Array.isArray(artifacts) ? artifacts : [];
  const validationResults = records.map(validatePolicyStarterTemplateCompatibilityBridgeArtifact);
  const ids = records.map(record => record?.id).filter(Boolean);
  const paths = records.map(record => record?.sourcePath).filter(Boolean);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
    .filter((id, index, allIds) => allIds.indexOf(id) === index);
  const duplicatePaths = paths.filter((path, index) => paths.indexOf(path) !== index)
    .filter((path, index, allPaths) => allPaths.indexOf(path) === index);
  const artifactPaths = new Set(paths);
  const bridgePaths = new Set(bridgeModuleRecords.map(record => record?.path));
  const missingBridgeModulePaths = REQUIRED_BRIDGE_MODULE_PATHS.filter(path => (
    bridgePaths.has(path) && !artifactPaths.has(path)
  ));
  const compatibilityComponentPaths = componentInventory
    .filter(record => (
      COMPATIBILITY_COMPONENT_ROLE_IDS.has(record.roleId)
      || ADDITIONAL_COMPATIBILITY_COMPONENT_IDS.has(record.id)
    ))
    .map(record => record.path);
  const missingCompatibilityComponentPaths = compatibilityComponentPaths
    .filter(path => !artifactPaths.has(path));
  const issues = [
    ...validationResults.flatMap(result => result.issues.map(issue => ({
      artifactId: result.artifactId,
      ...issue,
    }))),
    ...duplicateIds.map(id => ({
      artifactId: id,
      riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.DUPLICATE_ARTIFACT_ID,
      message: 'Compatibility bridge artifact IDs must be unique.',
    })),
    ...duplicatePaths.map(sourcePath => ({
      sourcePath,
      riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.DUPLICATE_SOURCE_PATH,
      message: 'Each compatibility source path must have one inventory record.',
    })),
    ...missingBridgeModulePaths.map(sourcePath => ({
      sourcePath,
      riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.MISSING_BRIDGE_MODULE_COVERAGE,
      message: 'A live round-trip bridge module is missing from the compatibility inventory.',
    })),
    ...missingCompatibilityComponentPaths.map(sourcePath => ({
      sourcePath,
      riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.MISSING_COMPATIBILITY_COMPONENT_COVERAGE,
      message: 'A declared compatibility component is missing from the compatibility inventory.',
    })),
  ];

  return {
    ok: issues.length === 0,
    checkedArtifactCount: records.length,
    checkedBridgeModuleCount: REQUIRED_BRIDGE_MODULE_PATHS.length,
    checkedCompatibilityComponentCount: compatibilityComponentPaths.length,
    validationResults,
    duplicateIds,
    duplicatePaths,
    missingBridgeModulePaths,
    missingCompatibilityComponentPaths,
    issues,
  };
}

function summarizePolicyStarterTemplateCompatibilityBridgeInventory() {
  const artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts();
  const countsByKind = artifacts.reduce((counts, artifact) => {
    counts[artifact.kindId] = (counts[artifact.kindId] || 0) + 1;
    return counts;
  }, {});

  return {
    activeArtifactCount: artifacts.length,
    countsByKind,
    deletionGateIds: REQUIRED_DELETION_GATE_IDS,
    retiredMechanicPaths: RETIRED_MECHANIC_PATHS,
    normalAuthoringCompatibilityArtifactIds: artifacts
      .filter(artifact => artifact.normalAuthoringAllowed)
      .map(artifact => artifact.id),
  };
}

export {
  POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS,
  POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS,
  POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS,
  buildPolicyStarterTemplateCompatibilityBridgeAudit,
  listPolicyStarterTemplateCompatibilityBridgeArtifacts,
  listPolicyStarterTemplateRetiredMechanicPaths,
  summarizePolicyStarterTemplateCompatibilityBridgeInventory,
  validatePolicyStarterTemplateCompatibilityBridgeArtifact,
};
