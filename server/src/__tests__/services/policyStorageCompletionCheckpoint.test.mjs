import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS,
  POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS,
  POLICY_STORAGE_IMPLEMENTATION_COMPONENTS,
  buildPolicyStorageCompletionCheckpoint,
  validatePolicyStorageCompletionCheckpoint,
} from '../../services/policyStorageCompletionCheckpoint.mjs';
import {
  POLICY_STORAGE_INSTANCE_CUTOVER_COMPONENT_IDS,
} from '../../services/policyStorageClosureComponentScopeMap.mjs';
import {
  MANIFEST_PATHS,
  buildCompletionAuditArtifactFixture,
} from './policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';
import {
  buildPolicyStorageClosureValidationEvidenceFixture,
} from './policyStorageClosureValidationEvidenceFixture.mjs';

const COMPONENT_IDS =
  POLICY_STORAGE_IMPLEMENTATION_COMPONENTS.map(component => component.componentId);

function componentEvidence(overrides = {}) {
  return POLICY_STORAGE_IMPLEMENTATION_COMPONENTS.map(component => ({
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

function changelogEvidence(overrides = {}) {
  return {
    updated: true,
    componentIds: COMPONENT_IDS,
    ...overrides,
  };
}

async function completeCheckpoint(overrides = {}) {
  const completionAuditArtifact =
    overrides.completionAuditArtifact || await buildCompletionAuditArtifactFixture();

  return buildPolicyStorageCompletionCheckpoint({
    componentEvidence: componentEvidence(),
    roadmapEvidence: roadmapEvidence(),
    completionAuditArtifact,
    validationEvidence: validationEvidence(),
    changelogEvidence: changelogEvidence(),
    ...overrides,
  });
}

describe('policyStorageCompletionCheckpoint', () => {
  test('includes each discrete native-authority, initial-establishment, semantic eligibility, and retention component in the checkpoint', () => {
    expect(COMPONENT_IDS).toEqual(expect.arrayContaining([
      'active_native_intent_integrity_correction',
      'semantic_native_authority_eligibility',
      'candidate_authority_eligibility',
      'initial_native_intent_establishment',
      'observed_evidence_establishment_provenance',
      'runtime_authority_selection_integrity',
      'transactional_native_authority_reversion',
      'rollback_snapshot_retention_cleanup',
    ]));
  });

  test('completes when component, roadmap, removal, validation, and changelog evidence pass', async () => {
    const checkpoint = await completeCheckpoint();

    expect(checkpoint.statusId).toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE);
    expect(checkpoint.complete).toBe(true);
    expect(checkpoint.validation.ok).toBe(true);
    expect(checkpoint.componentCoverage).toEqual(expect.objectContaining({
      expectedCount: POLICY_STORAGE_IMPLEMENTATION_COMPONENTS.length,
      implementedCount: POLICY_STORAGE_IMPLEMENTATION_COMPONENTS.length,
      documentedCount: POLICY_STORAGE_IMPLEMENTATION_COMPONENTS.length,
      contractEvidenceCount: POLICY_STORAGE_IMPLEMENTATION_COMPONENTS.length,
      testEvidenceCount: POLICY_STORAGE_IMPLEMENTATION_COMPONENTS.length,
    }));
    expect(checkpoint.roadmapEvidence).toEqual(expect.objectContaining({
      sequenceCount: POLICY_STORAGE_IMPLEMENTATION_COMPONENTS.length,
      implementationStatusCount: POLICY_STORAGE_IMPLEMENTATION_COMPONENTS.length,
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
    expect(checkpoint.componentScopeMap).toEqual(expect.objectContaining({
      implementationReadiness: expect.objectContaining({
        scope: 'repository',
        componentIds: COMPONENT_IDS,
      }),
      instanceCutover: expect.objectContaining({
        scope: 'active_installation',
        componentIds: POLICY_STORAGE_INSTANCE_CUTOVER_COMPONENT_IDS,
        requiredForStorageClosure: true,
      }),
    }));
  });

  test('does not let active-installation retirement evidence enter implementation readiness', async () => {
    const checkpoint = await completeCheckpoint({
      expectedComponents: [
        ...POLICY_STORAGE_IMPLEMENTATION_COMPONENTS,
        {
          componentId: 'compatibility_removal_completion_audit',
          label: 'Compatibility Removal Completion Audit',
        },
      ],
    });

    expect(checkpoint.implementationReadiness).toEqual(expect.objectContaining({
      statusId: 'ready',
      ready: true,
      riskCount: 0,
    }));
    expect(checkpoint.componentScopeMap.implementationReadiness.componentIds)
      .not.toContain('compatibility_removal_completion_audit');
    expect(checkpoint.componentScopeMap.instanceCutover.componentIds)
      .toContain('compatibility_removal_completion_audit');
  });

  test('blocks when component implementation evidence is missing or incomplete', async () => {
    const missing = await completeCheckpoint({
      componentEvidence: componentEvidence()
        .filter(component => component.componentId !== 'native_backup_restore_wiring'),
    });
    const incomplete = await completeCheckpoint({
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

  test('blocks when roadmap sequence or implementation status evidence is incomplete', async () => {
    const checkpoint = await completeCheckpoint({
      roadmapEvidence: roadmapEvidence({
        componentSequenceIds:
          COMPONENT_IDS.filter(componentId => (
            componentId !== 'native_backup_restore_wiring'
          )),
        implementationStatusComponentIds:
          COMPONENT_IDS.filter(componentId => (
            componentId !== 'post_upgrade_apply_gate'
          )),
      }),
    });

    expect(checkpoint.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE);
    expect(checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.ROADMAP_SEQUENCE_INCOMPLETE,
        missingComponentIds: ['native_backup_restore_wiring'],
      }),
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS
            .ROADMAP_IMPLEMENTATION_STATUS_INCOMPLETE,
        missingComponentIds: ['post_upgrade_apply_gate'],
      }),
    ]));
  });

  test('blocks legacy roadmap evidence keys instead of treating them as durable fields', async () => {
    const checkpoint = await completeCheckpoint({
      roadmapEvidence: {
        sequencePhaseIds: COMPONENT_IDS,
        implementationStatusPhaseIds: COMPONENT_IDS,
      },
    });

    expect(checkpoint.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE);
    expect(checkpoint.roadmapEvidence.missingSequenceComponentIds)
      .toEqual(COMPONENT_IDS);
    expect(checkpoint.roadmapEvidence.missingImplementationStatusComponentIds)
      .toEqual(COMPONENT_IDS);
  });

  test('blocks a remaining-inventory or altered completion-audit artifact', async () => {
    const remainingArtifact = await buildCompletionAuditArtifactFixture({
      appliedPaths: [MANIFEST_PATHS[0]],
    });
    const alteredArtifact = structuredClone(await buildCompletionAuditArtifactFixture());
    alteredArtifact.auditSummary.manifestRemovedCount = 0;
    const checkpoint = await completeCheckpoint({
      completionAuditArtifact: remainingArtifact,
    });
    const altered = await completeCheckpoint({ completionAuditArtifact: alteredArtifact });

    expect(checkpoint.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_FINAL_REMOVAL_AUDIT);
    expect(checkpoint.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FINAL_REMOVAL_AUDIT_NOT_COMPLETE,
    ]));
    expect(altered.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS
            .FINAL_REMOVAL_AUDIT_ARTIFACT_INTEGRITY_FAILED,
      }),
    ]));
    expect(altered.risks.map(risk => risk.riskId)).not.toContain(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FINAL_REMOVAL_AUDIT_NOT_COMPLETE
    );
    expect(checkpoint.implementationReadiness).toEqual(expect.objectContaining({
      statusId: 'ready',
      ready: true,
      riskCount: 0,
      validationOk: true,
    }));
  });

  test('blocks when focused, lint, markdown, or full validation evidence is missing or failed', async () => {
    const missing = await completeCheckpoint({
      validationEvidence: {},
    });
    const failed = await completeCheckpoint({
      validationEvidence: validationEvidence({
        commandResultOverrides: {
          focused: { exitCode: 1, message: 'focused failed' },
          lint: { exitCode: 1, message: 'lint failed' },
          markdown: { exitCode: 1, message: 'markdown failed' },
          full: { exitCode: 1, message: 'full failed' },
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

  test('rejects validation evidence whose derived checks no longer match its fingerprint', async () => {
    const alteredValidationEvidence = validationEvidence();
    alteredValidationEvidence.full.passed = false;

    const checkpoint = await completeCheckpoint({
      validationEvidence: alteredValidationEvidence,
    });

    expect(checkpoint.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_VALIDATION);
    expect(checkpoint.validationEvidenceIntegrity.ok).toBe(false);
    expect(checkpoint.risks.map(risk => risk.riskId)).toContain(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS
        .VALIDATION_EVIDENCE_ARTIFACT_INTEGRITY_FAILED
    );
  });

  test('blocks when changelog coverage is missing for expected components', async () => {
    const checkpoint = await completeCheckpoint({
      changelogEvidence: changelogEvidence({
        updated: true,
        componentIds: COMPONENT_IDS.filter(componentId => (
          componentId !== 'native_backup_restore_wiring'
        )),
      }),
    });

    expect(checkpoint.statusId)
      .toBe(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_CHANGELOG);
    expect(checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.CHANGELOG_ENTRY_MISSING,
        missingComponentIds: ['native_backup_restore_wiring'],
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

  test('rejects a scope map that drops an active-installation cutover component', async () => {
    const checkpoint = await completeCheckpoint();
    checkpoint.componentScopeMap.instanceCutover.componentIds = [];

    const validation = validatePolicyStorageCompletionCheckpoint(checkpoint);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_SCOPE_MAP_INVALID,
      }),
    ]));
  });
});
