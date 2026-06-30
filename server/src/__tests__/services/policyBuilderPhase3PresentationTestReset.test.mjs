import {
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
} from '../../services/policyBuilderPhase3PresentationTestReset.mjs';

describe('policyBuilderPhase3PresentationTestReset', () => {
  test('categorizes current policy-builder presentation tests by reset action', () => {
    expect(listPhase3PresentationTestRecords().map(record => record.filePath)).toEqual([
      'client/src/__tests__/PolicyBuilderModal.test.js',
      'client/src/__tests__/PolicyBuilderLibraryContext.test.js',
      'client/src/__tests__/PolicyStarterTemplateBrowser.test.js',
      'client/src/__tests__/PolicyStarterTemplateDetails.test.js',
      'client/src/__tests__/PolicyStarterTemplateMechanics.test.js',
      'client/src/__tests__/PolicyIntentGenreControl.test.js',
      'client/src/__tests__/PolicyIntentOptionSelect.test.js',
      'client/src/__tests__/PolicyIntentChip.test.js',
      'client/src/__tests__/PolicyIntentCertificationControl.test.js',
      'client/src/__tests__/PolicyIntentReadinessSummary.test.js',
      'client/src/__tests__/PolicyIntentImpactPreviewCard.test.js',
      'client/src/__tests__/PolicyIntentReplayPreviewCard.test.js',
      'client/src/__tests__/PolicyIntentEditorParity.test.js',
      'client/src/__tests__/composables/usePolicyIntentDraft.test.js',
    ]);
  });

  test('defines required presentation behaviors from the Phase 3R roadmap', () => {
    expect(listRequiredPhase3PresentationBehaviors().map(behavior => behavior.id)).toEqual([
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.STARTER_TEMPLATES_SECONDARY_TO_DESTINATION,
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT,
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS,
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.HARD_LIMITS_REQUIRE_EXPLICIT_ACTION,
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.READINESS_LINKS_TO_NEXT_ACTION,
      PHASE_3R_PRESENTATION_TEST_BEHAVIOR_IDS.INTERNAL_DIAGNOSTIC_PANELS_ABSENT,
    ]);
  });

  test('keeps draft bridge behavior owned by Phase 2R instead of presentation tests', () => {
    expect(getPhase3PresentationTestRecord('client/src/__tests__/PolicyIntentEditorParity.test.js'))
      .toEqual(expect.objectContaining({
        categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.KEEP_PHASE_2R_DRAFT_BRIDGE,
        phaseOwner: '2R',
        normalPath: false,
      }));
  });

  test('marks replay and impact preview presentation tests as abandoned normal-path diagnostics', () => {
    [
      'client/src/__tests__/PolicyIntentImpactPreviewCard.test.js',
      'client/src/__tests__/PolicyIntentReplayPreviewCard.test.js',
    ].forEach(filePath => {
      expect(getPhase3PresentationTestRecord(filePath)).toEqual(expect.objectContaining({
        categoryId: PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.DELETE_ABANDONED_DIAGNOSTIC_SURFACE,
        normalPath: false,
      }));
    });
  });

  test('audits the default Phase 3R.9 reset plan', () => {
    expect(buildPhase3PresentationTestResetAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedRecordCount: listPhase3PresentationTestRecords().length,
      requiredBehaviorCount: listRequiredPhase3PresentationBehaviors().length,
      missingRequiredBehaviorIds: [],
      issueCount: 0,
    }));
  });

  test('fails unknown files and unknown behavior references', () => {
    const result = validatePhase3PresentationTestRecord({
      filePath: 'client/src/__tests__/UnknownPolicyPanel.test.js',
      categoryId: 'unknown_category',
      normalPath: true,
      phaseOwner: '3R',
      requiredBehaviorIds: ['unknown_behavior'],
      rationale: 'Unknown test.',
    });

    expect(result.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      PHASE_3R_PRESENTATION_TEST_RISK_IDS.UNKNOWN_TEST_FILE,
      PHASE_3R_PRESENTATION_TEST_RISK_IDS.UNKNOWN_CATEGORY,
      PHASE_3R_PRESENTATION_TEST_RISK_IDS.UNKNOWN_BEHAVIOR,
    ]));
  });

  test('fails rewrite records without target workflow behavior', () => {
    const result = validatePhase3PresentationTestRecord({
      ...getPhase3PresentationTestRecord('client/src/__tests__/PolicyBuilderModal.test.js'),
      requiredBehaviorIds: [],
    });

    expect(result.issues.map(issue => issue.riskId))
      .toContain(PHASE_3R_PRESENTATION_TEST_RISK_IDS.MISSING_REWRITE_BEHAVIOR);
  });

  test('fails normal-path diagnostic tests and duplicated draft bridge ownership', () => {
    const diagnosticResult = validatePhase3PresentationTestRecord({
      ...getPhase3PresentationTestRecord('client/src/__tests__/PolicyIntentImpactPreviewCard.test.js'),
      normalPath: true,
    });

    expect(diagnosticResult.issues.map(issue => issue.riskId))
      .toContain(PHASE_3R_PRESENTATION_TEST_RISK_IDS.NORMAL_PATH_DIAGNOSTIC_TEST);

    const draftResult = validatePhase3PresentationTestRecord({
      ...getPhase3PresentationTestRecord('client/src/__tests__/PolicyIntentEditorParity.test.js'),
      phaseOwner: '3R',
    });

    expect(draftResult.issues.map(issue => issue.riskId))
      .toContain(PHASE_3R_PRESENTATION_TEST_RISK_IDS.DRAFT_BRIDGE_DUPLICATED_IN_PRESENTATION);
  });

  test('detects internal diagnostic wording in normal product-facing tests', () => {
    expect(includesInternalPresentationLanguage('Replay preview and provider readiness are visible.')).toBe(true);
    expect(includesInternalPresentationLanguage('Readiness links to the next action.')).toBe(false);

    const result = validatePhase3PresentationTestRecord({
      ...getPhase3PresentationTestRecord('client/src/__tests__/PolicyIntentReadinessSummary.test.js'),
      productAssertions: [
        'Shows TMDB live preview scoring details.',
      ],
    });

    expect(result.issues.map(issue => issue.riskId))
      .toContain(PHASE_3R_PRESENTATION_TEST_RISK_IDS.INTERNAL_LANGUAGE_IN_PRODUCT_TEST);
  });

  test('summarizes reset categories for implementation planning', () => {
    expect(summarizePhase3PresentationTestReset()).toEqual(expect.objectContaining({
      recordCount: listPhase3PresentationTestRecords().length,
      requiredBehaviorCount: listRequiredPhase3PresentationBehaviors().length,
      normalPathRecordCount: 9,
      phase2ROwnedRecordCount: 2,
      countsByCategory: expect.objectContaining({
        [PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.DELETE_ABANDONED_DIAGNOSTIC_SURFACE]: 3,
        [PHASE_3R_PRESENTATION_TEST_CATEGORY_IDS.KEEP_PHASE_2R_DRAFT_BRIDGE]: 2,
      }),
    }));
  });

  test('exposes immutable records and returns null for unknown lookups', () => {
    const records = listPhase3PresentationTestRecords();
    const behaviors = listRequiredPhase3PresentationBehaviors();

    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
    expect(Object.isFrozen(behaviors)).toBe(true);
    expect(Object.isFrozen(behaviors[0])).toBe(true);
    expect(getPhase3PresentationTestRecord('unknown')).toBeNull();
    expect(getRequiredPhase3PresentationBehavior('unknown')).toBeNull();
  });
});
