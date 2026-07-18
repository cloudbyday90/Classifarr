import {
  POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS,
} from '../../services/policyStorageClosureValidationEvidence.mjs';
import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS,
} from '../../services/policyStorageCompletionCheckpoint.mjs';
import {
  POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS,
  POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS,
  buildPolicyStorageFinalClosureReadout,
  validatePolicyStorageFinalClosureReadout,
} from '../../services/policyStorageFinalClosureReadout.mjs';
import {
  buildPolicyStorageCompletionCheckpointArtifact,
} from '../../services/policyStorageCompletionCheckpointArtifact.mjs';
import {
  MANIFEST_PATHS,
  buildCompletionAuditArtifactFixture,
} from './policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';
import {
  POLICY_STORAGE_COMPLETION_COMPONENT_IDS,
  buildPolicyStorageCompletionCheckpointArtifactInputs,
} from './policyStorageCompletionCheckpointArtifactFixture.mjs';

const INCOMPLETE_REMOVAL_AUDIT = 'incomplete_removal_audit';

async function checkpointArtifact({
  componentEvidenceOverrides = {},
  roadmapEvidenceOverrides = {},
  completionAuditArtifact = undefined,
  validationEvidenceOverrides = {},
  changelogEvidenceOverrides = {},
} = {}) {
  const inputs = await buildPolicyStorageCompletionCheckpointArtifactInputs({
    componentEvidenceOverrides,
    roadmapEvidenceOverrides,
    completionAuditArtifact,
    validationEvidenceOverrides,
    changelogEvidenceOverrides,
  });

  return buildPolicyStorageCompletionCheckpointArtifact({
    ...inputs,
    generatedAt: '2026-07-15T13:00:00.000Z',
  });
}

async function readout({
  checkpointArtifact: providedCheckpointArtifact = undefined,
  ...overrides
} = {}) {
  return buildPolicyStorageFinalClosureReadout({
    checkpointArtifact:
      providedCheckpointArtifact === undefined
        ? await checkpointArtifact()
        : providedCheckpointArtifact,
    generatedAt: '2026-07-15T13:01:00.000Z',
    ...overrides,
  });
}

