import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAuditArtifact.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS,
  POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_VERSION,
  buildPolicyCompatibilityRemovalEvidenceRegeneration,
} from '../../services/policyCompatibilityRemovalEvidenceRegeneration.mjs';
import {
  EVIDENCE_REGENERATION_MANIFEST_PATHS,
  EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
  buildEvidenceRegenerationExecutionPlan,
  buildEvidenceRegenerationExecutionPlanArtifact,
  buildEvidenceRegenerationNextBatchAuthorizationArtifact,
  buildEvidenceRegenerationReferenceScan,
  buildEvidenceRegenerationValidationEvidence,
} from './fixtures/policyCompatibilityRemovalEvidenceRegenerationFixtures.mjs';

describe('policyCompatibilityRemovalEvidenceRegeneration', () => {
  test('regenerates a complete current artifact from a current plan and repository state', async () => {
    const plan = buildEvidenceRegenerationExecutionPlan();
    const executionPlanArtifact =
      buildEvidenceRegenerationExecutionPlanArtifact({ executionPlan: plan });
    const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      executionPlanArtifact,
      nextBatchAuthorizationArtifact:
        await buildEvidenceRegenerationNextBatchAuthorizationArtifact({
          plan,
          executionPlanArtifact,
        }),
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
    expect(evidence.completionAuditArtifact.auditInput.validationEvidence).toEqual({
      focused: { passed: true },
      full: { passed: true },
    });
    expect(JSON.stringify(evidence)).not.toContain('focused checks');
    expect(JSON.stringify(evidence)).not.toContain('npm --prefix server test');
    expect(evidence.validation.ok).toBe(true);
  });

  test('reports current remaining inventory without manufacturing a completion result', async () => {
    const plan = buildEvidenceRegenerationExecutionPlan();
    const executionPlanArtifact =
      buildEvidenceRegenerationExecutionPlanArtifact({ executionPlan: plan });
    const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      executionPlanArtifact,
      nextBatchAuthorizationArtifact: await buildEvidenceRegenerationNextBatchAuthorizationArtifact({
        plan,
        executionPlanArtifact,
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
    const executionPlanArtifact =
      buildEvidenceRegenerationExecutionPlanArtifact({ executionPlan: plan });
    const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      executionPlanArtifact,
      nextBatchAuthorizationArtifact:
        await buildEvidenceRegenerationNextBatchAuthorizationArtifact({
          plan,
          executionPlanArtifact,
        }),
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
        riskId: 'execution_plan_artifact_invalid',
      }),
    ]));
  });

  test('requires a completed current-source reference scan', async () => {
    const plan = buildEvidenceRegenerationExecutionPlan();
    const executionPlanArtifact =
      buildEvidenceRegenerationExecutionPlanArtifact({ executionPlan: plan });
    const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      executionPlanArtifact,
      nextBatchAuthorizationArtifact:
        await buildEvidenceRegenerationNextBatchAuthorizationArtifact({
          plan,
          executionPlanArtifact,
        }),
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

  test('reports absent closure inputs as a blocked non-authoritative diagnostic', async () => {
    const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      referenceScan: buildEvidenceRegenerationReferenceScan(),
      fileExists: () => false,
    });

    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
        .BLOCKED);
    expect(evidence.complete).toBe(false);
    expect(evidence.inputEvidence).toEqual({
      executionPlanArtifactProvided: false,
      nextBatchAuthorizationArtifactProvided: false,
      reviewArtifactFingerprintProvided: false,
      validationEvidenceProvided: false,
    });
    expect(evidence.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
            .EXECUTION_PLAN_ARTIFACT_MISSING,
      }),
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
            .NEXT_BATCH_AUTHORIZATION_ARTIFACT_MISSING,
      }),
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
            .REVIEW_ARTIFACT_FINGERPRINT_MISSING,
      }),
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_REMOVAL_EVIDENCE_REGENERATION_RISK_IDS
            .VALIDATION_EVIDENCE_MISSING,
      }),
    ]));
    expect(evidence.sideEffects).toEqual(expect.objectContaining({
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
      manifestWritten: false,
      gitCommandsRun: false,
    }));
  });

  test('rejects a raw or altered nested plan instead of accepting it as authority', async () => {
    const plan = buildEvidenceRegenerationExecutionPlan();
    const validArtifact =
      buildEvidenceRegenerationExecutionPlanArtifact({ executionPlan: plan });
    const authorizationArtifact =
      await buildEvidenceRegenerationNextBatchAuthorizationArtifact({
        plan,
        executionPlanArtifact: validArtifact,
      });
    const rawPlanEvidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      executionPlanArtifact: plan,
      nextBatchAuthorizationArtifact: authorizationArtifact,
      reviewArtifactFingerprint: EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: buildEvidenceRegenerationValidationEvidence(),
      referenceScan: buildEvidenceRegenerationReferenceScan(),
      fileExists: () => false,
    });
    const alteredArtifact = structuredClone(validArtifact);
    alteredArtifact.executionPlan.manifest.entries[0].path = 'server/src/unsafe.mjs';
    const alteredEvidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
      executionPlanArtifact: alteredArtifact,
      nextBatchAuthorizationArtifact: authorizationArtifact,
      reviewArtifactFingerprint: EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
      validationEvidence: buildEvidenceRegenerationValidationEvidence(),
      referenceScan: buildEvidenceRegenerationReferenceScan(),
      fileExists: () => false,
    });

    [rawPlanEvidence, alteredEvidence].forEach(evidence => {
      expect(evidence.statusId).toBe('blocked');
      expect(evidence.complete).toBe(false);
      expect(evidence.risks).toEqual(expect.arrayContaining([
        expect.objectContaining({ riskId: 'execution_plan_artifact_invalid' }),
      ]));
    });
  });
});
