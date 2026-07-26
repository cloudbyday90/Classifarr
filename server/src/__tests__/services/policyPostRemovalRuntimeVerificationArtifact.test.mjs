import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemoval.mjs';
import {
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS,
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS,
  buildPolicyPostRemovalRuntimeVerificationArtifact,
  validatePolicyPostRemovalRuntimeVerificationArtifact,
} from '../../services/policyPostRemovalRuntimeVerificationArtifact.mjs';

const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const EXECUTION_PLAN_ARTIFACT_FINGERPRINT = 'b'.repeat(64);
const EXECUTION_GATE_ARTIFACT_FINGERPRINT = 'c'.repeat(64);

const PARTIAL_APPLY_ENTRIES = [
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

function applyEvidence(overrides = {}) {
  return {
    statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
    applied: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    removalReview: {
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      executionPlanArtifactFingerprint: EXECUTION_PLAN_ARTIFACT_FINGERPRINT,
    },
    applyBatch: {
      requestedCount: 2,
      results: [
        {
          path: 'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
          actionId: 'delete_file',
          applied: true,
        },
        {
          path: 'server/src/services/policyIntentImpactPreview.mjs',
          actionId: 'delete_file',
          applied: true,
        },
      ],
    },
    ...overrides,
  };
}

function partialApplyEvidence(overrides = {}) {
  return {
    statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_ADAPTER,
    applied: false,
    validation: { ok: true, issueCount: 0, issues: [] },
    removalReview: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
        .READY_FOR_REMOVAL_REVIEW,
      validationOk: true,
      readyForRemovalReview: true,
      selectedCount: PARTIAL_APPLY_ENTRIES.length,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      executionPlanArtifactFingerprint: EXECUTION_PLAN_ARTIFACT_FINGERPRINT,
      executionGateArtifactFingerprint: EXECUTION_GATE_ARTIFACT_FINGERPRINT,
    },
    applyBatch: {
      requestedCount: PARTIAL_APPLY_ENTRIES.length,
      checkedCount: 2,
      blockedEntry: PARTIAL_APPLY_ENTRIES[1],
      haltReasonId: 'adapter_failure',
      appliedCount: 1,
      entries: PARTIAL_APPLY_ENTRIES,
      results: [{ ...PARTIAL_APPLY_ENTRIES[0], applied: true }],
    },
    ...overrides,
  };
}

function verificationInput(overrides = {}) {
  return {
    importScan: {
      completed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      checkedPaths: [
        'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
        'server/src/services/policyIntentImpactPreview.mjs',
      ],
      references: [],
    },
    runtimeChecks: [
      {
        checkId: 'policy-builder-imports',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      {
        checkId: 'policy-write-runtime',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
    ],
    validationEvidence: {
      focused: {
        command: 'node ./scripts/run-jest.mjs --testPathPatterns="policy" --no-coverage',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      full: {
        command: 'npm --prefix server test',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
    },
    ...overrides,
  };
}

describe('policyPostRemovalRuntimeVerificationArtifact', () => {
  test('wraps verified runtime evidence for the next batch gate', async () => {
    const artifact = await buildPolicyPostRemovalRuntimeVerificationArtifact({
      applyEvidence: applyEvidence(),
      input: verificationInput(),
      generatedAt: '2026-06-25T09:00:00.000Z',
    });

    expect(artifact.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS.VERIFIED);
    expect(artifact.verified).toBe(true);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.verification.verified).toBe(true);
    expect(artifact.verificationSummary).toEqual({
      appliedPathCount: 2,
      checkedPathCount: 2,
      referenceCount: 0,
      runtimeCheckCount: 2,
      runtimePassedCount: 2,
    });
    expect(artifact.nextStep).toEqual(expect.objectContaining({
      stepId: 'next_compatibility_removal_batch_authorization',
      label: 'Next Compatibility Removal Batch Authorization',
    }));
    expect(artifact.nextPhase).toBeUndefined();
  });

  test('blocks when removed paths are still referenced', async () => {
    const artifact = await buildPolicyPostRemovalRuntimeVerificationArtifact({
      applyEvidence: applyEvidence(),
      input: verificationInput({
        importScan: {
          completed: true,
          reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
          checkedPaths: [
            'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
            'server/src/services/policyIntentImpactPreview.mjs',
          ],
          references: [{
            path: 'server/src/services/policyIntentImpactPreview.mjs',
            referencedBy: 'server/src/routes/policiesRoutePolicyWrite.mjs',
          }],
        },
      }),
    });

    expect(artifact.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.verified).toBe(false);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
            .VERIFICATION_NOT_VERIFIED,
      }),
    ]));
    expect(artifact.verification.statusId).toBe('blocked_by_import_references');
  });

  test('retains a verified partial prefix only for blocker resolution', async () => {
    const appliedPath = PARTIAL_APPLY_ENTRIES[0].path;
    const artifact = await buildPolicyPostRemovalRuntimeVerificationArtifact({
      applyEvidence: partialApplyEvidence(),
      input: verificationInput({
        importScan: {
          completed: true,
          reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
          checkedPaths: [appliedPath],
          references: [],
        },
        runtimeChecks: [{
          checkId: 'partial-prefix-runtime-check',
          passed: true,
          checkedPaths: [appliedPath],
          reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
        }],
        validationEvidence: {
          focused: {
            command: 'focused partial validation',
            passed: true,
            checkedPaths: [appliedPath],
            reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
          },
          full: {
            command: 'full partial validation',
            passed: true,
            checkedPaths: [appliedPath],
            reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
          },
        },
      }),
    });

    expect(artifact.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS
        .PARTIAL_APPLY_VERIFIED);
    expect(artifact.verified).toBe(false);
    expect(artifact.partialApplyVerified).toBe(true);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.nextStep).toEqual(expect.objectContaining({
      stepId: 'resolve_removal_apply_blocker',
      label: 'Resolve Removal Apply Blocker',
    }));
  });

  test('blocks when runtime checks fail', async () => {
    const artifact = await buildPolicyPostRemovalRuntimeVerificationArtifact({
      applyEvidence: applyEvidence(),
      input: verificationInput({
        runtimeChecks: [{
          checkId: 'policy-write-runtime',
          passed: false,
          reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
          message: 'policy write route still imports removed path',
        }],
      }),
    });

    expect(artifact.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.verification.statusId).toBe('blocked_by_runtime_checks');
  });

  test('rejects storage and git side effects', async () => {
    const artifact = await buildPolicyPostRemovalRuntimeVerificationArtifact({
      applyEvidence: applyEvidence(),
      input: verificationInput(),
      sideEffects: {
        storageChanged: true,
        gitCommandsRun: true,
      },
    });

    expect(artifact.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.validation.ok).toBe(false);
    expect(artifact.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'storageChanged',
      }),
      expect.objectContaining({
        riskId:
          POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'gitCommandsRun',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation = validatePolicyPostRemovalRuntimeVerificationArtifact({
      statusId: 'unexpected',
      riskCount: 1,
      risks: [],
      sideEffects: {},
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
            .UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId:
          POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
            .RISK_COUNT_MISMATCH,
      }),
    ]));
  });
});
