const LEGACY_COMPATIBILITY_ARTIFACT_IDS = Object.freeze({
  PRESET_ATTACHMENTS: 'preset_attachments',
  STARTER_TEMPLATE_WEIGHTS: 'starter_template_weights',
  CUSTOM_SIGNALS: 'custom_signals',
  REMOVED_MARKERS: 'removed_markers',
  STRICT_ADVISORY_METADATA: 'strict_advisory_metadata',
  COMPATIBILITY_FALLBACK_PROJECTION: 'compatibility_fallback_projection',
});

const LEGACY_COMPATIBILITY_OWNER_IDS = Object.freeze({
  DRAFT_BRIDGE: 'draft_bridge',
  DRAFT_STATE_COMPOSABLE: 'draft_state_composable',
  POLICY_BUILDER_STATE: 'policy_builder_state',
  TEMPLATE_SIGNAL_HELPER: 'template_signal_helper',
  COMBINED_SIGNAL_PRESENTATION: 'combined_signal_presentation',
  PRODUCT_COMPONENT_CONSUMER: 'product_component_consumer',
  SERVER_VALIDATION: 'server_validation',
  NATIVE_INTENT_STORAGE: 'native_intent_storage',
});

const LEGACY_COMPATIBILITY_ACTION_IDS = Object.freeze({
  READ_COMPATIBILITY_PAYLOAD: 'read_compatibility_payload',
  WRITE_RAW_PAYLOAD: 'write_raw_payload',
  ROUTE_THROUGH_DRAFT_COMMAND: 'route_through_draft_command',
  SERIALIZE_THROUGH_BRIDGE: 'serialize_through_bridge',
  PRESENT_ONLY: 'present_only',
  RENAME_PRODUCT_LANGUAGE: 'rename_product_language',
  DELETE_AFTER_NATIVE_STORAGE: 'delete_after_native_storage',
});

const LEGACY_COMPATIBILITY_RISK_IDS = Object.freeze({
  RAW_PAYLOAD_MUTATION: 'raw_payload_mutation',
  PRODUCT_LANGUAGE_LEAK: 'product_language_leak',
  PERMANENT_DUAL_MODEL: 'permanent_dual_model',
  UNTESTED_ROLLBACK_DRIFT: 'untested_rollback_drift',
  ENGINE_AUTHORITY_CONFUSION: 'engine_authority_confusion',
});

const LEGACY_COMPATIBILITY_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_MODULE: 'unknown_module',
  UNKNOWN_ARTIFACT: 'unknown_artifact',
  DISALLOWED_ARTIFACT_OWNER: 'disallowed_artifact_owner',
  RAW_MUTATION_OUTSIDE_BRIDGE: 'raw_mutation_outside_bridge',
  PRODUCT_FACING_RAW_ACCESS: 'product_facing_raw_access',
  MISSING_DELETION_GATE: 'missing_deletion_gate',
  DELETION_GATE_NOT_REQUIRED: 'deletion_gate_not_required',
});

const LEGACY_COMPATIBILITY_DELETION_GATE_IDS = Object.freeze({
  NATIVE_INTENT_SCHEMA: 'native_intent_schema',
  LOSSLESS_CONVERSION: 'lossless_conversion',
  ROLLBACK_SNAPSHOT: 'rollback_snapshot',
  NATIVE_READ_WRITE_PARITY: 'native_read_write_parity',
  LEGACY_WRITE_SHUTDOWN: 'legacy_write_shutdown',
  BACKUP_RESTORE_VERIFICATION: 'backup_restore_verification',
  REGRESSION_COVERAGE: 'regression_coverage',
});

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

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').toLowerCase();
}

