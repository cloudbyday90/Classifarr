import {
  PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP,
} from '../../services/policyBuilderPhase8CompletionEvidenceRun.mjs';
import {
  PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from '../../services/policyBuilderPhase8CompatibilityRemovalCompletionAudit.mjs';
import {
  PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS,
  PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS,
  buildPolicyBuilderPhase8CurrentRepositoryClosureAudit,
  validatePolicyBuilderPhase8CurrentRepositoryClosureAudit,
} from '../../services/policyBuilderPhase8CurrentRepositoryClosureAudit.mjs';

function completeRoadmapContent() {
  const componentSections = PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP
    .map(component => {
      const number = component.phaseId.replace('8r_', '');

      return `### 8R.${number} ${component.label}`;
    })
    .join('\n');
  const sequenceItems = PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP
    .map((component, index) => {
      const number = component.phaseId.replace('8r_', '');

      return `${index + 1}. **8R.${number} ${component.label}**`;
    })
    .join('\n');

  return `${componentSections}\n\n## Phase 8R Work Sequence\n\n${sequenceItems}`;
}

function completeChangelogContent() {
  return PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP
    .map(component => `- **Policy Builder Phase 8R ${component.label}**`)
    .join('\n');
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
      statusId: PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE,
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
      command: 'focused',
      passed: true,
    },
    lint: {
      command: 'lint',
      passed: true,
    },
    markdown: {
      command: 'markdown',
      passed: true,
    },
    full: {
      command: 'full',
      passed: true,
    },
    ...overrides,
  };
}

function readTextFile(filePath) {
  return filePath.replace(/\\/g, '/').endsWith('CHANGELOG.md')
    ? completeChangelogContent()
    : completeRoadmapContent();
}

function completeAudit(overrides = {}) {
  return buildPolicyBuilderPhase8CurrentRepositoryClosureAudit({
    cwd: '/repo',
    completionAuditArtifact: completionAuditArtifact(),
    validationEvidence: validationEvidence(),
    generatedAt: '2026-06-25T14:00:00.000Z',
    fileExists: () => true,
    readTextFile,
    ...overrides,
  });
}

describe('policyBuilderPhase8CurrentRepositoryClosureAudit', () => {
  test('completes when current repository evidence, completion audit, and validation pass', () => {
    const audit = completeAudit();

    expect(audit.statusId)
      .toBe(PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS.COMPLETE);
    expect(audit.complete).toBe(true);
    expect(audit.validation.ok).toBe(true);
    expect(audit.summary).toEqual(expect.objectContaining({
      evidenceRunComplete: true,
      checkpointArtifactComplete: true,
      finalReadoutComplete: true,
      missingCurrentArtifactCount: 0,
      validationEvidenceComplete: true,
    }));
    expect(audit.sideEffects.filesRead).toBe(true);
    expect(audit.sideEffects.filesWritten).toBe(false);
  });

  test('blocks on current evidence when a mapped repository artifact is missing', () => {
    const missingPath = 'server/src/services/policyBuilderPhase8CompletionCheckpoint.mjs';
    const audit = completeAudit({
      fileExists: absolutePath => (
        !absolutePath.replace(/\\/g, '/').endsWith(missingPath)
      ),
    });

    expect(audit.statusId)
      .toBe(PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS
        .BLOCKED_BY_CURRENT_EVIDENCE);
    expect(audit.summary.missingCurrentArtifactCount).toBe(1);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
            .CURRENT_EVIDENCE_RUN_NOT_COMPLETE,
      }),
    ]));
  });

  test('blocks when validation evidence is missing', () => {
    const audit = completeAudit({
      validationEvidence: {},
    });

    expect(audit.statusId)
      .toBe(PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS
        .BLOCKED_BY_CURRENT_EVIDENCE);
    expect(audit.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
        .VALIDATION_EVIDENCE_MISSING,
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
        .CURRENT_EVIDENCE_RUN_NOT_COMPLETE,
    ]));
  });

  test('blocks when the completion-audit artifact is incomplete', () => {
    const audit = completeAudit({
      completionAuditArtifact: completionAuditArtifact({
        statusId: 'remaining_inventory',
        complete: false,
        audit: {
          statusId:
            PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
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

    expect(audit.statusId)
      .toBe(PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS
        .BLOCKED_BY_CURRENT_EVIDENCE);
    expect(audit.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_NOT_COMPLETE,
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
        .CURRENT_EVIDENCE_RUN_NOT_COMPLETE,
    ]));
  });

  test('blocks on side effects other than repository file reads', () => {
    const audit = completeAudit({
      sideEffects: {
        filesWritten: true,
        storageChanged: true,
        gitCommandsRun: true,
        commandsExecuted: true,
        manifestWritten: true,
      },
    });

    expect(audit.statusId)
      .toBe(PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS
        .BLOCKED_BY_SIDE_EFFECTS);
    expect(audit.validation.ok).toBe(false);
    expect(audit.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'filesWritten',
      }),
      expect.objectContaining({
        riskId:
          PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'manifestWritten',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation = validatePolicyBuilderPhase8CurrentRepositoryClosureAudit({
      statusId: 'unexpected',
      complete: false,
      riskCount: 1,
      risks: [],
      sideEffects: {
        filesRead: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS.UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId:
          PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_RISK_IDS
            .RISK_COUNT_MISMATCH,
      }),
    ]));
  });
});
