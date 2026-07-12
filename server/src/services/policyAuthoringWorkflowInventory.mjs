const POLICY_AUTHORING_WORKFLOW_DECISION_IDS = Object.freeze({
  KEEP: 'keep',
  REWRITE: 'rewrite',
  REPLACE: 'replace',
  DELETE: 'delete',
});

const POLICY_AUTHORING_WORKFLOW_ROLE_IDS = Object.freeze({
  NORMAL_AUTHORING_PATH: 'normal_authoring_path',
  WORKFLOW_SHELL: 'workflow_shell',
  DESTINATION_CONTEXT: 'destination_context',
  DECLARED_INTENT_EDITING: 'declared_intent_editing',
  READINESS_NEXT_ACTION: 'readiness_next_action',
  STARTER_TEMPLATE_ACCELERATOR: 'starter_template_accelerator',
  ADVANCED_SUPPORT_ONLY: 'advanced_support_only',
  MAINTAINER_VERIFIER_ONLY: 'maintainer_verifier_only',
  COMPATIBILITY_BRIDGE: 'compatibility_bridge',
  FUTURE_SERVER_ENGINE_INPUT: 'future_server_engine_input',
  TEST_BOUNDARY: 'test_boundary',
});

const POLICY_AUTHORING_WORKFLOW_RISK_IDS = Object.freeze({
  OLD_MODAL_SHAPE: 'old_modal_shape',
  LEGACY_PAYLOAD_EXPOSURE: 'legacy_payload_exposure',
  DIAGNOSTIC_PRODUCT_PATH: 'diagnostic_product_path',
  PROVIDER_READINESS_IN_NORMAL_UX: 'provider_readiness_in_normal_ux',
  STARTER_TEMPLATE_FIRST_MODEL: 'starter_template_first_model',
  RAW_SCORING_WEIGHT_EXPOSURE: 'raw_scoring_weight_exposure',
  CLIENT_ENGINE_DECISION: 'client_engine_decision',
  UNCLASSIFIED_SURFACE: 'unclassified_surface',
});

const POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS = Object.freeze({
  EVERY_SURFACE_CLASSIFIED: 'every_surface_classified',
  NORMAL_PATH_EXCLUDES_DIAGNOSTICS: 'normal_path_excludes_diagnostics',
  NORMAL_PATH_EXCLUDES_PROVIDER_READINESS: 'normal_path_excludes_provider_readiness',
  NORMAL_PATH_EXCLUDES_RAW_SCORING_WEIGHTS: 'normal_path_excludes_raw_scoring_weights',
  STARTER_TEMPLATES_ARE_ACCELERATORS: 'starter_templates_are_accelerators',
  TESTS_DO_NOT_FREEZE_OLD_UI: 'tests_do_not_freeze_old_ui',
});

const POLICY_AUTHORING_BUILDER_MATCHER =
  /(PolicyBuilder|PolicyIntent|PolicySelected|PolicyStarter|PolicyPreset|policyBuilder|policyIntent|usePolicyBuilder|usePolicyIntent)/;

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

