import {
  PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS,
} from '../../services/policyBuilderPhase8CurrentRepositoryClosureAudit.mjs';
import {
  PHASE8R_FINAL_REQUIREMENT_ARTIFACT_MAP,
  PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS,
  PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS,
  buildPolicyBuilderPhase8FinalRequirementCompletionAudit,
  validatePolicyBuilderPhase8FinalRequirementCompletionAudit,
} from '../../services/policyBuilderPhase8FinalRequirementCompletionAudit.mjs';

function completeRoadmapContent() {
  const componentSections = PHASE8R_FINAL_REQUIREMENT_ARTIFACT_MAP
    .map(component => {
      const number = component.phaseId.replace('8r_', '');

      return `### 8R.${number} ${component.label}`;
    })
    .join('\n');
  const sequenceItems = PHASE8R_FINAL_REQUIREMENT_ARTIFACT_MAP
    .map((component, index) => {
      const number = component.phaseId.replace('8r_', '');

      return `${index + 1}. **8R.${number} ${component.label}**`;
    })
    .join('\n');

  return `${componentSections}\n\n## Phase 8R Work Sequence\n\n${sequenceItems}`;
}

function completeChangelogContent({
  excludedPhaseId = null,
} = {}) {
  return PHASE8R_FINAL_REQUIREMENT_ARTIFACT_MAP
    .filter(component => component.phaseId !== excludedPhaseId)
    .map(component => `- **Policy Builder Phase 8R ${component.label}**`)
    .join('\n');
}

function currentClosureAudit(overrides = {}) {
  return {
    version: 'phase8r.current_repository_closure_audit.v1',
    statusId:
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS.COMPLETE,
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
  return buildPolicyBuilderPhase8FinalRequirementCompletionAudit({
    cwd: '/repo',
    currentClosureAudit: currentClosureAudit(),
    generatedAt: '2026-06-25T18:00:00.000Z',
    fileExists: () => true,
    readTextFile: readTextFileFactory(),
    ...overrides,
  });
}

describe('policyBuilderPhase8FinalRequirementCompletionAudit', () => {
  test('completes when current closure and all 8R.1 through 8R.34 evidence pass', () => {
    const audit = completeAudit();

    expect(audit.statusId)
      .toBe(PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS.COMPLETE);
    expect(audit.complete).toBe(true);
    expect(audit.validation.ok).toBe(true);
    expect(audit.evidenceScope).toEqual(expect.objectContaining({
      phaseRange: '8R.1-8R.34',
      componentCount: 34,
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

  test('blocks when the Phase 8R.34 current closure audit is incomplete', () => {
    const audit = completeAudit({
      currentClosureAudit: currentClosureAudit({
        statusId:
          PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS
            .BLOCKED_BY_CURRENT_EVIDENCE,
        complete: false,
      }),
    });

    expect(audit.statusId)
      .toBe(PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_CURRENT_CLOSURE);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
            .CURRENT_CLOSURE_AUDIT_NOT_COMPLETE,
      }),
    ]));
  });

  test('blocks when a later closure component artifact is missing', () => {
    const missingPath =
      'server/src/services/policyBuilderPhase8CurrentRepositoryClosureAudit.mjs';
    const audit = completeAudit({
      fileExists: absolutePath => (
        !absolutePath.replace(/\\/g, '/').endsWith(missingPath)
      ),
    });

    expect(audit.statusId)
      .toBe(PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_COMPONENT_EVIDENCE);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
            .COMPONENT_ARTIFACT_MISSING,
        phaseId: '8r_34',
      }),
      expect.objectContaining({
        riskId:
          PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
            .COMPONENT_CONTRACT_EVIDENCE_MISSING,
        phaseId: '8r_34',
      }),
    ]));
  });

  test('blocks when the roadmap omits a late Phase 8R work-sequence item', () => {
    const roadmapContent = completeRoadmapContent()
      .replace('34. **8R.34 Current Repository Closure Audit**', '');
    const audit = completeAudit({
      readTextFile: readTextFileFactory({ roadmapContent }),
    });

    expect(audit.statusId)
      .toBe(PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_ROADMAP_EVIDENCE);
    expect(audit.roadmapEvidence.missingSequencePhaseIds).toContain('8r_34');
  });

  test('blocks when changelog coverage omits a late Phase 8R component', () => {
    const audit = completeAudit({
      readTextFile: readTextFileFactory({
        changelogContent: completeChangelogContent({
          excludedPhaseId: '8r_33',
        }),
      }),
    });

    expect(audit.statusId)
      .toBe(PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_CHANGELOG);
    expect(audit.changelogEvidence.missingPhaseIds).toContain('8r_33');
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
      .toBe(PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_SIDE_EFFECTS);
    expect(audit.validation.ok).toBe(false);
    expect(audit.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'filesWritten',
      }),
      expect.objectContaining({
        riskId:
          PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'manifestWritten',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation =
      validatePolicyBuilderPhase8FinalRequirementCompletionAudit({
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
          PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS.UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId:
          PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
            .RISK_COUNT_MISMATCH,
      }),
    ]));
  });
});
