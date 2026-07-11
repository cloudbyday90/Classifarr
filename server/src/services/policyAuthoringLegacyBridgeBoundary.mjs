import {
  LEGACY_COMPATIBILITY_ACTION_IDS,
  LEGACY_COMPATIBILITY_ARTIFACT_IDS,
  LEGACY_COMPATIBILITY_DELETION_GATE_IDS,
  LEGACY_COMPATIBILITY_RISK_IDS,
  canMutateLegacyPayload,
  validateLegacyCompatibilityTouchpoint,
} from './policyBuilderLegacyCompatibilityBoundary.mjs';

const POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS = Object.freeze({
  DESERIALIZE_SELECTED_PRESETS: 'deserialize_selected_presets',
  PROJECT_CUSTOM_SIGNALS_TO_DRAFT: 'project_custom_signals_to_draft',
  SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS: 'serialize_draft_to_custom_signals',
  PRESERVE_UNSUPPORTED_LEGACY_BLOCKS: 'preserve_unsupported_legacy_blocks',
  PRESERVE_PRESET_WEIGHTS: 'preserve_preset_weights',
  PRESERVE_REMOVED_MARKERS: 'preserve_removed_markers',
  PRESERVE_STRICT_ADVISORY_METADATA: 'preserve_strict_advisory_metadata',
  PRESERVE_COMPATIBILITY_FALLBACK: 'preserve_compatibility_fallback',
  MIGRATION_ONLY_METADATA: 'migration_only_metadata',
  DELETE_AFTER_NATIVE_STORAGE: 'delete_after_native_storage',
});

const POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS = Object.freeze({
  DESERIALIZER: 'deserializer',
  SERIALIZER: 'serializer',
  NO_OP_PRESERVATION: 'no_op_preservation',
  MIGRATION_METADATA: 'migration_metadata',
  DELETION_GATE: 'deletion_gate',
});

const POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS = Object.freeze({
  DRAFT_BRIDGE: 'draft_bridge',
  DRAFT_COMPOSABLE_CALLER: 'draft_composable_caller',
  POLICY_BUILDER_STATE_CALLER: 'policy_builder_state_caller',
  SERVER_VALIDATION: 'server_validation',
  NATIVE_STORAGE_REPLACEMENT: 'native_storage_replacement',
});

const POLICY_AUTHORING_LEGACY_BRIDGE_ALLOWED_SERIALIZED_KEYS = Object.freeze([
  'require_all',
  'require_any',
  'include',
  'prefer',
  'exclude',
  'mode',
  'max',
  'min',
  'min_minutes',
  'max_minutes',
  'semantics',
  'constraint_mode',
  'constraint',
  'runtime_mode',
  'runtime',
  'strict',
  'removed',
]);

const POLICY_AUTHORING_LEGACY_BRIDGE_UNSUPPORTED_PRESERVATION_KEYS = Object.freeze([
  'source_note',
  'custom_score',
  'provider_hint',
  'legacy_rule_id',
]);

const POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_RESPONSIBILITY: 'unknown_responsibility',
  UNKNOWN_STAGE: 'unknown_stage',
  UNKNOWN_OWNER: 'unknown_owner',
  UNKNOWN_ARTIFACT: 'unknown_artifact',
  MISSING_MODULE_BOUNDARY: 'missing_module_boundary',
  SERIALIZER_NOT_ALLOW_LISTED: 'serializer_not_allow_listed',
  PRODUCT_FACING_BRIDGE_RECORD: 'product_facing_bridge_record',
  RAW_MUTATION_OUTSIDE_BRIDGE: 'raw_mutation_outside_bridge',
  UNSUPPORTED_PRESERVATION_NOT_BRIDGE_OWNED: 'unsupported_preservation_not_bridge_owned',
  DELETION_GATE_WITHOUT_NATIVE_REPLACEMENT: 'deletion_gate_without_native_replacement',
  UNSAFE_SERIALIZED_KEY: 'unsafe_serialized_key',
  UNSUPPORTED_KEY_OVERLAPS_SERIALIZED_KEY: 'unsupported_key_overlaps_serialized_key',
  MISSING_DELETION_REQUIREMENT: 'missing_deletion_requirement',
});