const LEGACY_COMPATIBILITY_ARTIFACTS = deepFreeze([
  {
    id: LEGACY_COMPATIBILITY_ARTIFACT_IDS.PRESET_ATTACHMENTS,
    label: 'Preset attachments',
    legacyNames: ['policy_presets', 'content_presets', 'preset_id'],
    allowedOwnerIds: [
      LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_STATE_COMPOSABLE,
      LEGACY_COMPATIBILITY_OWNER_IDS.POLICY_BUILDER_STATE,
      LEGACY_COMPATIBILITY_OWNER_IDS.PRODUCT_COMPONENT_CONSUMER,
      LEGACY_COMPATIBILITY_OWNER_IDS.SERVER_VALIDATION,
    ],
    productLanguage: 'starter templates',
    nativeStorageDisposition: 'replace with native template links or native intent references',
  },
  {
    id: LEGACY_COMPATIBILITY_ARTIFACT_IDS.STARTER_TEMPLATE_WEIGHTS,
    label: 'Starter-template weights',
    legacyNames: ['weight', 'preset_weight'],
    allowedOwnerIds: [
      LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_STATE_COMPOSABLE,
      LEGACY_COMPATIBILITY_OWNER_IDS.POLICY_BUILDER_STATE,
      LEGACY_COMPATIBILITY_OWNER_IDS.PRODUCT_COMPONENT_CONSUMER,
      LEGACY_COMPATIBILITY_OWNER_IDS.SERVER_VALIDATION,
    ],
    productLanguage: 'template influence',
    nativeStorageDisposition: 'replace with native influence settings or remove when templates become seed-only',
  },
  {
    id: LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
    label: 'Custom signals',
    legacyNames: ['customSignals', 'custom_signals', 'legacyCustomSignals'],
    allowedOwnerIds: [
      LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_BRIDGE,
      LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_STATE_COMPOSABLE,
      LEGACY_COMPATIBILITY_OWNER_IDS.POLICY_BUILDER_STATE,
      LEGACY_COMPATIBILITY_OWNER_IDS.COMBINED_SIGNAL_PRESENTATION,
      LEGACY_COMPATIBILITY_OWNER_IDS.SERVER_VALIDATION,
    ],
    productLanguage: 'declared intent signals',
    nativeStorageDisposition: 'delete after native intent storage is read/write authoritative',
  },
  {
    id: LEGACY_COMPATIBILITY_ARTIFACT_IDS.REMOVED_MARKERS,
    label: 'Removed markers',
    legacyNames: ['customSignals.removed', 'signalRemovalOverrides'],
    allowedOwnerIds: [
      LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_BRIDGE,
      LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_STATE_COMPOSABLE,
      LEGACY_COMPATIBILITY_OWNER_IDS.TEMPLATE_SIGNAL_HELPER,
      LEGACY_COMPATIBILITY_OWNER_IDS.COMBINED_SIGNAL_PRESENTATION,
      LEGACY_COMPATIBILITY_OWNER_IDS.PRODUCT_COMPONENT_CONSUMER,
    ],
    productLanguage: 'ignored template signal',
    nativeStorageDisposition: 'replace with native ignored-template-signal state or delete if no longer needed',
  },
  {
    id: LEGACY_COMPATIBILITY_ARTIFACT_IDS.STRICT_ADVISORY_METADATA,
    label: 'Strict/advisory metadata',
    legacyNames: ['strict', 'constraint_mode', 'runtimeSemantics', 'runtime_semantics'],
    allowedOwnerIds: [
      LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_BRIDGE,
      LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_STATE_COMPOSABLE,
      LEGACY_COMPATIBILITY_OWNER_IDS.TEMPLATE_SIGNAL_HELPER,
      LEGACY_COMPATIBILITY_OWNER_IDS.PRODUCT_COMPONENT_CONSUMER,
      LEGACY_COMPATIBILITY_OWNER_IDS.SERVER_VALIDATION,
    ],
    productLanguage: 'hard limit or helpful hint behavior',
    nativeStorageDisposition: 'replace with native constraint semantics',
  },
  {
    id: LEGACY_COMPATIBILITY_ARTIFACT_IDS.COMPATIBILITY_FALLBACK_PROJECTION,
    label: 'Compatibility fallback projection',
    legacyNames: ['legacy_policy_builder', 'legacy_compatible', 'native_candidate'],
    allowedOwnerIds: [
      LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_BRIDGE,
      LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_STATE_COMPOSABLE,
      LEGACY_COMPATIBILITY_OWNER_IDS.SERVER_VALIDATION,
      LEGACY_COMPATIBILITY_OWNER_IDS.NATIVE_INTENT_STORAGE,
    ],
    productLanguage: 'compatibility bridge projection',
    nativeStorageDisposition: 'delete after conversion, rollback, and native read/write parity are complete',
  },
]);

