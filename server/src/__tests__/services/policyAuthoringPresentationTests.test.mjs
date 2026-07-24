import {
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
} from '../../services/policyAuthoringPresentationTests.mjs';

describe('policyAuthoringPresentationTests', () => {
  test('categorizes current policy-builder presentation tests by reset action', () => {
    expect(listPolicyAuthoringPresentationTestRecords().map(record => record.filePath)).toEqual([
      'client/src/__tests__/PolicyBuilderModal.test.js',
      'client/src/__tests__/PolicyBuilderLibraryContext.test.js',
      'client/src/__tests__/PolicyStarterTemplateBrowser.test.js',
      'client/src/__tests__/PolicyStarterTemplateAccelerator.test.js',
      'client/src/__tests__/PolicyIntentGenreControl.test.js',
      'client/src/__tests__/PolicyIntentOptionSelect.test.js',
      'client/src/__tests__/PolicyIntentChip.test.js',
      'client/src/__tests__/PolicyIntentCertificationControl.test.js',
      'client/src/__tests__/PolicyIntentReadinessSummary.test.js',
      'client/src/__tests__/PolicyIntentEditorParity.test.js',
      'client/src/__tests__/composables/usePolicyIntentDraft.test.js',
    ]);
  });

  test('defines required presentation behaviors from the policy authoring roadmap', () => {
    expect(listRequiredPolicyAuthoringPresentationBehaviors().map(behavior => behavior.id)).toEqual([
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.STARTER_TEMPLATES_SECONDARY_TO_DESTINATION,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.HARD_LIMITS_REQUIRE_EXPLICIT_ACTION,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.READINESS_LINKS_TO_NEXT_ACTION,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.INTERNAL_DIAGNOSTIC_PANELS_ABSENT,
    ]);
  });

  test('keeps draft bridge behavior owned by the draft bridge instead of presentation tests', () => {
    expect(getPolicyAuthoringPresentationTestRecord('client/src/__tests__/PolicyIntentEditorParity.test.js'))
      .toEqual(expect.objectContaining({
        categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_DRAFT_BRIDGE_COVERAGE,
        coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.DRAFT_BRIDGE,
        normalPath: false,
      }));
  });

  test('uses durable coverage owners instead of roadmap owner ids', () => {
    const ownerIds = Object.values(POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS);

    expect(listPolicyAuthoringPresentationTestRecords().map(record => record.coverageOwnerId))
      .not.toContain(POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.RUNTIME_VERIFIER);
    listPolicyAuthoringPresentationTestRecords().forEach(record => {
      expect(ownerIds).toContain(record.coverageOwnerId);
      expect(record.coverageOwnerId).not.toMatch(/^\d+R$/);
    });
  });

  test('does not retain removed replay and impact preview presentation tests', () => {
    [
      'client/src/__tests__/PolicyIntentImpactPreviewCard.test.js',
      'client/src/__tests__/PolicyIntentReplayPreviewCard.test.js',
    ].forEach(filePath => {
      expect(getPolicyAuthoringPresentationTestRecord(filePath)).toBeNull();
    });
  });

  test('audits the default policy authoring presentation test plan', () => {
    expect(buildPolicyAuthoringPresentationTestAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedRecordCount: listPolicyAuthoringPresentationTestRecords().length,
      requiredBehaviorCount: listRequiredPolicyAuthoringPresentationBehaviors().length,
      missingRequiredBehaviorIds: [],
      issueCount: 0,
    }));
  });

  test('fails unknown files and unknown behavior references', () => {
    const result = validatePolicyAuthoringPresentationTestRecord({
      filePath: 'client/src/__tests__/UnknownPolicyPanel.test.js',
      categoryId: 'unknown_category',
      normalPath: true,
      coverageOwnerId: 'unknown_owner',
      requiredBehaviorIds: ['unknown_behavior'],
      rationale: 'Unknown test.',
    });

    expect(result.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.UNKNOWN_TEST_FILE,
      POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.UNKNOWN_CATEGORY,
      POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.UNKNOWN_OWNER,
      POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.UNKNOWN_BEHAVIOR,
    ]));
  });

  test('fails protection records without target workflow behavior', () => {
    const result = validatePolicyAuthoringPresentationTestRecord({
      ...getPolicyAuthoringPresentationTestRecord('client/src/__tests__/PolicyBuilderModal.test.js'),
      requiredBehaviorIds: [],
    });

    expect(result.issues.map(issue => issue.riskId))
      .toContain(POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.MISSING_PROTECTED_BEHAVIOR);
  });

  test('fails reintroduced normal-path diagnostics and duplicated draft bridge ownership', () => {
    const diagnosticResult = validatePolicyAuthoringPresentationTestRecord({
      ...getPolicyAuthoringPresentationTestRecord('client/src/__tests__/PolicyBuilderModal.test.js'),
      categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.REMOVE_ABANDONED_DIAGNOSTIC_SURFACE,
      coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.RUNTIME_VERIFIER,
      normalPath: true,
    });

    expect(diagnosticResult.issues.map(issue => issue.riskId))
      .toContain(POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.NORMAL_PATH_DIAGNOSTIC_TEST);

    const draftResult = validatePolicyAuthoringPresentationTestRecord({
      ...getPolicyAuthoringPresentationTestRecord('client/src/__tests__/PolicyIntentEditorParity.test.js'),
      coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    });

    expect(draftResult.issues.map(issue => issue.riskId))
      .toContain(POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.DRAFT_BRIDGE_DUPLICATED_IN_PRESENTATION);
  });

  test('detects internal diagnostic wording in normal product-facing tests', () => {
    expect(includesInternalPresentationLanguage('Replay preview and provider readiness are visible.')).toBe(true);
    expect(includesInternalPresentationLanguage('Readiness links to the next action.')).toBe(false);

    const result = validatePolicyAuthoringPresentationTestRecord({
      ...getPolicyAuthoringPresentationTestRecord('client/src/__tests__/PolicyIntentReadinessSummary.test.js'),
      productAssertions: [
        'Shows TMDB live preview scoring details.',
      ],
    });

    expect(result.issues.map(issue => issue.riskId))
      .toContain(POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.INTERNAL_LANGUAGE_IN_PRODUCT_TEST);
  });

  test('summarizes reset categories for implementation planning', () => {
    expect(summarizePolicyAuthoringPresentationTests()).toEqual(expect.objectContaining({
      recordCount: listPolicyAuthoringPresentationTestRecords().length,
      requiredBehaviorCount: listRequiredPolicyAuthoringPresentationBehaviors().length,
      normalPathRecordCount: 9,
      draftBridgeOwnedRecordCount: 2,
      countsByCategory: expect.objectContaining({
        [POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_DRAFT_BRIDGE_COVERAGE]: 2,
      }),
    }));
  });

  test('exposes immutable records and returns null for unknown lookups', () => {
    const records = listPolicyAuthoringPresentationTestRecords();
    const behaviors = listRequiredPolicyAuthoringPresentationBehaviors();

    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
    expect(Object.isFrozen(behaviors)).toBe(true);
    expect(Object.isFrozen(behaviors[0])).toBe(true);
    expect(getPolicyAuthoringPresentationTestRecord('unknown')).toBeNull();
    expect(getRequiredPolicyAuthoringPresentationBehavior('unknown')).toBeNull();
  });
});