const UNSAFE_BRIDGE_PAYLOAD_KEYS = Object.freeze([
  '__proto__',
  'constructor',
  'prototype',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  Object.values(value).forEach(item => {
    deepFreeze(item);
  });

  return value;
}

const POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_RECORDS = deepFreeze([
  {
    id: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.DESERIALIZE_SELECTED_PRESETS,
    stageId: POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.DESERIALIZER,
    ownerId: POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.DRAFT_BRIDGE,
    modulePath: 'client/src/utils/policyIntentDraftBridge.js',
    entryPoint: 'buildPolicyIntentDraft',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.PRESET_ATTACHMENTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STARTER_TEMPLATE_WEIGHTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.COMPATIBILITY_FALLBACK_PROJECTION,
    ],
    allowListed: true,
    preservesUnknownPayload: true,
    productFacing: false,
    deleteAfterNativeStorage: true,
    replacementTarget: 'native intent reader with legacy fallback converter',
  },
  {
    id: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PROJECT_CUSTOM_SIGNALS_TO_DRAFT,
    stageId: POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.DESERIALIZER,
    ownerId: POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.DRAFT_BRIDGE,
    modulePath: 'client/src/utils/policyIntentDraftBridge.js',
    entryPoint: 'buildPolicyIntentDraft',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.REMOVED_MARKERS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STRICT_ADVISORY_METADATA,
    ],
    allowListed: true,
    preservesUnknownPayload: true,
    productFacing: false,
    deleteAfterNativeStorage: true,
    replacementTarget: 'native intent projection reader',
  },
  {
    id: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS,
    stageId: POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.SERIALIZER,
    ownerId: POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.DRAFT_BRIDGE,
    modulePath: 'client/src/utils/policyIntentDraftBridge.js',
    entryPoint: 'applyPolicyIntentDraftToSelectedPresets',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.REMOVED_MARKERS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STRICT_ADVISORY_METADATA,
    ],
    allowListed: true,
    preservesUnknownPayload: true,
    productFacing: false,
    deleteAfterNativeStorage: true,
    replacementTarget: 'native intent writer with legacy converter removed',
  },
  {
    id: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_UNSUPPORTED_LEGACY_BLOCKS,
    stageId: POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.NO_OP_PRESERVATION,
    ownerId: POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.DRAFT_BRIDGE,
    modulePath: 'client/src/utils/policyIntentDraftBridge.js',
    entryPoint: 'applyPolicyIntentDraftToSelectedPresets',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
    ],
    allowListed: true,
    preservesUnknownPayload: true,
    productFacing: false,
    deleteAfterNativeStorage: true,
    replacementTarget: 'native storage rollback snapshot and conversion tests',
  },
  {
    id: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_PRESET_WEIGHTS,
    stageId: POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.NO_OP_PRESERVATION,
    ownerId: POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.POLICY_BUILDER_STATE_CALLER,
    modulePath: 'client/src/composables/usePolicyBuilderState.js',
    entryPoint: 'buildPolicySavePayload',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STARTER_TEMPLATE_WEIGHTS,
    ],
    allowListed: true,
    preservesUnknownPayload: false,
    productFacing: false,
    deleteAfterNativeStorage: false,
    replacementTarget: 'native template influence or seed metadata',
  },
  {
    id: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_REMOVED_MARKERS,
    stageId: POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.NO_OP_PRESERVATION,
    ownerId: POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.DRAFT_BRIDGE,
    modulePath: 'client/src/utils/policyIntentDraftBridge.js',
    entryPoint: 'signalRemovalOverrides',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.REMOVED_MARKERS,
    ],
    allowListed: true,
    preservesUnknownPayload: true,
    productFacing: false,
    deleteAfterNativeStorage: true,
    replacementTarget: 'native ignored-template-signal state or deletion',
  },
  {
    id: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_STRICT_ADVISORY_METADATA,
    stageId: POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.NO_OP_PRESERVATION,
    ownerId: POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.DRAFT_BRIDGE,
    modulePath: 'client/src/utils/policyIntentDraftBridge.js',
    entryPoint: 'signalMetadataOverrides',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STRICT_ADVISORY_METADATA,
    ],
    allowListed: true,
    preservesUnknownPayload: true,
    productFacing: false,
    deleteAfterNativeStorage: true,
    replacementTarget: 'native constraint semantics',
  },
  {
    id: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_COMPATIBILITY_FALLBACK,
    stageId: POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.NO_OP_PRESERVATION,
    ownerId: POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.DRAFT_BRIDGE,
    modulePath: 'client/src/utils/policyIntentDraftBridge.js',
    entryPoint: 'legacyCustomSignals',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.COMPATIBILITY_FALLBACK_PROJECTION,
    ],
    allowListed: true,
    preservesUnknownPayload: true,
    productFacing: false,
    deleteAfterNativeStorage: true,
    replacementTarget: 'native storage rollback snapshot',
  },
  {
    id: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.MIGRATION_ONLY_METADATA,
    stageId: POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.MIGRATION_METADATA,
    ownerId: POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.DRAFT_BRIDGE,
    modulePath: 'client/src/utils/policyIntentDraftBridge.js',
    entryPoint: 'source and migration_state fields',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.COMPATIBILITY_FALLBACK_PROJECTION,
    ],
    allowListed: true,
    preservesUnknownPayload: false,
    productFacing: false,
    deleteAfterNativeStorage: true,
    replacementTarget: 'native policy intent storage state',
  },
  {
    id: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.DELETE_AFTER_NATIVE_STORAGE,
    stageId: POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.DELETION_GATE,
    ownerId: POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.NATIVE_STORAGE_REPLACEMENT,
    modulePath: 'client/src/utils/policyIntentDraftBridge.js',
    entryPoint: 'entire bridge module',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.COMPATIBILITY_FALLBACK_PROJECTION,
    ],
    allowListed: true,
    preservesUnknownPayload: false,
    productFacing: false,
    deleteAfterNativeStorage: true,
    replacementTarget: 'native intent storage mapper',
  },
]);

