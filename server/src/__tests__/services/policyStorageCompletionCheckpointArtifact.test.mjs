import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS,
} from '../../services/policyStorageCompletionCheckpoint.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION,
} from '../../services/policyCompatibilityRemovalCompletionAuditArtifact.mjs';
import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS,
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS,
  buildPolicyStorageCompletionCheckpointArtifact,
  validatePolicyStorageCompletionCheckpointArtifact,
} from '../../services/policyStorageCompletionCheckpointArtifact.mjs';
import {
  MANIFEST_PATHS,
  buildCompletionAuditArtifactFixture,
} from './policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';
import {
  POLICY_STORAGE_COMPLETION_COMPONENT_IDS,
  buildPolicyStorageCompletionCheckpointArtifactInputs,
  buildPolicyStorageCompletionCheckpointRoadmapEvidence,
} from './policyStorageCompletionCheckpointArtifactFixture.mjs';

async function completeArtifact(overrides = {}) {
  const inputs = await buildPolicyStorageCompletionCheckpointArtifactInputs({
    completionAuditArtifact: overrides.completionAuditArtifact,
  });

  return buildPolicyStorageCompletionCheckpointArtifact({
    ...inputs,
    generatedAt: '2026-06-25T12:00:00.000Z',
    ...overrides,
  });
}

describe('policyStorageCompletionCheckpointArtifact', () => {
  test('wraps a complete policy storage completion checkpoint artifact', async () => {
    const artifact = await completeArtifact();

    expect(artifact.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE);
    expect(artifact.complete).toBe(true);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.checkpoint.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE);
    expect(artifact.checkpointSummary).toEqual(expect.objectContaining({
      componentExpectedCount: POLICY_STORAGE_COMPLETION_COMPONENT_IDS.length,
      componentImplementedCount: POLICY_STORAGE_COMPLETION_COMPONENT_IDS.length,
      checkpointRiskCount: 0,
      finalRemovalAuditStatusId: 'complete',
      validationEvidenceIntegrityOk: true,
      validationEvidenceArtifactFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      validationPassedCount: 4,
    }));
    expect(artifact.completionAuditArtifact).toEqual(expect.objectContaining({
      version: POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION,
      statusId: 'complete',
      complete: true,
      validationOk: true,
      riskCount: 0,
    }));
    expect(artifact.nextPhase).toBeUndefined();
    expect(artifact.nextStep).toEqual(expect.objectContaining({
      stepId: 'policy_storage_final_closure_readout',
      label: 'Policy Storage Final Closure Readout',
    }));
  });

  test('blocks when the compatibility-removal completion-audit artifact is missing', async () => {
    const artifact = await completeArtifact({
      completionAuditArtifact: {},
    });

    expect(artifact.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
            .COMPLETION_AUDIT_MISSING,
      }),
    ]));
  });

  test('blocks when the compatibility-removal completion-audit artifact is not complete', async () => {
    const artifact = await completeArtifact({
      completionAuditArtifact: await buildCompletionAuditArtifactFixture({
        appliedPaths: [MANIFEST_PATHS[0]],
      }),
    });

    expect(artifact.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_NOT_COMPLETE,
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.CHECKPOINT_BLOCKED,
    ]));
  });

  test('blocks a predecessor completion-audit artifact wrapper', async () => {
    const completionAuditArtifact = structuredClone(
      await buildCompletionAuditArtifactFixture()
    );
    completionAuditArtifact.version =
      'phase8r.compatibility_removal_completion_audit_artifact.v1';
    const artifact = await completeArtifact({
      completionAuditArtifact,
    });

    expect(artifact.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
            .COMPLETION_AUDIT_ARTIFACT_VERSION_UNSUPPORTED,
        expectedVersion:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_VERSION,
      }),
    ]));
  });

  test('blocks when checkpoint evidence is incomplete', async () => {
    const artifact = await completeArtifact({
      roadmapEvidence: buildPolicyStorageCompletionCheckpointRoadmapEvidence({
        componentSequenceIds: POLICY_STORAGE_COMPLETION_COMPONENT_IDS.filter(componentId => (
          componentId !== 'next_compatibility_removal_batch_authorization'
        )),
      }),
    });

    expect(artifact.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.checkpoint.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.CHECKPOINT_BLOCKED,
      }),
    ]));
  });

  test('rejects side effects in artifact output', async () => {
    const artifact = await completeArtifact({
      sideEffects: {
        filesWritten: true,
        storageChanged: true,
        gitCommandsRun: true,
        commandsExecuted: true,
        manifestWritten: true,
      },
    });

    expect(artifact.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.validation.ok).toBe(false);
    expect(artifact.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
        sideEffect: 'filesWritten',
      }),
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
        sideEffect: 'manifestWritten',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation = validatePolicyStorageCompletionCheckpointArtifact({
      statusId: 'unexpected',
      complete: false,
      riskCount: 1,
      risks: [],
      sideEffects: {},
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.RISK_COUNT_MISMATCH,
      }),
    ]));
  });
});
