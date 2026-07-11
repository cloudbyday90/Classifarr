import {
  POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
  POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS,
  POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS,
  buildPolicyStorageClosureEvidenceRun,
  validatePolicyStorageClosureEvidenceRun,
} from '../../services/policyStorageClosureEvidenceRun.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAudit.mjs';

const SOURCE_COMPONENT_IDS = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP
  .map(component => component.componentId);

function allMappedPaths(key) {
  return POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP
    .flatMap(component => component[key] || []);
}

function artifactInventory(overrides = {}) {
  return {
    servicePaths: allMappedPaths('contractPaths')
      .filter(path => path.startsWith('server/src/services/')),
    routePaths: allMappedPaths('contractPaths')
      .filter(path => path.startsWith('server/src/routes/')),
    migrationPaths: allMappedPaths('contractPaths')
      .filter(path => path.startsWith('database/migrations/')),
    testPaths: allMappedPaths('testPaths'),
    docPaths: allMappedPaths('designDocPaths'),
    otherPaths: allMappedPaths('contractPaths')
      .filter(path => ![
        'server/src/services/',
        'server/src/routes/',
        'database/migrations/',
      ].some(prefix => path.startsWith(prefix))),
    ...overrides,
  };
}

function roadmapEvidence(overrides = {}) {
  return {
    componentSequenceIds: SOURCE_COMPONENT_IDS,
    implementationStatusComponentIds: SOURCE_COMPONENT_IDS,
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
    componentIds: SOURCE_COMPONENT_IDS,
    ...overrides,
  };
}

function completeRun(overrides = {}) {
  return buildPolicyStorageClosureEvidenceRun({
    artifactInventory: artifactInventory(),
    roadmapEvidence: roadmapEvidence(),
    finalRemovalAudit: finalRemovalAudit(),
    validationEvidence: validationEvidence(),
    changelogEvidence: changelogEvidence(),
    ...overrides,
  });
}

