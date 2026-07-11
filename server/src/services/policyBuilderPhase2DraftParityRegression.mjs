const PHASE_2R_PARITY_TEST_CATEGORY_IDS = Object.freeze({
  LEGACY_NO_OP_PARITY: 'legacy_no_op_parity',
  DRAFT_COMMAND_BOUNDARY: 'draft_command_boundary',
  BRIDGE_SERIALIZATION_ALLOWLIST: 'bridge_serialization_allowlist',
  DRAFT_VIEW_PROJECTION: 'draft_view_projection',
  PROVENANCE_PARITY: 'provenance_parity',
  UI_STATE_SERIALIZATION_GUARD: 'ui_state_serialization_guard',
  SERVER_AUTHORITY_PRELIGHT: 'server_authority_preflight',
  REWRITE_OR_DELETE_CANDIDATE: 'rewrite_or_delete_candidate',
});

const PHASE_2R_PARITY_RULE_IDS = Object.freeze({
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

const PHASE_2R_PARITY_ACTION_IDS = Object.freeze({
  KEEP: 'keep',
  ADD_OR_UPDATE_BOUNDARY_ASSERTION: 'add_or_update_boundary_assertion',
  REWRITE_IN_PHASE_6R: 'rewrite_in_phase_6r',
  DELETE_AFTER_PHASE_8R_CUTLINE: 'delete_after_phase_8r_cutline',
});

const PHASE_2R_PARITY_RISK_IDS = Object.freeze({
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

const PHASE_2R_REQUIRED_PARITY_RULE_IDS = deepFreeze([
  PHASE_2R_PARITY_RULE_IDS.NO_OP_LEGACY_SAVE_PRESERVES_PAYLOADS,
  PHASE_2R_PARITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
  PHASE_2R_PARITY_RULE_IDS.COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS,
  PHASE_2R_PARITY_RULE_IDS.BRIDGE_SERIALIZATION_IS_ALLOWLISTED,
  PHASE_2R_PARITY_RULE_IDS.DRAFT_VIEW_HIDES_RAW_LEGACY_STORAGE,
  PHASE_2R_PARITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
  PHASE_2R_PARITY_RULE_IDS.UI_ONLY_TRANSIENT_FIELDS_DO_NOT_SERIALIZE,
  PHASE_2R_PARITY_RULE_IDS.CLIENT_DRAFT_IS_NOT_DURABLE_AUTHORITY,
]);

const PHASE_2R_PARITY_TEST_RECORDS = deepFreeze([
  {
    path: 'client/src/__tests__/utils/policyIntentDraftBridge.test.js',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.LEGACY_NO_OP_PARITY,
    actionId: PHASE_2R_PARITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.NO_OP_LEGACY_SAVE_PRESERVES_PAYLOADS,
      PHASE_2R_PARITY_RULE_IDS.BRIDGE_SERIALIZATION_IS_ALLOWLISTED,
      PHASE_2R_PARITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
    ],
    freezesLegacyUi: false,
    notes: 'Protects the compatibility bridge and no-op legacy payload round trips until native intent storage replaces it.',
  },
  {
    path: 'client/src/__tests__/composables/usePolicyBuilderState.test.js',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.UI_STATE_SERIALIZATION_GUARD,
    actionId: PHASE_2R_PARITY_ACTION_IDS.ADD_OR_UPDATE_BOUNDARY_ASSERTION,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.NO_OP_LEGACY_SAVE_PRESERVES_PAYLOADS,
      PHASE_2R_PARITY_RULE_IDS.UI_ONLY_TRANSIENT_FIELDS_DO_NOT_SERIALIZE,
    ],
    freezesLegacyUi: false,
    notes: 'Protects client save payload assembly with an explicit form allow-list before server validation runs.',
  },
  {
    path: 'client/src/__tests__/composables/usePolicyIntentDraft.test.js',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.DRAFT_COMMAND_BOUNDARY,
    actionId: PHASE_2R_PARITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
      PHASE_2R_PARITY_RULE_IDS.COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS,
    ],
    freezesLegacyUi: false,
    notes: 'Protects product-level draft mutations through bounded commands instead of direct projection edits.',
  },
  {
    path: 'client/src/__tests__/PolicyIntentEditor.test.js',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.DRAFT_COMMAND_BOUNDARY,
    actionId: PHASE_2R_PARITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
    ],
    freezesLegacyUi: false,
    notes: 'Keeps editor interaction coverage focused on emitted command payloads, not raw bridge storage.',
  },
  {
    path: 'client/src/__tests__/PolicyIntentEditorParity.test.js',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.DRAFT_COMMAND_BOUNDARY,
    actionId: PHASE_2R_PARITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
      PHASE_2R_PARITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
    ],
    freezesLegacyUi: false,
    notes: 'Protects editor parity through command and provenance behavior rather than visual snapshots.',
  },
  {
    path: 'client/src/__tests__/utils/policyIntentDraftView.test.js',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.DRAFT_VIEW_PROJECTION,
    actionId: PHASE_2R_PARITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.DRAFT_VIEW_HIDES_RAW_LEGACY_STORAGE,
      PHASE_2R_PARITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
    ],
    freezesLegacyUi: false,
    notes: 'Protects the read-only draft view model consumed by product components.',
  },
  {
    path: 'client/src/__tests__/PolicyIntentChip.test.js',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.PROVENANCE_PARITY,
    actionId: PHASE_2R_PARITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
    ],
    freezesLegacyUi: false,
    notes: 'Keeps provenance rendering tied to view-provided labels instead of raw source fields.',
  },
  {
    path: 'server/src/__tests__/services/policyBuilderDraftStateBoundary.test.mjs',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.UI_STATE_SERIALIZATION_GUARD,
    actionId: PHASE_2R_PARITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.UI_ONLY_TRANSIENT_FIELDS_DO_NOT_SERIALIZE,
    ],
    freezesLegacyUi: false,
    notes: 'Protects server-side payload rejection for UI-only and server-projection fields.',
  },
  {
    path: 'server/src/__tests__/services/policyBuilderPhase2LegacyBridgeIsolation.test.mjs',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.BRIDGE_SERIALIZATION_ALLOWLIST,
    actionId: PHASE_2R_PARITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.NO_OP_LEGACY_SAVE_PRESERVES_PAYLOADS,
      PHASE_2R_PARITY_RULE_IDS.BRIDGE_SERIALIZATION_IS_ALLOWLISTED,
    ],
    freezesLegacyUi: false,
    notes: 'Protects legacy bridge ownership and serialized-key allow-lists.',
  },
  {
    path: 'server/src/__tests__/services/policyAuthoringDraftCommandBoundary.test.mjs',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.DRAFT_COMMAND_BOUNDARY,
    actionId: PHASE_2R_PARITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
      PHASE_2R_PARITY_RULE_IDS.COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS,
      PHASE_2R_PARITY_RULE_IDS.BRIDGE_SERIALIZATION_IS_ALLOWLISTED,
    ],
    freezesLegacyUi: false,
    notes: 'Protects command IDs, payload validation, and read-only projection mutation rejection.',
  },
  {
    path: 'server/src/__tests__/services/policyBuilderPhase2DraftViewProjection.test.mjs',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.DRAFT_VIEW_PROJECTION,
    actionId: PHASE_2R_PARITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS,
      PHASE_2R_PARITY_RULE_IDS.DRAFT_VIEW_HIDES_RAW_LEGACY_STORAGE,
      PHASE_2R_PARITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
    ],
    freezesLegacyUi: false,
    notes: 'Protects server-side projection fields and raw legacy storage exposure checks.',
  },
  {
    path: 'server/src/__tests__/services/policyBuilderPhase2ServerAuthorityPreparation.test.mjs',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.SERVER_AUTHORITY_PRELIGHT,
    actionId: PHASE_2R_PARITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.CLIENT_DRAFT_IS_NOT_DURABLE_AUTHORITY,
    ],
    freezesLegacyUi: false,
    notes: 'Protects the Phase 2R rule that server validation is authoritative and native persistence remains disabled.',
  },
  {
    path: 'server/src/__tests__/services/policyIntentRequestValidator.test.mjs',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.SERVER_AUTHORITY_PRELIGHT,
    actionId: PHASE_2R_PARITY_ACTION_IDS.KEEP,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.CLIENT_DRAFT_IS_NOT_DURABLE_AUTHORITY,
      PHASE_2R_PARITY_RULE_IDS.BRIDGE_SERIALIZATION_IS_ALLOWLISTED,
    ],
    freezesLegacyUi: false,
    notes: 'Protects authoritative request-shape validation before persistence.',
  },
  {
    path: 'client/src/__tests__/PolicyIntentImpactPreviewCard.test.js',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.REWRITE_OR_DELETE_CANDIDATE,
    actionId: PHASE_2R_PARITY_ACTION_IDS.REWRITE_IN_PHASE_6R,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.OLD_DIAGNOSTIC_UI_IS_NOT_FROZEN,
    ],
    freezesLegacyUi: false,
    notes: 'Keep only until Phase 6R decides whether impact preview becomes engine evidence, migration tooling, or deleted diagnostics.',
  },
  {
    path: 'client/src/__tests__/PolicyIntentReplayPreviewCard.test.js',
    categoryId: PHASE_2R_PARITY_TEST_CATEGORY_IDS.REWRITE_OR_DELETE_CANDIDATE,
    actionId: PHASE_2R_PARITY_ACTION_IDS.DELETE_AFTER_PHASE_8R_CUTLINE,
    coveredRuleIds: [
      PHASE_2R_PARITY_RULE_IDS.OLD_DIAGNOSTIC_UI_IS_NOT_FROZEN,
    ],
    freezesLegacyUi: false,
    notes: 'Keep only until Phase 6R/8R decides whether replay preview remains a maintainer tool.',
  },
]);

