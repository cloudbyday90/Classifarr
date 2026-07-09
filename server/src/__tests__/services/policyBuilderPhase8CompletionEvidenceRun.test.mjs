import {
  PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP,
  PHASE8R_COMPLETION_EVIDENCE_RUN_RISK_IDS,
  PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS,
  buildPolicyBuilderPhase8CompletionEvidenceRun,
  validatePolicyBuilderPhase8CompletionEvidenceRun,
} from '../../services/policyBuilderPhase8CompletionEvidenceRun.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAudit.mjs';

const PHASE_IDS = PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP
  .map(component => component.phaseId);

function allMappedPaths(key) {
  return PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP
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

function completeRun(overrides = {}) {
  return buildPolicyBuilderPhase8CompletionEvidenceRun({
    artifactInventory: artifactInventory(),
    roadmapEvidence: roadmapEvidence(),
    finalRemovalAudit: finalRemovalAudit(),
    validationEvidence: validationEvidence(),
    changelogEvidence: changelogEvidence(),
    ...overrides,
  });
}

describe('policyBuilderPhase8CompletionEvidenceRun', () => {
  test('completes when artifact, roadmap, final audit, validation, and changelog evidence pass', () => {
    const evidenceRun = completeRun();

    expect(evidenceRun.statusId).toBe(PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.COMPLETE);
    expect(evidenceRun.complete).toBe(true);
    expect(evidenceRun.validation.ok).toBe(true);
    expect(evidenceRun.artifactInventory).toEqual(expect.objectContaining({
      componentCount: PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP.length,
      componentsWithMissingArtifactCount: 0,
    }));
    expect(evidenceRun.componentEvidence).toHaveLength(
      PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP.length
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
    expect(evidenceRun.nextPhase).toEqual(expect.objectContaining({
      phaseId: '8r_complete',
      label: 'Phase 8R Complete',
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

    expect(evidenceRun.statusId).toBe(PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.COMPLETE);
    expect(evidenceRun.artifactInventory.componentsWithMissingArtifactCount).toBe(0);
  });

  test('normalizes human-readable dotted Phase 8R IDs in supplied evidence', () => {
    const dottedPhaseIds = PHASE_IDS.map(phaseId => (
      phaseId.replace(/^8r_(\d+)$/, '8R.$1')
    ));
    const evidenceRun = completeRun({
      roadmapEvidence: roadmapEvidence({
        sequencePhaseIds: dottedPhaseIds,
        implementationStatusPhaseIds: dottedPhaseIds,
      }),
      changelogEvidence: changelogEvidence({
        phaseIds: dottedPhaseIds,
      }),
    });

    expect(evidenceRun.statusId).toBe(PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.COMPLETE);
    expect(evidenceRun.componentEvidence.every(component => (
      component.changelogEntryPresent
    ))).toBe(true);
  });

  test('blocks when artifact inventory is missing', () => {
    const evidenceRun = completeRun({
      artifactInventory: {},
    });

    expect(evidenceRun.statusId)
      .toBe(PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_ARTIFACT_INVENTORY);
    expect(evidenceRun.risks.map(risk => risk.riskId)).toContain(
      PHASE8R_COMPLETION_EVIDENCE_RUN_RISK_IDS.MISSING_ARTIFACT_INVENTORY
    );
  });

  test('blocks through checkpoint when a mapped artifact is missing', () => {
    const inventory = artifactInventory();
    const evidenceRun = completeRun({
      artifactInventory: {
        ...inventory,
        servicePaths: inventory.servicePaths.filter(path => (
          path !== 'server/src/services/policyBuilderPhase8CompletionCheckpoint.mjs'
        )),
      },
    });

    expect(evidenceRun.statusId)
      .toBe(PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
    expect(evidenceRun.artifactInventory.componentsWithMissingArtifactCount).toBe(1);
    expect(evidenceRun.checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: 'component_not_implemented',
        phaseId: '8r_22',
      }),
      expect.objectContaining({
        riskId: 'component_missing_contract_evidence',
        phaseId: '8r_22',
      }),
    ]));
    expect(evidenceRun.risks.map(risk => risk.riskId)).toContain(
      PHASE8R_COMPLETION_EVIDENCE_RUN_RISK_IDS.CHECKPOINT_NOT_COMPLETE
    );
  });

  test('blocks when roadmap or final removal audit evidence does not satisfy checkpoint', () => {
    const roadmapBlocked = completeRun({
      roadmapEvidence: roadmapEvidence({
        sequencePhaseIds: PHASE_IDS.filter(phaseId => phaseId !== '8r_22'),
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
      .toBe(PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
    expect(roadmapBlocked.checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: 'roadmap_sequence_incomplete',
        missingPhaseIds: ['8r_22'],
      }),
    ]));
    expect(removalAuditBlocked.statusId)
      .toBe(PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
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
        phaseIds: PHASE_IDS.filter(phaseId => phaseId !== '8r_21'),
      }),
    });

    expect(validationBlocked.statusId)
      .toBe(PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
    expect(validationBlocked.checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: 'full_validation_failed',
      }),
    ]));
    expect(changelogBlocked.statusId)
      .toBe(PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
    expect(changelogBlocked.checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: 'changelog_entry_missing',
        missingPhaseIds: ['8r_21'],
      }),
    ]));
  });

  test('rejects mutated evidence-run output with stale risk counts or side effects', () => {
    const validation = validatePolicyBuilderPhase8CompletionEvidenceRun({
      statusId: PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.COMPLETE,
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
      PHASE8R_COMPLETION_EVIDENCE_RUN_RISK_IDS.RISK_COUNT_MISMATCH,
      PHASE8R_COMPLETION_EVIDENCE_RUN_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
