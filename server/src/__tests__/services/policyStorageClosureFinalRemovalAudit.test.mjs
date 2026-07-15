import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAudit.mjs';
import {
  buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs';
import {
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';
import {
  POLICY_STORAGE_CLOSURE_FINAL_REMOVAL_AUDIT_STATUS_IDS,
  buildManifestPathState,
  buildPolicyStorageClosureFinalRemovalAudit,
} from '../../services/policyStorageClosureFinalRemovalAudit.mjs';
import {
  buildReadyExecutionPlanArtifact,
} from './fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';

const MANIFEST_PATHS = Object.freeze([
  'server/src/services/legacyA.mjs',
  'client/src/components/LegacyB.vue',
]);
const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);

function executionPlan(overrides = {}) {
  return {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
    statusId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    riskCount: 0,
    risks: [],
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
    },
    manifest: {
      approved: true,
      approvedBy: 'storage-closure-maintainer',
      entryCount: MANIFEST_PATHS.length,
      entries: MANIFEST_PATHS.map(path => ({
        categoryId: 'old_preview_replay_diagnostics',
        actionId: 'delete_file',
        path,
        replacementEvidence: {
          replacementPath: 'server/src/services/nativeIntent.mjs',
        },
        ready: true,
      })),
    },
    ...overrides,
  };
}

function executionPlanArtifact(plan = executionPlan()) {
  return buildReadyExecutionPlanArtifact({ executionPlan: plan });
}

