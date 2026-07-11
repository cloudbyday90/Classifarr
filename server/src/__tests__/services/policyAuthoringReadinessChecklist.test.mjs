import {
  POLICY_AUTHORING_ALIGNMENT_CATEGORIES,
  POLICY_AUTHORING_CHECKLIST_ITEM_IDS,
  POLICY_AUTHORING_COMPONENT_IDS,
  findPolicyAuthoringTerminologyFlags,
  getPolicyAuthoringChecklistItem,
  getPolicyAuthoringComponentRecord,
  hasPolicyAuthoringTerminologyFlags,
  listPolicyAuthoringChecklistItems,
  listPolicyAuthoringComponentRecords,
  listPolicyAuthoringTerminologyFlags,
  validatePolicyAuthoringChecklistResponse,
} from '../../services/policyAuthoringReadinessChecklist.mjs';

describe('policyAuthoringReadinessChecklist', () => {
  test('defines the required policy-authoring checklist', () => {
    expect(listPolicyAuthoringChecklistItems().map(item => item.id)).toEqual([
      POLICY_AUTHORING_CHECKLIST_ITEM_IDS.SOURCE_OF_TRUTH_IDENTIFIED,
      POLICY_AUTHORING_CHECKLIST_ITEM_IDS.AUTHORITY_LEVEL_IDENTIFIED,
      POLICY_AUTHORING_CHECKLIST_ITEM_IDS.LEARNING_SIDE_EFFECT_IDENTIFIED,
      POLICY_AUTHORING_CHECKLIST_ITEM_IDS.ROLLBACK_MIGRATION_IMPACT_IDENTIFIED,
      POLICY_AUTHORING_CHECKLIST_ITEM_IDS.OPERATOR_LANGUAGE_VALIDATED,
    ]);

    listPolicyAuthoringChecklistItems().forEach(item => {
      expect(item.required).toBe(true);
      expect(item.question).toEqual(expect.any(String));
      expect(item.evidenceRequired.length).toBeGreaterThan(0);
      expect(item.failureMode).toEqual(expect.any(String));
    });
  });

  test('exposes each roadmap-required checklist item', () => {
    expect(getPolicyAuthoringChecklistItem(POLICY_AUTHORING_CHECKLIST_ITEM_IDS.SOURCE_OF_TRUTH_IDENTIFIED))
      .toEqual(expect.objectContaining({
        label: 'Source of truth identified',
      }));
    expect(getPolicyAuthoringChecklistItem(POLICY_AUTHORING_CHECKLIST_ITEM_IDS.AUTHORITY_LEVEL_IDENTIFIED))
      .toEqual(expect.objectContaining({
        label: 'Authority level identified',
      }));
    expect(getPolicyAuthoringChecklistItem(POLICY_AUTHORING_CHECKLIST_ITEM_IDS.LEARNING_SIDE_EFFECT_IDENTIFIED))
      .toEqual(expect.objectContaining({
        label: 'Learning side effect identified',
      }));
    expect(getPolicyAuthoringChecklistItem(POLICY_AUTHORING_CHECKLIST_ITEM_IDS.ROLLBACK_MIGRATION_IMPACT_IDENTIFIED))
      .toEqual(expect.objectContaining({
        label: 'Rollback or migration impact identified',
      }));
    expect(getPolicyAuthoringChecklistItem(POLICY_AUTHORING_CHECKLIST_ITEM_IDS.OPERATOR_LANGUAGE_VALIDATED))
      .toEqual(expect.objectContaining({
        label: 'Operator-facing language validated',
      }));
  });

  test('fails closed when checklist responses are incomplete', () => {
    const result = validatePolicyAuthoringChecklistResponse({
      [POLICY_AUTHORING_CHECKLIST_ITEM_IDS.SOURCE_OF_TRUTH_IDENTIFIED]: true,
      [POLICY_AUTHORING_CHECKLIST_ITEM_IDS.AUTHORITY_LEVEL_IDENTIFIED]: { satisfied: true },
    });

    expect(result.valid).toBe(false);
    expect(result.missingItemIds).toEqual([
      POLICY_AUTHORING_CHECKLIST_ITEM_IDS.LEARNING_SIDE_EFFECT_IDENTIFIED,
      POLICY_AUTHORING_CHECKLIST_ITEM_IDS.ROLLBACK_MIGRATION_IMPACT_IDENTIFIED,
      POLICY_AUTHORING_CHECKLIST_ITEM_IDS.OPERATOR_LANGUAGE_VALIDATED,
    ]);
  });

  test('accepts complete checklist responses with boolean or object values', () => {
    const result = validatePolicyAuthoringChecklistResponse({
      [POLICY_AUTHORING_CHECKLIST_ITEM_IDS.SOURCE_OF_TRUTH_IDENTIFIED]: true,
      [POLICY_AUTHORING_CHECKLIST_ITEM_IDS.AUTHORITY_LEVEL_IDENTIFIED]: { satisfied: true },
      [POLICY_AUTHORING_CHECKLIST_ITEM_IDS.LEARNING_SIDE_EFFECT_IDENTIFIED]: { status: 'satisfied' },
      [POLICY_AUTHORING_CHECKLIST_ITEM_IDS.ROLLBACK_MIGRATION_IMPACT_IDENTIFIED]: true,
      [POLICY_AUTHORING_CHECKLIST_ITEM_IDS.OPERATOR_LANGUAGE_VALIDATED]: true,
    });

    expect(result).toEqual({
      valid: true,
      missingItemIds: [],
      missingItems: [],
    });
  });

  test('records authoring docs, contracts, and tests', () => {
    expect(listPolicyAuthoringComponentRecords().map(record => record.componentId)).toEqual([
      POLICY_AUTHORING_COMPONENT_IDS.AUTHORITY_VOCABULARY,
      POLICY_AUTHORING_COMPONENT_IDS.USER_MENTAL_MODEL,
      POLICY_AUTHORING_COMPONENT_IDS.LEGACY_COMPATIBILITY_VOCABULARY,
      POLICY_AUTHORING_COMPONENT_IDS.QUESTION_LEARNING_VOCABULARY,
      POLICY_AUTHORING_COMPONENT_IDS.DOCUMENTATION_TEST_ALIGNMENT,
    ]);

    expect(getPolicyAuthoringComponentRecord(POLICY_AUTHORING_COMPONENT_IDS.DOCUMENTATION_TEST_ALIGNMENT))
      .toEqual(expect.objectContaining({
        docPath: 'docs/architecture/policy-authoring-documentation-test-alignment.md',
        servicePath: 'server/src/services/policyAuthoringReadinessChecklist.mjs',
        testPath: 'server/src/__tests__/services/policyAuthoringReadinessChecklist.test.mjs',
      }));
    expect(listPolicyAuthoringComponentRecords().every(record =>
      Object.hasOwn(record, 'componentId') && !Object.hasOwn(record, 'phaseId')
    )).toBe(true);
  });

  test('classifies stale terminology by replacement path', () => {
    const flags = findPolicyAuthoringTerminologyFlags(
      'The raw preset uses customSignals, provider gate details, and a genre priority question.',
    );

    expect(flags.map(flag => flag.category)).toEqual([
      POLICY_AUTHORING_ALIGNMENT_CATEGORIES.REPLACE_PRODUCT_LANGUAGE,
      POLICY_AUTHORING_ALIGNMENT_CATEGORIES.LEGACY_INTERNAL_ONLY,
      POLICY_AUTHORING_ALIGNMENT_CATEGORIES.MAINTAINER_DIAGNOSTIC_ONLY,
    ]);
    expect(flags[0].matchedPhrases).toEqual(['genre priority']);
    expect(flags[1].matchedPhrases).toEqual(['customSignals', 'raw preset']);
    expect(flags[2].matchedPhrases).toEqual(['provider gate']);
  });

  test('detects when product text has or does not have authoring terminology flags', () => {
    expect(hasPolicyAuthoringTerminologyFlags('Does this item belong in this destination?')).toBe(false);
    expect(hasPolicyAuthoringTerminologyFlags('Which genre should be prioritized?')).toBe(true);
  });

  test('exposes immutable checklist, implementation, and terminology records', () => {
    const checklist = listPolicyAuthoringChecklistItems();
    const implementationRecords = listPolicyAuthoringComponentRecords();
    const terminologyFlags = listPolicyAuthoringTerminologyFlags();

    expect(Object.isFrozen(checklist)).toBe(true);
    expect(Object.isFrozen(checklist[0])).toBe(true);
    expect(Object.isFrozen(checklist[0].evidenceRequired)).toBe(true);
    expect(Object.isFrozen(implementationRecords)).toBe(true);
    expect(Object.isFrozen(implementationRecords[0])).toBe(true);
    expect(Object.isFrozen(implementationRecords[0].protects)).toBe(true);
    expect(Object.isFrozen(terminologyFlags)).toBe(true);
    expect(Object.isFrozen(terminologyFlags[0])).toBe(true);
    expect(Object.isFrozen(terminologyFlags[0].phrases)).toBe(true);
  });

  test('returns null or empty results for unknown inputs', () => {
    expect(getPolicyAuthoringChecklistItem('unknown')).toBeNull();
    expect(getPolicyAuthoringComponentRecord('unknown')).toBeNull();
    expect(findPolicyAuthoringTerminologyFlags()).toEqual([]);
    expect(hasPolicyAuthoringTerminologyFlags()).toBe(false);
  });
});
