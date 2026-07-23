const POLICY_BUILDER_BOUNDARY_CATEGORIES = Object.freeze({
  PRESENTATION_ONLY: 'presentation_only',
  UI_ORCHESTRATION: 'ui_orchestration',
  DRAFT_STATE: 'draft_state',
  LEGACY_COMPATIBILITY_BRIDGE: 'legacy_compatibility_bridge',
  REFERENCE_DATA_ADAPTER: 'reference_data_adapter',
  ENGINE_CANDIDATE: 'engine_candidate',
  REWRITE_OR_DELETE_AFTER_ENGINE_CUTLINE: 'rewrite_or_delete_after_engine_cutline',
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

const POLICY_BUILDER_BOUNDARY_OWNER_IDS = Object.freeze({
  CLIENT_PRESENTATION: 'client_presentation',
  CLIENT_ORCHESTRATION: 'client_orchestration',
  CLIENT_DRAFT_PROJECTION: 'client_draft_projection',
  CLIENT_COMPATIBILITY_BRIDGE: 'client_compatibility_bridge',
  CLIENT_REFERENCE_ADAPTER: 'client_reference_adapter',
  SERVER_ENGINE_CANDIDATE: 'server_engine_candidate',
  MAINTAINER_VERIFIER_OR_DELETE: 'maintainer_verifier_or_delete',
  TEST_CONTRACT: 'test_contract',
});

const POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS = Object.freeze({
  UNCLASSIFIED_MODULE: 'unclassified_module',
  MISSING_REQUIRED_RULE_COVERAGE: 'missing_required_rule_coverage',
  MISSING_RULE_OWNER: 'missing_rule_owner',
  UNKNOWN_RULE_OWNER: 'unknown_rule_owner',
  CLIENT_ENGINE_AUTHORITY_ALLOWED: 'client_engine_authority_allowed',
  MISSING_ENGINE_CUTLINE_DECISION: 'missing_engine_cutline_decision',
  INVALID_ENGINE_CANDIDATE_ACTION: 'invalid_engine_candidate_action',
  INVALID_DELETE_REPLACE_ACTION: 'invalid_delete_replace_action',
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

const POLICY_BUILDER_MODULE_MATCHER = /(PolicyBuilder|PolicyDestination|PolicyIntent|PolicySelected|PolicyStarter|PolicyPreset|PolicyCombined|DestinationContext|ObservedProfile|ReadinessNextAction|IntentSignal|policyBuilder|policyIntent|usePolicyBuilder|usePolicyIntent|usePolicyOperatorWorkflow)/;

const POLICY_BUILDER_BOUNDARY_RULES = deepFreeze([
  {
    id: 'policy_operator_workflow_read_adapter',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.REFERENCE_DATA_ADAPTER,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_REFERENCE_ADAPTER,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.SPLIT_REFERENCE_AND_EVIDENCE,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: false,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.OBSERVED_EVIDENCE_ADAPTER,
    ],
    notes: 'The operator workflow composable may load and validate the server-owned display projection, but cannot persist policy intent, route media, or decide automation.',
    matches: (filePath) => filePath.endsWith('/usePolicyOperatorWorkflow.js'),
  },
  {
    id: 'policy_library_sync_recovery_orchestration',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_ORCHESTRATION,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_ORCHESTRATION,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: false,
    riskIds: [],
    notes: 'The library-sync recovery composable coordinates explicit authenticated recovery and a profile reread. It cannot infer intent, decide automation, or route media.',
    matches: (filePath) => filePath.endsWith('/usePolicyBuilderLibrarySync.js'),
  },
  {
    id: 'policy_builder_tests',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.TEST_BOUNDARY,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.TEST_CONTRACT,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.RESET_TEST_OWNERSHIP,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: false,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.TEST_RESET_REQUIRED,
    ],
    notes: 'Tests are not product authority; test-boundary reset must classify them as keep, rewrite, future-contract, or delete.',
    matches: (filePath) => filePath.includes('/__tests__/'),
  },
  {
    id: 'policy_builder_modal',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_ORCHESTRATION,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_ORCHESTRATION,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: false,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
    ],
    notes: 'The modal may coordinate child components and save/cancel flow, but modal orchestration ownership must keep evidence, readiness, replay, and legacy mutation out of the modal.',
    matches: (filePath) => filePath.endsWith('/PolicyBuilderModal.vue'),
  },
  {
    id: 'policy_builder_experience_mode',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_ORCHESTRATION,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_ORCHESTRATION,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: false,
    riskIds: [],
    notes: 'Experience mode only selects the new-policy or existing-policy shell from a persisted identifier; it cannot infer intent, evaluate evidence, or decide automation.',
    matches: (filePath) => filePath.endsWith('/policyBuilderExperienceMode.js'),
  },
  {
    id: 'policy_intent_editor',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_ORCHESTRATION,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_ORCHESTRATION,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: false,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
    ],
    notes: 'The editor should route draft commands to composables and child controls, not infer policy meaning.',
    matches: (filePath) => filePath.endsWith('/PolicyIntentEditor.vue'),
  },
  {
    id: 'policy_draft_state_composables',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.DRAFT_STATE,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_DRAFT_PROJECTION,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.EXTRACT_DRAFT_BOUNDARY,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: false,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.LEGACY_PAYLOAD_TOUCHPOINT,
    ],
    notes: 'Draft state is an editable client projection; draft ownership must keep serialization allow-listed and non-authoritative.',
    matches: (filePath) => hasAnySegment(filePath, [
      '/usePolicyBuilderState.js',
      '/usePolicyIntentDraft.js',
      '/policyIntentWritePreflight.js',
    ]),
  },
  {
    id: 'policy_reference_data_adapters',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.REFERENCE_DATA_ADAPTER,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_REFERENCE_ADAPTER,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.SPLIT_REFERENCE_AND_EVIDENCE,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: false,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.OBSERVED_EVIDENCE_ADAPTER,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
    ],
    notes: 'Reference data may fetch static options and observed profile suggestions, but reference-data ownership must distinguish options from evidence.',
    matches: (filePath) => hasAnySegment(filePath, [
      '/usePolicyBuilderReferenceData.js',
      '/policyBuilderLibraryGenreOptions.js',
      '/policyBuilderProfileFreshness.js',
      '/policyBuilderProfileRefreshResult.js',
    ]),
  },
  {
    id: 'policy_intent_signal_draft_state',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.DRAFT_STATE,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_DRAFT_PROJECTION,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.EXTRACT_DRAFT_BOUNDARY,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: false,
    riskIds: [],
    notes: 'Intent-signal draft state applies explicitly accepted server-authored commands to transient client state. It cannot infer evidence, persist policy intent, or route media.',
    matches: (filePath) => hasAnySegment(filePath, [
      '/policyIntentSignalDraft.js',
      '/usePolicyIntentSignalDraft.js',
    ]),
  },
  {
    id: 'policy_intent_constraint_draft_state',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.DRAFT_STATE,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_DRAFT_PROJECTION,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.EXTRACT_DRAFT_BOUNDARY,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: false,
    riskIds: [],
    notes: 'Constraint draft state resolves one explicit operator choice from the server-owned decision projection and retains only a typed local command. It cannot infer constraint meaning, persist policy intent, or route media.',
    matches: (filePath) => hasAnySegment(filePath, [
      '/policyIntentConstraintDraft.js',
      '/usePolicyIntentConstraintDraft.js',
    ]),
  },
  {
    id: 'policy_legacy_bridge_modules',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.LEGACY_COMPATIBILITY_BRIDGE,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_COMPATIBILITY_BRIDGE,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.CONTAIN_LEGACY_BRIDGE,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: false,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.LEGACY_PAYLOAD_TOUCHPOINT,
    ],
    notes: 'Legacy preset/custom-signal projection must stay isolated until native intent storage replaces it.',
    matches: (filePath) => hasAnySegment(filePath, [
      '/usePolicyBuilderTemplateSignals.js',
      '/usePolicyBuilderCombinedSignals.js',
      '/policyIntentDraftBridge.js',
      '/policyIntentDraftView.js',
      '/policyIntentModel.js',
    ]),
  },
  {
    id: 'policy_legacy_summary_surfaces',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.REWRITE_OR_DELETE_AFTER_ENGINE_CUTLINE,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.MAINTAINER_VERIFIER_OR_DELETE,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.RECLASSIFY_AS_MAINTAINER_VERIFIER_OR_DELETE,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: true,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.LEGACY_PAYLOAD_TOUCHPOINT,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
    ],
    notes: 'Legacy combined-signal summaries expose preset-era concepts in the product path and should be replaced by approved product-vocabulary surfaces.',
    matches: (filePath) => hasAnySegment(filePath, [
      '/PolicyCombinedSignalsSummary.vue',
    ]),
  },
  {
    id: 'policy_client_engine_candidates',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.ENGINE_CANDIDATE,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.SERVER_ENGINE_CANDIDATE,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.MOVE_TO_SERVER_ENGINE,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: true,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.CLIENT_ENGINE_LOGIC,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
    ],
    notes: 'Client-side projection/readiness helpers may remain display adapters temporarily, but engine cutline review must decide which logic belongs server-side.',
    matches: (filePath) => hasAnySegment(filePath, [
      '/policyIntentSectionProjection.js',
      '/policyIntentSectionVisualState.js',
      '/policyIntentSummary.js',
      '/policyIntentControlView.js',
      '/policyIntentCertificationControl.js',
      '/policyIntentGenreControl.js',
      '/policyIntentEditorSections.js',
      '/policyBuilderRoutingReadiness.js',
      '/policyBuilderSetupCards.js',
      '/policyIntentEditorGroups.js',
      '/policyBuilderAdvancedControls.js',
    ]),
  },
  {
    id: 'policy_intent_action_orchestration',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_ORCHESTRATION,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_ORCHESTRATION,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: false,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
    ],
    notes: 'Option actions can coordinate explicit draft commands, but must not compute engine authority or learning.',
    matches: (filePath) => hasAnySegment(filePath, [
      '/usePolicyIntentOptionAction.js',
      '/policyBuilderActionBoundary.js',
    ]),
  },
  {
    id: 'policy_presentation_components',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.PRESENTATION_ONLY,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.CLIENT_PRESENTATION,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.KEEP_PRESENTATION,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: false,
    riskIds: [],
    notes: 'These components should render props and emit explicit events without owning evidence, learning, or migration decisions.',
    matches: (filePath) => filePath.includes('/components/policies/') &&
      hasAnySegment(filePath, [
        '/DestinationContextCard.vue',
        '/IntentSignalPicker.vue',
        '/ObservedProfileSummary.vue',
        '/PolicyBuilderLibraryContext.vue',
        '/PolicyBuilderFooterActions.vue',
        '/PolicyBuilderRoutingReadinessCard.vue',
        '/PolicyBuilderSetupCards.vue',
        '/PolicyBuilderDestinationQuestions.vue',
        '/PolicyBuilderWorkflowShell.vue',
        '/PolicyDestinationEmptyStateNotice.vue',
        '/ReadinessNextActionCard.vue',
        '/PolicyIntentActionButton.vue',
        '/PolicyIntentCertificationControl.vue',
        '/PolicyIntentChip.vue',
        '/PolicyIntentCustomSignalEntry.vue',
        '/PolicyIntentGenreControl.vue',
        '/PolicyIntentOptionActionGroup.vue',
        '/PolicyIntentOptionSelect.vue',
        '/PolicyIntentReviewTriggerControl.vue',
        '/PolicyIntentReadinessSummary.vue',
        '/PolicyIntentSecondaryActionButton.vue',
        '/PolicyIntentSectionCard.vue',
        '/PolicyIntentSummaryCard.vue',
        '/PolicyPresetMigrationNotice.vue',
        '/PolicySelectedStarterTemplates.vue',
        '/PolicyStarterTemplateAccelerator.vue',
        '/PolicyStarterTemplateBrowser.vue',
        '/PolicyStarterTemplateDetails.vue',
        '/PolicyStarterTemplateMechanics.vue',
      ]),
  },
  {
    id: 'policy_advanced_settings_component',
    category: POLICY_BUILDER_BOUNDARY_CATEGORIES.REWRITE_OR_DELETE_AFTER_ENGINE_CUTLINE,
    ownerId: POLICY_BUILDER_BOUNDARY_OWNER_IDS.MAINTAINER_VERIFIER_OR_DELETE,
    actionId: POLICY_BUILDER_BOUNDARY_ACTION_IDS.RECLASSIFY_AS_MAINTAINER_VERIFIER_OR_DELETE,
    clientEngineAuthorityAllowed: false,
    engineCutlineDecisionRequired: true,
    riskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.CLIENT_ENGINE_LOGIC,
    ],
    notes: 'Advanced scoring/weight controls conflict with the destination-first model and need operator-surface and engine replacement criteria.',
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
      notes: 'No policy-builder boundary rule matched this policy-builder path.',
      mixedBoundary: false,
    };
  }

  return {
    path: normalizedPath,
    name: basename(normalizedPath),
    category: matchedRule.category,
    ownerId: matchedRule.ownerId,
    actionId: matchedRule.actionId,
    clientEngineAuthorityAllowed: matchedRule.clientEngineAuthorityAllowed,
    engineCutlineDecisionRequired: matchedRule.engineCutlineDecisionRequired,
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
    ownerId: rule.ownerId,
    actionId: rule.actionId,
    clientEngineAuthorityAllowed: rule.clientEngineAuthorityAllowed,
    engineCutlineDecisionRequired: rule.engineCutlineDecisionRequired,
    riskIds: rule.riskIds,
    notes: rule.notes,
  }));
}