function validationEvidence(overrides = {}) {
  return {
    focused: {
      command: 'focused phase8r checks',
      passed: true,
    },
    full: {
      command: 'npm --prefix server test',
      passed: true,
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
      removalReview: { reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT },
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

async function nextBatchAuthorizationArtifact({
  plan = executionPlan(),
  appliedPaths = MANIFEST_PATHS,
} = {}) {
  const remainingPaths = MANIFEST_PATHS.filter(path => !appliedPaths.includes(path));

  return buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
    runtimeEvidenceArtifact: runtimeEvidenceArtifact(appliedPaths),
    executionPlan: plan,
    input: {
      requestedPaths: remainingPaths,
      maxBatchSize: MANIFEST_PATHS.length,
      authorizationReason: remainingPaths.length > 0
        ? 'Continue the reviewed compatibility removal loop.'
        : '',
      authorizedBy: remainingPaths.length > 0 ? 'policy-maintainer' : '',
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    },
    generatedAt: '2026-07-14T10:00:00.000Z',
  });
}

describe('policyStorageClosureFinalRemovalAudit', () => {
  test('summarizes manifest path state from the current checkout', () => {
    const state = buildManifestPathState({
      manifestPaths: MANIFEST_PATHS,
      fileExists: path => path.endsWith('legacyA.mjs'),
    });

    expect(state).toEqual({
      totalCount: 2,
      existingCount: 1,
      removedCount: 1,
      manifestPaths: MANIFEST_PATHS,
      existingPaths: [MANIFEST_PATHS[0]],
      removedPaths: [MANIFEST_PATHS[1]],
    });
  });

  test('reports remaining inventory when an approved manifest path still exists', async () => {
    const plan = executionPlan();
    const evidence = await buildPolicyStorageClosureFinalRemovalAudit({
      executionPlanArtifact: executionPlanArtifact(plan),
      nextBatchAuthorizationArtifact: await nextBatchAuthorizationArtifact({
        plan,
        appliedPaths: [MANIFEST_PATHS[1]],
      }),
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: validationEvidence(),
      fileExists: path => path === MANIFEST_PATHS[0],
      referenceScan: {
        completed: true,
        checkedPaths: MANIFEST_PATHS,
        references: [],
      },
    });

    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .REMAINING_INVENTORY);
    expect(evidence.complete).toBe(false);
    expect(evidence.pathState).toEqual(expect.objectContaining({
      existingCount: 1,
      removedCount: 1,
    }));
    expect(evidence.audit.manifestInventory.remainingPaths).toEqual([MANIFEST_PATHS[0]]);
  });

  test('completes when an intact authorization artifact covers removed manifest paths', async () => {
    const plan = executionPlan();
    const evidence = await buildPolicyStorageClosureFinalRemovalAudit({
      executionPlanArtifact: executionPlanArtifact(plan),
      nextBatchAuthorizationArtifact: await nextBatchAuthorizationArtifact({ plan }),
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: validationEvidence(),
      fileExists: () => false,
      referenceScan: {
        completed: true,
        checkedPaths: MANIFEST_PATHS,
        references: [],
      },
    });

    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE);
    expect(evidence.complete).toBe(true);
    expect(evidence.pathState).toEqual(expect.objectContaining({
      existingCount: 0,
      removedCount: 2,
    }));
    expect(evidence.audit.validation.ok).toBe(true);
  });

  test('blocks a stale complete authorization artifact when checkout paths reappear', async () => {
    const plan = executionPlan();
    const evidence = await buildPolicyStorageClosureFinalRemovalAudit({
      executionPlanArtifact: executionPlanArtifact(plan),
      nextBatchAuthorizationArtifact: await nextBatchAuthorizationArtifact({ plan }),
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: validationEvidence(),
      fileExists: path => path === MANIFEST_PATHS[0],
      referenceScan: {
        completed: true,
        checkedPaths: MANIFEST_PATHS,
        references: [],
      },
    });

    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_AUTHORIZATION_ARTIFACT);
    expect(evidence.complete).toBe(false);
    expect(evidence.pathStateVerification).toEqual(expect.objectContaining({
      checked: true,
      ok: false,
      remainingPathsMatch: false,
      actualRemainingPaths: [MANIFEST_PATHS[0]],
    }));
  });

  test('blocks completion when final scan still reports references', async () => {
    const plan = executionPlan();
    const evidence = await buildPolicyStorageClosureFinalRemovalAudit({
      executionPlanArtifact: executionPlanArtifact(plan),
      nextBatchAuthorizationArtifact: await nextBatchAuthorizationArtifact({ plan }),
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: validationEvidence(),
      fileExists: () => false,
      referenceScan: {
        completed: true,
        checkedPaths: MANIFEST_PATHS,
        references: [{
          path: MANIFEST_PATHS[0],
          referencedBy: 'server/src/routes/example.mjs',
          line: 12,
        }],
      },
    });

    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_FINAL_SCAN);
    expect(evidence.audit.finalImportScan.referenceCount).toBe(1);
  });

  test('blocks completion when validation evidence is missing', async () => {
    const plan = executionPlan();
    const evidence = await buildPolicyStorageClosureFinalRemovalAudit({
      executionPlanArtifact: executionPlanArtifact(plan),
      nextBatchAuthorizationArtifact: await nextBatchAuthorizationArtifact({ plan }),
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      fileExists: () => false,
      referenceScan: {
        completed: true,
        checkedPaths: MANIFEST_PATHS,
        references: [],
      },
    });

    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_VALIDATION);
    expect(evidence.audit.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      'focused_validation_missing',
      'full_validation_missing',
    ]));
  });

  test('blocks a raw execution plan instead of treating it as an approved manifest source', async () => {
    const plan = executionPlan();
    const evidence = await buildPolicyStorageClosureFinalRemovalAudit({
      executionPlanArtifact: plan,
      nextBatchAuthorizationArtifact: await nextBatchAuthorizationArtifact({ plan }),
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: validationEvidence(),
      fileExists: () => false,
      referenceScan: {
        completed: true,
        checkedPaths: MANIFEST_PATHS,
        references: [],
      },
    });

    expect(evidence.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_FINAL_REMOVAL_AUDIT_STATUS_IDS
        .BLOCKED_BY_EXECUTION_PLAN_ARTIFACT);
    expect(evidence.complete).toBe(false);
    expect(evidence.executionPlanSource.ok).toBe(false);
    expect(evidence.executionPlanSource.issues.map(issue => issue.riskId))
      .toContain('artifact_not_ready');
  });
});
