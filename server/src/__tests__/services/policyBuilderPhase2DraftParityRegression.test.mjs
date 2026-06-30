import fs from 'node:fs';
import path from 'node:path';
import {
  PHASE_2R_PARITY_ACTION_IDS,
  PHASE_2R_PARITY_RISK_IDS,
  PHASE_2R_PARITY_RULE_IDS,
  PHASE_2R_PARITY_TEST_CATEGORY_IDS,
  getPhase2RParityTestRecord,
  listPhase2RParityRewriteCandidates,
  listPhase2RParityTestRecords,
  listPhase2RParityTestRecordsByCategory,
  listPhase2RRequiredParityRuleIds,
  summarizePhase2RParityRegressionTests,
  validatePhase2RParityRegressionSuite,
  validatePhase2RParityRule,
} from '../../services/policyBuilderPhase2DraftParityRegression.mjs';

const repoRoot = path.resolve(process.cwd(), '..');

describe('policyBuilderPhase2DraftParityRegression', () => {
  test('defines the Phase 2R.6 required parity rules', () => {
    expect(listPhase2RRequiredParityRuleIds()).toEqual([
      PHASE_2R_PARITY_RULE_IDS.NO_OP_LEGACY_SAVE_PRESERVES_PAYLOADS,
      PHASE_2R_PARITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
      PHASE_2R_PARITY_RULE_IDS.COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS,
      PHASE_2R_PARITY_RULE_IDS.BRIDGE_SERIALIZATION_IS_ALLOWLISTED,
      PHASE_2R_PARITY_RULE_IDS.DRAFT_VIEW_HIDES_RAW_LEGACY_STORAGE,
      PHASE_2R_PARITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
      PHASE_2R_PARITY_RULE_IDS.UI_ONLY_TRANSIENT_FIELDS_DO_NOT_SERIALIZE,
      PHASE_2R_PARITY_RULE_IDS.CLIENT_DRAFT_IS_NOT_DURABLE_AUTHORITY,
    ]);
  });

  test('summarizes current Phase 2R parity coverage without making client draft authoritative', () => {
    expect(summarizePhase2RParityRegressionTests()).toEqual({
      recordCount: 15,
      requiredRuleCount: 8,
      countsByCategory: {
        [PHASE_2R_PARITY_TEST_CATEGORY_IDS.LEGACY_NO_OP_PARITY]: 1,
        [PHASE_2R_PARITY_TEST_CATEGORY_IDS.UI_STATE_SERIALIZATION_GUARD]: 2,
        [PHASE_2R_PARITY_TEST_CATEGORY_IDS.DRAFT_COMMAND_BOUNDARY]: 4,
        [PHASE_2R_PARITY_TEST_CATEGORY_IDS.DRAFT_VIEW_PROJECTION]: 2,
        [PHASE_2R_PARITY_TEST_CATEGORY_IDS.PROVENANCE_PARITY]: 1,
        [PHASE_2R_PARITY_TEST_CATEGORY_IDS.BRIDGE_SERIALIZATION_ALLOWLIST]: 1,
        [PHASE_2R_PARITY_TEST_CATEGORY_IDS.SERVER_AUTHORITY_PRELIGHT]: 2,
        [PHASE_2R_PARITY_TEST_CATEGORY_IDS.REWRITE_OR_DELETE_CANDIDATE]: 2,
      },
      coveredRuleIds: [
        PHASE_2R_PARITY_RULE_IDS.BRIDGE_SERIALIZATION_IS_ALLOWLISTED,
        PHASE_2R_PARITY_RULE_IDS.CLIENT_DRAFT_IS_NOT_DURABLE_AUTHORITY,
        PHASE_2R_PARITY_RULE_IDS.COMMANDS_CANNOT_MUTATE_READ_ONLY_PROJECTIONS,
        PHASE_2R_PARITY_RULE_IDS.DRAFT_VIEW_HIDES_RAW_LEGACY_STORAGE,
        PHASE_2R_PARITY_RULE_IDS.NO_OP_LEGACY_SAVE_PRESERVES_PAYLOADS,
        PHASE_2R_PARITY_RULE_IDS.OLD_DIAGNOSTIC_UI_IS_NOT_FROZEN,
        PHASE_2R_PARITY_RULE_IDS.PRODUCT_COMPONENTS_EMIT_TYPED_COMMANDS,
        PHASE_2R_PARITY_RULE_IDS.PROVENANCE_PRESERVED_ACROSS_PROJECTION_AND_SERIALIZATION,
        PHASE_2R_PARITY_RULE_IDS.UI_ONLY_TRANSIENT_FIELDS_DO_NOT_SERIALIZE,
      ],
      uncoveredRequiredRuleIds: [],
      rewriteCandidateCount: 2,
      legacyUiFreezeRecordIds: [],
      clientDraftAuthoritative: false,
      nativeIntentPersistenceExpected: false,
      phase2RComplete: true,
    });
  });

  test('validates every required parity rule has regression evidence', () => {
    for (const ruleId of listPhase2RRequiredParityRuleIds()) {
      expect(validatePhase2RParityRule(ruleId)).toEqual(expect.objectContaining({
        valid: true,
        riskId: null,
        evidence: expect.objectContaining({
          recordPaths: expect.any(Array),
        }),
      }));
    }
  });

  test('fails closed for unknown parity rules', () => {
    expect(validatePhase2RParityRule('unknown_rule')).toEqual({
      valid: false,
      riskId: PHASE_2R_PARITY_RISK_IDS.MISSING_RULE_COVERAGE,
      evidence: {
        reason: 'Unknown or non-required Phase 2R parity rule.',
      },
    });
  });

  test('validates the Phase 2R.6 regression suite as complete', () => {
    expect(validatePhase2RParityRegressionSuite()).toEqual(expect.objectContaining({
      valid: true,
      riskId: null,
      summary: expect.objectContaining({
        uncoveredRequiredRuleIds: [],
        clientDraftAuthoritative: false,
        nativeIntentPersistenceExpected: false,
      }),
    }));
  });

  test('groups rewrite and deletion candidates for later Phase 6R and Phase 8R cutlines', () => {
    expect(listPhase2RParityRewriteCandidates()).toEqual([
      expect.objectContaining({
        path: 'client/src/__tests__/PolicyIntentImpactPreviewCard.test.js',
        actionId: PHASE_2R_PARITY_ACTION_IDS.REWRITE_IN_PHASE_6R,
      }),
      expect.objectContaining({
        path: 'client/src/__tests__/PolicyIntentReplayPreviewCard.test.js',
        actionId: PHASE_2R_PARITY_ACTION_IDS.DELETE_AFTER_PHASE_8R_CUTLINE,
      }),
    ]);

    expect(listPhase2RParityTestRecordsByCategory(PHASE_2R_PARITY_TEST_CATEGORY_IDS.REWRITE_OR_DELETE_CANDIDATE)
      .map(record => record.path)).toEqual([
      'client/src/__tests__/PolicyIntentImpactPreviewCard.test.js',
      'client/src/__tests__/PolicyIntentReplayPreviewCard.test.js',
    ]);
  });

  test('lists test files that exist in the repository and avoids snapshot layout freezes', () => {
    for (const record of listPhase2RParityTestRecords()) {
      const absolutePath = path.join(repoRoot, record.path);
      expect(fs.existsSync(absolutePath)).toBe(true);
      expect(record.freezesLegacyUi).toBe(false);
      expect(fs.readFileSync(absolutePath, 'utf8')).not.toMatch(/toMatch(?:Inline)?Snapshot\s*\(/);
    }
  });

  test('exposes immutable parity records', () => {
    const records = listPhase2RParityTestRecords();
    const categoryRecords = listPhase2RParityTestRecordsByCategory(
      PHASE_2R_PARITY_TEST_CATEGORY_IDS.DRAFT_COMMAND_BOUNDARY
    );

    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
    expect(Object.isFrozen(records[0].coveredRuleIds)).toBe(true);
    expect(Object.isFrozen(categoryRecords[0])).toBe(true);
  });

  test('returns null or empty arrays for unknown lookups', () => {
    expect(getPhase2RParityTestRecord('unknown')).toBeNull();
    expect(listPhase2RParityTestRecordsByCategory('unknown')).toEqual([]);
  });
});
