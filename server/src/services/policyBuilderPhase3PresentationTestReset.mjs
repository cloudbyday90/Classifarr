const PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS = Object.freeze({
  KEEP_WORKFLOW_REGRESSION: 'keep_workflow_regression',
  REWRITE_DESTINATION_FIRST_FLOW: 'rewrite_destination_first_flow',
  REWRITE_EVIDENCE_BACKED_OPTIONS: 'rewrite_evidence_backed_options',
  REWRITE_READINESS_NEXT_ACTIONS: 'rewrite_readiness_next_actions',
  REWRITE_ACCESSIBILITY_DECISION_LOAD: 'rewrite_accessibility_decision_load',
  DELETE_ABANDONED_DIAGNOSTIC_SURFACE: 'delete_abandoned_diagnostic_surface',
  KEEP_PHASE_2R_DRAFT_BRIDGE: 'keep_phase_2r_draft_bridge',
});

const PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS = Object.freeze({
  STARTER_TEMPLATES_SECONDARY_TO_DESTINATION: 'starter_templates_secondary_to_destination',
  OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT: 'observed_evidence_distinct_from_declared_intent',
  MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS: 'multi_select_emits_typed_draft_commands',
  ACCESSIBLE_NAMES_AND_DISABLED_REASONS: 'accessible_names_and_disabled_reasons',
  HARD_LIMITS_REQUIRE_EXPLICIT_ACTION: 'hard_limits_require_explicit_action',
  READINESS_LINKS_TO_NEXT_ACTION: 'readiness_links_to_next_action',
  INTERNAL_DIAGNOSTIC_PANELS_ABSENT: 'internal_diagnostic_panels_absent',
});

