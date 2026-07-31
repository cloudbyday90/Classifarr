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
  TEMPLATE_DERIVED_VALUES_REQUIRE_EXPLICIT_ACCEPTANCE: 'template_derived_values_require_explicit_acceptance',
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
  MISSING_INVENTORY_CLASSIFICATION: 'missing_inventory_classification',
  CLASSIFICATION_OUTSIDE_INVENTORY: 'classification_outside_inventory',
  DUPLICATE_INVENTORY_CLASSIFICATION: 'duplicate_inventory_classification',
  INVALID_NORMAL_PATH_FLAG: 'invalid_normal_path_flag',
  NON_AUTHORING_OWNER_IN_NORMAL_PATH: 'non_authoring_owner_in_normal_path',
  INVALID_EXCLUSION: 'invalid_exclusion',
  EXCLUDED_FILE_IS_CLASSIFIED: 'excluded_file_is_classified',
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
    id: POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.TEMPLATE_DERIVED_VALUES_REQUIRE_EXPLICIT_ACCEPTANCE,
    description: 'Template-derived values remain source-labelled candidates until explicitly accepted into typed declared intent.',
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

const POLICY_AUTHORING_PRESENTATION_TEST_INVENTORY_FILE_PATHS = deepFreeze([
  'client/src/__tests__/PolicyBuilderDestinationQuestions.test.js',
  'client/src/__tests__/PolicyBuilderFooterActions.test.js',
  'client/src/__tests__/PolicyBuilderLibraryContext.test.js',
  'client/src/__tests__/PolicyBuilderModal.test.js',
  'client/src/__tests__/PolicyBuilderRoutingReadinessCard.test.js',
  'client/src/__tests__/PolicyBuilderSetupCards.test.js',
  'client/src/__tests__/PolicyBuilderWorkflowShell.test.js',
  'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js',
  'client/src/__tests__/PolicyDestinationEmptyStateNotice.test.js',
  'client/src/__tests__/PolicyIntentActionButton.test.js',
  'client/src/__tests__/PolicyIntentCertificationControl.test.js',
  'client/src/__tests__/PolicyIntentChip.test.js',
  'client/src/__tests__/PolicyIntentConstraintControlSurface.test.js',
  'client/src/__tests__/PolicyIntentCustomSignalEntry.test.js',
  'client/src/__tests__/PolicyIntentEditor.test.js',
  'client/src/__tests__/PolicyIntentEditorParity.test.js',
  'client/src/__tests__/PolicyIntentGenreControl.test.js',
  'client/src/__tests__/PolicyIntentOptionActionGroup.test.js',
  'client/src/__tests__/PolicyIntentOptionSelect.test.js',
  'client/src/__tests__/PolicyIntentReviewTriggerControl.test.js',
  'client/src/__tests__/PolicyIntentSecondaryActionButton.test.js',
  'client/src/__tests__/PolicyIntentSectionCard.test.js',
  'client/src/__tests__/PolicyIntentSummaryCard.test.js',
  'client/src/__tests__/PolicyNativeCreateHandoff.test.js',
  'client/src/__tests__/PolicyNativeIntentReconciliation.test.js',
  'client/src/__tests__/PolicyNativePolicyRecoveryNotice.test.js',
  'client/src/__tests__/PolicyNativeProfileRecoveryStatus.test.js',
  'client/src/__tests__/PolicyPresetMigrationNotice.test.js',
  'client/src/__tests__/IntentSignalPicker.test.js',
  'client/src/__tests__/composables/usePolicyIntentDraft.test.js',
  'client/src/__tests__/utils/policyIntentDraftBridge.test.js',
  'client/src/__tests__/utils/policyIntentDraftView.test.js',
  'client/src/__tests__/utils/policyIntentModel.test.js',
]);

const POLICY_AUTHORING_PRESENTATION_TEST_EXCLUSION_RECORDS = deepFreeze([
  {
    filePath: 'client/src/__tests__/PolicyCard.test.js',
    rationale: 'The policy list card is a policy-management surface, not policy authoring or an adjacent authoring recovery flow.',
  },
]);

function presentationTestRecord(
  filePath,
  categoryId,
  normalPath,
  coverageOwnerId,
  requiredBehaviorIds,
  rationale
) {
  return {
    filePath,
    categoryId,
    normalPath,
    coverageOwnerId,
    requiredBehaviorIds,
    rationale,
  };
}

