import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAuditArtifact.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAudit.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS,
  POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_VERSION,
  buildPolicyCompatibilityRemovalEvidenceRegeneration,
} from '../../services/policyCompatibilityRemovalEvidenceRegeneration.mjs';
import {
  EVIDENCE_REGENERATION_MANIFEST_PATHS,
  EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
  buildEvidenceRegenerationExecutionPlan,
  buildEvidenceRegenerationNextBatchAuthorizationArtifact,
  buildEvidenceRegenerationReferenceScan,
  buildEvidenceRegenerationValidationEvidence,
} from './fixtures/policyCompatibilityRemovalEvidenceRegenerationFixtures.mjs';

describe('policyCompatibilityRemovalEvidenceRegeneration', () => {
  test('regenerates a complete current artifact from a current plan and repository state', async () => {
    const plan = buildEvidenceRegenerationExecutionPlan();
    const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      executionPlan: plan,
      nextBatchAuthorizationArtifact:
        await buildEvidenceRegenerationNextBatchAuthorizationArtifact({ plan }),
      reviewArtifactFingerprint: EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: buildEvidenceRegenerationValidationEvidence(),
      referenceScan: buildEvidenceRegenerationReferenceScan(),
      fileExists: () => false,
      generatedAt: '2026-07-14T18:00:00.000Z',
    });

    expect(evidence.version)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_VERSION);
    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .COMPLETE);
    expect(evidence.complete).toBe(true);
    expect(evidence.pathState).toEqual(expect.objectContaining({
      existingCount: 0,
      removedCount: EVIDENCE_REGENERATION_MANIFEST_PATHS.length,
    }));
    expect(evidence.completionAuditArtifact.complete).toBe(true);
    expect(evidence.validation.ok).toBe(true);
  });

  test('reports current remaining inventory without manufacturing a completion result', async () => {
    const plan = buildEvidenceRegenerationExecutionPlan();
    const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      executionPlan: plan,
      nextBatchAuthorizationArtifact: await buildEvidenceRegenerationNextBatchAuthorizationArtifact({
        plan,
        appliedPaths: [EVIDENCE_REGENERATION_MANIFEST_PATHS[1]],
      }),
      reviewArtifactFingerprint: EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: buildEvidenceRegenerationValidationEvidence(),
      referenceScan: buildEvidenceRegenerationReferenceScan(),
      fileExists: path => path === EVIDENCE_REGENERATION_MANIFEST_PATHS[0],
    });

    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .REMAINING_INVENTORY);
    expect(evidence.complete).toBe(false);
    expect(evidence.pathState).toEqual(expect.objectContaining({
      existingPaths: [EVIDENCE_REGENERATION_MANIFEST_PATHS[0]],
      removedPaths: [EVIDENCE_REGENERATION_MANIFEST_PATHS[1]],
    }));
    expect(evidence.nextStep.stepId)
      .toBe('policy_compatibility_deletion_readiness');
  });

  test('rejects a predecessor execution-plan contract even when all paths are absent', async () => {
    const plan = buildEvidenceRegenerationExecutionPlan({
        version: 'phase8r.compatibility_path_deletion_execution_plan.v1',
      });
    const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      executionPlan: plan,
      nextBatchAuthorizationArtifact:
        await buildEvidenceRegenerationNextBatchAuthorizationArtifact({ plan }),
      reviewArtifactFingerprint: EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: buildEvidenceRegenerationValidationEvidence(),
      referenceScan: buildEvidenceRegenerationReferenceScan(),
      fileExists: () => false,
    });

    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .BLOCKED);
    expect(evidence.complete).toBe(false);
    expect(evidence.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_RISK_IDS
            .EXECUTION_PLAN_VERSION_UNSUPPORTED,
        expectedVersion: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
      }),
    ]));
  });

  test('requires a completed current-source reference scan', async () => {
    const plan = buildEvidenceRegenerationExecutionPlan();
    const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      executionPlan: plan,
      nextBatchAuthorizationArtifact:
        await buildEvidenceRegenerationNextBatchAuthorizationArtifact({ plan }),
      reviewArtifactFingerprint: EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: buildEvidenceRegenerationValidationEvidence(),
      referenceScan: buildEvidenceRegenerationReferenceScan({
        completed: false,
        checkedPaths: [],
      }),
      fileExists: () => false,
    });

    expect(evidence.complete).toBe(false);
    expect(evidence.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
            .SOURCE_SCAN_INCOMPLETE,
      }),
    ]));
  });
});