function listPhase2RParityTestRecords() {
  return PHASE_2R_PARITY_TEST_RECORDS;
}

function getPhase2RParityTestRecord(path) {
  return PHASE_2R_PARITY_TEST_RECORDS.find(record => record.path === path) || null;
}

function listPhase2RParityTestRecordsByCategory(categoryId) {
  return PHASE_2R_PARITY_TEST_RECORDS.filter(record => record.categoryId === categoryId);
}

function listPhase2RRequiredParityRuleIds() {
  return PHASE_2R_REQUIRED_PARITY_RULE_IDS;
}

function listPhase2RParityRewriteCandidates() {
  return PHASE_2R_PARITY_TEST_RECORDS.filter(record =>
    record.categoryId === PHASE_2R_PARITY_TEST_CATEGORY_IDS.REWRITE_OR_DELETE_CANDIDATE);
}

function summarizePhase2RParityRegressionTests() {
  const countsByCategory = PHASE_2R_PARITY_TEST_RECORDS.reduce((counts, record) => {
    counts[record.categoryId] = (counts[record.categoryId] || 0) + 1;
    return counts;
  }, {});

  const coveredRuleIds = Array.from(new Set(
    PHASE_2R_PARITY_TEST_RECORDS.flatMap(record => record.coveredRuleIds)
  )).sort();
  const uncoveredRequiredRuleIds = PHASE_2R_REQUIRED_PARITY_RULE_IDS
    .filter(ruleId => !coveredRuleIds.includes(ruleId));
  const legacyUiFreezeRecordIds = PHASE_2R_PARITY_TEST_RECORDS
    .filter(record => record.freezesLegacyUi)
    .map(record => record.path);

  return {
    recordCount: PHASE_2R_PARITY_TEST_RECORDS.length,
    requiredRuleCount: PHASE_2R_REQUIRED_PARITY_RULE_IDS.length,
    countsByCategory,
    coveredRuleIds,
    uncoveredRequiredRuleIds,
    rewriteCandidateCount: listPhase2RParityRewriteCandidates().length,
    legacyUiFreezeRecordIds,
    clientDraftAuthoritative: false,
    nativeIntentPersistenceExpected: false,
    phase2RComplete: uncoveredRequiredRuleIds.length === 0 && legacyUiFreezeRecordIds.length === 0,
  };
}

