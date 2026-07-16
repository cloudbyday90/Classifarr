import {
  POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
} from '../../services/policyStorageClosureEvidenceRun.mjs';
import {
  MANIFEST_PATHS,
  buildCompletionAuditArtifactFixture,
} from './policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';
import {
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS,
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS,
  buildPolicyStorageCurrentClosureAudit,
  validatePolicyStorageCurrentClosureAudit,
} from '../../services/policyStorageCurrentClosureAudit.mjs';
import {
  validatePolicyStorageCurrentClosureAuditIntegrity,
} from '../../services/policyStorageCurrentClosureAuditIntegrity.mjs';
import {
  buildPolicyStorageClosureValidationEvidenceFixture,
} from './policyStorageClosureValidationEvidenceFixture.mjs';

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

function validationEvidence(overrides = {}) {
  const {
    commandResultOverrides = {},
    ...artifactOverrides
  } = overrides;

  return {
    ...buildPolicyStorageClosureValidationEvidenceFixture({ commandResultOverrides }),
    ...artifactOverrides,
  };
}

function readTextFile(filePath) {
  return filePath.replace(/\\/g, '/').endsWith('CHANGELOG.md')
    ? completeChangelogContent()
    : completeRoadmapContent();
}

async function completeAudit(overrides = {}) {
  const completionAuditArtifact =
    overrides.completionAuditArtifact || await buildCompletionAuditArtifactFixture();

  return buildPolicyStorageCurrentClosureAudit({
    cwd: '/repo',
    completionAuditArtifact,
    validationEvidence: validationEvidence(),
    generatedAt: '2026-06-25T14:00:00.000Z',
    fileExists: () => true,
    readTextFile,
    ...overrides,
  });
}

describe('policyStorageCurrentClosureAudit', () => {
  test('completes when current repository evidence, completion audit, and validation pass', async () => {
    const audit = await completeAudit();

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS.COMPLETE);
    expect(audit.complete).toBe(true);
    expect(audit.validation.ok).toBe(true);
    expect(audit.artifactFingerprint).toEqual(expect.objectContaining({
      algorithm: 'sha256',
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(audit.closureInput).toEqual(expect.objectContaining({
      completionAuditArtifact: expect.any(Object),
      validationEvidence: expect.any(Object),
      currentEvidence: expect.objectContaining({
        artifactInventory: expect.any(Object),
        roadmapEvidence: expect.any(Object),
        changelogEvidence: expect.any(Object),
      }),
    }));
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

  test('uses one generated timestamp when no timestamp is supplied so replay remains exact', async () => {
    const audit = await completeAudit({ generatedAt: null });
    const integrity = await validatePolicyStorageCurrentClosureAuditIntegrity({
      currentClosureAudit: audit,
    });

    expect(audit.checkpointArtifact.generatedAt).toBe(audit.generatedAt);
    expect(audit.finalReadout.generatedAt).toBe(audit.generatedAt);
    expect(integrity.ok).toBe(true);
  });

  test('blocks on current evidence when a mapped repository artifact is missing', async () => {
    const missingPath = 'server/src/services/policyStorageCompletionCheckpoint.mjs';
    const audit = await completeAudit({
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

  test('blocks when validation evidence is missing', async () => {
    const audit = await completeAudit({
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

  test('rejects validation evidence whose fingerprint no longer binds its checks', async () => {
    const alteredValidationEvidence = validationEvidence();
    alteredValidationEvidence.full.passed = false;

    const audit = await completeAudit({
      validationEvidence: alteredValidationEvidence,
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS
        .BLOCKED_BY_CURRENT_EVIDENCE);
    expect(audit.risks.map(risk => risk.riskId)).toContain(
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
        .VALIDATION_EVIDENCE_ARTIFACT_INTEGRITY_FAILED
    );
  });

  test('blocks when the completion-audit artifact is incomplete', async () => {
    const audit = await completeAudit({
      completionAuditArtifact: await buildCompletionAuditArtifactFixture({
        appliedPaths: [MANIFEST_PATHS[0]],
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

  test('blocks historical completion-audit artifact versions', async () => {
    const completionAuditArtifact = structuredClone(
      await buildCompletionAuditArtifactFixture()
    );
    completionAuditArtifact.version =
      'phase8r.compatibility_removal_completion_audit_artifact.v1';
    const audit = await completeAudit({
      completionAuditArtifact,
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS
        .BLOCKED_BY_CURRENT_EVIDENCE);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_RISK_IDS
            .COMPLETION_AUDIT_ARTIFACT_VERSION_UNSUPPORTED,
        expectedVersion: expect.any(String),
      }),
    ]));
  });

  test('blocks on side effects other than repository file reads', async () => {
    const audit = await completeAudit({
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
