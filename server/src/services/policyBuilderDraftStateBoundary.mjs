const DRAFT_STATE_FIELD_CATEGORIES = Object.freeze({
  DECLARED_INTENT_EDIT: 'declared_intent_edit',
  COMPATIBILITY_PAYLOAD_METADATA: 'compatibility_payload_metadata',
  UI_ONLY_TRANSIENT_STATE: 'ui_only_transient_state',
  SERVER_PROJECTION_DISPLAY: 'server_projection_display',
  SAVE_ALLOWLIST_FIELD: 'save_allowlist_field',
});

const DRAFT_COMMAND_IDS = Object.freeze({
  SYNC_FROM_SELECTED_PRESETS: 'sync_from_selected_presets',
  BUILD_SELECTED_PRESETS_FROM_DRAFT: 'build_selected_presets_from_draft',
  APPLY_DRAFT_TO_SELECTED_PRESETS: 'apply_draft_to_selected_presets',
  ADD_SIGNAL: 'add_signal',
  REMOVE_SIGNAL_VALUE: 'remove_signal_value',
  SET_SIGNAL_CONFIG: 'set_signal_config',
  SET_SIGNAL_METADATA: 'set_signal_metadata',
  SET_SIGNAL_REMOVAL: 'set_signal_removal',
  CLEAR_SIGNAL_CONFIG: 'clear_signal_config',
});

const DRAFT_BOUNDARY_RISK_IDS = Object.freeze({
  MASS_ASSIGNMENT: 'mass_assignment',
  DURABLE_AUTHORITY_CONFUSION: 'durable_authority_confusion',
  LEGACY_PAYLOAD_LEAK: 'legacy_payload_leak',
  UI_STATE_SERIALIZATION: 'ui_state_serialization',
  SERVER_PROJECTION_PERSISTENCE: 'server_projection_persistence',
});

const DRAFT_STATE_OPERATION_IDS = Object.freeze({
  LOAD_OR_RESET_POLICY: 'load_or_reset_policy',
  SET_FORM_FIELD: 'set_form_field',
  TOGGLE_PRESET_SELECTION: 'toggle_preset_selection',
  SET_PRESET_WEIGHT: 'set_preset_weight',
  TOGGLE_PRESET_EXPANSION: 'toggle_preset_expansion',
  DRAFT_SIGNAL_COMMAND: 'draft_signal_command',
  LEGACY_CUSTOM_SIGNAL_ALIAS: 'legacy_custom_signal_alias',
  BUILD_SAVE_PAYLOAD: 'build_save_payload',
});

const DRAFT_BOUNDARY_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_OPERATION: 'unknown_operation',
  UNKNOWN_DRAFT_COMMAND: 'unknown_draft_command',
  DISALLOWED_DRAFT_COMMAND: 'disallowed_draft_command',
  OPERATION_CLAIMS_DURABLE_AUTHORITY: 'operation_claims_durable_authority',
  OPERATION_PERSISTS_UI_STATE: 'operation_persists_ui_state',
  OPERATION_PERSISTS_SERVER_PROJECTION: 'operation_persists_server_projection',
  UNSAFE_SAVE_PAYLOAD: 'unsafe_save_payload',
});

const DRAFT_SAVE_ALLOWLIST_FIELDS = Object.freeze([
  'library_id',
  'name',
  'description',
  'enabled',
  'priority',
  'sort_order',
  'auto_classify_threshold',
  'prompt_threshold',
  'require_ai_validation',
  'trust_patterns',
  'trust_rag',
  'trust_history',
  'preset_weight',
  'profile_weight',
  'pattern_weight',
  'rag_weight',
  'history_weight',
  'combination_mode',
  'presets',
  'policyIntentDraft',
]);