describe('policyStorageClosureEvidenceRun', () => {
  test('completes when artifact, roadmap, final audit, validation, and changelog evidence pass', () => {
    const evidenceRun = completeRun();

    expect(evidenceRun.statusId).toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.COMPLETE);
    expect(evidenceRun.complete).toBe(true);
    expect(evidenceRun.validation.ok).toBe(true);
    expect(evidenceRun.artifactInventory).toEqual(expect.objectContaining({
      componentCount: POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP.length,
      componentsWithMissingArtifactCount: 0,
    }));
    expect(evidenceRun.componentEvidence).toHaveLength(
      POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP.length
    );
    expect(evidenceRun.componentEvidence.every(component => (
      component.implemented &&
      component.designDocPresent &&
      component.contractEvidencePresent &&
      component.testEvidencePresent &&
      component.changelogEntryPresent
    ))).toBe(true);
    expect(evidenceRun.checkpoint).toEqual(expect.objectContaining({
      statusId: 'complete',
      complete: true,
      validationOk: true,
      riskCount: 0,
    }));
    expect(evidenceRun.nextStep).toEqual(expect.objectContaining({
      stepId: 'policy_storage_closure_evidence_complete',
      label: 'Policy Storage Closure Evidence Complete',
    }));
  });

  test('normalizes Windows-style paths in supplied artifact inventory', () => {
    const windowsInventory = artifactInventory({
      servicePaths: artifactInventory().servicePaths.map(path => path.replace(/\//g, '\\')),
      routePaths: artifactInventory().routePaths.map(path => path.replace(/\//g, '\\')),
      migrationPaths: artifactInventory().migrationPaths.map(path => path.replace(/\//g, '\\')),
      testPaths: artifactInventory().testPaths.map(path => path.replace(/\//g, '\\')),
      docPaths: artifactInventory().docPaths.map(path => path.replace(/\//g, '\\')),
      otherPaths: artifactInventory().otherPaths.map(path => path.replace(/\//g, '\\')),
    });
    const evidenceRun = completeRun({
      artifactInventory: windowsInventory,
    });

    expect(evidenceRun.statusId).toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.COMPLETE);
    expect(evidenceRun.artifactInventory.componentsWithMissingArtifactCount).toBe(0);
  });

  test('blocks historical roadmap identifiers instead of normalizing them as component IDs', () => {
    const historicalRoadmapIds = SOURCE_COMPONENT_IDS.map((_componentId, index) => (
      `8R.${index + 1}`
    ));
    const evidenceRun = completeRun({
      roadmapEvidence: {
        componentSequenceIds: historicalRoadmapIds,
        implementationStatusComponentIds: historicalRoadmapIds,
      },
      changelogEvidence: changelogEvidence({
        componentIds: historicalRoadmapIds,
      }),
    });

    expect(evidenceRun.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
    expect(evidenceRun.checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: 'roadmap_sequence_incomplete',
      }),
      expect.objectContaining({
        riskId: 'changelog_entry_missing',
      }),
    ]));
  });

  test('blocks legacy evidence keys instead of treating them as durable component fields', () => {
    const evidenceRun = completeRun({
      roadmapEvidence: {
        sequencePhaseIds: SOURCE_COMPONENT_IDS,
        implementationStatusPhaseIds: SOURCE_COMPONENT_IDS,
      },
      changelogEvidence: {
        updated: true,
        phaseIds: SOURCE_COMPONENT_IDS,
      },
    });

    expect(evidenceRun.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
    expect(evidenceRun.checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: 'roadmap_sequence_incomplete',
        missingComponentIds: expect.any(Array),
      }),
      expect.objectContaining({
        riskId: 'changelog_entry_missing',
        missingComponentIds: expect.any(Array),
      }),
    ]));
    expect(evidenceRun.checkpoint.risks.every(risk => (
      risk.missingComponentIds?.length === SOURCE_COMPONENT_IDS.length
    ))).toBe(true);
  });

  test('blocks when artifact inventory is missing', () => {
    const evidenceRun = completeRun({
      artifactInventory: {},
    });

    expect(evidenceRun.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_ARTIFACT_INVENTORY);
    expect(evidenceRun.risks.map(risk => risk.riskId)).toContain(
      POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS.MISSING_ARTIFACT_INVENTORY
    );
  });

  test('blocks through checkpoint when a mapped artifact is missing', () => {
    const inventory = artifactInventory();
    const evidenceRun = completeRun({
      artifactInventory: {
        ...inventory,
        servicePaths: inventory.servicePaths.filter(path => (
          path !== 'server/src/services/policyStorageCompletionCheckpoint.mjs'
        )),
      },
    });

    expect(evidenceRun.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
    expect(evidenceRun.artifactInventory.componentsWithMissingArtifactCount).toBe(1);
    expect(evidenceRun.checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: 'component_not_implemented',
        componentId: 'storage_completion_checkpoint',
      }),
      expect.objectContaining({
        riskId: 'component_missing_contract_evidence',
        componentId: 'storage_completion_checkpoint',
      }),
    ]));
    expect(evidenceRun.risks.map(risk => risk.riskId)).toContain(
      POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS.CHECKPOINT_NOT_COMPLETE
    );
  });

  test('blocks when roadmap or final removal audit evidence does not satisfy checkpoint', () => {
    const roadmapBlocked = completeRun({
      roadmapEvidence: roadmapEvidence({
        componentSequenceIds:
          SOURCE_COMPONENT_IDS.filter(componentId => (
            componentId !== 'storage_completion_checkpoint'
          )),
      }),
    });
    const removalAuditBlocked = completeRun({
      finalRemovalAudit: finalRemovalAudit({
        statusId:
          POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
            .BLOCKED_BY_FINAL_SCAN,
        complete: false,
      }),
    });

    expect(roadmapBlocked.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
    expect(roadmapBlocked.checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: 'roadmap_sequence_incomplete',
        missingComponentIds: ['storage_completion_checkpoint'],
      }),
    ]));
    expect(removalAuditBlocked.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
    expect(removalAuditBlocked.checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: 'final_removal_audit_not_complete',
      }),
    ]));
  });

  test('blocks when validation or changelog evidence fails checkpoint', () => {
    const validationBlocked = completeRun({
      validationEvidence: validationEvidence({
        full: {
          command: 'npm test',
          passed: false,
          message: 'full suite failed',
        },
      }),
    });
    const changelogBlocked = completeRun({
      changelogEvidence: changelogEvidence({
        componentIds:
          SOURCE_COMPONENT_IDS.filter(componentId => (
            componentId !== 'compatibility_removal_completion_audit'
          )),
      }),
    });

    expect(validationBlocked.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
    expect(validationBlocked.checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: 'full_validation_failed',
      }),
    ]));
    expect(changelogBlocked.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
    expect(changelogBlocked.checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: 'changelog_entry_missing',
        missingComponentIds: ['compatibility_removal_completion_audit'],
      }),
    ]));
  });

  test('rejects mutated evidence-run output with stale risk counts or side effects', () => {
    const validation = validatePolicyStorageClosureEvidenceRun({
      statusId: POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.COMPLETE,
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
      POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS.RISK_COUNT_MISMATCH,
      POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
