import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemoval.mjs';
import {
  POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS,
  POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS,
  evaluatePolicyPostRemovalApplyEligibility,
} from '../../services/policyPostRemovalApplyEligibility.mjs';

const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const EXECUTION_PLAN_ARTIFACT_FINGERPRINT = 'b'.repeat(64);
const EXECUTION_GATE_ARTIFACT_FINGERPRINT = 'c'.repeat(64);

const ENTRIES = [
  {
    path: 'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
    actionId: 'delete_file',
  },
  {
    path: 'server/src/services/policyIntentImpactPreview.mjs',
    actionId: 'delete_file',
  },
  {
    path: 'server/src/services/policyIntentMapper.mjs',
    actionId: 'delete_file',
  },
];

function partialApplyEvidence(overrides = {}) {
  return {
    statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_ADAPTER,
    applied: false,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    removalReview: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
        .READY_FOR_REMOVAL_REVIEW,
      validationOk: true,
      readyForRemovalReview: true,
      selectedCount: ENTRIES.length,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      executionPlanArtifactFingerprint: EXECUTION_PLAN_ARTIFACT_FINGERPRINT,
      executionGateArtifactFingerprint: EXECUTION_GATE_ARTIFACT_FINGERPRINT,
    },
    applyBatch: {
      requestedCount: ENTRIES.length,
      checkedCount: 2,
      blockedEntry: ENTRIES[1],
      haltReasonId:
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS
          .ADAPTER_FAILURE,
      appliedCount: 1,
      entries: ENTRIES,
      results: [{
        ...ENTRIES[0],
        applied: true,
      }],
    },
    ...overrides,
  };
}

describe('policyPostRemovalApplyEligibility', () => {
  test('accepts a bounded valid applied prefix but marks it non-authorizing', () => {
    const eligibility = evaluatePolicyPostRemovalApplyEligibility(
      partialApplyEvidence()
    );

    expect(eligibility).toEqual(expect.objectContaining({
      modeId: POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS.PARTIAL_APPLY,
      partialApply: true,
      authorizationEligible: false,
      appliedPathCount: 1,
      appliedPaths: [ENTRIES[0].path],
      riskCount: 0,
      risks: [],
    }));
  });

  test('accepts every known stopped-state shape only when its status matches', () => {
    const scenarios = [
      {
        statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
          .BLOCKED_BY_PRE_APPLY_RECHECK,
        haltReasonId:
          POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS
            .PRE_APPLY_RECHECK_FAILED,
        results: [{ ...ENTRIES[0], applied: true }],
      },
      {
        statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
          .BLOCKED_BY_APPLY_RESULT,
        haltReasonId:
          POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS
            .ADAPTER_RESULT_REJECTED,
        results: [
          { ...ENTRIES[0], applied: true },
          { ...ENTRIES[1], applied: false },
        ],
      },
    ];

    scenarios.forEach(({ statusId, haltReasonId, results }) => {
      const eligibility = evaluatePolicyPostRemovalApplyEligibility(
        partialApplyEvidence({
          statusId,
          applyBatch: {
            ...partialApplyEvidence().applyBatch,
            haltReasonId,
            results,
          },
        })
      );

      expect(eligibility).toEqual(expect.objectContaining({
        modeId: POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS.PARTIAL_APPLY,
        authorizationEligible: false,
        riskCount: 0,
      }));
    });
  });

  test('rejects a partial result without an exact halted entry or review context', () => {
    const eligibility = evaluatePolicyPostRemovalApplyEligibility(
      partialApplyEvidence({
        removalReview: {
          reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
        },
        applyBatch: {
          ...partialApplyEvidence().applyBatch,
          blockedEntry: ENTRIES[2],
        },
      })
    );

    expect(eligibility.modeId)
      .toBe(POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS.INELIGIBLE);
    expect(eligibility.authorizationEligible).toBe(false);
    expect(eligibility.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS.PARTIAL_APPLY_PREFIX_MISSING,
      POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_RISK_IDS
        .PARTIAL_APPLY_REVIEW_CONTEXT_INVALID,
    ]));
  });

  test('continues to accept completed controlled-removal apply evidence', () => {
    const eligibility = evaluatePolicyPostRemovalApplyEligibility({
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      applied: true,
      validation: { ok: true },
      applyBatch: {
        requestedCount: 1,
        results: [{
          path: ENTRIES[0].path,
          actionId: ENTRIES[0].actionId,
          applied: true,
        }],
      },
    });

    expect(eligibility).toEqual(expect.objectContaining({
      modeId: POLICY_POST_REMOVAL_APPLY_ELIGIBILITY_MODE_IDS.COMPLETE_APPLY,
      partialApply: false,
      authorizationEligible: true,
      riskCount: 0,
    }));
  });
});