const POLICY_AUTHORING_LEGACY_BRIDGE_DELETION_REQUIREMENTS = deepFreeze([
  LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA,
  LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LOSSLESS_CONVERSION,
  LEGACY_COMPATIBILITY_DELETION_GATE_IDS.ROLLBACK_SNAPSHOT,
  LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_READ_WRITE_PARITY,
  LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LEGACY_WRITE_SHUTDOWN,
  LEGACY_COMPATIBILITY_DELETION_GATE_IDS.BACKUP_RESTORE_VERIFICATION,
  LEGACY_COMPATIBILITY_DELETION_GATE_IDS.REGRESSION_COVERAGE,
]);

function listPolicyAuthoringLegacyBridgeResponsibilities() {
  return POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_RECORDS;
}

function getPolicyAuthoringLegacyBridgeResponsibility(responsibilityId) {
  return POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_RECORDS.find(record => record.id === responsibilityId) || null;
}

function listPolicyAuthoringLegacyBridgeResponsibilitiesByStage(stageId) {
  return POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_RECORDS.filter(record => record.stageId === stageId);
}

function listPolicyAuthoringLegacyBridgeDeletionRequirements() {
  return POLICY_AUTHORING_LEGACY_BRIDGE_DELETION_REQUIREMENTS;
}

