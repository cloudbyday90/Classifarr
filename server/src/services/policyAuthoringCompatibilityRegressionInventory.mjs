const POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS = Object.freeze({
  LEGACY_NO_OP_COMPATIBILITY: 'legacy_no_op_parity',
  DRAFT_COMMAND_BOUNDARY: 'draft_command_boundary',
  BRIDGE_SERIALIZATION_ALLOWLIST: 'bridge_serialization_allowlist',
  DRAFT_VIEW_PROJECTION: 'draft_view_projection',
  PROVENANCE_COMPATIBILITY: 'provenance_parity',
  UI_STATE_SERIALIZATION_GUARD: 'ui_state_serialization_guard',
  SERVER_AUTHORITY_PREFLIGHT: 'server_authority_preflight',
  DIAGNOSTIC_SURFACE_TRANSITION_CANDIDATE: 'rewrite_or_delete_candidate',
});

const POLICY_AUTHORING_COMPATIBILITY_RULE_IDS = Object.freeze({
  NO_OP_LEGACY_SAVE_PRESERVES_PAYLOADS: 'no_op_legacy_save_preserves_payloads',
  PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS: 'product_components_emit_typed_commands',
  COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS: 'commands_cannot_mutate_read_only_projections',
  BRIDGE_SERIALIZATION_IS_ALLOWLISTED: 'bridge_serialization_is_allowlisted',
  DRAFT_VIEW_HIDES_RAW_LEGACY_STORAGE: 'draft_view_hides_raw_legacy_storage',
  PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION: 'provenance_preserved_across_projection_and_serialization',
  UI_ONLY_TRANSIENT_FIELDS_DO_NOT_SERIALIZE: 'ui_only_transient_fields_do_not_serialize',
  CLIENT_DRAFT_IS_NOT_DURABLE_AUTHORITY: 'client_draft_is_not_durable_authority',
  OLD_DIAGNOSTIC_UI_IS_NOT_FROZEN: 'old_diagnostic_ui_is_not_frozen',
});

const POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS = Object.freeze({
  KEEP: 'keep',
  ADD_OR_UPDATE_BOUNDARY_ASSERTION: 'add_or_update_boundary_assertion',
  REWRITE_FOR_POLICY_ENGINE: 'rewrite_for_policy_engine',
  REMOVE_AFTER_NATIVE_STORAGE_CUTOVER: 'remove_after_native_storage_cutover',
});