const LEGACY_COMPATIBILITY_MODULE_RECORDS = deepFreeze([
  {
    id: 'policy_intent_draft_bridge',
    path: 'client/src/utils/policyIntentDraftBridge.js',
    ownerId: LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_BRIDGE,
    role: 'Owns legacy-compatible projection and serialization between draft intent and selected preset payloads.',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.REMOVED_MARKERS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STRICT_ADVISORY_METADATA,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.COMPATIBILITY_FALLBACK_PROJECTION,
    ],
    allowedActions: [
      LEGACY_COMPATIBILITY_ACTION_IDS.READ_COMPATIBILITY_PAYLOAD,
      LEGACY_COMPATIBILITY_ACTION_IDS.WRITE_RAW_PAYLOAD,
      LEGACY_COMPATIBILITY_ACTION_IDS.SERIALIZE_THROUGH_BRIDGE,
      LEGACY_COMPATIBILITY_ACTION_IDS.DELETE_AFTER_NATIVE_STORAGE,
    ],
    productFacing: false,
    canMutateRawLegacyPayload: true,
    deleteAfterNativeStorage: true,
    replacementTarget: 'native intent storage mapper',
  },
  {
    id: 'policy_intent_draft_composable',
    path: 'client/src/composables/usePolicyIntentDraft.js',
    ownerId: LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_STATE_COMPOSABLE,
    role: 'Routes allow-listed draft commands and applies bridge output without owning raw storage format.',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.REMOVED_MARKERS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STRICT_ADVISORY_METADATA,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.COMPATIBILITY_FALLBACK_PROJECTION,
    ],
    allowedActions: [
      LEGACY_COMPATIBILITY_ACTION_IDS.READ_COMPATIBILITY_PAYLOAD,
      LEGACY_COMPATIBILITY_ACTION_IDS.ROUTE_THROUGH_DRAFT_COMMAND,
      LEGACY_COMPATIBILITY_ACTION_IDS.SERIALIZE_THROUGH_BRIDGE,
    ],
    productFacing: false,
    canMutateRawLegacyPayload: false,
    deleteAfterNativeStorage: false,
    replacementTarget: 'native intent draft command composable',
  },
  {
    id: 'policy_builder_state',
    path: 'client/src/composables/usePolicyBuilderState.js',
    ownerId: LEGACY_COMPATIBILITY_OWNER_IDS.POLICY_BUILDER_STATE,
    role: 'Coordinates policy form state and save payload assembly while delegating intent serialization to the bridge.',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.PRESET_ATTACHMENTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STARTER_TEMPLATE_WEIGHTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
    ],
    allowedActions: [
      LEGACY_COMPATIBILITY_ACTION_IDS.READ_COMPATIBILITY_PAYLOAD,
      LEGACY_COMPATIBILITY_ACTION_IDS.ROUTE_THROUGH_DRAFT_COMMAND,
      LEGACY_COMPATIBILITY_ACTION_IDS.SERIALIZE_THROUGH_BRIDGE,
    ],
    productFacing: false,
    canMutateRawLegacyPayload: false,
    deleteAfterNativeStorage: false,
    replacementTarget: 'policy form state backed by native intent storage',
  },
  {
    id: 'template_signal_helper',
    path: 'client/src/composables/usePolicyBuilderTemplateSignals.js',
    ownerId: LEGACY_COMPATIBILITY_OWNER_IDS.TEMPLATE_SIGNAL_HELPER,
    role: 'Reads starter-template and compatibility metadata for presentation and command routing only.',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.REMOVED_MARKERS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STRICT_ADVISORY_METADATA,
    ],
    allowedActions: [
      LEGACY_COMPATIBILITY_ACTION_IDS.READ_COMPATIBILITY_PAYLOAD,
      LEGACY_COMPATIBILITY_ACTION_IDS.PRESENT_ONLY,
      LEGACY_COMPATIBILITY_ACTION_IDS.RENAME_PRODUCT_LANGUAGE,
    ],
    productFacing: false,
    canMutateRawLegacyPayload: false,
    deleteAfterNativeStorage: false,
    replacementTarget: 'native template presentation helper',
  },
  {
    id: 'combined_signal_presentation',
    path: 'client/src/composables/usePolicyBuilderCombinedSignals.js',
    ownerId: LEGACY_COMPATIBILITY_OWNER_IDS.COMBINED_SIGNAL_PRESENTATION,
    role: 'Builds read-only summaries from starter-template and custom signal projections.',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.REMOVED_MARKERS,
    ],
    allowedActions: [
      LEGACY_COMPATIBILITY_ACTION_IDS.READ_COMPATIBILITY_PAYLOAD,
      LEGACY_COMPATIBILITY_ACTION_IDS.PRESENT_ONLY,
      LEGACY_COMPATIBILITY_ACTION_IDS.RENAME_PRODUCT_LANGUAGE,
    ],
    productFacing: false,
    canMutateRawLegacyPayload: false,
    deleteAfterNativeStorage: false,
    replacementTarget: 'native intent summary projection',
  },
  {
    id: 'starter_template_mechanics',
    path: 'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
    ownerId: LEGACY_COMPATIBILITY_OWNER_IDS.PRODUCT_COMPONENT_CONSUMER,
    role: 'Product component that should emit commands and product-language events, not mutate legacy payloads.',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.PRESET_ATTACHMENTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STARTER_TEMPLATE_WEIGHTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.REMOVED_MARKERS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STRICT_ADVISORY_METADATA,
    ],
    allowedActions: [
      LEGACY_COMPATIBILITY_ACTION_IDS.ROUTE_THROUGH_DRAFT_COMMAND,
      LEGACY_COMPATIBILITY_ACTION_IDS.PRESENT_ONLY,
      LEGACY_COMPATIBILITY_ACTION_IDS.RENAME_PRODUCT_LANGUAGE,
    ],
    productFacing: true,
    canMutateRawLegacyPayload: false,
    deleteAfterNativeStorage: false,
    replacementTarget: 'template seed and intent command components',
  },
  {
    id: 'starter_template_details',
    path: 'client/src/components/policies/PolicyStarterTemplateDetails.vue',
    ownerId: LEGACY_COMPATIBILITY_OWNER_IDS.PRODUCT_COMPONENT_CONSUMER,
    role: 'Product presentation for template details and command events.',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.REMOVED_MARKERS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STRICT_ADVISORY_METADATA,
    ],
    allowedActions: [
      LEGACY_COMPATIBILITY_ACTION_IDS.ROUTE_THROUGH_DRAFT_COMMAND,
      LEGACY_COMPATIBILITY_ACTION_IDS.PRESENT_ONLY,
      LEGACY_COMPATIBILITY_ACTION_IDS.RENAME_PRODUCT_LANGUAGE,
    ],
    productFacing: true,
    canMutateRawLegacyPayload: false,
    deleteAfterNativeStorage: false,
    replacementTarget: 'native template detail component',
  },
  {
    id: 'policy_intent_request_validator',
    path: 'server/src/services/policyIntentRequestValidator.mjs',
    ownerId: LEGACY_COMPATIBILITY_OWNER_IDS.SERVER_VALIDATION,
    role: 'Server allow-list and size validation for intent draft and legacy compatibility snapshots.',
    artifactIds: [
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STRICT_ADVISORY_METADATA,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.COMPATIBILITY_FALLBACK_PROJECTION,
    ],
    allowedActions: [
      LEGACY_COMPATIBILITY_ACTION_IDS.READ_COMPATIBILITY_PAYLOAD,
      LEGACY_COMPATIBILITY_ACTION_IDS.PRESENT_ONLY,
    ],
    productFacing: false,
    canMutateRawLegacyPayload: false,
    deleteAfterNativeStorage: false,
    replacementTarget: 'native intent request validator with conversion support',
  },
]);