function canPolicyAuthoringLegacyBridgeSerializeKey(key) {
  return POLICY_AUTHORING_LEGACY_BRIDGE_ALLOWED_SERIALIZED_KEYS.includes(key);
}

function shouldPolicyAuthoringLegacyBridgePreserveUnsupportedKey(key) {
  return POLICY_AUTHORING_LEGACY_BRIDGE_UNSUPPORTED_PRESERVATION_KEYS.includes(key);
}

function validatePolicyAuthoringLegacyBridgeResponsibility(record) {
  if (!record || typeof record !== 'object') {
    return {
      valid: false,
      responsibilityId: null,
      issues: [
        {
          riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
          reason: 'Bridge responsibility record is missing or invalid.',
        },
      ],
    };
  }

  const issues = [];

  if (!Object.values(POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS).includes(record.id)) {
    issues.push({
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
      reason: 'Bridge responsibility is not in the declared policy authoring legacy bridge vocabulary.',
    });
  }

  if (!Object.values(POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS).includes(record.stageId)) {
    issues.push({
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNKNOWN_STAGE,
      reason: 'Bridge responsibility has no recognized stage.',
    });
  }

  if (!Object.values(POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS).includes(record.ownerId)) {
    issues.push({
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNKNOWN_OWNER,
      reason: 'Bridge responsibility has no recognized owner.',
    });
  }

  const unknownArtifactIds = (Array.isArray(record.artifactIds) ? record.artifactIds : [])
    .filter(artifactId => !Object.values(LEGACY_COMPATIBILITY_ARTIFACT_IDS).includes(artifactId));

  if (unknownArtifactIds.length > 0) {
    issues.push({
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNKNOWN_ARTIFACT,
      reason: 'Bridge responsibility references an unknown legacy compatibility artifact.',
    });
  }

  if (!record.modulePath || !record.entryPoint) {
    issues.push({
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.MISSING_MODULE_BOUNDARY,
      reason: 'Bridge responsibility must declare a module path and entry point.',
    });
  }

  if (record.stageId === POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.SERIALIZER && record.allowListed !== true) {
    issues.push({
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.SERIALIZER_NOT_ALLOW_LISTED,
      reason: 'Bridge serializer responsibilities must be allow-listed.',
    });
  }

  if (record.productFacing) {
    issues.push({
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.PRODUCT_FACING_BRIDGE_RECORD,
      reason: 'Bridge responsibilities must not be product-facing UI records.',
    });
  }

  if (
    record.stageId === POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.SERIALIZER
    && record.ownerId !== POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.DRAFT_BRIDGE
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.RAW_MUTATION_OUTSIDE_BRIDGE,
      reason: 'Raw legacy serialization must stay inside the draft bridge.',
    });
  }

  if (
    record.id === POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_UNSUPPORTED_LEGACY_BLOCKS
    && (record.ownerId !== POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.DRAFT_BRIDGE || record.preservesUnknownPayload !== true)
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNSUPPORTED_PRESERVATION_NOT_BRIDGE_OWNED,
      reason: 'Unsupported legacy payload preservation must be bridge-owned and preserve unknown payload data.',
    });
  }

  if (
    record.deleteAfterNativeStorage
    && (!record.replacementTarget || record.ownerId === POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.SERVER_VALIDATION)
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.DELETION_GATE_WITHOUT_NATIVE_REPLACEMENT,
      reason: 'Bridge deletion candidates must declare a native-storage replacement target.',
    });
  }

  return {
    valid: issues.length === 0,
    responsibilityId: record.id || null,
    issues,
  };
}

