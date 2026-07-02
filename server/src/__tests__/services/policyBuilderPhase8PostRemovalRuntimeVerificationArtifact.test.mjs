import {
  PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyBuilderPhase8ControlledCompatibilityPathRemovalApply.mjs';
import {
  PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS,
  PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS,
  buildPolicyBuilderPhase8PostRemovalRuntimeVerificationArtifact,
  validatePolicyBuilderPhase8PostRemovalRuntimeVerificationArtifact,
} from '../../services/policyBuilderPhase8PostRemovalRuntimeVerificationArtifact.mjs';

function applyEvidence(overrides = {}) {
  return {
    statusId: PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
    applied: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    applyBatch: {
      requestedCount: 2,
      results: [
        {
          path: 'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
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

function verificationInput(overrides = {}) {
  return {
    importScan: {
      completed: true,
      checkedPaths: [
        'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
        'server/src/services/policyIntentImpactPreview.mjs',
      ],
      references: [],
    },
    runtimeChecks: [
      {
        checkId: 'policy-builder-imports',
        passed: true,
      },
      {
        checkId: 'policy-write-runtime',
        passed: true,
      },
    ],
    validationEvidence: {
      focused: {
        command: 'node ./scripts/run-jest.mjs --testPathPatterns="phase8r" --no-coverage',
        passed: true,
      },
      full: {
        command: 'npm --prefix server test',
        passed: true,
      },
    },
    ...overrides,
  };
}

describe('policyBuilderPhase8PostRemovalRuntimeVerificationArtifact', () => {
  test('wraps verified Phase 8R.19 runtime evidence for the next batch gate', async () => {
    const artifact = await buildPolicyBuilderPhase8PostRemovalRuntimeVerificationArtifact({
      applyEvidence: applyEvidence(),
      input: verificationInput(),
      generatedAt: '2026-06-25T09:00:00.000Z',
    });

    expect(artifact.statusId)
      .toBe(PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS.VERIFIED);
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
    expect(artifact.nextPhase).toEqual(expect.objectContaining({
      phaseId: '8r_20',
      label: 'Next Compatibility Removal Batch Authorization',
    }));
  });

  test('blocks when removed paths are still referenced', async () => {
    const artifact = await buildPolicyBuilderPhase8PostRemovalRuntimeVerificationArtifact({
      applyEvidence: applyEvidence(),
      input: verificationInput({
        importScan: {
          completed: true,
          checkedPaths: [
            'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
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
      .toBe(PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.verified).toBe(false);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
            .VERIFICATION_NOT_VERIFIED,
      }),
    ]));
    expect(artifact.verification.statusId).toBe('blocked_by_import_references');
  });

  test('blocks when runtime checks fail', async () => {
    const artifact = await buildPolicyBuilderPhase8PostRemovalRuntimeVerificationArtifact({
      applyEvidence: applyEvidence(),
      input: verificationInput({
        runtimeChecks: [{
          checkId: 'policy-write-runtime',
          passed: false,
          message: 'policy write route still imports removed path',
        }],
      }),
    });

    expect(artifact.statusId)
      .toBe(PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.verification.statusId).toBe('blocked_by_runtime_checks');
  });

  test('rejects storage and git side effects', async () => {
    const artifact = await buildPolicyBuilderPhase8PostRemovalRuntimeVerificationArtifact({
      applyEvidence: applyEvidence(),
      input: verificationInput(),
      sideEffects: {
        storageChanged: true,
        gitCommandsRun: true,
      },
    });

    expect(artifact.statusId)
      .toBe(PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.validation.ok).toBe(false);
    expect(artifact.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'storageChanged',
      }),
      expect.objectContaining({
        riskId:
          PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'gitCommandsRun',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation = validatePolicyBuilderPhase8PostRemovalRuntimeVerificationArtifact({
      statusId: 'unexpected',
      riskCount: 1,
      risks: [],
      sideEffects: {},
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
            .UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId:
          PHASE8R_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS
            .RISK_COUNT_MISMATCH,
      }),
    ]));
  });
});
