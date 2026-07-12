const POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS = Object.freeze({
  KEEP_WORKFLOW_REGRESSION: 'keep_workflow_regression',
  PROTECT_DESTINATION_FIRST_FLOW: 'protect_destination_first_flow',
  PROTECT_EVIDENCE_BACKED_OPTIONS: 'protect_evidence_backed_options',
  PROTECT_READINESS_NEXT_ACTIONS: 'protect_readiness_next_actions',
  PROTECT_ACCESSIBILITY_DECISION_LOAD: 'protect_accessibility_decision_load',
  REMOVE_ABANDONED_DIAGNOSTIC_SURFACE: 'remove_abandoned_diagnostic_surface',
  KEEP_DRAFT_BRIDGE_COVERAGE: 'keep_draft_bridge_coverage',
});

const POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS = Object.freeze({
  POLICY_AUTHORING: 'policy_authoring',
  DRAFT_BRIDGE: 'draft_bridge',
  RUNTIME_VERIFIER: 'runtime_verifier',
  NATIVE_STORAGE_CLEANUP: 'native_storage_cleanup',
});

const POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS = Object.freeze({
  STARTER_TEMPLATES_SECONDARY_TO_DESTINATION: 'starter_templates_secondary_to_destination',
  OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT: 'observed_evidence_distinct_from_declared_intent',
  MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS: 'multi_select_emits_typed_draft_commands',
  ACCESSIBLE_NAMES_AND_DISABLED_REASONS: 'accessible_names_and_disabled_reasons',
  HARD_LIMITS_REQUIRE_EXPLICIT_ACTION: 'hard_limits_require_explicit_action',
  READINESS_LINKS_TO_NEXT_ACTION: 'readiness_links_to_next_action',
  INTERNAL_DIAGNOSTIC_PANELS_ABSENT: 'internal_diagnostic_panels_absent',
});

const POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS = Object.freeze({
  UNKNOWN_TEST_FILE: 'unknown_test_file',
  UNKNOWN_CATEGORY: 'unknown_category',
  UNKNOWN_OWNER: 'unknown_owner',
  UNKNOWN_BEHAVIOR: 'unknown_behavior',
  NORMAL_PATH_DIAGNOSTIC_TEST: 'normal_path_diagnostic_test',
  DRAFT_BRIDGE_DUPLICATED_IN_PRESENTATION: 'draft_bridge_duplicated_in_presentation',
  MISSING_PROTECTED_BEHAVIOR: 'missing_protected_behavior',
  MISSING_REMOVAL_RATIONALE: 'missing_removal_rationale',
  MISSING_REQUIRED_BEHAVIOR_COVERAGE: 'missing_required_behavior_coverage',
  INTERNAL_LANGUAGE_IN_PRODUCT_TEST: 'internal_language_in_product_test',
});

