import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS,
  PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
  buildPolicyBuilderPhase8CompatibilityRemovalCompletionAudit,
  validatePolicyBuilderPhase8CompatibilityRemovalCompletionAudit,
} from '../../services/policyBuilderPhase8CompatibilityRemovalCompletionAudit.mjs';
import {
  PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS,
} from '../../services/policyBuilderPhase8NextCompatibilityRemovalBatchAuthorization.mjs';
import {
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS,
} from '../../services/policyPostRemovalRuntimeVerification.mjs';

const MANIFEST_PATHS = Object.freeze([
  'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
  'server/src/services/policyIntentImpactPreview.mjs',
  'server/src/services/policyIntentReplayPreview.mjs',
]);

function manifestEntry(path, overrides = {}) {
  return {
    categoryId: 'old_preview_replay_diagnostics',
    actionId: 'delete_file',
    path,
    replacementEvidence: {
      replacementPath: 'server/src/services/policyNativeIntentProjection.mjs',
    },
    ready: true,
    ...overrides,
  };
}

function executionPlan(overrides = {}) {
  const entries = overrides.entries || MANIFEST_PATHS.map(path => manifestEntry(path));

  return {
    statusId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    manifest: {
      approved: true,
      entryCount: entries.length,
      entries,
    },
    ...overrides,
  };
}

function completionAuthorization(overrides = {}) {
  return {
    statusId:
      PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
        .COMPLETE_NO_REMAINING_PATHS,
    completedNoRemainingPaths: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    remainingManifest: {
      totalCount: MANIFEST_PATHS.length,
      removedCount: MANIFEST_PATHS.length,
      remainingCount: 0,
      removedPaths: MANIFEST_PATHS,
      remainingPaths: [],
    },
    ...overrides,
  };
}

function removalVerification(paths = MANIFEST_PATHS, overrides = {}) {
  return {
    statusId: POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS.VERIFIED,
    verified: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    applyEvidence: {
      appliedPathCount: paths.length,
      appliedPaths: paths,
    },
    ...overrides,
  };
}

function finalImportScan(overrides = {}) {
  return {
    completed: true,
    checkedPaths: MANIFEST_PATHS,
    references: [],
    ...overrides,
  };
}

function validationEvidence(overrides = {}) {
  return {
    focused: {
      command: 'node ./scripts/run-jest.mjs --testPathPatterns="phase8r" --no-coverage',
      passed: true,
    },
    full: {
      command: 'npm test',
      passed: true,
    },
    ...overrides,
  };
}

function completeAudit(overrides = {}) {
  return buildPolicyBuilderPhase8CompatibilityRemovalCompletionAudit({
    completionAuthorization: completionAuthorization(),
    executionPlan: executionPlan(),
    removalVerifications: [removalVerification()],
    finalImportScan: finalImportScan(),
    validationEvidence: validationEvidence(),
    ...overrides,
  });
}