const LEGACY_COMPATIBILITY_DELETION_GATES = deepFreeze([
  {
    id: LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA,
    required: true,
    description: 'Native policy intent storage schema exists and is the authoritative write target.',
  },
  {
    id: LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LOSSLESS_CONVERSION,
    required: true,
    description: 'Legacy preset attachments, weights, custom signals, removals, and metadata convert without behavior loss.',
  },
  {
    id: LEGACY_COMPATIBILITY_DELETION_GATE_IDS.ROLLBACK_SNAPSHOT,
    required: true,
    description: 'Pre-conversion legacy payloads are captured for rollback and audit.',
  },
  {
    id: LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_READ_WRITE_PARITY,
    required: true,
    description: 'Native read/write paths pass parity tests against representative legacy policies.',
  },
  {
    id: LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LEGACY_WRITE_SHUTDOWN,
    required: true,
    description: 'Client and server save paths no longer write raw legacy compatibility payloads.',
  },
  {
    id: LEGACY_COMPATIBILITY_DELETION_GATE_IDS.BACKUP_RESTORE_VERIFICATION,
    required: true,
    description: 'Backup and restore flows prove converted policies can be recovered.',
  },
  {
    id: LEGACY_COMPATIBILITY_DELETION_GATE_IDS.REGRESSION_COVERAGE,
    required: true,
    description: 'Regression tests cover existing policies, fresh policies, no-op saves, and conversion rollback.',
  },
]);

