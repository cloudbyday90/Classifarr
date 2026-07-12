import fs from 'node:fs';
import path from 'node:path';
import {
  TEST_BOUNDARY_CATEGORY_IDS,
  TEST_BOUNDARY_RULE_IDS,
  getTestBoundaryRecord,
  listTestBoundaryRecords,
  listTestBoundaryRecordsByCategory,
  listTestBoundaryRules,
  summarizeTestBoundaryReset,
  validatePolicyBuilderTestBoundaryReset,
  validateTestBoundaryRule,
} from '../../services/policyBuilderTestBoundaryReset.mjs';

const repoRoot = path.resolve(process.cwd(), '..');

describe('policyBuilderTestBoundaryReset', () => {
  test('categorizes the current policy-builder test surface', () => {
    expect(summarizeTestBoundaryReset()).toEqual({
      recordCount: 12,
      countsByCategory: {
        [TEST_BOUNDARY_CATEGORY_IDS.POLICY_BUILDER_BOUNDARY_CONTRACT]: 5,
        [TEST_BOUNDARY_CATEGORY_IDS.KEEP_BEHAVIOR_REGRESSION]: 1,
        [TEST_BOUNDARY_CATEGORY_IDS.REWRITE_PRODUCT_VOCABULARY]: 2,
        [TEST_BOUNDARY_CATEGORY_IDS.REWRITE_DRAFT_BRIDGE_BOUNDARY]: 3,
        [TEST_BOUNDARY_CATEGORY_IDS.REWRITE_FUTURE_EVIDENCE_READINESS]: 1,
      },
      coveredRuleIds: [
        TEST_BOUNDARY_RULE_IDS.DRAFT_COMMANDS_ARE_ALLOWLISTED,
        TEST_BOUNDARY_RULE_IDS.LEGACY_COMPATIBILITY_AUDIT_IS_CLEAN,
        TEST_BOUNDARY_RULE_IDS.LEGACY_DELETION_REQUIRES_COMPLETED_GATES,
        TEST_BOUNDARY_RULE_IDS.LEGACY_PAYLOAD_MUTATION_STAYS_IN_BRIDGE,
        TEST_BOUNDARY_RULE_IDS.MODAL_DOES_NOT_GENERATE_EVIDENCE,
        TEST_BOUNDARY_RULE_IDS.NO_TRANSITIONAL_LAYOUT_SNAPSHOTS,
        TEST_BOUNDARY_RULE_IDS.REFERENCE_OPTIONS_DISTINCT_FROM_OBSERVED_EVIDENCE,
        TEST_BOUNDARY_RULE_IDS.UI_ONLY_STATE_IS_NOT_SERIALIZED,
      ],
      uncoveredRuleIds: [],
      snapshotFreezeRecordIds: [],
    });
  });

  test('keeps all required policy-builder boundary rules covered', () => {
    expect(listTestBoundaryRules()).toEqual([
      TEST_BOUNDARY_RULE_IDS.MODAL_DOES_NOT_GENERATE_EVIDENCE,
      TEST_BOUNDARY_RULE_IDS.DRAFT_COMMANDS_ARE_ALLOWLISTED,
      TEST_BOUNDARY_RULE_IDS.REFERENCE_OPTIONS_DISTINCT_FROM_OBSERVED_EVIDENCE,
      TEST_BOUNDARY_RULE_IDS.LEGACY_PAYLOAD_MUTATION_STAYS_IN_BRIDGE,
      TEST_BOUNDARY_RULE_IDS.LEGACY_COMPATIBILITY_AUDIT_IS_CLEAN,
      TEST_BOUNDARY_RULE_IDS.LEGACY_DELETION_REQUIRES_COMPLETED_GATES,
      TEST_BOUNDARY_RULE_IDS.UI_ONLY_STATE_IS_NOT_SERIALIZED,
      TEST_BOUNDARY_RULE_IDS.NO_TRANSITIONAL_LAYOUT_SNAPSHOTS,
    ]);

    expect(validatePolicyBuilderTestBoundaryReset()).toEqual(expect.objectContaining({
      valid: true,
      summary: expect.objectContaining({
        uncoveredRuleIds: [],
        snapshotFreezeRecordIds: [],
      }),
    }));
  });

  test('proves each boundary rule with current contract evidence', () => {
    for (const ruleId of listTestBoundaryRules()) {
      expect(validateTestBoundaryRule(ruleId)).toEqual(expect.objectContaining({
        valid: true,
        evidence: expect.any(Object),
      }));
    }
  });

  test('fails closed for unknown test boundary rules', () => {
    expect(validateTestBoundaryRule('unknown_rule')).toEqual({
      valid: false,
      evidence: {
        reason: 'Unknown test boundary rule.',
      },
    });
  });

  test('groups records by architectural test category', () => {
    expect(listTestBoundaryRecordsByCategory(TEST_BOUNDARY_CATEGORY_IDS.POLICY_BUILDER_BOUNDARY_CONTRACT)
      .map(record => record.path)).toEqual([
      'server/src/__tests__/services/policyBuilderBoundaryInventory.test.mjs',
      'server/src/__tests__/services/policyBuilderModalOrchestrationContract.test.mjs',
      'server/src/__tests__/services/policyBuilderDraftStateBoundary.test.mjs',
      'server/src/__tests__/services/policyBuilderReferenceDataBoundary.test.mjs',
      'server/src/__tests__/services/policyBuilderLegacyCompatibilityBoundary.test.mjs',
    ]);

    expect(listTestBoundaryRecordsByCategory(TEST_BOUNDARY_CATEGORY_IDS.DELETE_WITH_ABANDONED_DIAGNOSTIC_UI))
      .toEqual([]);
  });

  test('lists current test files that exist in the repository', () => {
    for (const record of listTestBoundaryRecords()) {
      expect(fs.existsSync(path.join(repoRoot, record.path))).toBe(true);
    }
  });

  test('does not classify listed policy-builder tests as snapshot layout freezes', () => {
    for (const record of listTestBoundaryRecords()) {
      const source = fs.readFileSync(path.join(repoRoot, record.path), 'utf8');

      expect(record.freezesLayout).toBe(false);
      expect(source).not.toMatch(/toMatch(?:Inline)?Snapshot\s*\(/);
    }
  });

  test('exposes immutable reset records', () => {
    const records = listTestBoundaryRecords();
    const boundaryRecords = listTestBoundaryRecordsByCategory(TEST_BOUNDARY_CATEGORY_IDS.POLICY_BUILDER_BOUNDARY_CONTRACT);

    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
    expect(Object.isFrozen(records[0].coveredRuleIds)).toBe(true);
    expect(Object.isFrozen(boundaryRecords[0])).toBe(true);
  });

  test('returns null or empty arrays for unknown lookups', () => {
    expect(getTestBoundaryRecord('unknown')).toBeNull();
    expect(listTestBoundaryRecordsByCategory('unknown')).toEqual([]);
  });
});