const PHASE_3R_PRESENTATION_TEST_RISK_IDS = Object.freeze({
  UNKNOWN_TEST_FILE: 'unknown_test_file',
  UNKNOWN_CATEGORY: 'unknown_category',
  UNKNOWN_BEHAVIOR: 'unknown_behavior',
  NORMAL_PATH_DIAGNOSTIC_TEST: 'normal_path_diagnostic_test',
  DRAFT_BRIDGE_DUPLICATED_IN_PRESENTATION: 'draft_bridge_duplicated_in_presentation',
  MISSING_REWRITE_BEHAVIOR: 'missing_rewrite_behavior',
  MISSING_DELETE_RATIONALE: 'missing_delete_rationale',
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

const REQUIRED_PHASE_3R_PRESENTATION_BEHAVIORS = deepFreeze([
  {
    id: PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.STARTER_TEMPLATES_SECONDARY_TO_DESTINATION,
    description: 'Starter templates appear after destination context and do not own the policy mental model.',
  },
  {
    id: PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT,
    description: 'Observed library suggestions remain distinct from accepted declared intent.',
  },
  {
    id: PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS,
    description: 'Multi-select controls emit typed draft commands instead of mutating raw bridge payloads.',
  },
  {
    id: PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    description: 'Component primitives expose accessible names, helper text, and disabled reasons.',
  },
  {
    id: PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.HARD_LIMITS_REQUIRE_EXPLICIT_ACTION,
    description: 'Blocking constraints require explicit operator action.',
  },
  {
    id: PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.READINESS_LINKS_TO_NEXT_ACTION,
    description: 'Readiness surfaces link the highest-priority issue to one resolving action.',
  },
  {
    id: PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.INTERNAL_DIAGNOSTIC_PANELS_ABSENT,
    description: 'Impact, replay, provider, TMDB, scoring, and parity diagnostics are absent from the normal workflow.',
  },
]);

const PHASE_3R_PRESENTATION_TEST_RECORDS = deepFreeze([
  {
    filePath: 'client/src/__tests__/PolicyBuilderModal.test.js',
    categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.REWRITE_DESTINATION_FIRST_FLOW,
    normalPath: true,
    phaseOwner: '3R',
    requiredBehaviorIds: [
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.STARTER_TEMPLATES_SECONDARY_TO_DESTINATION,
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.INTERNAL_DIAGNOSTIC_PANELS_ABSENT,
    ],
    rationale: 'Rewrite modal assertions around destination-first workflow instead of legacy layout shape.',
  },
  {
    filePath: 'client/src/__tests__/PolicyBuilderLibraryContext.test.js',
    categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.KEEP_WORKFLOW_REGRESSION,
    normalPath: true,
    phaseOwner: '3R',
    requiredBehaviorIds: [
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT,
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    rationale: 'Keep as destination context regression while ensuring observed evidence is not declared automatically.',
  },
  {
    filePath: 'client/src/__tests__/PolicyStarterTemplateBrowser.test.js',
    categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.REWRITE_DESTINATION_FIRST_FLOW,
    normalPath: true,
    phaseOwner: '3R',
    requiredBehaviorIds: [
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.STARTER_TEMPLATES_SECONDARY_TO_DESTINATION,
    ],
    rationale: 'Rewrite starter-template browsing around optional post-destination acceleration.',
  },
  {
    filePath: 'client/src/__tests__/PolicyStarterTemplateDetails.test.js',
    categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.REWRITE_DESTINATION_FIRST_FLOW,
    normalPath: true,
    phaseOwner: '3R',
    requiredBehaviorIds: [
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.STARTER_TEMPLATES_SECONDARY_TO_DESTINATION,
    ],
    rationale: 'Template detail assertions should show Phase 0R vocabulary, not raw mechanics.',
  },
  {
    filePath: 'client/src/__tests__/PolicyStarterTemplateMechanics.test.js',
    categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.DELETE_ABANDONED_DIAGNOSTIC_SURFACE,
    normalPath: false,
    phaseOwner: '8R',
    requiredBehaviorIds: [],
    rationale: 'Raw template mechanics are bridge-only and should not remain a normal presentation surface.',
  },
  {
    filePath: 'client/src/__tests__/PolicyIntentGenreControl.test.js',
    categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.REWRITE_EVIDENCE_BACKED_OPTIONS,
    normalPath: true,
    phaseOwner: '3R',
    requiredBehaviorIds: [
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT,
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS,
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    rationale: 'Genre controls should prove observed options stay suggestions until accepted through typed commands.',
  },
  {
    filePath: 'client/src/__tests__/PolicyIntentOptionSelect.test.js',
    categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.REWRITE_EVIDENCE_BACKED_OPTIONS,
    normalPath: true,
    phaseOwner: '3R',
    requiredBehaviorIds: [
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS,
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    rationale: 'Option selection should protect source grouping, selected state, and disabled reasons.',
  },
  {
    filePath: 'client/src/__tests__/PolicyIntentChip.test.js',
    categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.REWRITE_ACCESSIBILITY_DECISION_LOAD,
    normalPath: true,
    phaseOwner: '3R',
    requiredBehaviorIds: [
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    rationale: 'Chip removal tests should assert accessible removal names and command routing.',
  },
  {
    filePath: 'client/src/__tests__/PolicyIntentCertificationControl.test.js',
    categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.REWRITE_EVIDENCE_BACKED_OPTIONS,
    normalPath: true,
    phaseOwner: '3R',
    requiredBehaviorIds: [
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.HARD_LIMITS_REQUIRE_EXPLICIT_ACTION,
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    rationale: 'Certification tests should separate max-rating hard limits from avoid-rating hints.',
  },
  {
    filePath: 'client/src/__tests__/PolicyIntentReadinessSummary.test.js',
    categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.REWRITE_READINESS_NEXT_ACTIONS,
    normalPath: true,
    phaseOwner: '3R',
    requiredBehaviorIds: [
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.READINESS_LINKS_TO_NEXT_ACTION,
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.INTERNAL_DIAGNOSTIC_PANELS_ABSENT,
    ],
    rationale: 'Readiness tests should assert one next action instead of diagnostic detail.',
  },
  {
    filePath: 'client/src/__tests__/PolicyIntentImpactPreviewCard.test.js',
    categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.DELETE_ABANDONED_DIAGNOSTIC_SURFACE,
    normalPath: false,
    phaseOwner: '6R',
    requiredBehaviorIds: [
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.INTERNAL_DIAGNOSTIC_PANELS_ABSENT,
    ],
    rationale: 'Impact preview is verifier-only and should not remain in normal presentation tests.',
  },
  {
    filePath: 'client/src/__tests__/PolicyIntentReplayPreviewCard.test.js',
    categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.DELETE_ABANDONED_DIAGNOSTIC_SURFACE,
    normalPath: false,
    phaseOwner: '6R',
    requiredBehaviorIds: [
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.INTERNAL_DIAGNOSTIC_PANELS_ABSENT,
    ],
    rationale: 'Replay preview is verifier-only and should not remain in normal presentation tests.',
  },
  {
    filePath: 'client/src/__tests__/PolicyIntentEditorParity.test.js',
    categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.KEEP_PHASE_2R_DRAFT_BRIDGE,
    normalPath: false,
    phaseOwner: '2R',
    requiredBehaviorIds: [],
    rationale: 'Draft bridge parity belongs to Phase 2R and should not be duplicated by presentation tests.',
  },
  {
    filePath: 'client/src/__tests__/composables/usePolicyIntentDraft.test.js',
    categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.KEEP_PHASE_2R_DRAFT_BRIDGE,
    normalPath: false,
    phaseOwner: '2R',
    requiredBehaviorIds: [],
    rationale: 'Draft command internals remain Phase 2R coverage, not Phase 3R presentation shape.',
  },
]);

function listPhase3PresentationTestRecords() {
  return PHASE_3R_PRESENTATION_TEST_RECORDS;
}

function listRequiredPhase3PresentationBehaviors() {
  return REQUIRED_PHASE_3R_PRESENTATION_BEHAVIORS;
}

function getPhase3PresentationTestRecord(filePath) {
  return PHASE_3R_PRESENTATION_TEST_RECORDS.find(record => record.filePath === filePath) || null;
}

function getRequiredPhase3PresentationBehavior(behaviorId) {
  return REQUIRED_PHASE_3R_PRESENTATION_BEHAVIORS.find(behavior => behavior.id === behaviorId) || null;
}

function validatePhase3PresentationTestRecord(record = {}) {
  const knownRecord = getPhase3PresentationTestRecord(record.filePath);
  const candidate = {
    ...knownRecord,
    ...record,
  };
  const issues = [];
  const requiredBehaviorIds = asArray(candidate.requiredBehaviorIds);

  if (!knownRecord) {
    issues.push({
      riskId: PHASE_3R_PRESENTATION_TEST_RISK_IDS.UNKNOWN_TEST_FILE,
      filePath: record.filePath || null,
      message: 'Presentation test file must be classified by the Phase 3R.9 reset contract.',
    });
  }

  if (!Object.values(PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS).includes(candidate.categoryId)) {
    issues.push({
      riskId: PHASE_3R_PRESENTATION_TEST_RISK_IDS.UNKNOWN_CATEGORY,
      filePath: candidate.filePath || null,
      categoryId: candidate.categoryId || null,
      message: 'Presentation test record must use a known reset category.',
    });
  }

  for (const behaviorId of requiredBehaviorIds) {
    if (!getRequiredPhase3PresentationBehavior(behaviorId)) {
      issues.push({
        riskId: PHASE_3R_PRESENTATION_TEST_RISK_IDS.UNKNOWN_BEHAVIOR,
        filePath: candidate.filePath || null,
        behaviorId,
        message: 'Presentation test record references an unknown required behavior.',
      });
    }
  }

  if (candidate.categoryId?.startsWith('rewrite_') && requiredBehaviorIds.length === 0) {
    issues.push({
      riskId: PHASE_3R_PRESENTATION_TEST_RISK_IDS.MISSING_REWRITE_BEHAVIOR,
      filePath: candidate.filePath || null,
      message: 'Rewrite records must identify the workflow behavior they should protect.',
    });
  }

  if (candidate.categoryId === PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.DELETE_ABANDONED_DIAGNOSTIC_SURFACE &&
      !cleanString(candidate.rationale)) {
    issues.push({
      riskId: PHASE_3R_PRESENTATION_TEST_RISK_IDS.MISSING_DELETE_RATIONALE,
      filePath: candidate.filePath || null,
      message: 'Delete records must explain why the old surface is abandoned.',
    });
  }

  if (candidate.categoryId === PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.KEEP_PHASE_2R_DRAFT_BRIDGE &&
      candidate.phaseOwner !== '2R') {
    issues.push({
      riskId: PHASE_3R_PRESENTATION_TEST_RISK_IDS.DRAFT_BRIDGE_DUPLICATED_IN_PRESENTATION,
      filePath: candidate.filePath || null,
      message: 'Draft bridge coverage must remain owned by Phase 2R.',
    });
  }

  if (candidate.normalPath === true &&
      candidate.categoryId === PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.DELETE_ABANDONED_DIAGNOSTIC_SURFACE) {
    issues.push({
      riskId: PHASE_3R_PRESENTATION_TEST_RISK_IDS.NORMAL_PATH_DIAGNOSTIC_TEST,
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
      riskId: PHASE_3R_PRESENTATION_TEST_RISK_IDS.INTERNAL_LANGUAGE_IN_PRODUCT_TEST,
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

function buildPhase3PresentationTestResetAudit(records = PHASE_3R_PRESENTATION_TEST_RECORDS) {
  const candidates = Array.isArray(records) ? records : [];
  const results = candidates.map(record => validatePhase3PresentationTestRecord(record));
  const issues = results.flatMap(result => result.issues);
  const coveredBehaviorIds = new Set(candidates.flatMap(record => asArray(record.requiredBehaviorIds)));
  const missingRequiredBehaviorIds = REQUIRED_PHASE_3R_PRESENTATION_BEHAVIORS
    .map(behavior => behavior.id)
    .filter(behaviorId => !coveredBehaviorIds.has(behaviorId));

  for (const behaviorId of missingRequiredBehaviorIds) {
    issues.push({
      riskId: PHASE_3R_PRESENTATION_TEST_RISK_IDS.MISSING_REQUIRED_BEHAVIOR_COVERAGE,
      behaviorId,
      message: 'Required Phase 3R presentation behavior is not covered by the reset plan.',
    });
  }

  return {
    ok: issues.length === 0,
    checkedRecordCount: results.length,
    requiredBehaviorCount: REQUIRED_PHASE_3R_PRESENTATION_BEHAVIORS.length,
    coveredBehaviorIds: [...coveredBehaviorIds],
    missingRequiredBehaviorIds,
    issueCount: issues.length,
    results,
    issues,
  };
}

function summarizePhase3PresentationTestReset() {
  const countsByCategory = PHASE_3R_PRESENTATION_TEST_RECORDS.reduce((counts, record) => {
    counts[record.categoryId] = (counts[record.categoryId] || 0) + 1;
    return counts;
  }, {});

  return {
    recordCount: PHASE_3R_PRESENTATION_TEST_RECORDS.length,
    requiredBehaviorCount: REQUIRED_PHASE_3R_PRESENTATION_BEHAVIORS.length,
    countsByCategory,
    normalPathRecordCount: PHASE_3R_PRESENTATION_TEST_RECORDS
      .filter(record => record.normalPath).length,
    phase2ROwnedRecordCount: PHASE_3R_PRESENTATION_TEST_RECORDS
      .filter(record => record.phaseOwner === '2R').length,
  };
}

export {
  PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS,
  PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS,
  PHASE_3R_PRESENTATION_TEST_RISK_IDS,
  buildPhase3PresentationTestResetAudit,
  getPhase3PresentationTestRecord,
  getRequiredPhase3PresentationBehavior,
  includesInternalPresentationLanguage,
  listPhase3PresentationTestRecords,
  listRequiredPhase3PresentationBehaviors,
  summarizePhase3PresentationTestReset,
  validatePhase3PresentationTestRecord,
};
