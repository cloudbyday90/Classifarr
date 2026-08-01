import fs from 'node:fs';
import path from 'node:path';
import {
  POLICY_AUTHORING_COMPATIBILITY_RISK_IDS,
  POLICY_AUTHORING_COMPATIBILITY_RULE_IDS,
  POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS,
  getPolicyAuthoringCompatibilityTestRecord,
  listPolicyAuthoringCompatibilityTransitionCandidates,
  listPolicyAuthoringCompatibilityTestRecords,
  listPolicyAuthoringCompatibilityTestRecordsByCategory,
  listPolicyAuthoringCompatibilityRequiredRuleIds,
  summarizePolicyAuthoringCompatibilityRegressionCoverage,
  validatePolicyAuthoringCompatibilityRegressionInventory,
  validatePolicyAuthoringCompatibilityRule,
} from '../../services/policyAuthoringCompatibilityRegressionInventory.mjs';

const repoRoot = path.resolve(process.cwd(), '..');

describe('policyAuthoringCompatibilityRegressionInventory', () => {
  test('defines the required policy authoring compatibility rules', () => {
    expect(listPolicyAuthoringCompatibilityRequiredRuleIds()).toEqual([
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.NO_OP_LEGACY_SAVE_PRESERVES_PAYLOADS,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.BRIDGE_SERIALIZATION_IS_ALLOWLISTED,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.DRAFT_VIEW_HIDES_RAW_LEGACY_STORAGE,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.UI_ONLY_TRANSIENT_FIELDS_DO_NOT_SERIALIZE,
      POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.CLIENT_DRAFT_IS_NOT_DURABLE_AUTHORITY,
    ]);
  });

  test('summarizes compatibility coverage without making the client draft authoritative', () => {
    expect(summarizePolicyAuthoringCompatibilityRegressionCoverage()).toEqual({
      recordCount: 14,
      requiredRuleCount: 8,
      countsByCategory: {
        [POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.LEGACY_NO_OP_COMPATIBILITY]: 1,
        [POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.UI_STATE_SERIALIZATION_GUARD]: 2,
        [POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.DRAFT_COMMAND_BOUNDARY]: 5,
        [POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.DRAFT_VIEW_PROJECTION]: 2,
        [POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.PROVENANCE_COMPATIBILITY]: 1,
        [POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.BRIDGE_SERIALIZATION_ALLOWLIST]: 1,
        [POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.SERVER_AUTHORITY_PREFLIGHT]: 2,
      },
      coveredRuleIds: [
        POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.BRIDGE_SERIALIZATION_IS_ALLOWLISTED,
        POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.CLIENT_DRAFT_IS_NOT_DURABLE_AUTHORITY,
        POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS,
        POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.DRAFT_VIEW_HIDES_RAW_LEGACY_STORAGE,
        POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.NO_OP_LEGACY_SAVE_PRESERVES_PAYLOADS,
        POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
        POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
        POLICY_AUTHORING_COMPATIBILITY_RULE_IDS.UI_ONLY_TRANSIENT_FIELDS_DO_NOT_SERIALIZE,
      ],
      uncoveredRequiredRuleIds: [],
      transitionCandidateCount: 0,
      legacyLayoutFreezeRecordPaths: [],
      clientDraftAuthoritative: false,
      nativeIntentStorageEnabled: false,
      policyAuthoringCompatibilityReady: true,
    });
  });

  test('validates every required compatibility rule has regression evidence', () => {
    for (const ruleId of listPolicyAuthoringCompatibilityRequiredRuleIds()) {
      expect(validatePolicyAuthoringCompatibilityRule(ruleId)).toEqual(expect.objectContaining({
        valid: true,
        riskId: null,
        evidence: expect.objectContaining({
          recordPaths: expect.any(Array),
        }),
      }));
    }
  });

  test('fails closed for unknown compatibility rules', () => {
    expect(validatePolicyAuthoringCompatibilityRule('unknown_rule')).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_COMPATIBILITY_RISK_IDS.MISSING_RULE_COVERAGE,
      evidence: {
        reason: 'Unknown or non-required policy authoring compatibility rule.',
      },
    });
  });

  test('validates the compatibility regression inventory as complete', () => {
    expect(validatePolicyAuthoringCompatibilityRegressionInventory()).toEqual(expect.objectContaining({
      valid: true,
      riskId: null,
      summary: expect.objectContaining({
        uncoveredRequiredRuleIds: [],
        clientDraftAuthoritative: false,
        nativeIntentStorageEnabled: false,
      }),
    }));
  });

  test('has no remaining browser diagnostic transition candidates', () => {
    expect(listPolicyAuthoringCompatibilityTransitionCandidates()).toEqual([]);
    expect(listPolicyAuthoringCompatibilityTestRecordsByCategory(
      POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.DIAGNOSTIC_SURFACE_TRANSITION_CANDIDATE
    )).toEqual([]);
  });

  test('lists test files that exist in the repository and avoids snapshot layout freezes', () => {
    for (const record of listPolicyAuthoringCompatibilityTestRecords()) {
      const absolutePath = path.join(repoRoot, record.path);
      expect(fs.existsSync(absolutePath)).toBe(true);
      expect(record.freezesLegacyUi).toBe(false);
      expect(fs.readFileSync(absolutePath, 'utf8')).not.toMatch(/toMatch(?:Inline)?Snapshot\s*\(/);
    }
  });

  test('exposes immutable compatibility records', () => {
    const records = listPolicyAuthoringCompatibilityTestRecords();
    const categoryRecords = listPolicyAuthoringCompatibilityTestRecordsByCategory(
      POLICY_AUTHORING_COMPATIBILITY_TEST_CATEGORY_IDS.DRAFT_COMMAND_BOUNDARY
    );

    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
    expect(Object.isFrozen(records[0].coveredRuleIds)).toBe(true);
    expect(Object.isFrozen(categoryRecords[0])).toBe(true);
  });

  test('returns null or empty arrays for unknown lookups', () => {
    expect(getPolicyAuthoringCompatibilityTestRecord('unknown')).toBeNull();
    expect(listPolicyAuthoringCompatibilityTestRecordsByCategory('unknown')).toEqual([]);
  });
});
