import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS,
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS,
  buildPolicyCompatibilityRemovalCompletionAuditArtifact,
  validatePolicyCompatibilityRemovalCompletionAuditArtifact,
} from '../../services/policyCompatibilityRemovalCompletionAuditArtifact.mjs';
import {
  buildPolicyCompatibilityRemovalCompletionAuditArtifactFingerprint,
} from '../../services/policyCompatibilityRemovalCompletionAuditArtifactFingerprint.mjs';
import {
  buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs';
import {
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';
import {
  buildNextBatchAuthorizationPathStateSource,
} from './fixtures/policyNextCompatibilityRemovalBatchAuthorizationFixtures.mjs';
import {
  buildReadyExecutionPlanArtifact,
} from './fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';

const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const MANIFEST_PATHS = Object.freeze([
  'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
  'server/src/services/policyIntentImpactPreview.mjs',
  'server/src/services/policyIntentReplayPreview.mjs',
]);

function executionPlan() {
  const entries = MANIFEST_PATHS.map(path => ({
    categoryId: 'old_preview_replay_diagnostics',
    actionId: 'delete_file',
    path,
    replacementEvidence: {
      replacementPath: 'server/src/services/policyNativeIntentProjection.mjs',
    },
    ready: true,
  }));

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
  };
}

function runtimeEvidenceArtifact(
  appliedPaths = MANIFEST_PATHS,
  executionPlanArtifactFingerprint = 'b'.repeat(64)
) {
  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      applied: true,
      validation: { ok: true, issueCount: 0, issues: [] },
      removalReview: {
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
        executionPlanArtifactFingerprint,
      },
      applyBatch: {
        requestedCount: appliedPaths.length,
        results: appliedPaths.map(path => ({ path, actionId: 'delete_file', applied: true })),
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
  executionPlanArtifact = buildReadyExecutionPlanArtifact({ executionPlan: plan }),
  appliedPaths = MANIFEST_PATHS,
} = {}) {
  const remainingPaths = MANIFEST_PATHS.filter(path => !appliedPaths.includes(path));
  const source = buildNextBatchAuthorizationPathStateSource({
    executionPlan: plan,
    executionPlanArtifact,
    existingPaths: remainingPaths,
  });

  return buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
    runtimeEvidenceArtifact: runtimeEvidenceArtifact(
      appliedPaths,
      source.executionPlanArtifact.artifactFingerprint.fingerprint
    ),
    ...source,
    input: {
      requestedPaths: remainingPaths,
      maxBatchSize: 3,
      authorizationReason: remainingPaths.length > 0
        ? 'Continue the reviewed compatibility removal loop.'
        : '',
      authorizedBy: remainingPaths.length > 0 ? 'policy-maintainer' : '',
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    },
    generatedAt: '2026-07-14T10:00:00.000Z',
  });
}

function input(overrides = {}) {
  return {
    reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    finalImportScan: {
      completed: true,
      checkedPaths: MANIFEST_PATHS,
      references: [],
    },
    validationEvidence: {
      focused: { command: 'focused phase8r checks', passed: true },
      full: { command: 'npm --prefix server test', passed: true },
    },
    ...overrides,
  };
}