describe('policyStorageFinalClosureReadout', () => {
  test('marks policy storage closure complete from a fingerprint-valid replayable checkpoint artifact', async () => {
    const output = await readout();

    expect(output.statusId).toBe(POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.COMPLETE);
    expect(output.complete).toBe(true);
    expect(output.validation.ok).toBe(true);
    expect(output.checkpointArtifactIntegrity).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      artifactFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(output.operatorSummary).toEqual(expect.objectContaining({
      decision: 'complete',
      nextAction: 'Policy storage closure can be treated as complete.',
    }));
    expect(output.nextPhase).toBeUndefined();
    expect(output.nextStep).toEqual(expect.objectContaining({
      stepId: 'policy_storage_closure_complete',
      label: 'Policy Storage Closure Complete',
    }));
    expect(output.checkpointArtifactSummary).toEqual(expect.objectContaining({
      statusId: 'complete',
      complete: true,
      validationOk: true,
      riskCount: 0,
    }));
  });

  test('blocks with artifact-validation status when the checkpoint artifact is missing', async () => {
    const output = await readout({ checkpointArtifact: {} });

    expect(output.statusId)
      .toBe(POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS
        .BLOCKED_BY_ARTIFACT_VALIDATION);
    expect(output.checkpointArtifactIntegrity.ok).toBe(false);
    expect(output.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS
            .CHECKPOINT_ARTIFACT_INTEGRITY_FAILED,
      }),
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.CHECKPOINT_ARTIFACT_MISSING,
      }),
      expect.objectContaining({
        riskId: POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.CHECKPOINT_MISSING,
      }),
    ]));
  });

  test('maps a replayable component checkpoint failure to component evidence status', async () => {
    const output = await readout({
      checkpointArtifact: await checkpointArtifact({
        componentEvidenceOverrides: {
          [POLICY_STORAGE_COMPLETION_COMPONENT_IDS[0]]: {
            implemented: false,
          },
        },
      }),
    });

    expect(output.checkpointArtifactIntegrity.ok).toBe(true);
    expect(output.checkpointSummary.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS
        .BLOCKED_BY_COMPONENT_COVERAGE);
    expect(output.statusId)
      .toBe(POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS
        .BLOCKED_BY_COMPONENT_EVIDENCE);
    expect(output.operatorSummary.nextAction)
      .toBe('Fix missing implementation, design-doc, contract, or test evidence.');
  });

  test.each([
    [
      'roadmap',
      {
        roadmapEvidenceOverrides: {
          componentSequenceIds: POLICY_STORAGE_COMPLETION_COMPONENT_IDS.slice(1),
        },
      },
      POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE,
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE,
    ],
    [
      'removal audit',
      {
        completionAuditArtifact: INCOMPLETE_REMOVAL_AUDIT,
      },
      POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS
        .BLOCKED_BY_FINAL_REMOVAL_AUDIT,
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_REMOVAL_AUDIT,
    ],
    [
      'validation',
      {
        validationEvidenceOverrides: {
          commandResultOverrides: {
            [POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS[0].checkId]: {
              exitCode: 1,
            },
          },
        },
      },
      POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_VALIDATION,
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_VALIDATION,
    ],
    [
      'changelog',
      {
        changelogEvidenceOverrides: {
          componentIds: POLICY_STORAGE_COMPLETION_COMPONENT_IDS.slice(1),
        },
      },
      POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_CHANGELOG,
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_CHANGELOG,
    ],
  ])(
    'maps a replayable %s checkpoint failure',
    async (_label, options, checkpointStatusId, readoutStatusId) => {
      const resolvedOptions = options.completionAuditArtifact === INCOMPLETE_REMOVAL_AUDIT
        ? {
          completionAuditArtifact: await buildCompletionAuditArtifactFixture({
            appliedPaths: [MANIFEST_PATHS[0]],
          }),
        }
        : options;
      const output = await readout({
        checkpointArtifact: await checkpointArtifact(resolvedOptions),
      });

      expect(output.checkpointArtifactIntegrity.ok).toBe(true);
      expect(output.checkpointSummary.statusId).toBe(checkpointStatusId);
      expect(output.statusId).toBe(readoutStatusId);
      expect(output.complete).toBe(false);
    }
  );

  test('separates repository readiness from pending active-installation cutover', async () => {
    const output = await readout({
      checkpointArtifact: await checkpointArtifact({
        completionAuditArtifact: await buildCompletionAuditArtifactFixture({
          appliedPaths: [MANIFEST_PATHS[0]],
        }),
      }),
    });

    expect(output.statusId)
      .toBe(POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_REMOVAL_AUDIT);
    expect(output.implementationReadiness).toEqual(expect.objectContaining({
      scope: 'repository',
      ready: true,
    }));
    expect(output.instanceCutover).toEqual(expect.objectContaining({
      scope: 'active_installation',
      ready: false,
      requiredForStorageClosure: true,
    }));
    expect(output.operatorSummary).toEqual(expect.objectContaining({
      decision: 'implementation_ready_instance_cutover_pending',
      nextAction:
        'Complete the active-installation compatibility-removal evidence and controlled cutover workflow.',
    }));
    expect(output.nextStep).toEqual(expect.objectContaining({
      stepId: 'policy_storage_instance_cutover',
      label: 'Active Installation Cutover',
    }));
  });

  test('rejects a tampered checkpoint artifact even when its top-level completion fields appear valid', async () => {
    const artifact = await checkpointArtifact();
    artifact.checkpointSummary.componentImplementedCount = 0;

    const output = await readout({ checkpointArtifact: artifact });

    expect(output.statusId)
      .toBe(POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS
        .BLOCKED_BY_ARTIFACT_VALIDATION);
    expect(output.checkpointArtifactIntegrity.ok).toBe(false);
  });

  test('blocks side-effect evidence even when the checkpoint artifact itself is complete', async () => {
    const output = await readout({
      sideEffects: {
        filesWritten: true,
        storageChanged: true,
        gitCommandsRun: true,
        commandsExecuted: true,
        manifestWritten: true,
      },
    });

    expect(output.statusId)
      .toBe(POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_SIDE_EFFECTS);
    expect(output.validation.ok).toBe(false);
    expect(output.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.SIDE_EFFECT_REPORTED,
        sideEffect: 'filesWritten',
      }),
      expect.objectContaining({
        riskId: POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.SIDE_EFFECT_REPORTED,
        sideEffect: 'manifestWritten',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation = validatePolicyStorageFinalClosureReadout({
      statusId: 'unexpected',
      complete: false,
      riskCount: 1,
      risks: [],
      sideEffects: {},
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId: POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.RISK_COUNT_MISMATCH,
      }),
    ]));
  });
});
