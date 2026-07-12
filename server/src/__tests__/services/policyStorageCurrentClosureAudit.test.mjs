import {
  POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
} from '../../services/policyStorageClosureEvidenceRun.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAudit.mjs';
import {
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS,
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS,
  buildPolicyStorageCurrentClosureAudit,
  validatePolicyStorageCurrentClosureAudit,
} from '../../services/policyStorageCurrentClosureAudit.mjs';

function completeRoadmapContent() {
  const componentSections = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP
    .map(component => `### ${component.label}`)
    .join('\n');
  const sequenceItems = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP
    .map((component, index) => `${index + 1}. **${component.label}**`)
    .join('\n');

  return `${componentSections}\n\n## Policy Storage Closure Work Sequence\n\n${sequenceItems}`;
}

function completeChangelogContent() {
  return `
## [Unreleased]

### Added

- **Native Policy Intent Storage** — added durable policy storage.
`;
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
  return buildPolicyStorageCurrentClosureAudit({
    cwd: '/repo',
    completionAuditArtifact: completionAuditArtifact(),
    validationEvidence: validationEvidence(),
    generatedAt: '2026-06-25T14:00:00.000Z',
    fileExists: () => true,
    readTextFile,
    ...overrides,
  });
}

describe('policyStorageCurrentClosureAudit', () => {
  test('completes when current repository evidence, completion audit, and validation pass', () => {
    const audit = completeAudit();

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS.COMPLETE);
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
    expect(audit.nextPhase).toBeUndefined();
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'policy_storage_current_closure_complete',
      label: 'Policy Storage Current Closure Complete',
    }));
  });

  test('blocks on current evidence when a mapped repository artifact is missing', () => {
    const missingPath = 'server/src/services/policyStorageCompletionCheckpoint.mjs';
    const audit = completeAudit({
      fileExists: absolutePath => (
        !absolutePath.replace(/\\/g, '/').endsWith(missingPath)
      ),
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS
        .BLOCKED_BY_CURRENT_EVIDENCE);
    expect(audit.summary.missingCurrentArtifactCount).toBe(1);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
            .CURRENT_EVIDENCE_RUN_NOT_COMPLETE,
      }),
    ]));
  });

  test('blocks when validation evidence is missing', () => {
    const audit = completeAudit({
      validationEvidence: {},
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS
        .BLOCKED_BY_CURRENT_EVIDENCE);
    expect(audit.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
        .VALIDATION_EVIDENCE_MISSING,
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
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

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS
        .BLOCKED_BY_CURRENT_EVIDENCE);
    expect(audit.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
        .COMPLETION_AUDIT_ARTIFACT_NOT_COMPLETE,
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
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
      .toBe(POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS
        .BLOCKED_BY_SIDE_EFFECTS);
    expect(audit.validation.ok).toBe(false);
    expect(audit.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'filesWritten',
      }),
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'manifestWritten',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation = validatePolicyStorageCurrentClosureAudit({
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
          POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS.UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
            .RISK_COUNT_MISMATCH,
      }),
    ]));
  });
});