const POLICY_AUTHORING_WORKFLOW_RULES = deepFreeze([
  {
    id: 'presentation_tests',
    decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REWRITE,
    roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.TEST_BOUNDARY,
    normalAuthoringAllowed: false,
    migrationSupportOnly: true,
    riskIds: [
      POLICY_AUTHORING_WORKFLOW_RISK_IDS.OLD_MODAL_SHAPE,
    ],
    notes: 'Presentation tests must be rewritten around the destination-first workflow instead of old modal layout or diagnostics.',
    matches: filePath => filePath.includes('/__tests__/'),
  },
  {
    id: 'workflow_shell_modal',
    decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REWRITE,
    roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.WORKFLOW_SHELL,
    normalAuthoringAllowed: true,
    migrationSupportOnly: false,
    riskIds: [
      POLICY_AUTHORING_WORKFLOW_RISK_IDS.OLD_MODAL_SHAPE,
    ],
    notes: 'Keep the shell responsibility, but rebuild the flow around destination context before mechanics.',
    matches: filePath => filePath.endsWith('/PolicyBuilderModal.vue'),
  },
  {
    id: 'destination_context_surface',
    decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.KEEP,
    roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.DESTINATION_CONTEXT,
    normalAuthoringAllowed: true,
    migrationSupportOnly: false,
    riskIds: [],
    notes: 'Destination context belongs in the normal path because the media server library is the source of observed application.',
    matches: filePath => hasAnySegment(filePath, [
      '/PolicyBuilderLibraryContext.vue',
      '/policyBuilderLibraryGenreOptions.js',
      '/policyBuilderProfileFreshness.js',
      '/policyBuilderProfileRefreshResult.js',
    ]),
  },
  {
    id: 'intent_editing_surface',
    decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REWRITE,
    roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.DECLARED_INTENT_EDITING,
    normalAuthoringAllowed: true,
    migrationSupportOnly: false,
    riskIds: [
      POLICY_AUTHORING_WORKFLOW_RISK_IDS.OLD_MODAL_SHAPE,
    ],
    notes: 'The editing concept survives, but component copy and grouping must align to destination-first questions.',
    matches: filePath => hasAnySegment(filePath, [
      '/PolicyIntentEditor.vue',
      '/PolicyIntentReviewTriggerControl.vue',
      '/PolicyIntentSectionCard.vue',
      '/policyIntentEditorGroups.js',
      '/policyIntentEditorSections.js',
      '/policyIntentSectionProjection.js',
      '/policyIntentSectionVisualState.js',
    ]),
  },
  {
    id: 'intent_leaf_controls',
    decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.KEEP,
    roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.DECLARED_INTENT_EDITING,
    normalAuthoringAllowed: true,
    migrationSupportOnly: false,
    riskIds: [],
    notes: 'Leaf controls may stay if they emit typed draft commands and avoid engine authority.',
    matches: filePath => hasAnySegment(filePath, [
      '/PolicyIntentActionButton.vue',
      '/PolicyIntentCertificationControl.vue',
      '/PolicyIntentChip.vue',
      '/PolicyIntentGenreControl.vue',
      '/PolicyIntentOptionActionGroup.vue',
      '/PolicyIntentOptionSelect.vue',
      '/PolicyIntentSecondaryActionButton.vue',
      '/policyIntentCertificationControl.js',
      '/policyIntentControlView.js',
      '/policyIntentGenreControl.js',
      '/usePolicyIntentOptionAction.js',
    ]),
  },
  {
    id: 'summary_and_readiness_surface',
    decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REPLACE,
    roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.READINESS_NEXT_ACTION,
    normalAuthoringAllowed: true,
    migrationSupportOnly: false,
    riskIds: [
      POLICY_AUTHORING_WORKFLOW_RISK_IDS.OLD_MODAL_SHAPE,
    ],
    notes: 'Summary/readiness concepts survive, but they must become action-oriented destination checks, not diagnostic dashboards.',
    matches: filePath => hasAnySegment(filePath, [
      '/PolicyBuilderFooterActions.vue',
      '/PolicyBuilderRoutingReadinessCard.vue',
      '/PolicyIntentReadinessSummary.vue',
      '/PolicyIntentSummaryCard.vue',
      '/policyBuilderActionBoundary.js',
      '/policyBuilderRoutingReadiness.js',
      '/policyIntentSummary.js',
    ]),
  },
  {
    id: 'starter_template_surfaces',
    decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REWRITE,
    roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.STARTER_TEMPLATE_ACCELERATOR,
    normalAuthoringAllowed: false,
    migrationSupportOnly: true,
    riskIds: [
      POLICY_AUTHORING_WORKFLOW_RISK_IDS.STARTER_TEMPLATE_FIRST_MODEL,
      POLICY_AUTHORING_WORKFLOW_RISK_IDS.LEGACY_PAYLOAD_EXPOSURE,
    ],
    notes: 'Templates can accelerate intent, but they must sit behind destination context and never define the normal model.',
    matches: filePath => hasAnySegment(filePath, [
      '/PolicySelectedStarterTemplates.vue',
      '/PolicyStarterTemplateAccelerator.vue',
      '/PolicyStarterTemplateBrowser.vue',
      '/PolicyStarterTemplateDetails.vue',
      '/PolicyStarterTemplateMechanics.vue',
      '/usePolicyBuilderTemplateSignals.js',
    ]),
  },
  {
    id: 'advanced_scoring_surfaces',
    decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REPLACE,
    roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.ADVANCED_SUPPORT_ONLY,
    normalAuthoringAllowed: false,
    migrationSupportOnly: true,
    riskIds: [
      POLICY_AUTHORING_WORKFLOW_RISK_IDS.RAW_SCORING_WEIGHT_EXPOSURE,
      POLICY_AUTHORING_WORKFLOW_RISK_IDS.CLIENT_ENGINE_DECISION,
    ],
    notes: 'Raw weights and scoring controls should not be part of normal policy authoring.',
    matches: filePath => hasAnySegment(filePath, [
      '/PolicyBuilderAdvancedSettings.vue',
      '/policyBuilderAdvancedControls.js',
    ]),
  },
  {
    id: 'migration_notice_surfaces',
    decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REWRITE,
    roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.MAINTAINER_VERIFIER_ONLY,
    normalAuthoringAllowed: false,
    migrationSupportOnly: true,
    riskIds: [
      POLICY_AUTHORING_WORKFLOW_RISK_IDS.LEGACY_PAYLOAD_EXPOSURE,
    ],
    notes: 'Migration notices may remain as support affordances, but they must not shape the normal destination-first authoring path.',
    matches: filePath => hasAnySegment(filePath, [
      '/PolicyPresetMigrationNotice.vue',
    ]),
  },
  {
    id: 'draft_and_bridge_utilities',
    decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.KEEP,
    roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.COMPATIBILITY_BRIDGE,
    normalAuthoringAllowed: false,
    migrationSupportOnly: true,
    riskIds: [
      POLICY_AUTHORING_WORKFLOW_RISK_IDS.LEGACY_PAYLOAD_EXPOSURE,
    ],
    notes: 'Draft and bridge utilities remain implementation support, not product surfaces operators reason about.',
    matches: filePath => hasAnySegment(filePath, [
      '/usePolicyBuilderState.js',
      '/usePolicyIntentDraft.js',
      '/policyIntentDraftBridge.js',
      '/policyIntentDraftView.js',
      '/policyIntentModel.js',
      '/policyIntentWritePreflight.js',
    ]),
  },
  {
    id: 'combined_signal_and_engine_candidates',
    decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REPLACE,
    roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.FUTURE_SERVER_ENGINE_INPUT,
    normalAuthoringAllowed: false,
    migrationSupportOnly: true,
    riskIds: [
      POLICY_AUTHORING_WORKFLOW_RISK_IDS.CLIENT_ENGINE_DECISION,
      POLICY_AUTHORING_WORKFLOW_RISK_IDS.LEGACY_PAYLOAD_EXPOSURE,
    ],
    notes: 'Combined-signal and derived mechanics should feed future server contracts, not normal UI mechanics.',
    matches: filePath => hasAnySegment(filePath, [
      '/usePolicyBuilderCombinedSignals.js',
    ]),
  },
  {
    id: 'reference_data_adapter',
    decisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.KEEP,
    roleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.DESTINATION_CONTEXT,
    normalAuthoringAllowed: true,
    migrationSupportOnly: false,
    riskIds: [],
    notes: 'Reference data remains allowed when it supports observed library evidence and available-option separation.',
    matches: filePath => hasAnySegment(filePath, [
      '/PolicyBuilderSetupCards.vue',
      '/policyBuilderSetupCards.js',
      '/usePolicyBuilderReferenceData.js',
    ]),
  },
]);

