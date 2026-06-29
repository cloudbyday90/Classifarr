const POLICY_BUILDER_BOUNDARY_CATEGORIES = Object.freeze({
  PRESENTATION_ONLY: 'presentation_only',
  UI_ORCHESTRATION: 'ui_orchestration',
  DRAFT_STATE: 'draft_state',
  LEGACY_COMPATIBILITY_BRIDGE: 'legacy_compatibility_bridge',
  REFERENCE_DATA_ADAPTER: 'reference_data_adapter',
  ENGINE_CANDIDATE: 'engine_candidate',
  DELETE_REPLACE_AFTER_PHASE_6R: 'delete_replace_after_phase_6r',
  TEST_BOUNDARY: 'test_boundary',
  UNCLASSIFIED: 'unclassified',
});

const POLICY_BUILDER_BOUNDARY_RISK_IDS = Object.freeze({
  MIXED_BOUNDARY: 'mixed_boundary',
  CLIENT_ENGINE_LOGIC: 'client_engine_logic',
  LEGACY_PAYLOAD_TOUCHPOINT: 'legacy_payload_touchpoint',
  DIAGNOSTIC_PRODUCT_SURFACE: 'diagnostic_product_surface',
  OBSERVED_EVIDENCE_ADAPTER: 'observed_evidence_adapter',
  TEST_RESET_REQUIRED: 'test_reset_required',
});

