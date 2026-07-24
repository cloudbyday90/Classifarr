import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemoval.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS,
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
  buildPolicyCompatibilityRemovalCompletionAudit,
  validatePolicyCompatibilityRemovalCompletionAudit,
} from '../../services/policyCompatibilityRemovalCompletionAudit.mjs';
import {
  buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs';
import {
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';
import {
  buildNextBatchAuthorizationPathStateSource,
} from './fixtures/policyNextCompatibilityRemovalBatchAuthorizationFixtures.mjs';

const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const MANIFEST_PATHS = Object.freeze([
  'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
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
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
    statusId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: { ok: true, issueCount: 0, issues: [] },
    riskCount: 0,
    risks: [],
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
      gitCommandsRun: false,
    },
    manifest: {
      approved: true,
      approvedBy: 'policy-maintainer',
      entryCount: entries.length,
      entries,
    },
    ...overrides,
  };
}

function runtimeEvidenceArtifact(appliedPaths = MANIFEST_PATHS) {
  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      applied: true,
      validation: { ok: true, issueCount: 0, issues: [] },
      removalReview: {
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      applyBatch: {
        requestedCount: appliedPaths.length,
        results: appliedPaths.map(path => ({
          path,
          actionId: 'delete_file',
          applied: true,
        })),
      },
    },
    importScan: {
      completed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      checkedPaths: appliedPaths,
      references: [],
    },
    runtimeChecks: [{
      checkId: 'policy-runtime-imports',
      passed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    }],
    validationEvidence: {
      focused: {
        command: 'focused validation',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      full: {
        command: 'full validation',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
    },
  });
}

function partialRuntimeEvidenceArtifact() {
  const appliedPath = MANIFEST_PATHS[0];

  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_ADAPTER,
      applied: false,
      validation: { ok: true, issueCount: 0, issues: [] },
      removalReview: {
        statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
          .READY_FOR_REMOVAL_REVIEW,
        validationOk: true,
        readyForRemovalReview: true,
        selectedCount: MANIFEST_PATHS.length,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
        executionPlanArtifactFingerprint: 'b'.repeat(64),
        executionGateArtifactFingerprint: 'c'.repeat(64),
      },
      applyBatch: {
        requestedCount: MANIFEST_PATHS.length,
        checkedCount: 2,
        appliedCount: 1,
        haltReasonId: 'adapter_failure',
        blockedEntry: {
          path: MANIFEST_PATHS[1],
          actionId: 'delete_file',
        },
        entries: MANIFEST_PATHS.map(path => ({ path, actionId: 'delete_file' })),
        results: [{
          path: appliedPath,
          actionId: 'delete_file',
          applied: true,
        }],
      },
    },
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
  });
}

async function nextBatchAuthorizationArtifact({
  plan = executionPlan(),
  appliedPaths = MANIFEST_PATHS,
  input = {},
} = {}) {
  const remainingPaths = MANIFEST_PATHS.filter(path => !appliedPaths.includes(path));
  const source = buildNextBatchAuthorizationPathStateSource({
    executionPlan: plan,
    existingPaths: remainingPaths,
  });

  return buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
    runtimeEvidenceArtifact: runtimeEvidenceArtifact(appliedPaths),
    ...source,
    input: {
      requestedPaths: remainingPaths,
      maxBatchSize: 3,
      authorizationReason: remainingPaths.length > 0
        ? 'Continue the reviewed compatibility removal loop.'
        : '',
      authorizedBy: remainingPaths.length > 0 ? 'policy-maintainer' : '',
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      ...input,
    },
    generatedAt: '2026-07-14T10:00:00.000Z',
  });
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

async function completeAudit(overrides = {}) {
  const plan = overrides.executionPlan || executionPlan();
  const artifact = overrides.nextBatchAuthorizationArtifact ||
    await nextBatchAuthorizationArtifact({ plan });

  return buildPolicyCompatibilityRemovalCompletionAudit({
    nextBatchAuthorizationArtifact: artifact,
    executionPlan: plan,
    reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    finalImportScan: finalImportScan(),
    validationEvidence: validationEvidence(),
    ...overrides,
  });
}

