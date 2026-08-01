/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  listPolicyCompatibilityMaintenanceTestSourcePaths,
} from '../../services/policyCompatibilityMaintenanceTestOwnership.mjs';
import {
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
  listPolicyAuthoringPresentationTestExclusionRecords,
  listPolicyAuthoringPresentationTestInventoryFilePaths,
  listPolicyAuthoringPresentationTestRecords,
  listRequiredPolicyAuthoringPresentationBehaviors,
  summarizePolicyAuthoringPresentationTests,
  validatePolicyAuthoringPresentationTestRecord,
} from '../../services/policyAuthoringPresentationTests.mjs';

describe('policyAuthoringPresentationTests', () => {
  test('classifies every in-scope presentation test once and documents adjacent policy test exclusions', async () => {
    const testDirectory = resolve(import.meta.dirname, '../../../..', 'client/src/__tests__');
    const directPolicyTestPaths = (await readdir(testDirectory))
      .filter(fileName => /^(Policy|IntentSignal|HardLimit|Avoid|ReviewTrigger).*\.test\.js$/.test(fileName))
      .map(fileName => `client/src/__tests__/${fileName}`)
      .sort();
    const documentedPolicyTestPaths = [
      ...listPolicyAuthoringPresentationTestInventoryFilePaths().filter(filePath => !filePath.includes('/composables/') && !filePath.includes('/utils/')),
      ...listPolicyCompatibilityMaintenanceTestSourcePaths(),
      ...listPolicyAuthoringPresentationTestExclusionRecords().map(record => record.filePath),
    ].filter((filePath, index, paths) => paths.indexOf(filePath) === index).sort();

    expect(listPolicyAuthoringPresentationTestRecords().map(record => record.filePath).sort())
      .toEqual([...POLICY_AUTHORING_PRESENTATION_TEST_INVENTORY_FILE_PATHS].sort());
    expect(documentedPolicyTestPaths).toEqual(directPolicyTestPaths);
    expect(listPolicyAuthoringPresentationTestExclusionRecords())
      .toEqual(POLICY_AUTHORING_PRESENTATION_TEST_EXCLUSION_RECORDS);
  });

  test('defines required presentation behaviors from the policy authoring roadmap', () => {
    expect(listRequiredPolicyAuthoringPresentationBehaviors().map(behavior => behavior.id)).toEqual([
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.TEMPLATE_DERIVED_VALUES_REQUIRE_EXPLICIT_ACCEPTANCE,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.OBSERVED_EVIDENCE_DISTINCT_FROM_DECLARED_INTENT,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.MULTI_SELECT_EMITS_TYPED_DRAFT_COMMANDS,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.ACCESSIBLE_NAMES_AND_DISABLED_REASONS,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.HARD_LIMITS_REQUIRE_EXPLICIT_ACTION,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.READINESS_LINKS_TO_NEXT_ACTION,
      POLICY_AUTHORING_PRESENTATION_TEST_BEHAVIOR_IDS.INTERNAL_DIAGNOSTIC_PANELS_ABSENT,
    ]);
  });

  test('keeps draft bridge behavior owned by the draft bridge instead of presentation tests', () => {
    expect(getPolicyAuthoringPresentationTestRecord('client/src/__tests__/utils/policyIntentDraftBridge.test.js'))
      .toEqual(expect.objectContaining({
        categoryId: POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_DRAFT_BRIDGE_COVERAGE,
        coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.DRAFT_BRIDGE,
        normalPath: false,
      }));
  });

  test('uses durable coverage owners instead of roadmap owner ids', () => {
    const ownerIds = Object.values(POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS);

    expect(listPolicyAuthoringPresentationTestRecords().map(record => record.coverageOwnerId))
      .toContain(POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.RUNTIME_VERIFIER);
    listPolicyAuthoringPresentationTestRecords().forEach(record => {
      expect(ownerIds).toContain(record.coverageOwnerId);
      expect(record.coverageOwnerId).not.toMatch(/^\d+R$/);
    });
  });

  test('audits the default policy authoring presentation test plan', () => {
    expect(buildPolicyAuthoringPresentationTestAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedRecordCount: listPolicyAuthoringPresentationTestRecords().length,
      requiredBehaviorCount: listRequiredPolicyAuthoringPresentationBehaviors().length,
      inventoryFilePathCount: new Set([
        ...listPolicyAuthoringPresentationTestInventoryFilePaths(),
        ...listPolicyCompatibilityMaintenanceTestSourcePaths(),
      ]).size,
      exclusionCount: listPolicyAuthoringPresentationTestExclusionRecords().length,
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
    expect(diagnosticResult.issues.map(issue => issue.riskId))
      .toContain(POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.NON_AUTHORING_OWNER_IN_NORMAL_PATH);

    const draftResult = validatePolicyAuthoringPresentationTestRecord({
      ...getPolicyAuthoringPresentationTestRecord('client/src/__tests__/utils/policyIntentDraftBridge.test.js'),
      coverageOwnerId: POLICY_AUTHORING_PRESENTATION_TEST_OWNER_IDS.POLICY_AUTHORING,
    });

    expect(draftResult.issues.map(issue => issue.riskId))
      .toContain(POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.DRAFT_BRIDGE_DUPLICATED_IN_PRESENTATION);
  });

  test('detects internal diagnostic wording in normal product-facing tests', () => {
    expect(includesInternalPresentationLanguage('Replay preview and provider readiness are visible.')).toBe(true);
    expect(includesInternalPresentationLanguage('Readiness links to the next action.')).toBe(false);

    const result = validatePolicyAuthoringPresentationTestRecord({
      ...getPolicyAuthoringPresentationTestRecord('client/src/__tests__/PolicyIntentSectionCard.test.js'),
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
      inventoryFilePathCount: listPolicyAuthoringPresentationTestInventoryFilePaths().length,
      exclusionCount: listPolicyAuthoringPresentationTestExclusionRecords().length,
      normalPathRecordCount: 23,
      draftBridgeOwnedRecordCount: 4,
      countsByCategory: expect.objectContaining({
        [POLICY_AUTHORING_PRESENTATION_TEST_CATEGORY_IDS.KEEP_DRAFT_BRIDGE_COVERAGE]: 4,
      }),
    }));
  });

  test('fails incomplete, duplicate, out-of-scope, and invalid inventory classifications', () => {
    const records = listPolicyAuthoringPresentationTestRecords();
    const oneRecord = records[0];
    const result = buildPolicyAuthoringPresentationTestInventoryAudit(
      [
        ...records.slice(1),
        oneRecord,
        oneRecord,
        { ...oneRecord, filePath: 'client/src/__tests__/UnexpectedPolicyTest.test.js' },
      ],
      [...listPolicyAuthoringPresentationTestInventoryFilePaths(), 'client/src/__tests__/MissingPolicyTest.test.js'],
      [
        ...listPolicyAuthoringPresentationTestExclusionRecords(),
        { filePath: oneRecord.filePath, rationale: 'Invalid overlap.' },
        { filePath: '', rationale: '' },
      ]
    );

    expect(result.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.MISSING_INVENTORY_CLASSIFICATION,
      POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.DUPLICATE_INVENTORY_CLASSIFICATION,
      POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.CLASSIFICATION_OUTSIDE_INVENTORY,
      POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.EXCLUDED_FILE_IS_CLASSIFIED,
      POLICY_AUTHORING_PRESENTATION_TEST_RISK_IDS.INVALID_EXCLUSION,
    ]));
  });

  test('exposes immutable records and returns null for unknown lookups', () => {
    const records = listPolicyAuthoringPresentationTestRecords();
    const inventoryFilePaths = listPolicyAuthoringPresentationTestInventoryFilePaths();
    const exclusions = listPolicyAuthoringPresentationTestExclusionRecords();
    const behaviors = listRequiredPolicyAuthoringPresentationBehaviors();

    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
    expect(Object.isFrozen(inventoryFilePaths)).toBe(true);
    expect(Object.isFrozen(exclusions)).toBe(true);
    expect(Object.isFrozen(exclusions[0])).toBe(true);
    expect(Object.isFrozen(behaviors)).toBe(true);
    expect(Object.isFrozen(behaviors[0])).toBe(true);
    expect(getPolicyAuthoringPresentationTestRecord('unknown')).toBeNull();
    expect(getRequiredPolicyAuthoringPresentationBehavior('unknown')).toBeNull();
  });
});
