import {
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS,
} from '../../services/policyStorageCurrentClosureAudit.mjs';
import {
  POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP,
  POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS,
  POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS,
  buildPolicyStorageClosureRequirementAudit,
  validatePolicyStorageClosureRequirementAudit,
} from '../../services/policyStorageClosureRequirementAudit.mjs';

function completeRoadmapContent() {
  const componentSections = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
    .map(component => `### ${component.label}`)
    .join('\n');
  const sequenceItems = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
    .map((component, index) => `${index + 1}. **${component.label}**`)
    .join('\n');

  return `${componentSections}\n\n## Policy Storage Closure Work Sequence\n\n${sequenceItems}`;
}

function historicRoadmapContent() {
  const componentSections = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
    .map((component, index) => `### 8R.${index + 1} ${component.label}`)
    .join('\n');
  const sequenceItems = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
    .map((component, index) => `${index + 1}. **8R.${index + 1} ${component.label}**`)
    .join('\n');

  return `${componentSections}\n\n## Policy Storage Closure Work Sequence\n\n${sequenceItems}`;
}

function completeChangelogContent({
  includeOutcome = true,
} = {}) {
  return `
## [Unreleased]

### Added

${includeOutcome ? '- **Native Policy Intent Storage** — added durable policy storage.' : ''}
`;
}

function currentClosureAudit(overrides = {}) {
  return {
    version: 'policy.storage_current_closure_audit.v1',
    statusId:
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS.COMPLETE,
    complete: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    riskCount: 0,
    risks: [],
    ...overrides,
  };
}

function readTextFileFactory({
  changelogContent = completeChangelogContent(),
  roadmapContent = completeRoadmapContent(),
} = {}) {
  return filePath => (
    filePath.replace(/\\/g, '/').endsWith('CHANGELOG.md')
      ? changelogContent
      : roadmapContent
  );
}

function completeAudit(overrides = {}) {
  return buildPolicyStorageClosureRequirementAudit({
    cwd: '/repo',
    currentClosureAudit: currentClosureAudit(),
    generatedAt: '2026-06-25T18:00:00.000Z',
    fileExists: () => true,
    readTextFile: readTextFileFactory(),
    ...overrides,
  });
}

describe('policyStorageClosureRequirementAudit', () => {
  test('completes when current closure and all catalog component evidence pass', () => {
    const audit = completeAudit();

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS.COMPLETE);
    expect(audit.complete).toBe(true);
    expect(audit.validation.ok).toBe(true);
    expect(audit.evidenceScope).toEqual(expect.objectContaining({
      componentCount: 34,
      componentCatalog: 'policy_storage_closure',
    }));
    expect(audit.summary).toEqual(expect.objectContaining({
      expectedComponentCount: 34,
      implementedComponentCount: 34,
      missingComponentArtifactCount: 0,
      missingRoadmapSequenceCount: 0,
      missingRoadmapImplementationStatusCount: 0,
      missingChangelogCount: 0,
    }));
  });

  test('blocks when the policy storage current closure audit is incomplete', () => {
    const audit = completeAudit({
      currentClosureAudit: currentClosureAudit({
        statusId:
          POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS
            .BLOCKED_BY_CURRENT_EVIDENCE,
        complete: false,
      }),
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
        .BLOCKED_BY_CURRENT_CLOSURE);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .CURRENT_CLOSURE_AUDIT_NOT_COMPLETE,
      }),
    ]));
  });

  test('blocks when a later closure component artifact is missing', () => {
    const missingPath =
      'server/src/services/policyStorageCurrentClosureAudit.mjs';
    const audit = completeAudit({
      fileExists: absolutePath => (
        !absolutePath.replace(/\\/g, '/').endsWith(missingPath)
      ),
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
        .BLOCKED_BY_COMPONENT_EVIDENCE);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .COMPONENT_ARTIFACT_MISSING,
        componentId: 'storage_current_closure_audit',
      }),
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .COMPONENT_CONTRACT_EVIDENCE_MISSING,
        componentId: 'storage_current_closure_audit',
      }),
    ]));
  });

  test('blocks when the roadmap omits a late storage-closure work-sequence item', () => {
    const roadmapContent = completeRoadmapContent()
      .replace('34. **Policy Storage Current Closure Audit**', '');
    const audit = completeAudit({
      readTextFile: readTextFileFactory({ roadmapContent }),
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
        .BLOCKED_BY_ROADMAP_EVIDENCE);
    expect(audit.roadmapEvidence.missingSequenceComponentIds)
      .toContain('storage_current_closure_audit');
  });

  test('blocks when the durable storage outcome is absent from Unreleased', () => {
    const audit = completeAudit({
      readTextFile: readTextFileFactory({
        changelogContent: completeChangelogContent({
          includeOutcome: false,
        }),
      }),
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
        .BLOCKED_BY_CHANGELOG);
    expect(audit.changelogEvidence.missingComponentIds)
      .toEqual(POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
        .map(component => component.componentId));
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
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
        .BLOCKED_BY_SIDE_EFFECTS);
    expect(audit.validation.ok).toBe(false);
    expect(audit.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'filesWritten',
      }),
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'manifestWritten',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation =
      validatePolicyStorageClosureRequirementAudit({
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
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS.UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .RISK_COUNT_MISMATCH,
      }),
    ]));
  });

  test('accepts phase-coded roadmap entries for durable closure component names', () => {
    const audit = completeAudit({
      readTextFile: readTextFileFactory({
        roadmapContent: historicRoadmapContent(),
      }),
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS.COMPLETE);
    expect(audit.roadmapEvidence.missingSequenceComponentIds).toEqual([]);
    expect(audit.roadmapEvidence.missingImplementationStatusComponentIds).toEqual([]);
  });
});
