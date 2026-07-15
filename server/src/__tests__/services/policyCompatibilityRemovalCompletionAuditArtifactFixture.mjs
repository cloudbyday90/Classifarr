import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  buildPolicyCompatibilityRemovalCompletionAuditArtifact,
} from '../../services/policyCompatibilityRemovalCompletionAuditArtifact.mjs';
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
  'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
  'server/src/services/policyIntentImpactPreview.mjs',
  'server/src/services/policyIntentReplayPreview.mjs',
]);

function buildCompletionAuditExecutionPlan() {
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

function buildCompletionAuditRuntimeEvidenceArtifact(appliedPaths = MANIFEST_PATHS) {
  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      applied: true,
      validation: { ok: true, issueCount: 0, issues: [] },
      removalReview: { reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT },
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

function buildCompletionAuditInput(overrides = {}) {
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

async function buildCompletionAuditNextBatchAuthorizationArtifact({
  executionPlan = buildCompletionAuditExecutionPlan(),
  appliedPaths = MANIFEST_PATHS,
  generatedAt = '2026-07-14T10:00:00.000Z',
} = {}) {
  const remainingPaths = MANIFEST_PATHS.filter(path => !appliedPaths.includes(path));
  const source = buildNextBatchAuthorizationPathStateSource({
    executionPlan,
    existingPaths: remainingPaths,
  });

  return buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
    runtimeEvidenceArtifact: buildCompletionAuditRuntimeEvidenceArtifact(appliedPaths),
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
    generatedAt,
  });
}

async function buildCompletionAuditArtifactFixture({
  appliedPaths = MANIFEST_PATHS,
  input = {},
  generatedAt = '2026-07-14T11:00:00.000Z',
} = {}) {
  const executionPlan = buildCompletionAuditExecutionPlan();
  const nextBatchAuthorizationArtifact =
    await buildCompletionAuditNextBatchAuthorizationArtifact({
      executionPlan,
      appliedPaths,
    });

  return buildPolicyCompatibilityRemovalCompletionAuditArtifact({
    nextBatchAuthorizationArtifact,
    executionPlan,
    input: buildCompletionAuditInput(input),
    generatedAt,
  });
}

export {
  MANIFEST_PATHS,
  REVIEW_ARTIFACT_FINGERPRINT,
  buildCompletionAuditExecutionPlan,
  buildCompletionAuditArtifactFixture,
  buildCompletionAuditInput,
  buildCompletionAuditNextBatchAuthorizationArtifact,
  buildCompletionAuditRuntimeEvidenceArtifact,
};
