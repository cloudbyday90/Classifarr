import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS,
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS,
  buildPolicyPostRemovalRuntimeVerification,
  validatePolicyPostRemovalRuntimeVerification,
} from '../../services/policyPostRemovalRuntimeVerification.mjs';

function applyEvidence(overrides = {}) {
  return {
    statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
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

function importScan(overrides = {}) {
  return {
    completed: true,
    checkedPaths: [
      'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
      'server/src/services/policyIntentImpactPreview.mjs',
    ],
    references: [],
    ...overrides,
  };
}

function runtimeChecks(overrides = []) {
  return [
    {
      checkId: 'policy-builder-imports',
      passed: true,
    },
    {
      checkId: 'policy-write-runtime',
      passed: true,
    },
    ...overrides,
  ];
}

function validationEvidence(overrides = {}) {
  return {
    focused: {
      command: 'node ./scripts/run-jest.mjs --testPathPatterns="policy" --no-coverage',
      passed: true,
    },
    full: {
      command: 'npm test',
      passed: true,
    },
    ...overrides,
  };
}

async function verified(overrides = {}) {
  return buildPolicyPostRemovalRuntimeVerification({
    applyEvidence: applyEvidence(),
    importScan: importScan(),
    runtimeChecks: runtimeChecks(),
    validationEvidence: validationEvidence(),
    ...overrides,
  });
}

describe('policyPostRemovalRuntimeVerification', () => {
  test('verifies post-removal runtime readiness when apply, import, runtime, and validation evidence pass', async () => {
    const verification = await verified();

    expect(verification.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED);
    expect(verification.verified).toBe(true);
    expect(verification.validation.ok).toBe(true);
    expect(verification.applyEvidence).toEqual(expect.objectContaining({
      statusId: 'applied',
      validationOk: true,
      applied: true,
      appliedPathCount: 2,
    }));
    expect(verification.importScan).toEqual(expect.objectContaining({
      completed: true,
      checkedPathCount: 2,
      referenceCount: 0,
    }));
    expect(verification.runtimeChecks).toEqual(expect.objectContaining({
      checkCount: 2,
      passedCount: 2,
    }));
    expect(verification.nextStep).toEqual(expect.objectContaining({
      stepId: 'next_compatibility_removal_batch_authorization',
      label: 'Next Compatibility Removal Batch Authorization',
    }));
    expect(verification.nextPhase).toBeUndefined();
  });

  test('blocks when controlled-removal apply evidence is incomplete or invalid', async () => {
    const verification = await verified({
      applyEvidence: applyEvidence({
        statusId: 'blocked_by_adapter',
        applied: false,
        validation: {
          ok: false,
          issueCount: 1,
          issues: [],
        },
      }),
    });

    expect(verification.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS
        .BLOCKED_BY_APPLY_EVIDENCE);
    expect(verification.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.APPLY_NOT_COMPLETE,
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.APPLY_VALIDATION_FAILED,
    ]));
  });

  test('blocks when import scan evidence is missing or removed paths are still referenced', async () => {
    const missingScan = await verified({
      importScan: importScan({
        completed: false,
        checkedPaths: [],
      }),
    });
    const referencedPath = await verified({
      importScan: importScan({
        references: [{
          path: 'server/src/services/policyIntentImpactPreview.mjs',
          referencedBy: 'server/src/routes/policiesRoutePolicyWrite.mjs',
        }],
      }),
    });

    expect(missingScan.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS
        .BLOCKED_BY_IMPORT_REFERENCES);
    expect(missingScan.risks.map(risk => risk.riskId)).toContain(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.IMPORT_SCAN_MISSING
    );
    expect(referencedPath.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS
        .BLOCKED_BY_IMPORT_REFERENCES);
    expect(referencedPath.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.REMOVED_PATH_STILL_REFERENCED,
        path: 'server/src/services/policyIntentImpactPreview.mjs',
        referencedBy: 'server/src/routes/policiesRoutePolicyWrite.mjs',
      }),
    ]));
  });

  test('blocks when runtime checks are missing or failed', async () => {
    const missingChecks = await verified({
      runtimeChecks: [],
    });
    const failedCheck = await verified({
      runtimeChecks: runtimeChecks([{
        checkId: 'policy-write-runtime',
        passed: false,
        message: 'policy write route still imports removed preview service',
      }]),
    });

    expect(missingChecks.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS
        .BLOCKED_BY_RUNTIME_CHECKS);
    expect(missingChecks.risks.map(risk => risk.riskId)).toContain(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RUNTIME_CHECK_MISSING
    );
    expect(failedCheck.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS
        .BLOCKED_BY_RUNTIME_CHECKS);
    expect(failedCheck.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RUNTIME_CHECK_FAILED,
        checkId: 'policy-write-runtime',
      }),
    ]));
  });

  test('blocks when focused or full validation evidence is missing or failed', async () => {
    const missingValidation = await verified({
      validationEvidence: {},
    });
    const failedValidation = await verified({
      validationEvidence: validationEvidence({
        focused: {
          command: 'focused tests',
          passed: false,
          message: 'focused runtime check failed',
        },
        full: {
          command: 'npm test',
          passed: false,
          message: 'full suite failed',
        },
      }),
    });

    expect(missingValidation.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.BLOCKED_BY_VALIDATION);
    expect(missingValidation.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.FOCUSED_VALIDATION_MISSING,
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.FULL_VALIDATION_MISSING,
    ]));
    expect(failedValidation.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.BLOCKED_BY_VALIDATION);
    expect(failedValidation.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.FOCUSED_VALIDATION_FAILED,
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.FULL_VALIDATION_FAILED,
    ]));
  });

  test('rejects storage or git side effects in verification evidence', async () => {
    const verification = await verified({
      sideEffects: {
        storageChanged: true,
        gitCommandsRun: true,
      },
    });

    expect(verification.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.BLOCKED_BY_VALIDATION);
    expect(verification.validation.ok).toBe(false);
    expect(verification.risks.map(risk => risk.riskId)).toContain(
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.UNEXPECTED_SIDE_EFFECT
    );
  });

  test('rejects mutated verification output with stale risk count or side effects', () => {
    const validation = validatePolicyPostRemovalRuntimeVerification({
      statusId: POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED,
      riskCount: 99,
      risks: [],
      sideEffects: {
        storageChanged: true,
        gitCommandsRun: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.RISK_COUNT_MISMATCH,
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.UNEXPECTED_SIDE_EFFECT,
      POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