const POLICY_BUILDER_BOUNDARY_ACTION_IDS = Object.freeze({
  KEEP_PRESENTATION: 'keep_presentation',
  KEEP_ORCHESTRATION: 'keep_orchestration',
  EXTRACT_DRAFT_BOUNDARY: 'extract_draft_boundary',
  CONTAIN_LEGACY_BRIDGE: 'contain_legacy_bridge',
  SPLIT_REFERENCE_AND_EVIDENCE: 'split_reference_and_evidence',
  MOVE_TO_SERVER_ENGINE: 'move_to_server_engine',
  RECLASSIFY_AS_MAINTAINER_VERIFIER_OR_DELETE: 'reclassify_as_maintainer_verifier_or_delete',
  RESET_TEST_OWNERSHIP: 'reset_test_ownership',
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

function normalizeClientPath(filePath = '') {
  return String(filePath || '').replace(/\\/g, '/');
}

function hasAnySegment(filePath, segments = []) {
  return segments.some(segment => filePath.includes(segment));
}

function basename(filePath) {
  return filePath.split('/').pop() || filePath;
}

const POLICY_BUILDER_MODULE_MATCHER = /(PolicyBuilder|PolicyIntent|PolicySelected|PolicyStarter|PolicyPreset|policyBuilder|policyIntent|usePolicyBuilder|usePolicyIntent)/;

const POLICY_BUILDER_BOUNDARY_RULES = deepFreeze([
  {
    id: 'policy_builder_tests',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.TEST_BOUNDARY,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.RESET_TEST_OWNERSHIP,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.TEST_RESET_REQUIRED,
    ],
    notes: 'Tests are not product authority; Phase 1R.6 must classify them as keep, rewrite, future-contract, or delete.',
    matches: (filePath) => filePath.includes('/__tests__/'),
  },
  {
    id: 'policy_builder_modal',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_ORCHESTRATION,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
    ],
    notes: 'The modal may coordinate child components and save/cancel flow, but Phase 1R.2 must keep evidence, readiness, replay, and legacy mutation out of the modal.',
    matches: (filePath) => filePath.endsWith('/PolicyBuilderModal.vue'),
  },
  {
    id: 'policy_intent_editor',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_ORCHESTRATION,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
    ],
    notes: 'The editor should route draft commands to composables and child controls, not infer policy meaning.',
    matches: (filePath) => filePath.endsWith('/PolicyIntentEditor.vue'),
  },
  {
    id: 'policy_draft_state_composables',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.DRAFT_STATE,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.EXTRACT_DRAFT_BOUNDARY,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.LEGACY_PAYLOAD_TOUCHPOINT,
    ],
    notes: 'Draft state is an editable client projection; Phase 1R.3 must keep serialization allow-listed and non-authoritative.',
    matches: (filePath) => hasAnySegment(filePath, [
      '/usePolicyBuilderState.js',
      '/usePolicyIntentDraft.js',
      '/policyIntentWritePreflight.js',
    ]),
  },
  {
    id: 'policy_reference_data_adapters',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.REFERENCE_DATA_ADAPTER,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.SPLIT_REFERENCE_AND_EVIDENCE,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.OBSERVED_EVIDENCE_ADAPTER,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
    ],
    notes: 'Reference data may fetch static options and observed profile suggestions, but Phase 1R.4 must distinguish options from evidence.',
    matches: (filePath) => hasAnySegment(filePath, [
      '/usePolicyBuilderReferenceData.js',
      '/policyBuilderLibraryGenreOptions.js',
      '/policyBuilderProfileFreshness.js',
      '/policyBuilderProfileRefreshResult.js',
    ]),
  },
  {
    id: 'policy_legacy_bridge_modules',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.LEGACY_COMPATIBILITY_BRIDGE,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.CONTAIN_LEGACY_BRIDGE,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.LEGACY_PAYLOAD_TOUCHPOINT,
    ],
    notes: 'Legacy preset/custom-signal projection must stay isolated until Phase 8R native intent storage replaces it.',
    matches: (filePath) => hasAnySegment(filePath, [
      '/usePolicyBuilderTemplateSignals.js',
      '/usePolicyBuilderCombinedSignals.js',
      '/policyIntentDraftBridge.js',
      '/policyIntentDraftView.js',
      '/policyIntentModel.js',
    ]),
  },
  {
    id: 'policy_preview_diagnostics',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.DELETE_REPLACE_AFTER_PHASE_6R,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.RECLASSIFY_AS_MAINTAINER_VERIFIER_OR_DELETE,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.CLIENT_ENGINE_LOGIC,
    ],
    notes: 'Impact/replay preview surfaces should become engine tests, migration verifiers, or be deleted after Phase 6R cutlines.',
    matches: (filePath) => hasAnySegment(filePath, [
      '/usePolicyIntentImpactPreview.js',
      '/usePolicyIntentReplayPreview.js',
      '/policyIntentImpactPreview.js',
      '/policyIntentReplayPreview.js',
      '/PolicyIntentImpactPreviewCard.vue',
      '/PolicyIntentReplayPreviewCard.vue',
    ]),
  },
  {
    id: 'policy_client_engine_candidates',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.ENGINE_CANDIDATE,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.MOVE_TO_SERVER_ENGINE,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.CLIENT_ENGINE_LOGIC,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
    ],
    notes: 'Client-side projection/readiness helpers may remain display adapters temporarily, but Phase 6R must decide which logic belongs server-side.',
    matches: (filePath) => hasAnySegment(filePath, [
      '/policyIntentSectionProjection.js',
      '/policyIntentSectionVisualState.js',
      '/policyIntentSummary.js',
      '/policyIntentControlView.js',
      '/policyIntentCertificationControl.js',
      '/policyIntentGenreControl.js',
      '/policyIntentEditorSections.js',
      '/policyBuilderAdvancedControls.js',
    ]),
  },
  {
    id: 'policy_intent_action_orchestration',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_ORCHESTRATION,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
    ],
    notes: 'Option actions can coordinate explicit draft commands, but must not compute engine authority or learning.',
    matches: (filePath) => hasAnySegment(filePath, [
      '/usePolicyIntentOptionAction.js',
    ]),
  },
  {
    id: 'policy_presentation_components',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.PRESENTATION_ONLY,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_PRESENTATION,
    riskIds: [],
    notes: 'These components should render props and emit explicit events without owning evidence, learning, or migration decisions.',
    matches: (filePath) => filePath.includes('/components/policies/') &&
      hasAnySegment(filePath, [
        '/PolicyBuilderLibraryContext.vue',
        '/PolicyIntentActionButton.vue',
        '/PolicyIntentCertificationControl.vue',
        '/PolicyIntentChip.vue',
        '/PolicyIntentGenreControl.vue',
        '/PolicyIntentOptionActionGroup.vue',
        '/PolicyIntentOptionSelect.vue',
        '/PolicyIntentReadinessSummary.vue',
        '/PolicyIntentSecondaryActionButton.vue',
        '/PolicyIntentSectionCard.vue',
        '/PolicyIntentSummaryCard.vue',
        '/PolicyPresetMigrationNotice.vue',
        '/PolicySelectedStarterTemplates.vue',
        '/PolicyStarterTemplateBrowser.vue',
        '/PolicyStarterTemplateDetails.vue',
        '/PolicyStarterTemplateMechanics.vue',
      ]),
  },
  {
    id: 'policy_advanced_settings_component',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.DELETE_REPLACE_AFTER_PHASE_6R,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.RECLASSIFY_AS_MAINTAINER_VERIFIER_OR_DELETE,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.CLIENT_ENGINE_LOGIC,
    ],
    notes: 'Advanced scoring/weight controls conflict with the destination-first model and need Phase 3R/6R replacement criteria.',
    matches: (filePath) => filePath.endsWith('/PolicyBuilderAdvancedSettings.vue'),
  },
]);

