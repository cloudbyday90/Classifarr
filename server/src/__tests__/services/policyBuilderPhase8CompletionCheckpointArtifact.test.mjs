import {
  PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS,
  PHASE8R_EXPECTED_COMPONENTS,
} from '../../services/policyBuilderPhase8CompletionCheckpoint.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAudit.mjs';
import {
  PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS,
  PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS,
  buildPolicyBuilderPhase8CompletionCheckpointArtifact,
  validatePolicyBuilderPhase8CompletionCheckpointArtifact,
} from '../../services/policyBuilderPhase8CompletionCheckpointArtifact.mjs';

const PHASE_IDS = PHASE8R_EXPECTED_COMPONENTS.map(component => component.phaseId);

function componentEvidence(overrides = {}) {
  return PHASE8R_EXPECTED_COMPONENTS.map(component => ({
    phaseId: component.phaseId,
    label: component.label,
    implemented: true,
    designDocPresent: true,
    contractEvidencePresent: true,
    testEvidencePresent: true,
    changelogEntryPresent: true,
    ...overrides[component.phaseId],
  }));
}

function roadmapEvidence(overrides = {}) {
  return {
    sequencePhaseIds: PHASE_IDS,
    implementationStatusPhaseIds: PHASE_IDS,
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
    phaseIds: PHASE_IDS,
    ...overrides,
  };
}

function completeArtifact(overrides = {}) {
  return buildPolicyBuilderPhase8CompletionCheckpointArtifact({
    componentEvidence: componentEvidence(),
    roadmapEvidence: roadmapEvidence(),
    completionAuditArtifact: completionAuditArtifact(),
    validationEvidence: validationEvidence(),
    changelogEvidence: changelogEvidence(),
    generatedAt: '2026-06-25T12:00:00.000Z',
    ...overrides,
  });
}

describe('policyBuilderPhase8CompletionCheckpointArtifact', () => {
  test('wraps a complete Phase 8R.22 completion checkpoint artifact', () => {
    const artifact = completeArtifact();

    expect(artifact.statusId)
      .toBe(PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.COMPLETE);
    expect(artifact.complete).toBe(true);
    expect(artifact.validation.ok).toBe(true);
    expect(artifact.checkpoint.statusId)
      .toBe(PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE);
    expect(artifact.checkpointSummary).toEqual(expect.objectContaining({
      componentExpectedCount: PHASE8R_EXPECTED_COMPONENTS.length,
      componentImplementedCount: PHASE8R_EXPECTED_COMPONENTS.length,
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
  });

  test('blocks when the compatibility-removal completion-audit artifact is missing', () => {
    const artifact = completeArtifact({
      completionAuditArtifact: {},
    });

    expect(artifact.statusId)
      .toBe(PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
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
      .toBe(PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_NOT_COMPLETE,
      PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.CHECKPOINT_BLOCKED,
    ]));
  });

  test('blocks when checkpoint evidence is incomplete', () => {
    const artifact = completeArtifact({
      roadmapEvidence: roadmapEvidence({
        sequencePhaseIds: PHASE_IDS.filter(phaseId => phaseId !== '8r_20'),
      }),
    });

    expect(artifact.statusId)
      .toBe(PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.checkpoint.statusId)
      .toBe(PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.CHECKPOINT_BLOCKED,
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
      .toBe(PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(artifact.validation.ok).toBe(false);
    expect(artifact.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
        sideEffect: 'filesWritten',
      }),
      expect.objectContaining({
        riskId:
          PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.SIDE_EFFECT_REPORTED,
        sideEffect: 'manifestWritten',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation = validatePolicyBuilderPhase8CompletionCheckpointArtifact({
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
          PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId:
          PHASE8R_COMPLETION_CHECKPOINT_ARTIFACT_RISK_IDS.RISK_COUNT_MISMATCH,
      }),
    ]));
  });
});