function listLegacyCompatibilityArtifacts() {
  return LEGACY_COMPATIBILITY_ARTIFACTS;
}

function getLegacyCompatibilityArtifact(artifactId) {
  return LEGACY_COMPATIBILITY_ARTIFACTS.find(artifact => artifact.id === artifactId) || null;
}

function listLegacyCompatibilityModuleRecords() {
  return LEGACY_COMPATIBILITY_MODULE_RECORDS;
}

function getLegacyCompatibilityModuleRecord(pathOrId) {
  const normalized = normalizePath(pathOrId);

  return LEGACY_COMPATIBILITY_MODULE_RECORDS.find(record => {
    return record.id === pathOrId || normalizePath(record.path) === normalized;
  }) || null;
}

function listLegacyCompatibilityDeletionGates() {
  return LEGACY_COMPATIBILITY_DELETION_GATES;
}

function isLegacyCompatibilityBridgeOwner(pathOrId) {
  const record = getLegacyCompatibilityModuleRecord(pathOrId);
  return record?.ownerId === LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_BRIDGE;
}

function canMutateLegacyPayload(pathOrId) {
  return getLegacyCompatibilityModuleRecord(pathOrId)?.canMutateRawLegacyPayload === true;
}

function summarizeLegacyCompatibilityBoundary() {
  const rawMutationOwnerIds = LEGACY_COMPATIBILITY_MODULE_RECORDS
    .filter(record => record.canMutateRawLegacyPayload)
    .map(record => record.id);

  const productFacingRecordIds = LEGACY_COMPATIBILITY_MODULE_RECORDS
    .filter(record => record.productFacing)
    .map(record => record.id);

  return {
    artifactCount: LEGACY_COMPATIBILITY_ARTIFACTS.length,
    moduleRecordCount: LEGACY_COMPATIBILITY_MODULE_RECORDS.length,
    deletionGateCount: LEGACY_COMPATIBILITY_DELETION_GATES.length,
    rawMutationOwnerIds,
    productFacingRecordIds,
    deleteAfterNativeStorageRecordIds: LEGACY_COMPATIBILITY_MODULE_RECORDS
      .filter(record => record.deleteAfterNativeStorage)
      .map(record => record.id),
  };
}