function validatePolicyAuthoringLegacyBridgeSerializedKeySets({
  allowedSerializedKeys = POLICY_AUTHORING_LEGACY_BRIDGE_ALLOWED_SERIALIZED_KEYS,
  unsupportedPreservationKeys = POLICY_AUTHORING_LEGACY_BRIDGE_UNSUPPORTED_PRESERVATION_KEYS,
} = {}) {
  const allowedKeys = Array.isArray(allowedSerializedKeys) ? allowedSerializedKeys : [];
  const unsupportedKeys = Array.isArray(unsupportedPreservationKeys) ? unsupportedPreservationKeys : [];
  const issues = [];

  const unsafeKeys = [...allowedKeys, ...unsupportedKeys]
    .filter(key => typeof key !== 'string' || UNSAFE_BRIDGE_PAYLOAD_KEYS.includes(key));

  if (unsafeKeys.length > 0) {
    issues.push({
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNSAFE_SERIALIZED_KEY,
      reason: 'Bridge payload key sets cannot contain prototype-pollution keys or non-string keys.',
      keys: unsafeKeys,
    });
  }

  const overlappingKeys = unsupportedKeys.filter(key => allowedKeys.includes(key));

  if (overlappingKeys.length > 0) {
    issues.push({
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNSUPPORTED_KEY_OVERLAPS_SERIALIZED_KEY,
      reason: 'Unsupported preservation keys must not overlap with the serializer allow-list.',
      keys: overlappingKeys,
    });
  }

  return {
    valid: issues.length === 0,
    allowedSerializedKeys: allowedKeys,
    unsupportedPreservationKeys: unsupportedKeys,
    issues,
  };
}

function canPolicyAuthoringPathMutateLegacyPayload(path) {
  return canMutateLegacyPayload(path);
}

function validatePolicyAuthoringLegacyBridgeTouchpoint({ path, artifactId, operation } = {}) {
  return validateLegacyCompatibilityTouchpoint({
    path,
    artifactId,
    operation,
  });
}

function validatePolicyAuthoringLegacyBridgeDeletionReadiness(completedGateIds = []) {
  const completed = Array.isArray(completedGateIds) ? completedGateIds : [];
  const missingGateIds = POLICY_AUTHORING_LEGACY_BRIDGE_DELETION_REQUIREMENTS.filter(gateId => !completed.includes(gateId));

  return {
    ready: missingGateIds.length === 0,
    requiredGateIds: POLICY_AUTHORING_LEGACY_BRIDGE_DELETION_REQUIREMENTS,
    missingGateIds,
  };
}

function buildPolicyAuthoringLegacyBridgeBoundaryAudit({
  responsibilities = POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_RECORDS,
  deletionRequirements = POLICY_AUTHORING_LEGACY_BRIDGE_DELETION_REQUIREMENTS,
  allowedSerializedKeys = POLICY_AUTHORING_LEGACY_BRIDGE_ALLOWED_SERIALIZED_KEYS,
  unsupportedPreservationKeys = POLICY_AUTHORING_LEGACY_BRIDGE_UNSUPPORTED_PRESERVATION_KEYS,
} = {}) {
  const responsibilityResults = responsibilities.map(validatePolicyAuthoringLegacyBridgeResponsibility);
  const responsibilityIds = responsibilities.map(record => record?.id).filter(Boolean);
  const missingResponsibilityIds = Object.values(POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS)
    .filter(responsibilityId => !responsibilityIds.includes(responsibilityId));
  const duplicateResponsibilityIds = responsibilityIds
    .filter((responsibilityId, index) => responsibilityIds.indexOf(responsibilityId) !== index)
    .filter((responsibilityId, index, allIds) => allIds.indexOf(responsibilityId) === index);
  const missingDeletionRequirementIds = POLICY_AUTHORING_LEGACY_BRIDGE_DELETION_REQUIREMENTS
    .filter(gateId => !deletionRequirements.includes(gateId));
  const keySetResult = validatePolicyAuthoringLegacyBridgeSerializedKeySets({
    allowedSerializedKeys,
    unsupportedPreservationKeys,
  });
  const issues = [
    ...responsibilityResults.flatMap(result => result.issues.map(issue => ({
      responsibilityId: result.responsibilityId,
      ...issue,
    }))),
    ...missingResponsibilityIds.map(responsibilityId => ({
      responsibilityId,
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
      reason: 'Required policy authoring legacy bridge responsibility is missing.',
    })),
    ...duplicateResponsibilityIds.map(responsibilityId => ({
      responsibilityId,
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
      reason: 'Bridge responsibility appears more than once.',
    })),
    ...missingDeletionRequirementIds.map(gateId => ({
      responsibilityId: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.DELETE_AFTER_NATIVE_STORAGE,
      riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.MISSING_DELETION_REQUIREMENT,
      reason: `Required native-storage removal gate is missing: ${gateId}.`,
    })),
    ...keySetResult.issues.map(issue => ({
      responsibilityId: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS,
      ...issue,
    })),
  ];

  return {
    ok: issues.length === 0,
    checkedResponsibilityCount: responsibilities.length,
    requiredResponsibilityCount: Object.values(POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS).length,
    responsibilityResults,
    missingResponsibilityIds,
    duplicateResponsibilityIds,
    missingDeletionRequirementIds,
    keySetResult,
    issues,
  };
}