const POLICY_AUTHORING_PRESENTATION_TEST_RECORDS = deepFreeze([
  presentationTestRecord(
    'client/src/__tests__/PolicyBuilderDestinationQuestions.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_DESTINATION_FIRST_FLOW,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.READINESS_LINKS_TO_NEXT_ACTION,
    ],
    'Destination questions keep library observations and the recommended authoring action in a clear operator sequence.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyBuilderFooterActions.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_READINESS_NEXT_ACTIONS,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.READINESS_LINKS_TO_NEXT_ACTION,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    'Footer actions explain save readiness and preserve a clear defer path without creating another workflow state.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyBuilderLibraryContext.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_WORKFLOW_REGRESSION,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    'Library context preserves observed evidence as suggestions rather than declared intent.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyBuilderModal.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_DESTINATION_FIRST_FLOW,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.TEMPLATE_DERIVED_VALUES_REQUIRE_EXPLICIT_ACCEPTANCE,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.INTERNAL_DIAGNOSTIC_PANELS_ABSENT,
    ],
    'The modal protects destination-first authoring rather than compatibility layout shape.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyBuilderRoutingReadinessCard.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_READINESS_NEXT_ACTIONS,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.READINESS_LINKS_TO_NEXT_ACTION,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    'Routing readiness presents one bounded status and one resolving action without executing routing.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyBuilderSetupCards.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.REMOVE_ABANDONED_DIAGNOSTIC_SURFACE,
    false,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.NATIVE_STORAGE_CLEANUP,
    [],
    'The setup-card grid is a superseded compatibility surface and must not become the native destination-first workflow.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyBuilderWorkflowShell.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_WORKFLOW_REGRESSION,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.READINESS_LINKS_TO_NEXT_ACTION,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.INTERNAL_DIAGNOSTIC_PANELS_ABSENT,
    ],
    'The workflow shell proves library-first authoring, one readiness outcome, and no diagnostic control path.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.REMOVE_ABANDONED_DIAGNOSTIC_SURFACE,
    false,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.NATIVE_STORAGE_CLEANUP,
    [],
    'Compatibility maintenance retains typed destination-rule commands while raw scoring and threshold controls remain deleted.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyDestinationEmptyStateNotice.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_READINESS_NEXT_ACTIONS,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.READINESS_LINKS_TO_NEXT_ACTION,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    'Empty destination states retain a scoped recovery action and explain why authoring cannot proceed yet.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyIntentActionButton.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_ACCESSIBILITY_DECISION_LOAD,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS],
    'Primary authoring actions retain an explicit accessible name and a single public activation contract.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyIntentCertificationControl.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_EVIDENCE_BACKED_OPTIONS,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.HARD_LIMITS_REQUIRE_EXPLICIT_ACTION,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    'Certification controls separate explicit hard limits from advisory avoid values.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyIntentChip.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_ACCESSIBILITY_DECISION_LOAD,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS],
    'Chip removal keeps an accessible name and a typed command boundary.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyIntentConstraintControlSurface.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_EVIDENCE_BACKED_OPTIONS,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.HARD_LIMITS_REQUIRE_EXPLICIT_ACTION,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    'Native constraint controls expose only server-approved values and require an explicit staged action.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyIntentCustomSignalEntry.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_EVIDENCE_BACKED_OPTIONS,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    'Optional custom evidence remains unaccepted until it is validated and explicitly accepted.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyIntentEditor.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_DRAFT_BRIDGE_COVERAGE,
    false,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.DRAFT_BRIDGE,
    [],
    'Compatibility-editor command serialization remains draft-bridge coverage rather than native workflow shape.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyIntentEditorParity.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_DRAFT_BRIDGE_COVERAGE,
    false,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.DRAFT_BRIDGE,
    [],
    'Draft bridge parity belongs to the bridge contract and must not be duplicated by presentation tests.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyIntentGenreControl.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_EVIDENCE_BACKED_OPTIONS,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    'Genre controls prove observed choices remain suggestions until selected through typed commands.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyIntentOptionActionGroup.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_EVIDENCE_BACKED_OPTIONS,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    'Shared option actions preserve labelled selection and one explicit typed activation boundary.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyIntentOptionSelect.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_EVIDENCE_BACKED_OPTIONS,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    'Option selection protects source grouping, selected state, and disabled reasons.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyIntentReviewTriggerControl.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_ACCESSIBILITY_DECISION_LOAD,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
    ],
    'Review triggers expose selected values and duplicate reasons without creating another readiness model.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyIntentSecondaryActionButton.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_ACCESSIBILITY_DECISION_LOAD,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS],
    'Secondary actions keep a visible and programmatic name without competing with the primary action.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyIntentSectionCard.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_ACCESSIBILITY_DECISION_LOAD,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS],
    'Section cards expose a bounded destination-authoring step with readable status and action context.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyIntentSummaryCard.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_WORKFLOW_REGRESSION,
    false,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.NATIVE_STORAGE_CLEANUP,
    [],
    'The compatibility-policy summary remains read-only while native authoring uses one automation-readiness outcome.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyNativeCreateHandoff.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_WORKFLOW_REGRESSION,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.READINESS_LINKS_TO_NEXT_ACTION],
    'Native creation handoff confirms the saved outcome with a bounded follow-up rather than unsaved browser state.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyNativeIntentReconciliation.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_WORKFLOW_REGRESSION,
    false,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.RUNTIME_VERIFIER,
    [],
    'Reconciliation status is runtime verification feedback and remains outside policy authoring setup.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyNativePolicyRecoveryNotice.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_WORKFLOW_REGRESSION,
    false,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.NATIVE_STORAGE_CLEANUP,
    [],
    'Invalid native policy state is read-only recovery feedback and cannot reopen a compatibility or native setup control path.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyNativeProfileRecoveryStatus.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_WORKFLOW_REGRESSION,
    false,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.RUNTIME_VERIFIER,
    [],
    'Native profile recovery status is persisted-policy runtime feedback with no authoring control path.'
  ),
  presentationTestRecord(
    'client/src/__tests__/PolicyPresetMigrationNotice.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.REMOVE_ABANDONED_DIAGNOSTIC_SURFACE,
    false,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.NATIVE_STORAGE_CLEANUP,
    [],
    'Preset migration notices are compatibility-only until native storage cleanup removes the legacy policy path.'
  ),
  presentationTestRecord(
    'client/src/__tests__/IntentSignalPicker.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.PROTECT_DESTINATION_FIRST_FLOW,
    true,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    [POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.TEMPLATE_DERIVED_VALUES_REQUIRE_EXPLICIT_ACCEPTANCE],
    'Canonical, source-labelled candidates require explicit acceptance before they become typed intent commands.'
  ),
  presentationTestRecord(
    'client/src/__tests__/composables/usePolicyIntentDraft.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_DRAFT_BRIDGE_COVERAGE,
    false,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.DRAFT_BRIDGE,
    [],
    'Draft command internals remain bridge coverage, not policy-authoring presentation shape.'
  ),
  presentationTestRecord(
    'client/src/__tests__/utils/policyIntentDraftBridge.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_DRAFT_BRIDGE_COVERAGE,
    false,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.DRAFT_BRIDGE,
    [],
    'Legacy payload translation remains an isolated compatibility bridge concern.'
  ),
  presentationTestRecord(
    'client/src/__tests__/utils/policyIntentDraftView.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_DRAFT_BRIDGE_COVERAGE,
    false,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.DRAFT_BRIDGE,
    [],
    'Draft-view projection belongs to the compatibility bridge and must not define native authoring behavior.'
  ),
  presentationTestRecord(
    'client/src/__tests__/utils/policyIntentModel.test.js',
    POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_DRAFT_BRIDGE_COVERAGE,
    false,
    POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.DRAFT_BRIDGE,
    [],
    'The legacy intent data model remains bridge-owned until native storage replaces compatibility payloads.'
  ),
]);