function isPolicyAuthoringBuilderPath(filePath) {
  return POLICY_AUTHORING_BUILDER_MATCHER.test(normalizeClientPath(filePath));
}

function classifyPolicyAuthoringWorkflowSurface(filePath) {
  const normalizedPath = normalizeClientPath(filePath);
  const matchedRule = POLICY_AUTHORING_WORKFLOW_RULES.find(rule => rule.matches(normalizedPath));

  if (!matchedRule) {
    return {
      path: normalizedPath,
      name: basename(normalizedPath),
      decisionId: null,
      roleId: null,
      normalAuthoringAllowed: false,
      migrationSupportOnly: false,
      riskIds: [
        POLICY_AUTHORING_WORKFLOW_RISK_IDS.UNCLASSIFIED_SURFACE,
      ],
      ruleId: null,
      notes: 'No policy authoring workflow cutline rule matched this policy-builder path.',
    };
  }

  return {
    path: normalizedPath,
    name: basename(normalizedPath),
    decisionId: matchedRule.decisionId,
    roleId: matchedRule.roleId,
    normalAuthoringAllowed: matchedRule.normalAuthoringAllowed,
    migrationSupportOnly: matchedRule.migrationSupportOnly,
    riskIds: matchedRule.riskIds,
    ruleId: matchedRule.id,
    notes: matchedRule.notes,
  };
}

