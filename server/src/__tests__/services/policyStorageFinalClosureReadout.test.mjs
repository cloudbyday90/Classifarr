import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS,
} from '../../services/policyStorageCompletionCheckpointArtifact.mjs';
import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS,
} from '../../services/policyStorageCompletionCheckpoint.mjs';
import {
  POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS,
  POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS,
  buildPolicyStorageFinalClosureReadout,
  validatePolicyStorageFinalClosureReadout,
} from '../../services/policyStorageFinalClosureReadout.mjs';

function checkpoint(overrides = {}) {
  return {
    statusId: POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE,
    complete: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    componentCoverage: {
      expectedCount: 21,
      implementedCount: 21,
    },
    riskCount: 0,
    risks: [],
    ...overrides,
  };
}

function checkpointArtifact(overrides = {}) {
  return {
    statusId: POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE,
    complete: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    riskCount: 0,
    risks: [],
    sideEffects: {
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
      manifestWritten: false,
    },
    checkpoint: checkpoint(),
    ...overrides,
  };
}

function readout(overrides = {}) {
  return buildPolicyStorageFinalClosureReadout({
    checkpointArtifact: checkpointArtifact(),
    generatedAt: '2026-06-25T13:00:00.000Z',
    ...overrides,
  });
}

describe('policyStorageFinalClosureReadout', () => {
  test('marks policy storage closure complete when the checkpoint artifact is complete', () => {
    const output = readout();

    expect(output.statusId).toBe(POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.COMPLETE);
    expect(output.complete).toBe(true);
    expect(output.validation.ok).toBe(true);
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
      statusId: POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE,
      complete: true,
      validationOk: true,
      riskCount: 0,
    }));
  });

  test('blocks with artifact-validation status when the checkpoint artifact is missing', () => {
    const output = buildPolicyStorageFinalClosureReadout({
      checkpointArtifact: {},
    });

    expect(output.statusId)
      .toBe(POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS
        .BLOCKED_BY_ARTIFACT_VALIDATION);
    expect(output.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.CHECKPOINT_ARTIFACT_MISSING,
      }),
      expect.objectContaining({
        riskId: POLICY_STORAGE_FINAL_CLOSURE_READOUT_RISK_IDS.CHECKPOINT_MISSING,
      }),
    ]));
  });

  test('maps component checkpoint failures to component evidence status', () => {
    const output = readout({
      checkpointArtifact: checkpointArtifact({
        statusId: POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE,
        complete: true,
        checkpoint: checkpoint({
          statusId:
            POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS
              .BLOCKED_BY_COMPONENT_COVERAGE,
          complete: false,
          riskCount: 1,
          risks: [{
            riskId: 'component_missing_test_evidence',
          }],
        }),
      }),
    });

    expect(output.statusId)
      .toBe(POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS
        .BLOCKED_BY_COMPONENT_EVIDENCE);
    expect(output.operatorSummary.nextAction)
      .toBe('Fix missing implementation, design-doc, contract, or test evidence.');
  });

  test('maps roadmap, removal, validation, and changelog checkpoint failures', () => {
    const cases = [
      [
        POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE,
        POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE,
      ],
      [
        POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS
          .BLOCKED_BY_FINAL_REMOVAL_AUDIT,
        POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_REMOVAL_AUDIT,
      ],
      [
        POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_VALIDATION,
        POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_VALIDATION,
      ],
      [
        POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_CHANGELOG,
        POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_CHANGELOG,
      ],
    ];

    cases.forEach(([checkpointStatusId, readoutStatusId]) => {
      const output = readout({
        checkpointArtifact: checkpointArtifact({
          checkpoint: checkpoint({
            statusId: checkpointStatusId,
            complete: false,
            riskCount: 1,
            risks: [{ riskId: 'checkpoint_blocker' }],
          }),
        }),
      });

      expect(output.statusId).toBe(readoutStatusId);
      expect(output.complete).toBe(false);
    });
  });

  test('blocks side-effect evidence even when the checkpoint artifact is complete', () => {
    const output = readout({
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
