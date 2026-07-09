import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS,
  POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS,
  POLICY_STORAGE_COMPLETION_COMPONENTS,
  buildPolicyStorageCompletionCheckpoint,
  validatePolicyStorageCompletionCheckpoint,
} from '../../services/policyStorageCompletionCheckpoint.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAudit.mjs';

const COMPONENT_IDS =
  POLICY_STORAGE_COMPLETION_COMPONENTS.map(component => component.componentId);
const LEGACY_IDS =
  POLICY_STORAGE_COMPLETION_COMPONENTS.map(component => component.legacyId);

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
    componentIds: COMPONENT_IDS,
    ...overrides,
  };
}

function completeCheckpoint(overrides = {}) {
  return buildPolicyStorageCompletionCheckpoint({
    componentEvidence: componentEvidence(),
    roadmapEvidence: roadmapEvidence(),
    finalRemovalAudit: finalRemovalAudit(),
    validationEvidence: validationEvidence(),
    changelogEvidence: changelogEvidence(),
    ...overrides,
  });
}

describe('policyStorageCompletionCheckpoint', () => {
  test('completes when component, roadmap, removal, validation, and changelog evidence pass', () => {
    const checkpoint = completeCheckpoint();

    expect(checkpoint.statusId).toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE);
    expect(checkpoint.complete).toBe(true);
    expect(checkpoint.validation.ok).toBe(true);
    expect(checkpoint.componentCoverage).toEqual(expect.objectContaining({
      expectedCount: POLICY_STORAGE_COMPLETION_COMPONENTS.length,
      implementedCount: POLICY_STORAGE_COMPLETION_COMPONENTS.length,
      documentedCount: POLICY_STORAGE_COMPLETION_COMPONENTS.length,
      contractEvidenceCount: POLICY_STORAGE_COMPLETION_COMPONENTS.length,
      testEvidenceCount: POLICY_STORAGE_COMPLETION_COMPONENTS.length,
    }));
    expect(checkpoint.roadmapEvidence).toEqual(expect.objectContaining({
      sequenceCount: POLICY_STORAGE_COMPLETION_COMPONENTS.length,
      implementationStatusCount: POLICY_STORAGE_COMPLETION_COMPONENTS.length,
      missingSequenceComponentIds: [],
      missingImplementationStatusComponentIds: [],
    }));
    expect(checkpoint.finalRemovalAudit).toEqual(expect.objectContaining({
      complete: true,
      validationOk: true,
    }));
    expect(checkpoint.changelogEvidence).toEqual(expect.objectContaining({
      updated: true,
      missingComponentIds: [],
    }));
    expect(checkpoint.sideEffects).toEqual({
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
    });
    expect(checkpoint.nextPhase).toBeUndefined();
    expect(checkpoint.nextStep).toEqual(expect.objectContaining({
      stepId: 'policy_storage_final_closure_readout',
      label: 'Policy Storage Final Closure Readout',
    }));
  });

  test('blocks when component implementation evidence is missing or incomplete', () => {
    const missing = completeCheckpoint({
      componentEvidence: componentEvidence()
        .filter(component => component.componentId !== 'compatibility_removal_completion_audit'),
    });
    const incomplete = completeCheckpoint({
      componentEvidence: componentEvidence({
        native_backup_restore_wiring: {
          implemented: false,
          designDocPresent: false,
          contractEvidencePresent: false,
          testEvidencePresent: false,
        },
      }),
    });

    expect(missing.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_COMPONENT_COVERAGE);
    expect(missing.risks.map(risk => risk.riskId)).toContain(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.MISSING_COMPONENT_EVIDENCE
    );
    expect(incomplete.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_COMPONENT_COVERAGE);
    expect(incomplete.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_NOT_IMPLEMENTED,
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_DESIGN_DOC,
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_CONTRACT_EVIDENCE,
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_TEST_EVIDENCE,
    ]));
  });

  test('blocks when roadmap sequence or implementation status evidence is incomplete', () => {
    const checkpoint = completeCheckpoint({
      roadmapEvidence: roadmapEvidence({
        componentSequenceIds:
          COMPONENT_IDS.filter(componentId => (
            componentId !== 'next_compatibility_removal_batch_authorization'
          )),
        implementationStatusComponentIds:
          COMPONENT_IDS.filter(componentId => (
            componentId !== 'post_removal_runtime_verification'
          )),
      }),
    });

    expect(checkpoint.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE);
    expect(checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.ROADMAP_SEQUENCE_INCOMPLETE,
        missingComponentIds: ['next_compatibility_removal_batch_authorization'],
      }),
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS
            .ROADMAP_IMPLEMENTATION_STATUS_INCOMPLETE,
        missingComponentIds: ['post_removal_runtime_verification'],
      }),
    ]));
  });

  test('accepts human-readable dotted Phase 8R roadmap identifiers', () => {
    const dottedLegacyIds = LEGACY_IDS.map(legacyId => (
      legacyId.replace(/^8r_(\d+)$/, '8R.$1')
    ));
    const checkpoint = completeCheckpoint({
      roadmapEvidence: roadmapEvidence({
        sequencePhaseIds: dottedLegacyIds,
        implementationStatusPhaseIds: dottedLegacyIds,
      }),
    });

    expect(checkpoint.statusId).toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE);
    expect(checkpoint.roadmapEvidence.missingSequenceComponentIds).toEqual([]);
    expect(checkpoint.roadmapEvidence.missingImplementationStatusComponentIds)
      .toEqual([]);
  });

  test('blocks when compatibility-removal completion audit is not complete or invalid', () => {
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
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_FINAL_REMOVAL_AUDIT);
    expect(checkpoint.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FINAL_REMOVAL_AUDIT_NOT_COMPLETE,
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FINAL_REMOVAL_AUDIT_VALIDATION_FAILED,
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
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_VALIDATION);
    expect(missing.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FOCUSED_VALIDATION_MISSING,
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.LINT_VALIDATION_MISSING,
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.MARKDOWN_VALIDATION_MISSING,
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FULL_VALIDATION_MISSING,
    ]));
    expect(failed.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_VALIDATION);
    expect(failed.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FOCUSED_VALIDATION_FAILED,
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.LINT_VALIDATION_FAILED,
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.MARKDOWN_VALIDATION_FAILED,
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FULL_VALIDATION_FAILED,
    ]));
  });

  test('blocks when changelog coverage is missing for expected components', () => {
    const checkpoint = completeCheckpoint({
      changelogEvidence: changelogEvidence({
        updated: true,
        componentIds: COMPONENT_IDS.filter(componentId => (
          componentId !== 'controlled_compatibility_path_removal_apply'
        )),
      }),
    });

    expect(checkpoint.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_CHANGELOG);
    expect(checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.CHANGELOG_ENTRY_MISSING,
        missingComponentIds: ['controlled_compatibility_path_removal_apply'],
      }),
    ]));
  });

  test('rejects mutated checkpoint output with stale risk counts or side effects', () => {
    const validation = validatePolicyStorageCompletionCheckpoint({
      statusId: POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE,
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
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.RISK_COUNT_MISMATCH,
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