function validateLegacyCompatibilityModuleRecord(record = {}) {
  const canonicalRecord = getLegacyCompatibilityModuleRecord(record.id || record.path);
  const candidate = {
    ...canonicalRecord,
    ...record,
  };
  const issues = [];

  if (!canonicalRecord) {
    issues.push({
      riskId: LEGACY_COMPATIBILITY_AUDIT_RISK_IDS.UNKNOWN_MODULE,
      moduleId: record.id,
      path: record.path,
      message: 'Legacy compatibility module has no declared ownership record.',
    });
  }

  for (const artifactId of (Array.isArray(candidate.artifactIds) ? candidate.artifactIds : [])) {
    const artifact = getLegacyCompatibilityArtifact(artifactId);

    if (!artifact) {
      issues.push({
        riskId: LEGACY_COMPATIBILITY_AUDIT_RISK_IDS.UNKNOWN_ARTIFACT,
        moduleId: candidate.id,
        artifactId,
        message: 'Module references an unknown legacy compatibility artifact.',
      });
      continue;
    }

    if (!artifact.allowedOwnerIds.includes(candidate.ownerId)) {
      issues.push({
        riskId: LEGACY_COMPATIBILITY_AUDIT_RISK_IDS.DISALLOWED_ARTIFACT_OWNER,
        moduleId: candidate.id,
        artifactId,
        ownerId: candidate.ownerId,
        message: 'Module owner is not allowed to handle this legacy artifact.',
      });
    }
  }

  if (candidate.canMutateRawLegacyPayload === true &&
      candidate.ownerId !== LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_BRIDGE) {
    issues.push({
      riskId: LEGACY_COMPATIBILITY_AUDIT_RISK_IDS.RAW_MUTATION_OUTSIDE_BRIDGE,
      moduleId: candidate.id,
      ownerId: candidate.ownerId,
      message: 'Raw legacy payload mutation must stay inside the draft bridge owner.',
    });
  }

  if (candidate.productFacing === true &&
      Array.isArray(candidate.allowedActions) &&
      candidate.allowedActions.includes(LEGACY_COMPATIBILITY_ACTION_IDS.READ_COMPATIBILITY_PAYLOAD)) {
    issues.push({
      riskId: LEGACY_COMPATIBILITY_AUDIT_RISK_IDS.PRODUCT_FACING_RAW_ACCESS,
      moduleId: candidate.id,
      message: 'Product-facing modules cannot read raw compatibility payloads.',
    });
  }

  return {
    ok: issues.length === 0,
    moduleId: record.id || candidate.id,
    issues,
  };
}

function evaluateLegacyCompatibilityDeletionReadiness(completedGateIds = []) {
  const completed = new Set(Array.isArray(completedGateIds) ? completedGateIds : []);
  const requiredGates = LEGACY_COMPATIBILITY_DELETION_GATES.filter(gate => gate.required);
  const missingGateIds = requiredGates
    .filter(gate => !completed.has(gate.id))
    .map(gate => gate.id);

  return {
    ready: missingGateIds.length === 0,
    requiredGateIds: requiredGates.map(gate => gate.id),
    completedGateIds: [...completed],
    missingGateIds,
  };
}

