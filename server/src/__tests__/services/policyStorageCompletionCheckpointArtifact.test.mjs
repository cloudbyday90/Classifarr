import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS,
  POLICY_STORAGE_COMPLETION_COMPONENTS,
} from '../../services/policyStorageCompletionCheckpoint.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAudit.mjs';
import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS,
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS,
  buildPolicyStorageCompletionCheckpointArtifact,
  validatePolicyStorageCompletionCheckpointArtifact,
} from '../../services/policyStorageCompletionCheckpointArtifact.mjs';

const COMPONENT_IDS =
  POLICY_STORAGE_COMPLETION_COMPONENTS.map(component => component.componentId);

function componentEvidence(overrides = {}) {
  return POLICY_STORAGE_COMPLETION_COMPONENTS.map(component => ({
    componentId: component.componentId,
    label: component.label,
    implemented: true,
    designDocPresent: true,
    contractEvidencePresent: true,
    testEvidencePresent: true,
    changelogEntryPresent: true,
    ...overrides[component.componentId],
  }));
}

function roadmapEvidence(overrides = {}) {
  return {
    componentSequenceIds: COMPONENT_IDS,
    implementationStatusComponentIds: COMPONENT_IDS,
    ...overrides,
  };
}

function completionAuditArtifact(overrides = {}) {
  return {
    statusId: 'complete',
    complete: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    riskCount: 0,
    risks: [],
    audit: {
      statusId: POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE,
      complete: true,
      validation: {
        ok: true,
        issueCount: 0,
        issues: [],
      },
    },
    ...overrides,
  };
}

function validationEvidence(overrides = {}) {
  return {
    focused: {
      command: 'node ./scripts/run-jest.mjs --testPathPatterns="policyBuilderPhase8" --no-coverage',
      passed: true,
    },
    lint: {
      command: 'npm run lint',
      passed: true,
    },
    markdown: {
      command: 'npx markdownlint-cli2 CHANGELOG.md docs/architecture/policy-builder-intent-model-roadmap.md',
      passed: true,
    },
    full: {
      command: 'npm --prefix server test',
      passed: true,
    },
    ...overrides,
  };
}

function changelogEvidence(overrides = {}) {
  return {
    updated: true,
    componentIds: COMPONENT_IDS,
    ...overrides,
  };
}

function completeArtifact(overrides = {}) {
  return buildPolicyStorageCompletionCheckpointArtifact({
    componentEvidence: componentEvidence(),
    roadmapEvidence: roadmapEvidence(),
    completionAuditArtifact: completionAuditArtifact(),
    validationEvidence: validationEvidence(),
    changelogEvidence: changelogEvidence(),
    generatedAt: '2026-06-25T12:00:00.000Z',
    ...overrides,
  });
}

describe('policyStorageCompletionCheckpointArtifact', () => {
  test('wraps a complete policy storage completion checkpoint artifact', () => {
    const artifact = completeArtifact();

    expect(artifact.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE);
    expect(artifact.complete).toBe(true);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.checkpoint.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE);
    expect(artifact.checkpointSummary).toEqual(expect.objectContaining({
      componentExpectedCount: POLICY_STORAGE_COMPLETION_COMPONENTS.length,
      componentImplementedCount: POLICY_STORAGE_COMPLETION_COMPONENTS.length,
      checkpointRiskCount: 0,
      finalRemovalAuditStatusId:
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE,
      validationPassedCount: 4,
    }));
    expect(artifact.completionAuditArtifact).toEqual(expect.objectContaining({
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

  test('blocks when the compatibility-removal completion-audit artifact is missing', () => {
    const artifact = completeArtifact({
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

  test('blocks when the compatibility-removal completion-audit artifact is not complete', () => {
    const artifact = completeArtifact({
      completionAuditArtifact: completionAuditArtifact({
        statusId: 'remaining_inventory',
        complete: false,
        audit: {
          statusId:
            POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
              .REMAINING_INVENTORY,
          complete: false,
          validation: {
            ok: true,
            issueCount: 0,
            issues: [],
          },
        },
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

  test('blocks when checkpoint evidence is incomplete', () => {
    const artifact = completeArtifact({
      roadmapEvidence: roadmapEvidence({
        componentSequenceIds: COMPONENT_IDS.filter(componentId => (
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

  test('rejects side effects in artifact output', () => {
    const artifact = completeArtifact({
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
