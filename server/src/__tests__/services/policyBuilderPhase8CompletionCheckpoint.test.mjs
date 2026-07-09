import {
  PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS,
  PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS,
  PHASE8R_EXPECTED_COMPONENTS,
  buildPolicyBuilderPhase8CompletionCheckpoint,
  validatePolicyBuilderPhase8CompletionCheckpoint,
} from '../../services/policyBuilderPhase8CompletionCheckpoint.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAudit.mjs';

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

function finalRemovalAudit(overrides = {}) {
  return {
    statusId: POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE,
    complete: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
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
      command: 'npm run lint -- --no-error-on-unmatched-pattern',
      passed: true,
    },
    markdown: {
      command: 'npx markdownlint-cli2 "CHANGELOG.md" "docs/architecture/policy-builder-intent-model-roadmap.md"',
      passed: true,
    },
    full: {
      command: 'npm test',
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

function completeCheckpoint(overrides = {}) {
  return buildPolicyBuilderPhase8CompletionCheckpoint({
    componentEvidence: componentEvidence(),
    roadmapEvidence: roadmapEvidence(),
    finalRemovalAudit: finalRemovalAudit(),
    validationEvidence: validationEvidence(),
    changelogEvidence: changelogEvidence(),
    ...overrides,
  });
}

describe('policyBuilderPhase8CompletionCheckpoint', () => {
  test('completes when component, roadmap, removal, validation, and changelog evidence pass', () => {
    const checkpoint = completeCheckpoint();

    expect(checkpoint.statusId).toBe(PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE);
    expect(checkpoint.complete).toBe(true);
    expect(checkpoint.validation.ok).toBe(true);
    expect(checkpoint.componentCoverage).toEqual(expect.objectContaining({
      expectedCount: PHASE8R_EXPECTED_COMPONENTS.length,
      implementedCount: PHASE8R_EXPECTED_COMPONENTS.length,
      documentedCount: PHASE8R_EXPECTED_COMPONENTS.length,
      contractEvidenceCount: PHASE8R_EXPECTED_COMPONENTS.length,
      testEvidenceCount: PHASE8R_EXPECTED_COMPONENTS.length,
    }));
    expect(checkpoint.roadmapEvidence).toEqual(expect.objectContaining({
      sequenceCount: PHASE8R_EXPECTED_COMPONENTS.length,
      implementationStatusCount: PHASE8R_EXPECTED_COMPONENTS.length,
      missingSequencePhaseIds: [],
      missingImplementationStatusPhaseIds: [],
    }));
    expect(checkpoint.finalRemovalAudit).toEqual(expect.objectContaining({
      complete: true,
      validationOk: true,
    }));
    expect(checkpoint.changelogEvidence).toEqual(expect.objectContaining({
      updated: true,
      missingPhaseIds: [],
    }));
    expect(checkpoint.sideEffects).toEqual({
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
    });
    expect(checkpoint.nextPhase).toEqual(expect.objectContaining({
      phaseId: '8r_complete',
      label: 'Phase 8R Complete',
    }));
  });

  test('blocks when component implementation evidence is missing or incomplete', () => {
    const missing = completeCheckpoint({
      componentEvidence: componentEvidence().filter(component => component.phaseId !== '8r_21'),
    });
    const incomplete = completeCheckpoint({
      componentEvidence: componentEvidence({
        '8r_10': {
          implemented: false,
          designDocPresent: false,
          contractEvidencePresent: false,
          testEvidencePresent: false,
        },
      }),
    });

    expect(missing.statusId)
      .toBe(PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_COMPONENT_COVERAGE);
    expect(missing.risks.map(risk => risk.riskId)).toContain(
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.MISSING_COMPONENT_EVIDENCE
    );
    expect(incomplete.statusId)
      .toBe(PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_COMPONENT_COVERAGE);
    expect(incomplete.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_NOT_IMPLEMENTED,
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_DESIGN_DOC,
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_CONTRACT_EVIDENCE,
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_TEST_EVIDENCE,
    ]));
  });

  test('blocks when roadmap sequence or implementation status evidence is incomplete', () => {
    const checkpoint = completeCheckpoint({
      roadmapEvidence: roadmapEvidence({
        sequencePhaseIds: PHASE_IDS.filter(phaseId => phaseId !== '8r_20'),
        implementationStatusPhaseIds: PHASE_IDS.filter(phaseId => phaseId !== '8r_19'),
      }),
    });

    expect(checkpoint.statusId)
      .toBe(PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE);
    expect(checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.ROADMAP_SEQUENCE_INCOMPLETE,
        missingPhaseIds: ['8r_20'],
      }),
      expect.objectContaining({
        riskId:
          PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS
            .ROADMAP_IMPLEMENTATION_STATUS_INCOMPLETE,
        missingPhaseIds: ['8r_19'],
      }),
    ]));
  });

  test('accepts human-readable dotted Phase 8R roadmap identifiers', () => {
    const dottedPhaseIds = PHASE_IDS.map(phaseId => (
      phaseId.replace(/^8r_(\d+)$/, '8R.$1')
    ));
    const checkpoint = completeCheckpoint({
      roadmapEvidence: roadmapEvidence({
        sequencePhaseIds: dottedPhaseIds,
        implementationStatusPhaseIds: dottedPhaseIds,
      }),
    });

    expect(checkpoint.statusId).toBe(PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE);
    expect(checkpoint.roadmapEvidence.missingSequencePhaseIds).toEqual([]);
    expect(checkpoint.roadmapEvidence.missingImplementationStatusPhaseIds)
      .toEqual([]);
  });

  test('blocks when final Phase 8R.21 removal audit is not complete or invalid', () => {
    const checkpoint = completeCheckpoint({
      finalRemovalAudit: finalRemovalAudit({
        statusId: POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
          .BLOCKED_BY_FINAL_SCAN,
        complete: false,
        validation: {
          ok: false,
          issueCount: 1,
          issues: [],
        },
      }),
    });

    expect(checkpoint.statusId)
      .toBe(PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_FINAL_REMOVAL_AUDIT);
    expect(checkpoint.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FINAL_REMOVAL_AUDIT_NOT_COMPLETE,
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FINAL_REMOVAL_AUDIT_VALIDATION_FAILED,
    ]));
  });

  test('blocks when focused, lint, markdown, or full validation evidence is missing or failed', () => {
    const missing = completeCheckpoint({
      validationEvidence: {},
    });
    const failed = completeCheckpoint({
      validationEvidence: validationEvidence({
        focused: {
          command: 'focused',
          passed: false,
          message: 'focused failed',
        },
        lint: {
          command: 'lint',
          passed: false,
          message: 'lint failed',
        },
        markdown: {
          command: 'markdown',
          passed: false,
          message: 'markdown failed',
        },
        full: {
          command: 'full',
          passed: false,
          message: 'full failed',
        },
      }),
    });

    expect(missing.statusId)
      .toBe(PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_VALIDATION);
    expect(missing.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FOCUSED_VALIDATION_MISSING,
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.LINT_VALIDATION_MISSING,
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.MARKDOWN_VALIDATION_MISSING,
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FULL_VALIDATION_MISSING,
    ]));
    expect(failed.statusId)
      .toBe(PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_VALIDATION);
    expect(failed.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FOCUSED_VALIDATION_FAILED,
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.LINT_VALIDATION_FAILED,
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.MARKDOWN_VALIDATION_FAILED,
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FULL_VALIDATION_FAILED,
    ]));
  });

  test('blocks when changelog coverage is missing for expected components', () => {
    const checkpoint = completeCheckpoint({
      changelogEvidence: changelogEvidence({
        updated: true,
        phaseIds: PHASE_IDS.filter(phaseId => phaseId !== '8r_18'),
      }),
    });

    expect(checkpoint.statusId)
      .toBe(PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_CHANGELOG);
    expect(checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.CHANGELOG_ENTRY_MISSING,
        missingPhaseIds: ['8r_18'],
      }),
    ]));
  });

  test('rejects mutated checkpoint output with stale risk counts or side effects', () => {
    const validation = validatePolicyBuilderPhase8CompletionCheckpoint({
      statusId: PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE,
      riskCount: 99,
      risks: [],
      sideEffects: {
        filesWritten: true,
        storageChanged: true,
        gitCommandsRun: true,
        commandsExecuted: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.RISK_COUNT_MISMATCH,
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