describe('policyCompatibilityRemovalCompletionAuditArtifact', () => {
  test('wraps a complete artifact-bound compatibility-removal completion audit', async () => {
    const plan = executionPlan();
    const executionPlanArtifact = buildReadyExecutionPlanArtifact({ executionPlan: plan });
    const authorizationArtifact = await nextBatchAuthorizationArtifact({
      plan,
      executionPlanArtifact,
    });
    const artifact = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: authorizationArtifact,
      executionPlanArtifact,
      input: input(),
      generatedAt: '2026-07-14T11:00:00.000Z',
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .COMPLETE);
    expect(artifact.complete).toBe(true);
    expect(artifact.remainingInventory).toBe(false);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.artifactFingerprint).toEqual(expect.objectContaining({
      algorithm: 'sha256',
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(artifact.executionPlan).toEqual(plan);
    expect(artifact.executionPlanArtifact).toEqual(executionPlanArtifact);
    expect(artifact.auditInput).toEqual(expect.objectContaining({
      ...input(),
      executionPlanArtifactFingerprint:
        executionPlanArtifact.artifactFingerprint.fingerprint,
    }));
    expect(artifact.nextBatchAuthorizationArtifact).toBe(authorizationArtifact);
    expect(artifact.audit.authorizationArtifact).toEqual(expect.objectContaining({
      integrityOk: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    }));
    expect(artifact.auditSummary).toEqual({
      manifestTotalCount: 3,
      manifestRemovedCount: 3,
      manifestRemainingCount: 0,
      removalVerificationCount: 1,
      removalVerifiedCount: 1,
      finalScanReferenceCount: 0,
    });
  });

  test('wraps intact remaining-inventory output without treating it as corruption', async () => {
    const plan = executionPlan();
    const executionPlanArtifact = buildReadyExecutionPlanArtifact({ executionPlan: plan });
    const authorizationArtifact = await nextBatchAuthorizationArtifact({
      plan,
      executionPlanArtifact,
      appliedPaths: [MANIFEST_PATHS[0]],
    });
    const artifact = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: authorizationArtifact,
      executionPlanArtifact,
      input: input(),
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .REMAINING_INVENTORY);
    expect(artifact.complete).toBe(false);
    expect(artifact.remainingInventory).toBe(true);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.audit.manifestInventory.remainingPaths)
      .toEqual([MANIFEST_PATHS[1], MANIFEST_PATHS[2]]);
  });

  test('blocks an altered authorization artifact and a final scan reference', async () => {
    const plan = executionPlan();
    const executionPlanArtifact = buildReadyExecutionPlanArtifact({ executionPlan: plan });
    const authorizationArtifact = await nextBatchAuthorizationArtifact({
      plan,
      executionPlanArtifact,
    });
    const alteredAuthorizationArtifact = structuredClone(authorizationArtifact);
    alteredAuthorizationArtifact.authorizationSummary.remainingCount = 1;
    const altered = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: alteredAuthorizationArtifact,
      executionPlanArtifact,
      input: input(),
    });
    const referenced = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: authorizationArtifact,
      executionPlanArtifact,
      input: input({
        finalImportScan: {
          completed: true,
          checkedPaths: MANIFEST_PATHS,
          references: [{
            path: MANIFEST_PATHS[0],
            referencedBy: 'server/src/routes/policiesRoutePolicyWrite.mjs',
          }],
        },
      }),
    });

    [altered, referenced].forEach(artifact => {
      expect(artifact.statusId)
        .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
          .BLOCKED);
      expect(artifact.complete).toBe(false);
      expect(artifact.risks).toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId:
            POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
              .AUDIT_BLOCKED,
        }),
      ]));
    });
    expect(altered.audit.statusId).toBe('blocked_by_authorization_artifact');
    expect(referenced.audit.statusId).toBe('blocked_by_final_scan');
  });

  test('rejects side effects in artifact output', async () => {
    const plan = executionPlan();
    const executionPlanArtifact = buildReadyExecutionPlanArtifact({ executionPlan: plan });
    const artifact = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: await nextBatchAuthorizationArtifact({
        plan,
        executionPlanArtifact,
      }),
      executionPlanArtifact,
      input: input(),
      sideEffects: {
        filesDeleted: true,
        manifestWritten: true,
        gitCommandsRun: true,
      },
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .BLOCKED);
    expect(artifact.validation.ok).toBe(false);
    expect(artifact.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'filesDeleted',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation = validatePolicyCompatibilityRemovalCompletionAuditArtifact({
      statusId: 'unexpected',
      riskCount: 1,
      risks: [],
      sideEffects: {},
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
            .UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
            .RISK_COUNT_MISMATCH,
      }),
    ]));
  });

  test('blocks raw, altered, or cross-chain execution-plan artifacts', async () => {
    const plan = executionPlan();
    const executionPlanArtifact = buildReadyExecutionPlanArtifact({ executionPlan: plan });
    const authorizationArtifact = await nextBatchAuthorizationArtifact({
      plan,
      executionPlanArtifact,
    });
    const rawArtifact = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: authorizationArtifact,
      executionPlanArtifact: plan,
      input: input(),
    });
    const alteredExecutionPlanArtifact = structuredClone(executionPlanArtifact);
    alteredExecutionPlanArtifact.executionPlan.manifest.entries[0].path =
      'server/src/unsafe.mjs';
    const alteredArtifact = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: authorizationArtifact,
      executionPlanArtifact: alteredExecutionPlanArtifact,
      input: input(),
    });
    const otherPlan = executionPlan();
    otherPlan.manifest.entries[0].path = 'server/src/services/other.mjs';
    const otherExecutionPlanArtifact = buildReadyExecutionPlanArtifact({
      executionPlan: otherPlan,
    });
    const crossChainArtifact = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: authorizationArtifact,
      executionPlanArtifact: otherExecutionPlanArtifact,
      input: input(),
    });

    [rawArtifact, alteredArtifact, crossChainArtifact].forEach(artifact => {
      expect(artifact.statusId).toBe('blocked');
      expect(artifact.complete).toBe(false);
    });
    [rawArtifact, alteredArtifact].forEach(artifact => {
      expect(artifact.risks).toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId:
            POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
              .EXECUTION_PLAN_ARTIFACT_INVALID,
        }),
      ]));
    });
    expect(crossChainArtifact.audit.statusId)
      .toBe('blocked_by_authorization_artifact');
  });

  test('rejects a re-fingerprinted diagnostic plan that diverges from its wrapper', async () => {
    const plan = executionPlan();
    const executionPlanArtifact = buildReadyExecutionPlanArtifact({ executionPlan: plan });
    const artifact = await buildPolicyCompatibilityRemovalCompletionAuditArtifact({
      nextBatchAuthorizationArtifact: await nextBatchAuthorizationArtifact({
        plan,
        executionPlanArtifact,
      }),
      executionPlanArtifact,
      input: input(),
    });
    artifact.executionPlan = structuredClone(artifact.executionPlan);
    artifact.executionPlan.manifest.entries[0].path = 'server/src/other.mjs';
    artifact.artifactFingerprint =
      buildPolicyCompatibilityRemovalCompletionAuditArtifactFingerprint({ artifact });

    const validation =
      validatePolicyCompatibilityRemovalCompletionAuditArtifact(artifact);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_RISK_IDS
            .EXECUTION_PLAN_ARTIFACT_CONTENT_MISMATCH,
      }),
    ]));
  });
});