const POLICY_AUTHORING_COMPATIBILITY_RISK_IDS = Object.freeze({
  MISSING_RULE_COVERAGE: 'missing_rule_coverage',
  CLIENT_AUTHORITY_CONFUSION: 'client_authority_confusion',
  RAW_LEGACY_STORAGE_EXPOSURE: 'raw_legacy_storage_exposure',
  READ_ONLY_PROJECTION_MUTATION: 'read_only_projection_mutation',
  UI_STATE_SERIALIZATION: 'ui_state_serialization',
  TRANSITIONAL_UI_FROZEN: 'transitional_ui_frozen',
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

const POLICY_AUTHORING_COMPATIBILITY_REQUIRED_RULE_IDS = deepFreeze([
  POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.NO_OP_LEGACY_SAVE_PRESERVES_PAYLOADS,
  POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
  POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS,
  POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.BRIDGE_SERIALIZATION_IS_ALLOWLISTED,
  POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.DRAFT_VIEW_HIDES_RAW_LEGACY_STORAGE,
  POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
  POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.UI_ONLY_TRANSIENT_FIELDS_DO_NOT_SERIALIZE,
  POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.CLIENT_DRAFT_IS_NOT_DURABLE_AUTHORITY,
]);

const POLICY_AUTHORING_COMPATIBILITY_TEST_RECORDS = deepFreeze([
  {
    path: 'client/src/__tests__/utils/policyIntentDraftBridge.test.js',
    categoryId: POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.LEGACY_NO_OP_COMPATIBILITY,
    actionId: POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.NO_OP_LEGACY_SAVE_PRESERVES_PAYLOADS,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.BRIDGE_SERIALIZATION_IS_ALLOWLISTED,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
    ],
    freezesLegacyUi: false,
    notes: 'Protects the compatibility bridge and no-op legacy payload round trips until native intent storage replaces it.',
  },
  {
    path: 'client/src/__tests__/composables/usePolicyBuilderState.test.js',
    categoryId: POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.UI_STATE_SERIALIZATION_GUARD,
    actionId: POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.ADD_OR_UPDATE_BOUNDARY_ASSERTION,
    coveredRuleIds: [
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.NO_OP_LEGACY_SAVE_PRESERVES_PAYLOADS,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.UI_ONLY_TRANSIENT_FIELDS_DO_NOT_SERIALIZE,
    ],
    freezesLegacyUi: false,
    notes: 'Protects client save payload assembly with an explicit form allow-list before server validation runs.',
  },
  {
    path: 'client/src/__tests__/composables/usePolicyIntentDraft.test.js',
    categoryId: POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.DRAFT_COMMAND_BOUNDARY,
    actionId: POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS,
    ],
    freezesLegacyUi: false,
    notes: 'Protects product-level draft mutations through bounded commands instead of direct projection edits.',
  },
  {
    path: 'client/src/__tests__/PolicyBuilderDestinationQuestions.test.js',
    categoryId: POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.DRAFT_COMMAND_BOUNDARY,
    actionId: POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS,
    ],
    freezesLegacyUi: false,
    notes: 'Protects accessible server-bound destination selection, typed purpose commands, duplicate rejection, and declared-signal removal without compatibility policy context.',
  },
  {
    path: 'client/src/__tests__/PolicyIntentConstraintControlSurface.test.js',
    categoryId: POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.DRAFT_COMMAND_BOUNDARY,
    actionId: POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS,
    ],
    freezesLegacyUi: false,
    notes: 'Protects server-projected hard-limit, avoid, and review commands from falling back to legacy certification configuration events.',
  },
  {
    path: 'client/src/__tests__/ReviewTriggerControl.test.js',
    categoryId: POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.DRAFT_COMMAND_BOUNDARY,
    actionId: POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
    ],
    freezesLegacyUi: false,
    notes: 'Protects the native non-blocking review command plan and rejects the compatibility editor event boundary.',
  },
  {
    path: 'client/src/__tests__/utils/policyIntentDraftView.test.js',
    categoryId: POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.DRAFT_VIEW_PROJECTION,
    actionId: POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.DRAFT_VIEW_HIDES_RAW_LEGACY_STORAGE,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
    ],
    freezesLegacyUi: false,
    notes: 'Protects the read-only draft view model consumed by product components.',
  },
  {
    path: 'client/src/__tests__/PolicyIntentChip.test.js',
    categoryId: POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.PROVENANCE_COMPATIBILITY,
    actionId: POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
    ],
    freezesLegacyUi: false,
    notes: 'Keeps provenance rendering tied to view-provided labels instead of raw source fields.',
  },
  {
    path: 'server/src/__tests__/services/policyBuilderDraftStateBoundary.test.mjs',
    categoryId: POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.UI_STATE_SERIALIZATION_GUARD,
    actionId: POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.UI_ONLY_TRANSIENT_FIELDS_DO_NOT_SERIALIZE,
    ],
    freezesLegacyUi: false,
    notes: 'Protects server-side payload rejection for UI-only and server-projection fields.',
  },
  {
    path: 'server/src/__tests__/services/policyAuthoringLegacyBridgeBoundary.test.mjs',
    categoryId: POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.BRIDGE_SERIALIZATION_ALLOWLIST,
    actionId: POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.NO_OP_LEGACY_SAVE_PRESERVES_PAYLOADS,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.BRIDGE_SERIALIZATION_IS_ALLOWLISTED,
    ],
    freezesLegacyUi: false,
    notes: 'Protects legacy bridge ownership and serialized-key allow-lists.',
  },
  {
    path: 'server/src/__tests__/services/policyAuthoringDraftCommandBoundary.test.mjs',
    categoryId: POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.DRAFT_COMMAND_BOUNDARY,
    actionId: POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.BRIDGE_SERIALIZATION_IS_ALLOWLISTED,
    ],
    freezesLegacyUi: false,
    notes: 'Protects command IDs, payload validation, and read-only projection mutation rejection.',
  },
  {
    path: 'server/src/__tests__/services/policyAuthoringDraftViewProjection.test.mjs',
    categoryId: POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.DRAFT_VIEW_PROJECTION,
    actionId: POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.DRAFT_VIEW_HIDES_RAW_LEGACY_STORAGE,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
    ],
    freezesLegacyUi: false,
    notes: 'Protects server-side projection fields and raw legacy storage exposure checks.',
  },
  {
    path: 'server/src/__tests__/services/policyIntentAuthorityContract.test.mjs',
    categoryId: POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.SERVER_AUTHORITY_PREFLIGHT,
    actionId: POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.CLIENT_DRAFT_IS_NOT_DURABLE_AUTHORITY,
    ],
    freezesLegacyUi: false,
    notes: 'Protects server-owned intent authority, bounded observed-evidence references, and the read-only compatibility bridge after native storage activation.',
  },
  {
    path: 'server/src/__tests__/services/policyIntentRequestValidator.test.mjs',
    categoryId: POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.SERVER_AUTHORITY_PREFLIGHT,
    actionId: POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.CLIENT_DRAFT_IS_NOT_DURABLE_AUTHORITY,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.BRIDGE_SERIALIZATION_IS_ALLOWLISTED,
    ],
    freezesLegacyUi: false,
    notes: 'Protects authoritative request-shape validation before persistence.',
  },
]);

function listPolicyAuthoringCompatibilityTestRecords() {
  return POLICY_AUTHORING_COMPATIBILITY_TEST_RECORDS;
}

