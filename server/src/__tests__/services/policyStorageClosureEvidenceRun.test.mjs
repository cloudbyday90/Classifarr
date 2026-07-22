import {
  POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
  POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS,
  POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS,
  buildPolicyStorageClosureEvidenceRun,
  validatePolicyStorageClosureEvidenceRun,
} from '../../services/policyStorageClosureEvidenceRun.mjs';
import {
  MANIFEST_PATHS,
  buildCompletionAuditArtifactFixture,
} from './policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';
import {
  buildPolicyStorageClosureValidationEvidenceFixture,
} from './policyStorageClosureValidationEvidenceFixture.mjs';

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
    componentIds: SOURCE_COMPONENT_IDS,
    ...overrides,
  };
}

async function completeRun(overrides = {}) {
  const completionAuditArtifact =
    overrides.completionAuditArtifact || await buildCompletionAuditArtifactFixture();

  return buildPolicyStorageClosureEvidenceRun({
    artifactInventory: artifactInventory(),
    roadmapEvidence: roadmapEvidence(),
    completionAuditArtifact,
    validationEvidence: validationEvidence(),
    changelogEvidence: changelogEvidence(),
    ...overrides,
  });
}

describe('policyStorageClosureEvidenceRun', () => {
  test('completes when artifact, roadmap, final audit, validation, and changelog evidence pass', async () => {
    const evidenceRun = await completeRun();

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

  test('requires discrete authority, initial-establishment, reversion, and retention components', () => {
    const components = new Map(POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP
      .map(component => [component.componentId, component]));

    expect(components.get('active_native_intent_integrity_correction')).toEqual(
      expect.objectContaining({
        label: 'Active Native Intent Integrity Correction',
        contractPaths: expect.arrayContaining([
          'database/migrations/20260713_150000_enforce_single_active_policy_intent.sql',
        ]),
      })
    );
    expect(components.get('semantic_native_authority_eligibility')).toEqual(
      expect.objectContaining({
        label: 'Semantic Native Authority Eligibility And Empty-Intent Recovery',
        contractPaths: expect.arrayContaining([
          'server/src/services/policyNativeIntentAuthorityEligibility.mjs',
          'database/migrations/20260716_040000_enforce_semantic_native_intent_authority.sql',
        ]),
        testPaths: expect.arrayContaining([
          'server/src/__tests__/services/policyNativeIntentAuthorityEligibility.test.mjs',
          'server/src/__tests__/integration/policyEngine.test.mjs',
        ]),
      })
    );
    expect(components.get('initial_native_intent_establishment')).toEqual(
      expect.objectContaining({
        label: 'Initial Native Intent Establishment',
        designDocPaths: expect.arrayContaining([
          'docs/architecture/native-policy-initial-establishment-triage.md',
          'docs/architecture/native-policy-initial-establishment-transition.md',
          'docs/architecture/native-policy-initial-establishment-readiness.md',
          'docs/architecture/policy-initial-establishment-reconciliation-state-finalization.md',
        ]),
        contractPaths: expect.arrayContaining([
          'server/src/services/policyIntentMigrationCandidateReport.mjs',
          'server/src/services/nativeIntentReconciliationStatePersistence.mjs',
          'server/src/services/nativeIntentReconciliationStateService.mjs',
          'server/src/services/policyInitialIntentEstablishmentService.mjs',
          'server/src/services/policyInitialIntentEstablishmentReadinessService.mjs',
          'database/migrations/20260716_050000_add_policy_initial_intent_establishments.sql',
          'database/schema/current.sql',
        ]),
        testPaths: expect.arrayContaining([
          'server/src/__tests__/services/policyInitialIntentEstablishmentService.test.mjs',
          'server/src/__tests__/services/nativeIntentReconciliationStatePersistence.test.mjs',
          'server/src/__tests__/services/nativeIntentReconciliationStateService.test.mjs',
          'server/src/__tests__/services/policyInitialIntentEstablishmentReadinessService.test.mjs',
          'server/src/__tests__/integration/policy-initial-intent-establishment-readiness.test.mjs',
          'server/src/__tests__/integration/native-intent-reconciliation-state-persistence.test.mjs',
        ]),
      })
    );
    expect(components.get('observed_evidence_establishment_provenance')).toEqual(
      expect.objectContaining({
        label: 'Observed Evidence Establishment Provenance',
        designDocPaths: ['docs/architecture/policy-observed-evidence-provenance.md'],
        contractPaths: expect.arrayContaining([
          'server/src/services/policyObservedEvidenceProvenanceContract.mjs',
          'server/src/services/policyObservedEvidenceProvenanceRetentionService.mjs',
          'database/migrations/20260722_120000_add_policy_observed_evidence_provenance.sql',
          'database/schema/current.sql',
        ]),
        testPaths: expect.arrayContaining([
          'server/src/__tests__/services/policyObservedEvidenceProvenanceContract.test.mjs',
          'server/src/__tests__/services/policyObservedEvidenceProvenanceRetentionService.test.mjs',
          'server/src/__tests__/services/backupRestoreTables.nativePolicyIntent.test.mjs',
        ]),
      })
    );
    expect(components.get('transactional_native_authority_reversion')).toEqual(
      expect.objectContaining({
        contractPaths: expect.arrayContaining([
          'server/src/routes/policiesRouteNativeIntentReversion.mjs',
        ]),
      })
    );
    expect(components.get('rollback_snapshot_retention_cleanup')).toEqual(
      expect.objectContaining({
        designDocPaths: ['docs/architecture/policy-rollback-snapshot-retention.md'],
        contractPaths: expect.arrayContaining([
          'database/migrations/20260714_090000_add_policy_rollback_snapshot_retention_event.sql',
          'database/schema/current.sql',
        ]),
        testPaths: expect.arrayContaining([
          'server/src/__tests__/services/policyRollbackSnapshotRetentionService.test.mjs',
          'server/src/__tests__/services/backupRestoreTables.nativePolicyIntent.test.mjs',
        ]),
      })
    );
  });

  test('normalizes Windows-style paths in supplied artifact inventory', async () => {
    const windowsInventory = artifactInventory({
      servicePaths: artifactInventory().servicePaths.map(path => path.replace(/\//g, '\\')),
      routePaths: artifactInventory().routePaths.map(path => path.replace(/\//g, '\\')),
      migrationPaths: artifactInventory().migrationPaths.map(path => path.replace(/\//g, '\\')),
      testPaths: artifactInventory().testPaths.map(path => path.replace(/\//g, '\\')),
      docPaths: artifactInventory().docPaths.map(path => path.replace(/\//g, '\\')),
      otherPaths: artifactInventory().otherPaths.map(path => path.replace(/\//g, '\\')),
    });
    const evidenceRun = await completeRun({
      artifactInventory: windowsInventory,
    });

    expect(evidenceRun.statusId).toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.COMPLETE);
    expect(evidenceRun.artifactInventory.componentsWithMissingArtifactCount).toBe(0);
  });

  test('blocks historical roadmap identifiers instead of normalizing them as component IDs', async () => {
    const historicalRoadmapIds = SOURCE_COMPONENT_IDS.map((_componentId, index) => (
      `8R.${index + 1}`
    ));
    const evidenceRun = await completeRun({
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

  test('blocks legacy evidence keys instead of treating them as durable component fields', async () => {
    const evidenceRun = await completeRun({
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
    const missingComponentRisks = evidenceRun.checkpoint.risks
      .filter(risk => Array.isArray(risk.missingComponentIds));

    expect(missingComponentRisks).toHaveLength(3);
    expect(missingComponentRisks.every(risk => (
      risk.missingComponentIds.length > 0
    ))).toBe(true);
  });

  test('blocks when artifact inventory is missing', async () => {
    const evidenceRun = await completeRun({
      artifactInventory: {},
    });

    expect(evidenceRun.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_ARTIFACT_INVENTORY);
    expect(evidenceRun.risks.map(risk => risk.riskId)).toContain(
      POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS.MISSING_ARTIFACT_INVENTORY
    );
  });

  test('blocks through checkpoint when a mapped artifact is missing', async () => {
    const inventory = artifactInventory();
    const evidenceRun = await completeRun({
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

  test('blocks closure when rollback snapshot retention evidence is missing', async () => {
    const inventory = artifactInventory();
    const evidenceRun = await completeRun({
      artifactInventory: {
        ...inventory,
        servicePaths: inventory.servicePaths.filter(path => (
          path !== 'server/src/services/policyRollbackSnapshotRetentionService.mjs'
        )),
      },
    });

    expect(evidenceRun.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
    expect(evidenceRun.checkpoint.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: 'component_not_implemented',
        componentId: 'rollback_snapshot_retention_cleanup',
      }),
      expect.objectContaining({
        riskId: 'component_missing_contract_evidence',
        componentId: 'rollback_snapshot_retention_cleanup',
      }),
    ]));
  });

  test('blocks when roadmap or final removal audit evidence does not satisfy checkpoint', async () => {
    const roadmapBlocked = await completeRun({
      roadmapEvidence: roadmapEvidence({
        componentSequenceIds:
          SOURCE_COMPONENT_IDS.filter(componentId => (
            componentId !== 'storage_completion_checkpoint'
          )),
      }),
    });
    const removalAuditBlocked = await completeRun({
      completionAuditArtifact: await buildCompletionAuditArtifactFixture({
        appliedPaths: [MANIFEST_PATHS[0]],
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
    expect(removalAuditBlocked.implementationReadiness).toEqual(expect.objectContaining({
      scope: 'repository',
      statusId: 'ready',
      ready: true,
      riskCount: 0,
      validationOk: true,
    }));
    expect(removalAuditBlocked.instanceCutover).toEqual(expect.objectContaining({
      scope: 'active_installation',
      requiredForStorageClosure: true,
      ready: false,
      riskCount: 1,
    }));
  });

  test('blocks when validation or changelog evidence fails checkpoint', async () => {
    const validationBlocked = await completeRun({
      validationEvidence: validationEvidence({
        commandResultOverrides: {
          full: {
            exitCode: 1,
            message: 'full suite failed',
          },
        },
      }),
    });
    const changelogBlocked = await completeRun({
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
      POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS.IMPLEMENTATION_READINESS_SCOPE_INVALID,
      POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS.INSTANCE_CUTOVER_SCOPE_INVALID,
    ]));
  });
});