function validatePolicyBuilderBoundaryRule(rule = {}) {
  const issues = [];

  if (!rule.ownerId) {
    issues.push({
      riskId: POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.MISSING_RULE_OWNER,
      ruleId: rule.id || null,
      message: 'Policy-builder boundary rule must declare an owner.',
    });
  } else if (!Object.values(POLICY_BUILDER_BOUNDARY_OWNER_IDS).includes(rule.ownerId)) {
    issues.push({
      riskId: POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.UNKNOWN_RULE_OWNER,
      ruleId: rule.id || null,
      ownerId: rule.ownerId,
      message: 'Policy-builder boundary rule declares an unknown owner.',
    });
  }

  if (rule.clientEngineAuthorityAllowed) {
    issues.push({
      riskId: POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.CLIENT_ENGINE_AUTHORITY_ALLOWED,
      ruleId: rule.id || null,
      message: 'Client policy-builder modules must not own engine authority.',
    });
  }

  if (rule.category === POLICY_BUILDER_BOUNDARY_CATEGORIES.ENGINE_CANDIDATE) {
    if (rule.actionId !== POLICY_BUILDER_BOUNDARY_ACTION_IDS.MOVE_TO_SERVER_ENGINE) {
      issues.push({
        riskId: POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.INVALID_ENGINE_CANDIDATE_ACTION,
        ruleId: rule.id || null,
        message: 'Engine candidates must be routed to the server-engine cutline.',
      });
    }

    if (!rule.engineCutlineDecisionRequired) {
      issues.push({
        riskId: POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.MISSING_ENGINE_CUTLINE_DECISION,
        ruleId: rule.id || null,
        message: 'Engine candidates require an engine cutline decision before they can remain product-owned.',
      });
    }
  }

  if (rule.category === POLICY_BUILDER_BOUNDARY_CATEGORIES.REWRITE_OR_DELETE_AFTER_ENGINE_CUTLINE) {
    if (rule.actionId !== POLICY_BUILDER_BOUNDARY_ACTION_IDS.RECLASSIFY_AS_MAINTAINER_VERIFIER_OR_DELETE) {
      issues.push({
        riskId: POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.INVALID_DELETE_REPLACE_ACTION,
        ruleId: rule.id || null,
        message: 'Delete/replace surfaces must be reclassified as verifier or deletion candidates.',
      });
    }

    if (!rule.engineCutlineDecisionRequired) {
      issues.push({
        riskId: POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.MISSING_ENGINE_CUTLINE_DECISION,
        ruleId: rule.id || null,
        message: 'Rewrite/delete surfaces require an engine cutline decision.',
      });
    }
  }

  return {
    ok: issues.length === 0,
    ruleId: rule.id || null,
    ownerId: rule.ownerId || null,
    category: rule.category || null,
    issues,
  };
}