function getPolicyAuthoringCompatibilityTestRecord(path) {
  return POLICY_AUTHORING_COMPATIBILITY_TEST_RECORDS.find(record => record.path === path) || null;
}

function listPolicyAuthoringCompatibilityTestRecordsByCategory(categoryId) {
  return POLICY_AUTHORING_COMPATIBILITY_TEST_RECORDS.filter(record => record.categoryId === categoryId);
}

function listPolicyAuthoringCompatibilityRequiredRuleIds() {
  return POLICY_AUTHORING_COMPATIBILITY_REQUIRED_RULE_IDS;
}

function listPolicyAuthoringCompatibilityTransitionCandidates() {
  return POLICY_AUTHORING_COMPATIBILITY_TEST_RECORDS.filter(record =>
    record.categoryId === POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.DIAGNOSTIC_SURFACE_TRANSITION_CANDIDATE);
}

function summarizePolicyAuthoringCompatibilityRegressionCoverage() {
  const countsByCategory = POLICY_AUTHORING_COMPATIBILITY_TEST_RECORDS.reduce((counts, record) => {
    counts[record.categoryId] = (counts[record.categoryId] || 0) + 1;
    return counts;
  }, {});

  const coveredRuleIds = Array.from(new Set(
    POLICY_AUTHORING_COMPATIBILITY_TEST_RECORDS.flatMap(record => record.coveredRuleIds)
  )).sort();
  const uncoveredRequiredRuleIds = POLICY_AUTHORING_COMPATIBILITY_REQUIRED_RULE_IDS
    .filter(ruleId => !coveredRuleIds.includes(ruleId));
  const legacyLayoutFreezeRecordPaths = POLICY_AUTHORING_COMPATIBILITY_TEST_RECORDS
    .filter(record => record.freezesLegacyUi)
    .map(record => record.path);

  return {
    recordCount: POLICY_AUTHORING_COMPATIBILITY_TEST_RECORDS.length,
    requiredRuleCount: POLICY_AUTHORING_COMPATIBILITY_REQUIRED_RULE_IDS.length,
    countsByCategory,
    coveredRuleIds,
    uncoveredRequiredRuleIds,
    transitionCandidateCount: listPolicyAuthoringCompatibilityTransitionCandidates().length,
    legacyLayoutFreezeRecordPaths,
    clientDraftAuthoritative: false,
    nativeIntentStorageEnabled: true,
    policyAuthoringCompatibilityReady:
      uncoveredRequiredRuleIds.length === 0 && legacyLayoutFreezeRecordPaths.length === 0,
  };
}

function validatePolicyAuthoringCompatibilityRule(ruleId) {
  if (!POLICY_AUTHORING_COMPATIBILITY_REQUIRED_RULE_IDS.includes(ruleId)) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_COMPATIBILITY_RISK_IDS.MISSING_RULE_COVERAGE,
      evidence: {
        reason: 'Unknown or non-required policy authoring compatibility rule.',
      },
    };
  }

  const records = POLICY_AUTHORING_COMPATIBILITY_TEST_RECORDS.filter(record =>
    record.coveredRuleIds.includes(ruleId));

  if (records.length === 0) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_COMPATIBILITY_RISK_IDS.MISSING_RULE_COVERAGE,
      evidence: {
        reason: 'No test record covers the required policy authoring compatibility rule.',
      },
    };
  }

  return {
    valid: true,
    riskId: null,
    evidence: {
      recordPaths: records.map(record => record.path),
      reason: 'Required policy authoring compatibility rule has regression coverage.',
    },
  };
}

function validatePolicyAuthoringCompatibilityRegressionInventory() {
  const summary = summarizePolicyAuthoringCompatibilityRegressionCoverage();

  if (summary.uncoveredRequiredRuleIds.length > 0) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_COMPATIBILITY_RISK_IDS.MISSING_RULE_COVERAGE,
      summary,
    };
  }

  if (summary.legacyLayoutFreezeRecordPaths.length > 0) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_COMPATIBILITY_RISK_IDS.TRANSITIONAL_UI_FROZEN,
      summary,
    };
  }

  return {
    valid: true,
    riskId: null,
    summary,
  };
}

export {
  POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS,
  POLICY_AUTHORING_COMPATIBILITY_RISK_IDS,
  POLICY_AUTHORING_COMPATIBILITY_RULE_IDS,
  POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS,
  getPolicyAuthoringCompatibilityTestRecord,
  listPolicyAuthoringCompatibilityTransitionCandidates,
  listPolicyAuthoringCompatibilityTestRecords,
  listPolicyAuthoringCompatibilityTestRecordsByCategory,
  listPolicyAuthoringCompatibilityRequiredRuleIds,
  summarizePolicyAuthoringCompatibilityRegressionCoverage,
  validatePolicyAuthoringCompatibilityRegressionInventory,
  validatePolicyAuthoringCompatibilityRule,
};