function listPolicyAuthoringWorkflowRules() {
  return POLICY_AUTHORING_WORKFLOW_RULES.map(rule => ({
    id: rule.id,
    decisionId: rule.decisionId,
    roleId: rule.roleId,
    normalAuthoringAllowed: rule.normalAuthoringAllowed,
    migrationSupportOnly: rule.migrationSupportOnly,
    riskIds: rule.riskIds,
    notes: rule.notes,
  }));
}

function summarizePolicyAuthoringWorkflowInventory(filePaths = []) {
  const records = filePaths
    .map(normalizeClientPath)
    .filter(isPolicyAuthoringBuilderPath)
    .map(classifyPolicyAuthoringWorkflowSurface);

  const countsByDecision = records.reduce((counts, record) => {
    const key = record.decisionId || 'unclassified';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  const countsByRole = records.reduce((counts, record) => {
    const key = record.roleId || 'unclassified';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  const unclassifiedPaths = records
    .filter(record => !record.decisionId)
    .map(record => record.path);
  const normalAuthoringPaths = records
    .filter(record => record.normalAuthoringAllowed)
    .map(record => record.path);
  const migrationSupportOnlyPaths = records
    .filter(record => record.migrationSupportOnly)
    .map(record => record.path);
  const diagnosticNormalPathViolations = records
    .filter(record => record.normalAuthoringAllowed &&
      record.riskIds.includes(POLICY_AUTHORING_WORKFLOW_RISK_IDS.DIAGNOSTIC_PRODUCT_PATH))
    .map(record => record.path);
  const providerReadinessNormalPathViolations = records
    .filter(record => record.normalAuthoringAllowed &&
      record.riskIds.includes(POLICY_AUTHORING_WORKFLOW_RISK_IDS.PROVIDER_READINESS_IN_NORMAL_UX))
    .map(record => record.path);
  const rawWeightNormalPathViolations = records
    .filter(record => record.normalAuthoringAllowed &&
      record.riskIds.includes(POLICY_AUTHORING_WORKFLOW_RISK_IDS.RAW_SCORING_WEIGHT_EXPOSURE))
    .map(record => record.path);

  return {
    total: records.length,
    countsByDecision,
    countsByRole,
    unclassifiedPaths,
    normalAuthoringPaths,
    migrationSupportOnlyPaths,
    diagnosticNormalPathViolations,
    providerReadinessNormalPathViolations,
    rawWeightNormalPathViolations,
  };
}

function validatePolicyAuthoringWorkflowRequirement(requirementId, filePaths = []) {
  const summary = summarizePolicyAuthoringWorkflowInventory(filePaths);

  if (requirementId === POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS.EVERY_SURFACE_CLASSIFIED) {
    return {
      valid: summary.unclassifiedPaths.length === 0,
      riskId: summary.unclassifiedPaths.length === 0
        ? null
        : POLICY_AUTHORING_WORKFLOW_RISK_IDS.UNCLASSIFIED_SURFACE,
      evidence: {
        unclassifiedPaths: summary.unclassifiedPaths,
      },
    };
  }

  if (requirementId === POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS.NORMAL_PATH_EXCLUDES_DIAGNOSTICS) {
    return {
      valid: summary.diagnosticNormalPathViolations.length === 0,
      riskId: summary.diagnosticNormalPathViolations.length === 0
        ? null
        : POLICY_AUTHORING_WORKFLOW_RISK_IDS.DIAGNOSTIC_PRODUCT_PATH,
      evidence: {
        violationPaths: summary.diagnosticNormalPathViolations,
      },
    };
  }

  if (requirementId === POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS.NORMAL_PATH_EXCLUDES_PROVIDER_READINESS) {
    return {
      valid: summary.providerReadinessNormalPathViolations.length === 0,
      riskId: summary.providerReadinessNormalPathViolations.length === 0
        ? null
        : POLICY_AUTHORING_WORKFLOW_RISK_IDS.PROVIDER_READINESS_IN_NORMAL_UX,
      evidence: {
        violationPaths: summary.providerReadinessNormalPathViolations,
      },
    };
  }

  if (requirementId === POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS.NORMAL_PATH_EXCLUDES_RAW_SCORING_WEIGHTS) {
    return {
      valid: summary.rawWeightNormalPathViolations.length === 0,
      riskId: summary.rawWeightNormalPathViolations.length === 0
        ? null
        : POLICY_AUTHORING_WORKFLOW_RISK_IDS.RAW_SCORING_WEIGHT_EXPOSURE,
      evidence: {
        violationPaths: summary.rawWeightNormalPathViolations,
      },
    };
  }

  if (requirementId === POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS.STARTER_TEMPLATES_ARE_ACCELERATORS) {
    const starterTemplateNormalPaths = summary.normalAuthoringPaths
      .filter(filePath => filePath.includes('StarterTemplate') || filePath.includes('SelectedStarter'));

    return {
      valid: starterTemplateNormalPaths.length === 0,
      riskId: starterTemplateNormalPaths.length === 0
        ? null
        : POLICY_AUTHORING_WORKFLOW_RISK_IDS.STARTER_TEMPLATE_FIRST_MODEL,
      evidence: {
        violationPaths: starterTemplateNormalPaths,
      },
    };
  }

  if (requirementId === POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS.TESTS_DO_NOT_FREEZE_OLD_UI) {
    const oldUiTestPaths = summary.normalAuthoringPaths
      .filter(filePath => filePath.includes('/__tests__/'));

    return {
      valid: oldUiTestPaths.length === 0,
      riskId: oldUiTestPaths.length === 0
        ? null
        : POLICY_AUTHORING_WORKFLOW_RISK_IDS.OLD_MODAL_SHAPE,
      evidence: {
        violationPaths: oldUiTestPaths,
      },
    };
  }

  return {
    valid: false,
    riskId: POLICY_AUTHORING_WORKFLOW_RISK_IDS.UNCLASSIFIED_SURFACE,
    evidence: {
      reason: 'Unknown policy authoring workflow requirement.',
    },
  };
}

function validatePolicyAuthoringWorkflowInventory(filePaths = []) {
  const requirementIds = Object.values(POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS);
  const results = requirementIds.map(requirementId => ({
    requirementId,
    ...validatePolicyAuthoringWorkflowRequirement(requirementId, filePaths),
  }));

  return {
    valid: results.every(result => result.valid),
    results,
    summary: summarizePolicyAuthoringWorkflowInventory(filePaths),
  };
}

export {
  POLICY_AUTHORING_WORKFLOW_DECISION_IDS,
  POLICY_AUTHORING_WORKFLOW_REQUIREMENT_IDS,
  POLICY_AUTHORING_WORKFLOW_RISK_IDS,
  POLICY_AUTHORING_WORKFLOW_ROLE_IDS,
  classifyPolicyAuthoringWorkflowSurface,
  isPolicyAuthoringBuilderPath,
  listPolicyAuthoringWorkflowRules,
  normalizeClientPath,
  summarizePolicyAuthoringWorkflowInventory,
  validatePolicyAuthoringWorkflowInventory,
  validatePolicyAuthoringWorkflowRequirement,
};