function listPolicyAuthoringPresentationTestRecords() {
  return POLICY_AUTHORING_PRESENTATION_TEST_RECORDS;
}

function listPolicyAuthoringPresentationTestInventoryFilePaths() {
  return POLICY_AUTHORING_PRESENTATION_TEST_INVENTORY_FILE_PATHS;
}

function listPolicyAuthoringPresentationTestExclusionRecords() {
  return POLICY_AUTHORING_PRESENTATION_TEST_EXCLUSION_RECORDS;
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

  if (typeof candidate.normalPath !== 'boolean') {
    issues.push({
      riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.INVALID_NORMAL_PATH_FLAG,
      filePath: candidate.filePath || null,
      message: 'Presentation test records must explicitly state whether they cover the normal authoring path.',
    });
  }

  if (candidate.normalPath === true &&
      candidate.coverageOwnerId !== POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING) {
    issues.push({
      riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.NON_AUTHORING_OWNER_IN_NORMAL_PATH,
      filePath: candidate.filePath || null,
      coverageOwnerId: candidate.coverageOwnerId || null,
      message: 'Compatibility, bridge, and verifier owners cannot define the normal authoring path.',
    });
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

function findDuplicateFilePaths(records) {
  const seen = new Set();
  const duplicates = new Set();

  for (const record of asArray(records)) {
    const filePath = cleanString(record?.filePath);

    if (!filePath) {
      continue;
    }

    if (seen.has(filePath)) {
      duplicates.add(filePath);
    }

    seen.add(filePath);
  }

  return [...duplicates];
}

function buildPolicyAuthoringPresentationTestInventoryAudit(
  records = POLICY_AUTHORING_PRESENTATION_TEST_RECORDS,
  inventoryFilePaths = POLICY_AUTHORING_PRESENTATION_TEST_INVENTORY_FILE_PATHS,
  exclusions = POLICY_AUTHORING_PRESENTATION_TEST_EXCLUSION_RECORDS
) {
  const candidates = asArray(records);
  const expectedFilePaths = asArray(inventoryFilePaths).map(cleanString).filter(Boolean);
  const expectedFilePathSet = new Set(expectedFilePaths);
  const classifiedFilePathSet = new Set(
    candidates.map(record => cleanString(record?.filePath)).filter(Boolean)
  );
  const issues = [];

  for (const filePath of findDuplicateFilePaths(candidates)) {
    issues.push({
      riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.DUPLICATE_INVENTORY_CLASSIFICATION,
      filePath,
      message: 'Each in-scope presentation test file must have one classification record.',
    });
  }

  for (const filePath of expectedFilePaths) {
    if (!classifiedFilePathSet.has(filePath)) {
      issues.push({
        riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.MISSING_INVENTORY_CLASSIFICATION,
        filePath,
        message: 'Every in-scope presentation test file must have a durable classification.',
      });
    }
  }

  for (const filePath of classifiedFilePathSet) {
    if (!expectedFilePathSet.has(filePath)) {
      issues.push({
        riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.CLASSIFICATION_OUTSIDE_INVENTORY,
        filePath,
        message: 'Presentation test records must be added to the bounded inventory before they can define workflow coverage.',
      });
    }
  }

  for (const exclusion of asArray(exclusions)) {
    const filePath = cleanString(exclusion?.filePath);
    const rationale = cleanString(exclusion?.rationale);

    if (!filePath || !rationale) {
      issues.push({
        riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.INVALID_EXCLUSION,
        filePath: filePath || null,
        message: 'Presentation-test exclusions must identify the excluded file and why it is outside authoring scope.',
      });
      continue;
    }

    if (expectedFilePathSet.has(filePath) || classifiedFilePathSet.has(filePath)) {
      issues.push({
        riskId: POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.EXCLUDED_FILE_IS_CLASSIFIED,
        filePath,
        message: 'An excluded test file cannot also be classified as policy-authoring presentation coverage.',
      });
    }
  }

  return {
    ok: issues.length === 0,
    checkedRecordCount: candidates.length,
    inventoryFilePathCount: expectedFilePaths.length,
    exclusionCount: asArray(exclusions).length,
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

  const inventoryAudit = buildPolicyAuthoringPresentationTestInventoryAudit(candidates);
  issues.push(...inventoryAudit.issues);

  return {
    ok: issues.length === 0,
    checkedRecordCount: results.length,
    requiredBehaviorCount: REQUIRED_POLICY_AUTHORING_PRESENTATION_BEHAVIORS.length,
    coveredBehaviorIds: [...coveredBehaviorIds],
    missingRequiredBehaviorIds,
    inventoryFilePathCount: inventoryAudit.inventoryFilePathCount,
    exclusionCount: inventoryAudit.exclusionCount,
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
    inventoryFilePathCount: POLICY_AUTHORING_PRESENTATION_TEST_INVENTORY_FILE_PATHS.length,
    exclusionCount: POLICY_AUTHORING_PRESENTATION_TEST_EXCLUSION_RECORDS.length,
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
  POLICY_AUTHORING_PRESENTATION_TEST_EXCLUSION_RECORDS,
  POLICY_AUTHORING_PRESENTATION_TEST_INVENTORY_FILE_PATHS,
  POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS,
  POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS,
  buildPolicyAuthoringPresentationTestAudit,
  buildPolicyAuthoringPresentationTestInventoryAudit,
  getPolicyAuthoringPresentationTestRecord,
  getRequiredPolicyAuthoringPresentationBehavior,
  includesInternalPresentationLanguage,
  listPolicyAuthoringPresentationTestRecords,
  listPolicyAuthoringPresentationTestExclusionRecords,
  listPolicyAuthoringPresentationTestInventoryFilePaths,
  listRequiredPolicyAuthoringPresentationBehaviors,
  summarizePolicyAuthoringPresentationTests,
  validatePolicyAuthoringPresentationTestRecord,
};