function isPolicyBuilderClientModulePath(filePath) {
  return POLICY_BUILDER_MODULE_MATCHER.test(normalizeClientPath(filePath));
}

function classifyPolicyBuilderClientPath(filePath) {
  const normalizedPath = normalizeClientPath(filePath);
  const matchedRule = POLICY_BUILDER_BOUNDARY_RULES.find(rule => rule.matches(normalizedPath));

  if (!matchedRule) {
    return {
      path: normalizedPath,
      name: basename(normalizedPath),
      category: POLICY_BUILDER_BOUNDARY_CATEGORIES.UNCLASSIFIED,
      actionId: null,
      riskIds: [],
      ruleId: null,
      notes: 'No Phase 1R.1 boundary rule matched this policy-builder path.',
      mixedBoundary: false,
    };
  }

  return {
    path: normalizedPath,
    name: basename(normalizedPath),
    category: matchedRule.category,
    actionId: matchedRule.actionId,
    riskIds: matchedRule.riskIds,
    ruleId: matchedRule.id,
    notes: matchedRule.notes,
    mixedBoundary: matchedRule.riskIds.includes(POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY),
  };
}

function listPolicyBuilderBoundaryRules() {
  return POLICY_BUILDER_BOUNDARY_RULES.map(rule => ({
    id: rule.id,
    category: rule.category,
    actionId: rule.actionId,
    riskIds: rule.riskIds,
    notes: rule.notes,
  }));
}

function summarizePolicyBuilderBoundaryInventory(filePaths = []) {
  const records = filePaths
    .filter(isPolicyBuilderClientModulePath)
    .map(classifyPolicyBuilderClientPath);

  const countsByCategory = records.reduce((counts, record) => {
    counts[record.category] = (counts[record.category] || 0) + 1;
    return counts;
  }, {});

  return {
    total: records.length,
    records,
    countsByCategory,
    mixedBoundaryPaths: records
      .filter(record => record.mixedBoundary)
      .map(record => record.path),
    unclassifiedPaths: records
      .filter(record => record.category === POLICY_BUILDER_BOUNDARY_CATEGORIES.UNCLASSIFIED)
      .map(record => record.path),
  };
}

export {
  POLICY_BUILDER_BOUNDARY_ACTION_IDS,
  POLICY_BUILDER_BOUNDARY_CATEGORIES,
  POLICY_BUILDER_BOUNDARY_RISK_IDS,
  classifyPolicyBuilderClientPath,
  isPolicyBuilderClientModulePath,
  listPolicyBuilderBoundaryRules,
  normalizeClientPath,
  summarizePolicyBuilderBoundaryInventory,
};