const INTERNAL_PRESENTATION_TEST_LANGUAGE = Object.freeze([
  'impact preview',
  'replay preview',
  'provider readiness',
  'tmdb live preview',
  'scoring details',
  'parity delta',
  'customSignals',
  'raw preset',
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

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function includesInternalPresentationLanguage(text) {
  const normalizedText = String(text || '').toLowerCase();

  return INTERNAL_PRESENTATION_TEST_LANGUAGE.some(flag => normalizedText.includes(flag.toLowerCase()));
}

const REQUIRED_POLICY_AUTHORING_PRESENTATION_BEHAVIORS = deepFreeze([
  {
    id: POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.STARTER_TEMPLATES_SECONDARY_TO_DESTINATION,
    description: 'Starter templates appear after destination context and do not own the policy mental model.',
  },
  {
    id: POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT,
    description: 'Observed library suggestions remain distinct from accepted declared intent.',
  },
  {
    id: POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS,
    description: 'Multi-select controls emit typed draft commands instead of mutating raw bridge payloads.',
  },
  {
    id: POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    description: 'Component primitives expose accessible names, helper text, and disabled reasons.',
  },
  {
    id: POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.HARD_LIMITS_REQUIRE_EXPLICIT_ACTION,
    description: 'Blocking constraints require explicit operator action.',
  },
  {
    id: POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.READINESS_LINKS_TO_NEXT_ACTION,
    description: 'Readiness surfaces link the highest-priority issue to one resolving action.',
  },
  {
    id: POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.INTERNAL_DIAGNOSTIC_PANELS_ABSENT,
    description: 'Impact, replay, provider, TMDB, scoring, and parity diagnostics are absent from the normal workflow.',
  },
]);

const POLICY_AUTHORING_PRESENTATION_TEST_RECORDS = deepFreeze([
  {
    filePath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_DESTINATION_FIRST_FLOW,
    normalPath: true,
    coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    requiredBehaviorIds: [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.STARTER_TEMPLATES_SECONDARY_TO_DESTINATION,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.INTERNAL_DIAGNOSTIC_PANELS_ABSENT,
    ],
    rationale: 'Protect modal assertions around destination-first workflow instead of legacy layout shape.',
  },
  {
    filePath: 'client/src/__tests__/PolicyBuilderLibraryContext.test.js',
    categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_WORKFLOW_REGRESSION,
    normalPath: true,
    coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    requiredBehaviorIds: [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    rationale: 'Keep as destination context regression while ensuring observed evidence is not declared automatically.',
  },
  {
    filePath: 'client/src/__tests__/PolicyStarterTemplateBrowser.test.js',
    categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_DESTINATION_FIRST_FLOW,
    normalPath: true,
    coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    requiredBehaviorIds: [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.STARTER_TEMPLATES_SECONDARY_TO_DESTINATION,
    ],
    rationale: 'Protect starter-template browsing around optional post-destination acceleration.',
  },
  {
    filePath: 'client/src/__tests__/PolicyStarterTemplateDetails.test.js',
    categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_DESTINATION_FIRST_FLOW,
    normalPath: true,
    coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    requiredBehaviorIds: [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.STARTER_TEMPLATES_SECONDARY_TO_DESTINATION,
    ],
    rationale: 'Template detail assertions should show approved product vocabulary, not raw mechanics.',
  },
  {
    filePath: 'client/src/__tests__/PolicyStarterTemplateMechanics.test.js',
    categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.REMOVE_ABANDONED_DIAGNOSTIC_SURFACE,
    normalPath: false,
    coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.NATIVE_STORAGE_CLEANUP,
    requiredBehaviorIds: [],
    rationale: 'Raw template mechanics are bridge-only and should not remain a normal presentation surface.',
  },
  {
    filePath: 'client/src/__tests__/PolicyIntentGenreControl.test.js',
    categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_EVIDENCE_BACKED_OPTIONS,
    normalPath: true,
    coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    requiredBehaviorIds: [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    rationale: 'Genre controls should prove observed options stay suggestions until accepted through typed commands.',
  },
  {
    filePath: 'client/src/__tests__/PolicyIntentOptionSelect.test.js',
    categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_EVIDENCE_BACKED_OPTIONS,
    normalPath: true,
    coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    requiredBehaviorIds: [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    rationale: 'Option selection should protect source grouping, selected state, and disabled reasons.',
  },
  {
    filePath: 'client/src/__tests__/PolicyIntentChip.test.js',
    categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_ACCESSIBILITY_DECISION_LOAD,
    normalPath: true,
    coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    requiredBehaviorIds: [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    rationale: 'Chip removal tests should assert accessible removal names and command routing.',
  },
  {
    filePath: 'client/src/__tests__/PolicyIntentCertificationControl.test.js',
    categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_EVIDENCE_BACKED_OPTIONS,
    normalPath: true,
    coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    requiredBehaviorIds: [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.HARD_LIMITS_REQUIRE_EXPLICIT_ACTION,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    rationale: 'Certification tests should separate max-rating hard limits from avoid-rating hints.',
  },
  {
    filePath: 'client/src/__tests__/PolicyIntentReadinessSummary.test.js',
    categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_READINESS_NEXT_ACTIONS,
    normalPath: true,
    coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    requiredBehaviorIds: [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.READINESS_LINKS_TO_NEXT_ACTION,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.INTERNAL_DIAGNOSTIC_PANELS_ABSENT,
    ],
    rationale: 'Readiness tests should assert one next action instead of diagnostic detail.',
  },
  {
    filePath: 'client/src/__tests__/PolicyIntentEditorParity.test.js',
    categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_DRAFT_BRIDGE_COVERAGE,
    normalPath: false,
    coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.DRAFT_BRIDGE,
    requiredBehaviorIds: [],
    rationale: 'Draft bridge parity belongs to the draft bridge contract and should not be duplicated by presentation tests.',
  },
  {
    filePath: 'client/src/__tests__/composables/usePolicyIntentDraft.test.js',
    categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_DRAFT_BRIDGE_COVERAGE,
    normalPath: false,
    coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.DRAFT_BRIDGE,
    requiredBehaviorIds: [],
    rationale: 'Draft command internals remain draft bridge coverage, not policy-authoring presentation shape.',
  },
]);

function listPolicyAuthoringPresentationTestRecords() {
  return POLICY_AUTHORING_PRESENTATION_TEST_RECORDS;
}

function listRequiredPolicyAuthoringPresentationBehaviors() {
  return REQUIRED_POLICY_AUTHORING_PRESENTATION_BEHAVIORS;
}

function getPolicyAuthoringPresentationTestRecord(filePath) {
  return POLICY_AUTHORING_PRESENTATION_TEST_RECORDS.find(record => record.filePath === filePath) || null;
}

function getRequiredPolicyAuthoringPresentationBehavior(behaviorId) {
  return REQUIRED_POLICY_AUTHORING_PRESENTATION_BEHAVIORS.find(behavior => behavior.id === behaviorId) || null;
}

function validatePolicyAuthoringPresentationTestRecord(record = {}) {
  const knownRecord = getPolicyAuthoringPresentationTestRecord(record.filePath);
  const candidate = {
    ...knownRecord,
    ...record,
  };
  const issues = [];
  const requiredBehaviorIds = asArray(candidate.requiredBehaviorIds);

  if (!knownRecord) {
    issues.push({
      riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.UNKNOWN_TEST_FILE,
      filePath: record.filePath || null,
      message: 'Presentation test file must be classified by the policy authoring presentation test contract.',
    });
  }

  if (!Object.values(POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS).includes(candidate.categoryId)) {
    issues.push({
      riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.UNKNOWN_CATEGORY,
      filePath: candidate.filePath || null,
      categoryId: candidate.categoryId || null,
      message: 'Presentation test record must use a known presentation category.',
    });
  }

  if (!Object.values(POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS).includes(candidate.coverageOwnerId)) {
    issues.push({
      riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.UNKNOWN_OWNER,
      filePath: candidate.filePath || null,
      coverageOwnerId: candidate.coverageOwnerId || null,
      message: 'Presentation test record must use a known coverage owner.',
    });
  }

  for (const behaviorId of requiredBehaviorIds) {
    if (!getRequiredPolicyAuthoringPresentationBehavior(behaviorId)) {
      issues.push({
        riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.UNKNOWN_BEHAVIOR,
        filePath: candidate.filePath || null,
        behaviorId,
        message: 'Presentation test record references an unknown required behavior.',
      });
    }
  }

  if (candidate.categoryId?.startsWith('protect_') && requiredBehaviorIds.length === 0) {
    issues.push({
      riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.MISSING_PROTECTED_BEHAVIOR,
      filePath: candidate.filePath || null,
      message: 'Protection records must identify the workflow behavior they should protect.',
    });
  }

  if (candidate.categoryId === POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.REMOVE_ABANDONED_DIAGNOSTIC_SURFACE &&
      !cleanString(candidate.rationale)) {
    issues.push({
      riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.MISSING_REMOVAL_RATIONALE,
      filePath: candidate.filePath || null,
      message: 'Removal records must explain why the old surface is abandoned.',
    });
  }

  if (candidate.categoryId === POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_DRAFT_BRIDGE_COVERAGE &&
      candidate.coverageOwnerId !== POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.DRAFT_BRIDGE) {
    issues.push({
      riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.DRAFT_BRIDGE_DUPLICATED_IN_PRESENTATION,
      filePath: candidate.filePath || null,
      message: 'Draft bridge coverage must remain owned by the draft bridge contract.',
    });
  }

  if (candidate.normalPath === true &&
      candidate.categoryId === POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.REMOVE_ABANDONED_DIAGNOSTIC_SURFACE) {
    issues.push({
      riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.NORMAL_PATH_DIAGNOSTIC_TEST,
      filePath: candidate.filePath || null,
      message: 'Abandoned diagnostic surfaces cannot remain in the normal workflow test path.',
    });
  }

  const productText = [
    candidate.filePath,
    candidate.rationale,
    ...(candidate.productAssertions || []),
  ].join(' ');

  if (candidate.normalPath === true && includesInternalPresentationLanguage(productText)) {
    issues.push({
      riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.INTERNAL_LANGUAGE_IN_PRODUCT_TEST,
      filePath: candidate.filePath || null,
      message: 'Normal presentation tests must use product workflow vocabulary, not internal diagnostics.',
    });
  }

  return {
    ok: issues.length === 0,
    filePath: candidate.filePath || null,
    categoryId: candidate.categoryId || null,
    issues,
  };
}

function buildPolicyAuthoringPresentationTestAudit(records = POLICY_AUTHORING_PRESENTATION_TEST_RECORDS) {
  const candidates = Array.isArray(records) ? records : [];
  const results = candidates.map(record => validatePolicyAuthoringPresentationTestRecord(record));
  const issues = results.flatMap(result => result.issues);
  const coveredBehaviorIds = new Set(candidates.flatMap(record => asArray(record.requiredBehaviorIds)));
  const missingRequiredBehaviorIds = REQUIRED_POLICY_AUTHORING_PRESENTATION_BEHAVIORS
    .map(behavior => behavior.id)
    .filter(behaviorId => !coveredBehaviorIds.has(behaviorId));

  for (const behaviorId of missingRequiredBehaviorIds) {
    issues.push({
      riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.MISSING_REQUIRED_BEHAVIOR_COVERAGE,
      behaviorId,
      message: 'Required policy-authoring presentation behavior is not covered by the presentation test plan.',
    });
  }

  return {
    ok: issues.length === 0,
    checkedRecordCount: results.length,
    requiredBehaviorCount: REQUIRED_POLICY_AUTHORING_PRESENTATION_BEHAVIORS.length,
    coveredBehaviorIds: [...coveredBehaviorIds],
    missingRequiredBehaviorIds,
    issueCount: issues.length,
    results,
    issues,
  };
}

function summarizePolicyAuthoringPresentationTests() {
  const countsByCategory = POLICY_AUTHORING_PRESENTATION_TEST_RECORDS.reduce((counts, record) => {
    counts[record.categoryId] = (counts[record.categoryId] || 0) + 1;
    return counts;
  }, {});

  return {
    recordCount: POLICY_AUTHORING_PRESENTATION_TEST_RECORDS.length,
    requiredBehaviorCount: REQUIRED_POLICY_AUTHORING_PRESENTATION_BEHAVIORS.length,
    countsByCategory,
    normalPathRecordCount: POLICY_AUTHORING_PRESENTATION_TEST_RECORDS
      .filter(record => record.normalPath).length,
    draftBridgeOwnedRecordCount: POLICY_AUTHORING_PRESENTATION_TEST_RECORDS
      .filter(record => record.coverageOwnerId === POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.DRAFT_BRIDGE).length,
  };
}

export {
  POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS,
  POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS,
  POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS,
  POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS,
  buildPolicyAuthoringPresentationTestAudit,
  getPolicyAuthoringPresentationTestRecord,
  getRequiredPolicyAuthoringPresentationBehavior,
  includesInternalPresentationLanguage,
  listPolicyAuthoringPresentationTestRecords,
  listRequiredPolicyAuthoringPresentationBehaviors,
  summarizePolicyAuthoringPresentationTests,
  validatePolicyAuthoringPresentationTestRecord,
};