function buildLegacyCompatibilityBoundaryAudit({
  moduleRecords = LEGACY_COMPATIBILITY_MODULE_RECORDS,
  deletionGates = LEGACY_COMPATIBILITY_DELETION_GATES,
} = {}) {
  const moduleResults = (Array.isArray(moduleRecords) ? moduleRecords : [])
    .map(record => validateLegacyCompatibilityModuleRecord(record));
  const issues = moduleResults.flatMap(result => result.issues);
  const requiredGateIds = Object.values(LEGACY_COMPATIBILITY_DELETION_GATE_IDS);
  const gateIds = new Set((Array.isArray(deletionGates) ? deletionGates : []).map(gate => gate.id));

  requiredGateIds.forEach((gateId) => {
    if (!gateIds.has(gateId)) {
      issues.push({
        riskId: LEGACY_COMPATIBILITY_AUDIT_RISK_IDS.MISSING_DELETION_GATE,
        gateId,
        message: 'Compatibility-removal deletion gate is missing from the compatibility boundary.',
      });
    }
  });

  (Array.isArray(deletionGates) ? deletionGates : []).forEach((gate) => {
    if (gate.required !== true) {
      issues.push({
        riskId: LEGACY_COMPATIBILITY_AUDIT_RISK_IDS.DELETION_GATE_NOT_REQUIRED,
        gateId: gate.id,
        message: 'Every compatibility-removal deletion gate must be required.',
      });
    }
  });

  return {
    ok: issues.length === 0,
    checkedModuleCount: moduleResults.length,
    checkedDeletionGateCount: Array.isArray(deletionGates) ? deletionGates.length : 0,
    moduleResults,
    issues,
  };
}

function validateLegacyCompatibilityTouchpoint({ path, artifactId, operation } = {}) {
  const record = getLegacyCompatibilityModuleRecord(path);
  const artifact = getLegacyCompatibilityArtifact(artifactId);

  if (!record) {
    return {
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.ENGINE_AUTHORITY_CONFUSION,
      reason: 'Unknown module has no declared legacy compatibility ownership.',
    };
  }

  if (!artifact) {
    return {
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.ENGINE_AUTHORITY_CONFUSION,
      reason: 'Unknown legacy compatibility artifact.',
    };
  }

  if (!record.artifactIds.includes(artifact.id)) {
    return {
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.ENGINE_AUTHORITY_CONFUSION,
      reason: 'Module does not own or consume this legacy compatibility artifact.',
    };
  }

  if (!artifact.allowedOwnerIds.includes(record.ownerId)) {
    return {
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.ENGINE_AUTHORITY_CONFUSION,
      reason: 'Module owner is not allowed to handle this artifact.',
    };
  }

  if (operation === LEGACY_COMPATIBILITY_ACTION_IDS.WRITE_RAW_PAYLOAD && !record.canMutateRawLegacyPayload) {
    return {
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.RAW_PAYLOAD_MUTATION,
      reason: 'Raw legacy payload writes must stay inside the draft bridge serializer.',
    };
  }

  if (record.productFacing && operation === LEGACY_COMPATIBILITY_ACTION_IDS.READ_COMPATIBILITY_PAYLOAD) {
    return {
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.PRODUCT_LANGUAGE_LEAK,
      reason: 'Product components should consume product-language projections or route commands, not raw legacy payloads.',
    };
  }

  if (operation && !record.allowedActions.includes(operation)) {
    return {
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.ENGINE_AUTHORITY_CONFUSION,
      reason: 'Operation is not allowed for this module boundary.',
    };
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Legacy compatibility touchpoint stays within the declared boundary.',
  };
}

export {
  LEGACY_COMPATIBILITY_ACTION_IDS,
  LEGACY_COMPATIBILITY_AUDIT_RISK_IDS,
  LEGACY_COMPATIBILITY_ARTIFACT_IDS,
  LEGACY_COMPATIBILITY_DELETION_GATE_IDS,
  LEGACY_COMPATIBILITY_OWNER_IDS,
  LEGACY_COMPATIBILITY_RISK_IDS,
  buildLegacyCompatibilityBoundaryAudit,
  canMutateLegacyPayload,
  evaluateLegacyCompatibilityDeletionReadiness,
  getLegacyCompatibilityArtifact,
  getLegacyCompatibilityModuleRecord,
  isLegacyCompatibilityBridgeOwner,
  listLegacyCompatibilityArtifacts,
  listLegacyCompatibilityDeletionGates,
  listLegacyCompatibilityModuleRecords,
  summarizeLegacyCompatibilityBoundary,
  validateLegacyCompatibilityModuleRecord,
  validateLegacyCompatibilityTouchpoint,
};