const DRAFT_SAVE_PROHIBITED_FIELDS = Object.freeze([
  'libraryProfile',
  'libraryProfileFreshness',
  'libraryProfileRefreshResult',
  'libraryProfileGenreSummary',
  'availableGenreOptions',
  'availableGenres',
  'availableRatings',
  'suggestedPresets',
  'allPresets',
  'combinedSignals',
  'impactPreview',
  'impactPreviewNotice',
  'impactPreviewChangedBuckets',
  'replayPreview',
  'replayPreviewNotice',
  'replayPreviewSamples',
  'searchQuery',
  'selectedCategory',
  'expandedPresetIds',
  'tmdbLivePreviewOptIn',
  'presetMigrationNotice',
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

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

const DRAFT_STATE_FIELD_RECORDS = deepFreeze([
  {
    path: 'policyIntentDraft.presets[].buckets.identity_signals',
    category: DRAFT_STATE_FIELD_CATEGORIES.DECLARED_INTENT_EDIT,
    owner: 'usePolicyIntentDraft',
    saveBehavior: 'serialized through policyIntentDraft and legacy bridge until native intent storage exists',
    notes: 'Editable destination identity projection; not durable authority until server validation accepts it.',
  },
  {
    path: 'policyIntentDraft.presets[].buckets.compatibility_signals',
    category: DRAFT_STATE_FIELD_CATEGORIES.DECLARED_INTENT_EDIT,
    owner: 'usePolicyIntentDraft',
    saveBehavior: 'serialized through policyIntentDraft and legacy bridge until native intent storage exists',
    notes: 'Supportive evidence projection; cannot decide alone.',
  },
  {
    path: 'policyIntentDraft.presets[].buckets.strict_constraints',
    category: DRAFT_STATE_FIELD_CATEGORIES.DECLARED_INTENT_EDIT,
    owner: 'usePolicyIntentDraft',
    saveBehavior: 'serialized through policyIntentDraft and legacy bridge until native intent storage exists',
    notes: 'Operator-declared blocker projection; server validation remains authoritative.',
  },
  {
    path: 'policyIntentDraft.presets[].buckets.boosters',
    category: DRAFT_STATE_FIELD_CATEGORIES.DECLARED_INTENT_EDIT,
    owner: 'usePolicyIntentDraft',
    saveBehavior: 'serialized through policyIntentDraft and legacy bridge until native intent storage exists',
    notes: 'Confidence-support projection, not policy authority by itself.',
  },
  {
    path: 'policyIntentDraft.presets[].buckets.exclusions',
    category: DRAFT_STATE_FIELD_CATEGORIES.DECLARED_INTENT_EDIT,
    owner: 'usePolicyIntentDraft',
    saveBehavior: 'serialized through policyIntentDraft and legacy bridge until native intent storage exists',
    notes: 'Avoid/exclusion projection, not hard limit unless configured as strict constraint.',
  },
  {
    path: 'policyIntentDraft.presets[].legacyCustomSignals',
    category: DRAFT_STATE_FIELD_CATEGORIES.COMPATIBILITY_PAYLOAD_METADATA,
    owner: 'policyIntentDraftBridge',
    saveBehavior: 'bridge-only rollback/compatibility input',
    notes: 'Raw legacy compatibility state; product components should not mutate it directly.',
  },
  {
    path: 'policyIntentDraft.presets[].runtimeSemantics',
    category: DRAFT_STATE_FIELD_CATEGORIES.COMPATIBILITY_PAYLOAD_METADATA,
    owner: 'policyIntentDraftBridge',
    saveBehavior: 'bridge-only compatibility metadata',
    notes: 'Legacy runtime metadata until Phase 8R native intent storage replaces the bridge.',
  },
  {
    path: 'policyIntentDraft.presets[].signalMetadataOverrides',
    category: DRAFT_STATE_FIELD_CATEGORIES.COMPATIBILITY_PAYLOAD_METADATA,
    owner: 'usePolicyIntentDraft',
    saveBehavior: 'serialized only by draft bridge allow-list',
    notes: 'Metadata override projection for legacy compatibility.',
  },
  {
    path: 'policyIntentDraft.presets[].signalRemovalOverrides',
    category: DRAFT_STATE_FIELD_CATEGORIES.COMPATIBILITY_PAYLOAD_METADATA,
    owner: 'usePolicyIntentDraft',
    saveBehavior: 'serialized only by draft bridge allow-list',
    notes: 'Removed base-signal marker projection for legacy compatibility.',
  },
  {
    path: 'expandedPresetIds',
    category: DRAFT_STATE_FIELD_CATEGORIES.UI_ONLY_TRANSIENT_STATE,
    owner: 'usePolicyBuilderState',
    saveBehavior: 'never serialized',
    notes: 'Pure UI expansion state.',
  },
  {
    path: 'searchQuery',
    category: DRAFT_STATE_FIELD_CATEGORIES.UI_ONLY_TRANSIENT_STATE,
    owner: 'usePolicyBuilderReferenceData',
    saveBehavior: 'never serialized',
    notes: 'Browser/filter state only.',
  },
  {
    path: 'selectedCategory',
    category: DRAFT_STATE_FIELD_CATEGORIES.UI_ONLY_TRANSIENT_STATE,
    owner: 'usePolicyBuilderReferenceData',
    saveBehavior: 'never serialized',
    notes: 'Browser/filter state only.',
  },
  {
    path: 'libraryProfile',
    category: DRAFT_STATE_FIELD_CATEGORIES.SERVER_PROJECTION_DISPLAY,
    owner: 'usePolicyBuilderReferenceData',
    saveBehavior: 'never serialized as policy intent',
    notes: 'Observed evidence display projection; future Phase 6R should own evidence/readiness semantics.',
  },
  {
    path: 'impactPreview',
    category: DRAFT_STATE_FIELD_CATEGORIES.SERVER_PROJECTION_DISPLAY,
    owner: 'usePolicyIntentImpactPreview',
    saveBehavior: 'never serialized as policy intent',
    notes: 'Read-only diagnostic projection pending Phase 6R cutline.',
  },
  {
    path: 'replayPreview',
    category: DRAFT_STATE_FIELD_CATEGORIES.SERVER_PROJECTION_DISPLAY,
    owner: 'usePolicyIntentReplayPreview',
    saveBehavior: 'never serialized as policy intent',
    notes: 'Read-only diagnostic projection pending Phase 6R cutline.',
  },
]);

const DRAFT_COMMAND_RECORDS = deepFreeze([
  {
    id: DRAFT_COMMAND_IDS.SYNC_FROM_SELECTED_PRESETS,
    owner: 'usePolicyIntentDraft',
    allowed: true,
    touchesLegacyPayload: false,
    mutatesSelectedPresets: false,
    notes: 'Rebuilds editable draft projection from selected preset input.',
  },
  {
    id: DRAFT_COMMAND_IDS.BUILD_SELECTED_PRESETS_FROM_DRAFT,
    owner: 'usePolicyIntentDraft',
    allowed: true,
    touchesLegacyPayload: true,
    mutatesSelectedPresets: false,
    notes: 'Builds legacy-compatible selected preset output without mutating current state.',
  },
  {
    id: DRAFT_COMMAND_IDS.APPLY_DRAFT_TO_SELECTED_PRESETS,
    owner: 'usePolicyIntentDraft',
    allowed: true,
    touchesLegacyPayload: true,
    mutatesSelectedPresets: true,
    notes: 'Applies bridge output to selected presets; should stay contained in draft/bridge boundary.',
  },
  {
    id: DRAFT_COMMAND_IDS.ADD_SIGNAL,
    owner: 'usePolicyIntentDraft',
    allowed: true,
    touchesLegacyPayload: true,
    mutatesSelectedPresets: true,
    notes: 'Adds one allow-listed signal value and serializes through bridge output.',
  },
  {
    id: DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
    owner: 'usePolicyIntentDraft',
    allowed: true,
    touchesLegacyPayload: true,
    mutatesSelectedPresets: true,
    notes: 'Removes one allow-listed signal value and cleans empty configs.',
  },
  {
    id: DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
    owner: 'usePolicyIntentDraft',
    allowed: true,
    touchesLegacyPayload: true,
    mutatesSelectedPresets: true,
    notes: 'Sets one signal config through allow-listed draft value and metadata keys.',
  },
  {
    id: DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
    owner: 'usePolicyIntentDraft',
    allowed: true,
    touchesLegacyPayload: true,
    mutatesSelectedPresets: true,
    notes: 'Sets metadata override keys through bridge ownership.',
  },
  {
    id: DRAFT_COMMAND_IDS.SET_SIGNAL_REMOVAL,
    owner: 'usePolicyIntentDraft',
    allowed: true,
    touchesLegacyPayload: true,
    mutatesSelectedPresets: true,
    notes: 'Sets removed base-signal markers through bridge ownership.',
  },
  {
    id: DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
    owner: 'usePolicyIntentDraft',
    allowed: true,
    touchesLegacyPayload: true,
    mutatesSelectedPresets: true,
    notes: 'Clears one signal type without dropping unsupported custom fields.',
  },
]);

const DRAFT_STATE_OPERATION_RECORDS = deepFreeze([
  {
    id: DRAFT_STATE_OPERATION_IDS.LOAD_OR_RESET_POLICY,
    owner: 'usePolicyBuilderState',
    category: DRAFT_STATE_FIELD_CATEGORIES.UI_ONLY_TRANSIENT_STATE,
    allowedCommandIds: [
      DRAFT_COMMAND_IDS.SYNC_FROM_SELECTED_PRESETS,
    ],
    canBuildSavePayload: false,
    touchesLegacyPayload: false,
    mutatesUiOnlyState: true,
    persistsUiOnlyState: false,
    persistsServerProjection: false,
    claimsDurableAuthority: false,
    notes: 'Loads form, selected presets, and expansion defaults from policy or library props.',
  },
  {
    id: DRAFT_STATE_OPERATION_IDS.SET_FORM_FIELD,
    owner: 'usePolicyBuilderState',
    category: DRAFT_STATE_FIELD_CATEGORIES.DECLARED_INTENT_EDIT,
    allowedCommandIds: [],
    canBuildSavePayload: false,
    touchesLegacyPayload: false,
    mutatesUiOnlyState: false,
    persistsUiOnlyState: false,
    persistsServerProjection: false,
    claimsDurableAuthority: false,
    notes: 'Updates allow-listed policy form fields through field normalization.',
  },
  {
    id: DRAFT_STATE_OPERATION_IDS.TOGGLE_PRESET_SELECTION,
    owner: 'usePolicyBuilderState',
    category: DRAFT_STATE_FIELD_CATEGORIES.COMPATIBILITY_PAYLOAD_METADATA,
    allowedCommandIds: [
      DRAFT_COMMAND_IDS.SYNC_FROM_SELECTED_PRESETS,
    ],
    canBuildSavePayload: false,
    touchesLegacyPayload: true,
    mutatesUiOnlyState: true,
    persistsUiOnlyState: false,
    persistsServerProjection: false,
    claimsDurableAuthority: false,
    notes: 'Maintains current starter-template selection while draft state remains a projection.',
  },
  {
    id: DRAFT_STATE_OPERATION_IDS.SET_PRESET_WEIGHT,
    owner: 'usePolicyBuilderState',
    category: DRAFT_STATE_FIELD_CATEGORIES.COMPATIBILITY_PAYLOAD_METADATA,
    allowedCommandIds: [],
    canBuildSavePayload: false,
    touchesLegacyPayload: true,
    mutatesUiOnlyState: false,
    persistsUiOnlyState: false,
    persistsServerProjection: false,
    claimsDurableAuthority: false,
    notes: 'Updates legacy starter-template weight metadata until native intent storage replaces it.',
  },
  {
    id: DRAFT_STATE_OPERATION_IDS.TOGGLE_PRESET_EXPANSION,
    owner: 'usePolicyBuilderState',
    category: DRAFT_STATE_FIELD_CATEGORIES.UI_ONLY_TRANSIENT_STATE,
    allowedCommandIds: [],
    canBuildSavePayload: false,
    touchesLegacyPayload: false,
    mutatesUiOnlyState: true,
    persistsUiOnlyState: false,
    persistsServerProjection: false,
    claimsDurableAuthority: false,
    notes: 'Changes UI expansion state only.',
  },
  {
    id: DRAFT_STATE_OPERATION_IDS.DRAFT_SIGNAL_COMMAND,
    owner: 'usePolicyIntentDraft',
    category: DRAFT_STATE_FIELD_CATEGORIES.DECLARED_INTENT_EDIT,
    allowedCommandIds: [
      DRAFT_COMMAND_IDS.ADD_SIGNAL,
      DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
      DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
      DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
      DRAFT_COMMAND_IDS.SET_SIGNAL_REMOVAL,
      DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
      DRAFT_COMMAND_IDS.APPLY_DRAFT_TO_SELECTED_PRESETS,
    ],
    canBuildSavePayload: false,
    touchesLegacyPayload: true,
    mutatesUiOnlyState: false,
    persistsUiOnlyState: false,
    persistsServerProjection: false,
    claimsDurableAuthority: false,
    notes: 'Edits declared-intent projection and synchronizes bridge output to selected presets.',
  },
  {
    id: DRAFT_STATE_OPERATION_IDS.LEGACY_CUSTOM_SIGNAL_ALIAS,
    owner: 'usePolicyBuilderState',
    category: DRAFT_STATE_FIELD_CATEGORIES.COMPATIBILITY_PAYLOAD_METADATA,
    allowedCommandIds: [
      DRAFT_COMMAND_IDS.ADD_SIGNAL,
      DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
    ],
    canBuildSavePayload: false,
    touchesLegacyPayload: true,
    mutatesUiOnlyState: false,
    persistsUiOnlyState: false,
    persistsServerProjection: false,
    claimsDurableAuthority: false,
    notes: 'Temporary alias for old custom-signal events; Phase 1R.5 and Phase 2R keep bridge ownership explicit.',
  },
  {
    id: DRAFT_STATE_OPERATION_IDS.BUILD_SAVE_PAYLOAD,
    owner: 'usePolicyBuilderState',
    category: DRAFT_STATE_FIELD_CATEGORIES.SAVE_ALLOWLIST_FIELD,
    allowedCommandIds: [
      DRAFT_COMMAND_IDS.BUILD_SELECTED_PRESETS_FROM_DRAFT,
    ],
    canBuildSavePayload: true,
    touchesLegacyPayload: true,
    mutatesUiOnlyState: false,
    persistsUiOnlyState: false,
    persistsServerProjection: false,
    claimsDurableAuthority: false,
    notes: 'Builds compatibility save payload from allow-listed form fields, selected presets, and cloned draft output.',
  },
]);

function listDraftStateFieldRecords() {
  return DRAFT_STATE_FIELD_RECORDS;
}

function getDraftStateFieldRecord(fieldPath) {
  return DRAFT_STATE_FIELD_RECORDS.find(record => record.path === fieldPath) || null;
}

function listDraftCommandRecords() {
  return DRAFT_COMMAND_RECORDS;
}

function getDraftCommandRecord(commandId) {
  return DRAFT_COMMAND_RECORDS.find(record => record.id === commandId) || null;
}

function isDraftCommandAllowed(commandId) {
  return getDraftCommandRecord(commandId)?.allowed === true;
}

function listDraftStateOperationRecords() {
  return DRAFT_STATE_OPERATION_RECORDS;
}

function getDraftStateOperationRecord(operationId) {
  return DRAFT_STATE_OPERATION_RECORDS.find(record => record.id === operationId) || null;
}

function listDraftSaveAllowlistFields() {
  return DRAFT_SAVE_ALLOWLIST_FIELDS;
}

function listDraftSaveProhibitedFields() {
  return DRAFT_SAVE_PROHIBITED_FIELDS;
}

function classifyDraftStateField(fieldPath) {
  return getDraftStateFieldRecord(fieldPath)?.category || null;
}

function validatePolicyBuilderSavePayloadBoundary(payload = {}) {
  const value = asObject(payload);
  const keys = Object.keys(value);
  const prohibitedFields = keys.filter(key => DRAFT_SAVE_PROHIBITED_FIELDS.includes(key));
  const unknownFields = keys.filter(key => (
    !DRAFT_SAVE_ALLOWLIST_FIELDS.includes(key) &&
    !DRAFT_SAVE_PROHIBITED_FIELDS.includes(key)
  ));

  return {
    valid: prohibitedFields.length === 0 && unknownFields.length === 0,
    allowedFields: keys.filter(key => DRAFT_SAVE_ALLOWLIST_FIELDS.includes(key)),
    prohibitedFields,
    unknownFields,
  };
}

function validateDraftStateOperation(operation = {}) {
  const record = getDraftStateOperationRecord(operation.id);
  const candidate = {
    ...record,
    ...asObject(operation),
  };
  const issues = [];

  if (!record) {
    issues.push({
      riskId: DRAFT_BOUNDARY_AUDIT_RISK_IDS.UNKNOWN_OPERATION,
      operationId: operation.id,
      message: 'Draft state operation is not part of the Phase 1R.3 boundary contract.',
    });
  }

  for (const commandId of (Array.isArray(candidate.allowedCommandIds) ? candidate.allowedCommandIds : [])) {
    const command = getDraftCommandRecord(commandId);
    if (!command) {
      issues.push({
        riskId: DRAFT_BOUNDARY_AUDIT_RISK_IDS.UNKNOWN_DRAFT_COMMAND,
        operationId: operation.id,
        commandId,
        message: 'Draft state operation references an unknown draft command.',
      });
    } else if (command.allowed !== true) {
      issues.push({
        riskId: DRAFT_BOUNDARY_AUDIT_RISK_IDS.DISALLOWED_DRAFT_COMMAND,
        operationId: operation.id,
        commandId,
        message: 'Draft state operation references a disallowed draft command.',
      });
    }
  }

  if (candidate.claimsDurableAuthority === true) {
    issues.push({
      riskId: DRAFT_BOUNDARY_AUDIT_RISK_IDS.OPERATION_CLAIMS_DURABLE_AUTHORITY,
      operationId: operation.id,
      message: 'Client draft operations cannot claim durable policy authority.',
    });
  }

  if (candidate.persistsUiOnlyState === true) {
    issues.push({
      riskId: DRAFT_BOUNDARY_AUDIT_RISK_IDS.OPERATION_PERSISTS_UI_STATE,
      operationId: operation.id,
      message: 'Client draft operations cannot persist UI-only state.',
    });
  }

  if (candidate.persistsServerProjection === true) {
    issues.push({
      riskId: DRAFT_BOUNDARY_AUDIT_RISK_IDS.OPERATION_PERSISTS_SERVER_PROJECTION,
      operationId: operation.id,
      message: 'Client draft operations cannot persist server-projection display state.',
    });
  }

  if (candidate.payload) {
    const payloadResult = validatePolicyBuilderSavePayloadBoundary(candidate.payload);
    if (!payloadResult.valid) {
      issues.push({
        riskId: DRAFT_BOUNDARY_AUDIT_RISK_IDS.UNSAFE_SAVE_PAYLOAD,
        operationId: operation.id,
        payloadResult,
        message: 'Draft state operation payload violates the save allow-list boundary.',
      });
    }
  }

  return {
    ok: issues.length === 0,
    operationId: operation.id,
    issues,
  };
}

function buildDraftStateBoundaryAudit(operations = DRAFT_STATE_OPERATION_RECORDS) {
  const operationResults = (Array.isArray(operations) ? operations : [])
    .map(operation => validateDraftStateOperation(operation));
  const issues = operationResults.flatMap(result => result.issues);

  return {
    ok: issues.length === 0,
    checkedOperationCount: operationResults.length,
    operationResults,
    issues,
  };
}

function buildDraftBoundarySummary() {
  return {
    draftIsDurableAuthority: false,
    serverValidationRequired: true,
    nativeIntentPersistenceEnabled: false,
    allowlistFieldCount: DRAFT_SAVE_ALLOWLIST_FIELDS.length,
    prohibitedFieldCount: DRAFT_SAVE_PROHIBITED_FIELDS.length,
    commandIds: DRAFT_COMMAND_RECORDS.map(record => record.id),
    operationIds: DRAFT_STATE_OPERATION_RECORDS.map(record => record.id),
    fieldCategories: Object.values(DRAFT_STATE_FIELD_CATEGORIES),
    riskIds: Object.values(DRAFT_BOUNDARY_RISK_IDS),
  };
}

export {
  DRAFT_BOUNDARY_AUDIT_RISK_IDS,
  DRAFT_BOUNDARY_RISK_IDS,
  DRAFT_COMMAND_IDS,
  DRAFT_SAVE_ALLOWLIST_FIELDS,
  DRAFT_SAVE_PROHIBITED_FIELDS,
  DRAFT_STATE_OPERATION_IDS,
  DRAFT_STATE_FIELD_CATEGORIES,
  buildDraftBoundarySummary,
  buildDraftStateBoundaryAudit,
  classifyDraftStateField,
  getDraftCommandRecord,
  getDraftStateOperationRecord,
  getDraftStateFieldRecord,
  isDraftCommandAllowed,
  listDraftCommandRecords,
  listDraftSaveAllowlistFields,
  listDraftSaveProhibitedFields,
  listDraftStateOperationRecords,
  listDraftStateFieldRecords,
  validateDraftStateOperation,
  validatePolicyBuilderSavePayloadBoundary,
};