describe('policyCompatibilityRemovalCompletionAudit', () => {
  test('completes from one intact authorization artifact chain', async () => {
    const audit = await completeAudit();

    expect(audit.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE);
    expect(audit.complete).toBe(true);
    expect(audit.validation.ok).toBe(true);
    expect(audit.authorizationArtifact).toEqual(expect.objectContaining({
      integrityOk: true,
      authorizationStatusId: 'complete_no_remaining_paths',
      completedNoRemainingPaths: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    }));
    expect(audit.manifestInventory).toEqual(expect.objectContaining({
      totalCount: 3,
      removedCount: 3,
      remainingCount: 0,
      manifestPaths: MANIFEST_PATHS,
      remainingPaths: [],
    }));
    expect(audit.removalEvidence).toEqual({
      verificationCount: 1,
      verifiedCount: 1,
      appliedPaths: MANIFEST_PATHS,
    });
    expect(audit.sideEffects).toEqual({
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
      manifestWritten: false,
      gitCommandsRun: false,
    });
  });

  test('reports bounded remaining inventory from an intact ready authorization artifact', async () => {
    const plan = executionPlan();
    const artifact = await nextBatchAuthorizationArtifact({
      plan,
      appliedPaths: [MANIFEST_PATHS[0]],
    });
    const audit = await completeAudit({
      executionPlan: plan,
      nextBatchAuthorizationArtifact: artifact,
    });

    expect(audit.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .REMAINING_INVENTORY);
    expect(audit.complete).toBe(false);
    expect(audit.authorizationArtifact).toEqual(expect.objectContaining({
      integrityOk: true,
      remainingCount: 2,
    }));
    expect(audit.risks.map(risk => risk.riskId)).toContain(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .AUTHORIZATION_NOT_COMPLETE
    );
  });

  test('never completes from a verified partial-apply prefix', async () => {
    const plan = executionPlan();
    const source = buildNextBatchAuthorizationPathStateSource({
      executionPlan: plan,
      existingPaths: MANIFEST_PATHS.slice(1),
    });
    const authorizationArtifact =
      await buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
        runtimeEvidenceArtifact: partialRuntimeEvidenceArtifact(),
        ...source,
        input: {
          requestedPaths: [MANIFEST_PATHS[1]],
          maxBatchSize: 3,
          authorizationReason: 'Continue the reviewed compatibility removal loop.',
          authorizedBy: 'policy-maintainer',
          reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
        },
        generatedAt: '2026-07-14T10:00:00.000Z',
      });
    const audit = await completeAudit({
      executionPlan: plan,
      nextBatchAuthorizationArtifact: authorizationArtifact,
    });

    expect(audit.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_AUTHORIZATION_ARTIFACT);
    expect(audit.complete).toBe(false);
    expect(audit.risks.map(risk => risk.riskId)).toContain(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .AUTHORIZATION_ARTIFACT_NOT_AUTHORIZABLE
    );
  });

  test('blocks missing, altered, cross-review, and cross-manifest authorization evidence', async () => {
    const plan = executionPlan();
    const artifact = await nextBatchAuthorizationArtifact({ plan });
    const alteredArtifact = structuredClone(artifact);
    alteredArtifact.authorization.remainingManifest.remainingCount = 1;
    const alternatePlan = executionPlan({
      entries: MANIFEST_PATHS.slice(1).map(path => manifestEntry(path)),
      manifest: {
        approved: true,
        entryCount: 2,
        entries: MANIFEST_PATHS.slice(1).map(path => manifestEntry(path)),
      },
    });
    const missing = await buildPolicyCompatibilityRemovalCompletionAudit({
      executionPlan: plan,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      finalImportScan: finalImportScan(),
      validationEvidence: validationEvidence(),
    });
    const altered = await completeAudit({
      executionPlan: plan,
      nextBatchAuthorizationArtifact: alteredArtifact,
    });
    const crossReview = await completeAudit({
      executionPlan: plan,
      nextBatchAuthorizationArtifact: artifact,
      reviewArtifactFingerprint: 'b'.repeat(64),
    });
    const crossManifest = await completeAudit({
      executionPlan: alternatePlan,
      nextBatchAuthorizationArtifact: artifact,
      finalImportScan: finalImportScan({ checkedPaths: MANIFEST_PATHS.slice(1) }),
    });

    [missing, altered, crossReview, crossManifest].forEach(audit => {
      expect(audit.statusId)
        .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
          .BLOCKED_BY_AUTHORIZATION_ARTIFACT);
      expect(audit.complete).toBe(false);
    });
    expect(missing.risks.map(risk => risk.riskId)).toContain(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .AUTHORIZATION_ARTIFACT_MISSING
    );
    expect(altered.risks.map(risk => risk.riskId)).toContain(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .AUTHORIZATION_ARTIFACT_INVALID
    );
    expect(crossReview.risks.map(risk => risk.riskId)).toContain(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .AUTHORIZATION_REVIEW_CONTEXT_MISMATCH
    );
    expect(crossManifest.risks.map(risk => risk.riskId)).toContain(
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .AUTHORIZATION_EXECUTION_PLAN_MANIFEST_MISMATCH
    );
  });

  test('blocks when the final import scan is incomplete or references a manifest path', async () => {
    const missingScan = await completeAudit({
      finalImportScan: finalImportScan({ completed: false, checkedPaths: [] }),
    });
    const referenced = await completeAudit({
      finalImportScan: finalImportScan({
        references: [{
          path: MANIFEST_PATHS[1],
          referencedBy: 'server/src/routes/policiesRoutePolicyWrite.mjs',
        }],
      }),
    });

    expect(missingScan.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_FINAL_SCAN);
    expect(missingScan.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.FINAL_SCAN_MISSING,
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.FINAL_SCAN_PATH_MISSING,
    ]));
    expect(referenced.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_FINAL_SCAN);
    expect(referenced.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
            .FINAL_SCAN_REFERENCE_FOUND,
        path: MANIFEST_PATHS[1],
      }),
    ]));
  });

  test('blocks failed validation evidence and rejects mutated audit output side effects', async () => {
    const failedValidation = await completeAudit({
      validationEvidence: validationEvidence({
        focused: { command: 'focused checks', passed: false },
        full: { command: 'full checks', passed: false },
      }),
    });
    const validation = validatePolicyCompatibilityRemovalCompletionAudit({
      statusId: POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE,
      riskCount: 99,
      risks: [],
      sideEffects: {
        filesDeleted: true,
        storageChanged: true,
        gitCommandsRun: true,
      },
    });

    expect(failedValidation.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_VALIDATION);
    expect(failedValidation.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
        .FOCUSED_VALIDATION_FAILED,
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.FULL_VALIDATION_FAILED,
    ]));
    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.RISK_COUNT_MISMATCH,
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