function summarizePolicyAuthoringLegacyBridgeBoundary() {
  const countsByStage = POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_RECORDS.reduce((counts, record) => {
    counts[record.stageId] = (counts[record.stageId] || 0) + 1;
    return counts;
  }, {});

  return {
    bridgeModulePath: 'client/src/utils/policyIntentDraftBridge.js',
    productComponentsMayReadRawCustomSignals: false,
    productComponentsMayWriteRawCustomSignals: false,
    bridgeCanMutateRawLegacyPayload: canPolicyAuthoringPathMutateLegacyPayload('client/src/utils/policyIntentDraftBridge.js'),
    responsibilityCount: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_RECORDS.length,
    countsByStage,
    allowedSerializedKeys: POLICY_AUTHORING_LEGACY_BRIDGE_ALLOWED_SERIALIZED_KEYS,
    unsupportedPreservationKeys: POLICY_AUTHORING_LEGACY_BRIDGE_UNSUPPORTED_PRESERVATION_KEYS,
    deletionRequirementIds: POLICY_AUTHORING_LEGACY_BRIDGE_DELETION_REQUIREMENTS,
    deleteAfterNativeStorageResponsibilityIds: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_RECORDS
      .filter(record => record.deleteAfterNativeStorage)
      .map(record => record.id),
  };
}

export {
  LEGACY_COMPATIBILITY_ACTION_IDS,
  LEGACY_COMPATIBILITY_ARTIFACT_IDS,
  LEGACY_COMPATIBILITY_RISK_IDS,
  POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS,
  POLICY_AUTHORING_LEGACY_BRIDGE_ALLOWED_SERIALIZED_KEYS,
  POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS,
  POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS,
  POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS,
  POLICY_AUTHORING_LEGACY_BRIDGE_UNSUPPORTED_PRESERVATION_KEYS,
  buildPolicyAuthoringLegacyBridgeBoundaryAudit,
  canPolicyAuthoringLegacyBridgeSerializeKey,
  canPolicyAuthoringPathMutateLegacyPayload,
  getPolicyAuthoringLegacyBridgeResponsibility,
  listPolicyAuthoringLegacyBridgeDeletionRequirements,
  listPolicyAuthoringLegacyBridgeResponsibilities,
  listPolicyAuthoringLegacyBridgeResponsibilitiesByStage,
  shouldPolicyAuthoringLegacyBridgePreserveUnsupportedKey,
  summarizePolicyAuthoringLegacyBridgeBoundary,
  validatePolicyAuthoringLegacyBridgeDeletionReadiness,
  validatePolicyAuthoringLegacyBridgeResponsibility,
  validatePolicyAuthoringLegacyBridgeSerializedKeySets,
  validatePolicyAuthoringLegacyBridgeTouchpoint,
};