function buildPolicyBuilderBoundaryRuleAudit(rules = POLICY_BUILDER_BOUNDARY_RULES) {
  const ruleResults = rules.map(validatePolicyBuilderBoundaryRule);
  const issues = ruleResults.flatMap(result => result.issues);

  return {
    ok: issues.length === 0,
    checkedRuleCount: ruleResults.length,
    issues,
    ruleResults,
  };
}

function summarizePolicyBuilderBoundaryInventory(filePaths = []) {
  const records = filePaths
    .filter(isPolicyBuilderClientModulePath)
    .map(classifyPolicyBuilderClientPath);
  const coveredRuleIds = [...new Set(records
    .map(record => record.ruleId)
    .filter(Boolean))]
    .sort();

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
    coveredRuleIds,
  };
}

function buildPolicyBuilderBoundaryInventoryAudit(filePaths = [], options = {}) {
  const inventory = summarizePolicyBuilderBoundaryInventory(filePaths);
  const ruleAudit = buildPolicyBuilderBoundaryRuleAudit();
  const requiredRuleIds = Array.isArray(options.requiredRuleIds)
    ? [...options.requiredRuleIds]
    : POLICY_BUILDER_BOUNDARY_RULES.map(rule => rule.id);
  const missingRequiredRuleIds = requiredRuleIds
    .filter(ruleId => !inventory.coveredRuleIds.includes(ruleId))
    .sort();
  const issues = [...ruleAudit.issues];

  inventory.unclassifiedPaths.forEach((filePath) => {
    issues.push({
      riskId: POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.UNCLASSIFIED_MODULE,
      path: filePath,
      message: 'Policy-builder client module has no boundary ownership classification.',
    });
  });

  missingRequiredRuleIds.forEach((ruleId) => {
    issues.push({
      riskId: POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS.MISSING_REQUIRED_RULE_COVERAGE,
      ruleId,
      message: 'Required policy-builder boundary rule has no current client-tree coverage.',
    });
  });

  return {
    ok: issues.length === 0,
    inventory,
    ruleAudit,
    requiredRuleIds,
    missingRequiredRuleIds,
    issues,
  };
}

export {
  POLICY_BUILDER_BOUNDARY_AUDIT_RISK_IDS,
  POLICY_BUILDER_BOUNDARY_ACTION_IDS,
  POLICY_BUILDER_BOUNDARY_CATEGORIES,
  POLICY_BUILDER_BOUNDARY_OWNER_IDS,
  POLICY_BUILDER_BOUNDARY_RISK_IDS,
  buildPolicyBuilderBoundaryInventoryAudit,
  buildPolicyBuilderBoundaryRuleAudit,
  classifyPolicyBuilderClientPath,
  isPolicyBuilderClientModulePath,
  listPolicyBuilderBoundaryRules,
  normalizeClientPath,
  summarizePolicyBuilderBoundaryInventory,
  validatePolicyBuilderBoundaryRule,
};