describe('policyBuilderPhase8CompatibilityRemovalCompletionAudit', () => {
  test('completes when all manifest paths are removed, scanned, and validated', () => {
    const audit = completeAudit();

    expect(audit.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE);
    expect(audit.complete).toBe(true);
    expect(audit.validation.ok).toBe(true);
    expect(audit.manifestInventory).toEqual(expect.objectContaining({
      totalCount: 3,
      removedCount: 3,
      remainingCount: 0,
      manifestPaths: MANIFEST_PATHS,
      remainingPaths: [],
    }));
    expect(audit.removalEvidence).toEqual(expect.objectContaining({
      verificationCount: 1,
      verifiedCount: 1,
      appliedPaths: MANIFEST_PATHS,
    }));
    expect(audit.finalImportScan).toEqual(expect.objectContaining({
      completed: true,
      checkedPathCount: 3,
      referenceCount: 0,
    }));
    expect(audit.sideEffects).toEqual({
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
      manifestWritten: false,
      gitCommandsRun: false,
    });
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '8r_22',
      label: 'Phase 8R Completion Checkpoint',
    }));
  });

  test('reports remaining inventory when Phase 8R.20 still has remaining paths', () => {
    const audit = completeAudit({
      completionAuthorization: completionAuthorization({
        statusId:
          PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
            .READY_FOR_NEXT_BATCH,
        completedNoRemainingPaths: false,
        remainingManifest: {
          totalCount: 3,
          removedCount: 1,
          remainingCount: 2,
          removedPaths: [MANIFEST_PATHS[0]],
          remainingPaths: [MANIFEST_PATHS[1], MANIFEST_PATHS[2]],
        },
      }),
      removalVerifications: [removalVerification([MANIFEST_PATHS[0]])],
    });

    expect(audit.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .REMAINING_INVENTORY);
    expect(audit.complete).toBe(false);
    expect(audit.completionAuthorization.remainingCount).toBe(2);
    expect(audit.risks.map(risk => risk.riskId)).toContain(
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .AUTHORIZATION_NOT_COMPLETE
    );
  });

  test('blocks when completion authorization is invalid without remaining inventory', () => {
    const audit = completeAudit({
      completionAuthorization: completionAuthorization({
        statusId:
          PHASE8R_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_STATUS_IDS
            .BLOCKED_BY_AUTHORIZATION,
        completedNoRemainingPaths: false,
        validation: {
          ok: false,
          issueCount: 1,
          issues: [],
        },
      }),
    });

    expect(audit.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_AUTHORIZATION_EVIDENCE);
    expect(audit.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .AUTHORIZATION_NOT_COMPLETE,
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .AUTHORIZATION_VALIDATION_FAILED,
    ]));
  });

  test('blocks when execution plan evidence is not ready or has no manifest entries', () => {
    const notReady = completeAudit({
      executionPlan: executionPlan({
        statusId:
          POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS
            .BLOCKED_BY_APPROVAL,
        readyForExecutionGate: false,
        validation: {
          ok: false,
          issueCount: 1,
          issues: [],
        },
      }),
    });
    const noManifest = completeAudit({
      executionPlan: executionPlan({
        entries: [],
        manifest: {
          approved: true,
          entryCount: 0,
          entries: [],
        },
      }),
    });

    expect(notReady.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_EXECUTION_PLAN);
    expect(notReady.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.EXECUTION_PLAN_NOT_READY,
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .EXECUTION_PLAN_VALIDATION_FAILED,
    ]));
    expect(noManifest.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_EXECUTION_PLAN);
    expect(noManifest.risks.map(risk => risk.riskId)).toContain(
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.NO_MANIFEST_ENTRIES
    );
  });

  test('blocks when removal verification evidence is missing, invalid, or incomplete', () => {
    const missing = completeAudit({
      removalVerifications: [],
    });
    const invalid = completeAudit({
      removalVerifications: [removalVerification(MANIFEST_PATHS, {
        statusId:
          POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS
            .BLOCKED_BY_RUNTIME_CHECKS,
        verified: false,
      })],
    });
    const incompleteCoverage = completeAudit({
      completionAuthorization: completionAuthorization({
        remainingManifest: {
          totalCount: MANIFEST_PATHS.length,
          removedCount: 2,
          remainingCount: 0,
          removedPaths: [MANIFEST_PATHS[0], MANIFEST_PATHS[1]],
          remainingPaths: [],
        },
      }),
      removalVerifications: [removalVerification([MANIFEST_PATHS[0], MANIFEST_PATHS[1]])],
    });

    expect(missing.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_REMOVAL_EVIDENCE);
    expect(missing.risks.map(risk => risk.riskId)).toContain(
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .REMOVAL_VERIFICATION_MISSING
    );
    expect(invalid.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_REMOVAL_EVIDENCE);
    expect(invalid.risks.map(risk => risk.riskId)).toContain(
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .REMOVAL_VERIFICATION_NOT_VERIFIED
    );
    expect(incompleteCoverage.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_REMOVAL_EVIDENCE);
    expect(incompleteCoverage.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
            .REMOVED_PATH_COVERAGE_INCOMPLETE,
        missingPaths: [MANIFEST_PATHS[2]],
      }),
    ]));
  });

  test('blocks when final import scan evidence is missing or still has references', () => {
    const missingScan = completeAudit({
      finalImportScan: finalImportScan({
        completed: false,
        checkedPaths: [],
      }),
    });
    const referenced = completeAudit({
      finalImportScan: finalImportScan({
        references: [{
          path: MANIFEST_PATHS[1],
          referencedBy: 'server/src/routes/policiesRoutePolicyWrite.mjs',
        }],
      }),
    });

    expect(missingScan.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_FINAL_SCAN);
    expect(missingScan.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.FINAL_SCAN_MISSING,
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.FINAL_SCAN_PATH_MISSING,
    ]));
    expect(referenced.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_FINAL_SCAN);
    expect(referenced.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
            .FINAL_SCAN_REFERENCE_FOUND,
        path: MANIFEST_PATHS[1],
        referencedBy: 'server/src/routes/policiesRoutePolicyWrite.mjs',
      }),
    ]));
  });

  test('blocks when focused or full validation evidence is missing or failed', () => {
    const missingValidation = completeAudit({
      validationEvidence: {},
    });
    const failedValidation = completeAudit({
      validationEvidence: validationEvidence({
        focused: {
          command: 'focused checks',
          passed: false,
          message: 'focused checks failed',
        },
        full: {
          command: 'npm test',
          passed: false,
          message: 'full tests failed',
        },
      }),
    });

    expect(missingValidation.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_VALIDATION);
    expect(missingValidation.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .FOCUSED_VALIDATION_MISSING,
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.FULL_VALIDATION_MISSING,
    ]));
    expect(failedValidation.statusId)
      .toBe(PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_VALIDATION);
    expect(failedValidation.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .FOCUSED_VALIDATION_FAILED,
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.FULL_VALIDATION_FAILED,
    ]));
  });

  test('rejects mutated audit output with stale risk counts or side effects', () => {
    const validation = validatePolicyBuilderPhase8CompatibilityRemovalCompletionAudit({
      statusId: PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE,
      riskCount: 99,
      risks: [],
      sideEffects: {
        filesDeleted: true,
        storageChanged: true,
        gitCommandsRun: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.RISK_COUNT_MISMATCH,
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
