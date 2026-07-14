import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS,
  validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifactIntegrity,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorizationArtifactIntegrity.mjs';
import {
  buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs';
import {
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';

const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const MANIFEST_PATHS = Object.freeze([
  'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
  'server/src/services/policyIntentImpactPreview.mjs',
]);

function executionPlan(paths = MANIFEST_PATHS) {
  return {
    statusId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: { ok: true, issueCount: 0, issues: [] },
    manifest: {
      approved: true,
      approvedBy: 'policy-maintainer',
      entryCount: paths.length,
      entries: paths.map(path => ({
        categoryId: 'old_preview_replay_diagnostics',
        actionId: 'delete_file',
        path,
        ready: true,
      })),
    },
  };
}

function runtimeEvidenceArtifact(paths = MANIFEST_PATHS) {
  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      applied: true,
      validation: { ok: true, issueCount: 0, issues: [] },
      removalReview: { reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT },
      applyBatch: {
        requestedCount: paths.length,
        results: paths.map(path => ({ path, actionId: 'delete_file', applied: true })),
      },
    },
    importScan: {
      completed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      checkedPaths: paths,
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

async function authorizationArtifact(plan = executionPlan()) {
  return buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
    runtimeEvidenceArtifact: runtimeEvidenceArtifact(),
    executionPlan: plan,
    input: {
      requestedPaths: [],
      maxBatchSize: 2,
      authorizationReason: '',
      authorizedBy: '',
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    },
    generatedAt: '2026-07-14T10:00:00.000Z',
  });
}

describe('policyNextCompatibilityRemovalBatchAuthorizationArtifactIntegrity', () => {
  test('accepts an intact artifact replayed against the same manifest and review context', async () => {
    const plan = executionPlan();
    const integrity =
      await validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifactIntegrity({
        authorizationArtifact: await authorizationArtifact(plan),
        executionPlan: plan,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      });

    expect(integrity.ok).toBe(true);
    expect(integrity.authorization.completedNoRemainingPaths).toBe(true);
    expect(integrity.appliedPaths).toEqual(MANIFEST_PATHS);
  });

  test('rejects an altered artifact, mismatched review context, and cross-manifest replay', async () => {
    const plan = executionPlan();
    const artifact = await authorizationArtifact(plan);
    const alteredArtifact = structuredClone(artifact);
    alteredArtifact.authorizationSummary.remainingCount = 1;
    const altered =
      await validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifactIntegrity({
        authorizationArtifact: alteredArtifact,
        executionPlan: plan,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      });
    const crossReview =
      await validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifactIntegrity({
        authorizationArtifact: artifact,
        executionPlan: plan,
        reviewArtifactFingerprint: 'b'.repeat(64),
      });
    const crossManifest =
      await validatePolicyNextCompatibilityRemovalBatchAuthorizationArtifactIntegrity({
        authorizationArtifact: artifact,
        executionPlan: executionPlan([MANIFEST_PATHS[1]]),
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      });

    [altered, crossReview, crossManifest].forEach(integrity => {
      expect(integrity.ok).toBe(false);
    });
    expect(altered.issues.map(issue => issue.riskId)).toContain(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS
        .AUTHORIZATION_ARTIFACT_INVALID
    );
    expect(crossReview.issues.map(issue => issue.riskId)).toContain(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS
        .REVIEW_ARTIFACT_FINGERPRINT_MISMATCH
    );
    expect(crossManifest.issues.map(issue => issue.riskId)).toContain(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_INTEGRITY_RISK_IDS
        .AUTHORIZATION_REPLAY_MISMATCH
    );
  });
});