function validatePhase2RParityRule(ruleId) {
  if (!PHASE_2R_REQUIRED_PARITY_RULE_IDS.includes(ruleId)) {
    return {
      valid: false,
      riskId: PHASE_2R_PARITY_RISK_IDS.MISSING_RULE_COVERAGE,
      evidence: {
        reason: 'Unknown or non-required Phase 2R parity rule.',
      },
    };
  }

  const records = PHASE_2R_PARITY_TEST_RECORDS.filter(record =>
    record.coveredRuleIds.includes(ruleId));

  if (records.length === 0) {
    return {
      valid: false,
      riskId: PHASE_2R_PARITY_RISK_IDS.MISSING_RULE_COVERAGE,
      evidence: {
        reason: 'No test record covers the required Phase 2R parity rule.',
      },
    };
  }

  return {
    valid: true,
    riskId: null,
    evidence: {
      recordPaths: records.map(record => record.path),
      reason: 'Required Phase 2R parity rule has regression coverage.',
    },
  };
}

function validatePhase2RParityRegressionSuite() {
  const summary = summarizePhase2RParityRegressionTests();

  if (summary.uncoveredRequiredRuleIds.length > 0) {
    return {
      valid: false,
      riskId: PHASE_2R_PARITY_RISK_IDS.MISSING_RULE_COVERAGE,
      summary,
    };
  }

  if (summary.legacyUiFreezeRecordIds.length > 0) {
    return {
      valid: false,
      riskId: PHASE_2R_PARITY_RISK_IDS.TRANSITIONAL_UI_FROZEN,
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
  PHASE_2R_PARITY_ACTION_IDS,
  PHASE_2R_PARITY_RISK_IDS,
  PHASE_2R_PARITY_RULE_IDS,
  PHASE_2R_PARITY_TEST_CATEGORY_IDS,
  getPhase2RParityTestRecord,
  listPhase2RParityRewriteCandidates,
  listPhase2RParityTestRecords,
  listPhase2RParityTestRecordsByCategory,
  listPhase2RRequiredParityRuleIds,
  summarizePhase2RParityRegressionTests,
  validatePhase2RParityRegressionSuite,
  validatePhase2RParityRule,
};
