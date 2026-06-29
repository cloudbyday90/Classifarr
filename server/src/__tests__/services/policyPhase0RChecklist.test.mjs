import {
  PHASE_0R_ALIGNMENT_CATEGORIES,
  PHASE_0R_CHECKLIST_ITEM_IDS,
  PHASE_0R_IMPLEMENTATION_PHASE_IDS,
  findPhase0RTerminologyFlags,
  getPhase0RChecklistItem,
  getPhase0RImplementationRecord,
  hasPhase0RTerminologyFlags,
  listPhase0RChecklistItems,
  listPhase0RImplementationRecords,
  listPhase0RTerminologyFlags,
  validatePhase0RChecklistResponse,
} from '../../services/policyPhase0RChecklist.mjs';

describe('policyPhase0RChecklist', () => {
  test('defines the required Phase 0R implementation checklist', () => {
    expect(listPhase0RChecklistItems().map(item => item.id)).toEqual([
      PHASE_0R_CHECKLIST_ITEM_IDS.SOURCE_OF_TRUTH_IDENTIFIED,
      PHASE_0R_CHECKLIST_ITEM_IDS.AUTHORITY_LEVEL_IDENTIFIED,
      PHASE_0R_CHECKLIST_ITEM_IDS.LEARNING_SIDE_EFFECT_IDENTIFIED,
      PHASE_0R_CHECKLIST_ITEM_IDS.ROLLBACK_MIGRATION_IMPACT_IDENTIFIED,
      PHASE_0R_CHECKLIST_ITEM_IDS.OPERATOR_LANGUAGE_VALIDATED,
    ]);

    listPhase0RChecklistItems().forEach(item => {
      expect(item.required).toBe(true);
      expect(item.question).toEqual(expect.any(String));
      expect(item.evidenceRequired.length).toBeGreaterThan(0);
      expect(item.failureMode).toEqual(expect.any(String));
    });
  });

  test('exposes each roadmap-required checklist item', () => {
    expect(getPhase0RChecklistItem(PHASE_0R_CHECKLIST_ITEM_IDS.SOURCE_OF_TRUTH_IDENTIFIED))
      .toEqual(expect.objectContaining({
        label: 'Source of truth identified',
      }));
    expect(getPhase0RChecklistItem(PHASE_0R_CHECKLIST_ITEM_IDS.AUTHORITY_LEVEL_IDENTIFIED))
      .toEqual(expect.objectContaining({
        label: 'Authority level identified',
      }));
    expect(getPhase0RChecklistItem(PHASE_0R_CHECKLIST_ITEM_IDS.LEARNING_SIDE_EFFECT_IDENTIFIED))
      .toEqual(expect.objectContaining({
        label: 'Learning side effect identified',
      }));
    expect(getPhase0RChecklistItem(PHASE_0R_CHECKLIST_ITEM_IDS.ROLLBACK_MIGRATION_IMPACT_IDENTIFIED))
      .toEqual(expect.objectContaining({
        label: 'Rollback or migration impact identified',
      }));
    expect(getPhase0RChecklistItem(PHASE_0R_CHECKLIST_ITEM_IDS.OPERATOR_LANGUAGE_VALIDATED))
      .toEqual(expect.objectContaining({
        label: 'Operator-facing language validated',
      }));
  });

  test('fails closed when checklist responses are incomplete', () => {
    const result = validatePhase0RChecklistResponse({
      [PHASE_0R_CHECKLIST_ITEM_IDS.SOURCE_OF_TRUTH_IDENTIFIED]: true,
      [PHASE_0R_CHECKLIST_ITEM_IDS.AUTHORITY_LEVEL_IDENTIFIED]: { satisfied: true },
    });

    expect(result.valid).toBe(false);
    expect(result.missingItemIds).toEqual([
      PHASE_0R_CHECKLIST_ITEM_IDS.LEARNING_SIDE_EFFECT_IDENTIFIED,
      PHASE_0R_CHECKLIST_ITEM_IDS.ROLLBACK_MIGRATION_IMPACT_IDENTIFIED,
      PHASE_0R_CHECKLIST_ITEM_IDS.OPERATOR_LANGUAGE_VALIDATED,
    ]);
  });

  test('accepts complete checklist responses with boolean or object values', () => {
    const result = validatePhase0RChecklistResponse({
      [PHASE_0R_CHECKLIST_ITEM_IDS.SOURCE_OF_TRUTH_IDENTIFIED]: true,
      [PHASE_0R_CHECKLIST_ITEM_IDS.AUTHORITY_LEVEL_IDENTIFIED]: { satisfied: true },
      [PHASE_0R_CHECKLIST_ITEM_IDS.LEARNING_SIDE_EFFECT_IDENTIFIED]: { status: 'satisfied' },
      [PHASE_0R_CHECKLIST_ITEM_IDS.ROLLBACK_MIGRATION_IMPACT_IDENTIFIED]: true,
      [PHASE_0R_CHECKLIST_ITEM_IDS.OPERATOR_LANGUAGE_VALIDATED]: true,
    });

    expect(result).toEqual({
      valid: true,
      missingItemIds: [],
      missingItems: [],
    });
  });

  test('records Phase 0R implementation docs, contracts, and tests', () => {
    expect(listPhase0RImplementationRecords().map(record => record.phaseId)).toEqual([
      PHASE_0R_IMPLEMENTATION_PHASE_IDS.AUTHORITY_VOCABULARY,
      PHASE_0R_IMPLEMENTATION_PHASE_IDS.USER_MENTAL_MODEL,
      PHASE_0R_IMPLEMENTATION_PHASE_IDS.LEGACY_COMPATIBILITY_VOCABULARY,
      PHASE_0R_IMPLEMENTATION_PHASE_IDS.QUESTION_LEARNING_VOCABULARY,
      PHASE_0R_IMPLEMENTATION_PHASE_IDS.DOCUMENTATION_TEST_ALIGNMENT,
    ]);

    expect(getPhase0RImplementationRecord(PHASE_0R_IMPLEMENTATION_PHASE_IDS.DOCUMENTATION_TEST_ALIGNMENT))
      .toEqual(expect.objectContaining({
        docPath: 'docs/architecture/policy-builder-phase-0r-documentation-test-alignment.md',
        servicePath: 'server/src/services/policyPhase0RChecklist.mjs',
        testPath: 'server/src/__tests__/services/policyPhase0RChecklist.test.mjs',
      }));
  });

  test('classifies stale terminology by replacement path', () => {
    const flags = findPhase0RTerminologyFlags(
      'The raw preset uses customSignals, provider gate details, and a genre priority question.',
    );

    expect(flags.map(flag => flag.category)).toEqual([
      PHASE_0R_ALIGNMENT_CATEGORIES.REPLACE_PRODUCT_LANGUAGE,
      PHASE_0R_ALIGNMENT_CATEGORIES.LEGACY_INTERNAL_ONLY,
      PHASE_0R_ALIGNMENT_CATEGORIES.MAINTAINER_DIAGNOSTIC_ONLY,
    ]);
    expect(flags[0].matchedPhrases).toEqual(['genre priority']);
    expect(flags[1].matchedPhrases).toEqual(['customSignals', 'raw preset']);
    expect(flags[2].matchedPhrases).toEqual(['provider gate']);
  });

  test('detects when product text has or does not have Phase 0R terminology flags', () => {
    expect(hasPhase0RTerminologyFlags('Does this item belong in this destination?')).toBe(false);
    expect(hasPhase0RTerminologyFlags('Which genre should be prioritized?')).toBe(true);
  });

  test('exposes immutable checklist, implementation, and terminology records', () => {
    const checklist = listPhase0RChecklistItems();
    const implementationRecords = listPhase0RImplementationRecords();
    const terminologyFlags = listPhase0RTerminologyFlags();

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
    expect(getPhase0RChecklistItem('unknown')).toBeNull();
    expect(getPhase0RImplementationRecord('unknown')).toBeNull();
    expect(findPhase0RTerminologyFlags()).toEqual([]);
    expect(hasPhase0RTerminologyFlags()).toBe(false);
  });
});
