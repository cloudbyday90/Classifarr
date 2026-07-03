import {
  PHASE6R_COMPLETION_COMPONENT_IDS,
  PHASE6R_COMPLETION_RISK_IDS,
  buildPolicyBuilderPhase6ArtifactInventoryCutlineAudit,
  buildPolicyBuilderPhase6BoundedChainCompletionAudit,
  buildPolicyBuilderPhase6CompletionAudit,
  listPolicyBuilderPhase6CompletionComponents,
  listPolicyBuilderPhase6RequiredLegacyCutlineArtifacts,
  validatePhase6ComponentCompletion,
} from '../../services/policyBuilderPhase6CompletionAudit.mjs';
import {
  PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS,
  buildPolicyBuilderPhase6MigrationPlan,
  listPolicyBuilderPhase6MigrationArtifacts,
} from '../../services/policyBuilderPhase6MigrationDeletionPath.mjs';

describe('policyBuilderPhase6CompletionAudit', () => {
  test('lists Phase 6R components in roadmap order', () => {
    expect(listPolicyBuilderPhase6CompletionComponents().map(component => component.id))
      .toEqual([
        PHASE6R_COMPLETION_COMPONENT_IDS.ARTIFACT_INVENTORY_CUTLINE,
        PHASE6R_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE,
        PHASE6R_COMPLETION_COMPONENT_IDS.INTENT_ENGINE,
        PHASE6R_COMPLETION_COMPONENT_IDS.LEARNING_GUARD,
        PHASE6R_COMPLETION_COMPONENT_IDS.READINESS_ENGINE,
        PHASE6R_COMPLETION_COMPONENT_IDS.OPERATOR_WORKFLOW,
        PHASE6R_COMPLETION_COMPONENT_IDS.MIGRATION_DELETION_PATH,
      ]);
  });

  test('requires legacy replay, impact, provider, TMDB, and old Phase 6 docs to have cutline decisions', () => {
    const requiredPaths = listPolicyBuilderPhase6RequiredLegacyCutlineArtifacts();
    const classifiedPaths = listPolicyBuilderPhase6MigrationArtifacts()
      .map(artifact => artifact.path);

    expect(requiredPaths).toEqual(expect.arrayContaining([
      'client/src/components/policies/PolicyIntentImpactPreviewCard.vue',
      'client/src/components/policies/PolicyIntentReplayPreviewCard.vue',
      'server/src/services/policyIntentReplayTmdbMetadataExecutionSwitch.mjs',
      'server/src/services/policyIntentReplayTmdbProviderClient.mjs',
      'docs/architecture/policy-builder-phase-6-implementation.md',
    ]));
    expect(classifiedPaths).toEqual(expect.arrayContaining(requiredPaths));
  });

  test('passes the default artifact inventory cutline audit', () => {
    const audit = buildPolicyBuilderPhase6ArtifactInventoryCutlineAudit();

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedArtifactCount).toBeGreaterThanOrEqual(20);
    expect(audit.classifiedArtifactCount).toBeGreaterThan(audit.checkedArtifactCount);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '6r_1',
      label: 'Evidence Engine',
    }));
  });

  test('passes the default Phase 6R completion audit', () => {
    const audit = buildPolicyBuilderPhase6CompletionAudit();

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedComponentCount).toBe(7);
    expect(audit.requiredComponentCount).toBe(7);
    expect(audit.boundedChainOk).toBe(true);
    expect(audit.boundedChainAudit.checkedStepCount).toBe(6);
    expect(audit.boundedChainAudit.issueCount).toBe(0);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '7r_1',
      label: 'Runtime Decision Inventory And Cutline',
    }));
  });

  test('passes the default bounded Phase 6R chain completion audit', () => {
    const audit = buildPolicyBuilderPhase6BoundedChainCompletionAudit();

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedStepCount).toBe(6);
    expect(audit.fingerprintCount).toBe(6);
    expect(audit.sharedProjectionFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(new Set(audit.steps.map(step => step.projectionFingerprint)).size).toBe(1);
    expect(JSON.stringify(audit.steps)).not.toContain('Animated Movies');
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '7r_1',
    }));
  });

  test('rejects bounded chain failures, provenance drift, and raw provenance leakage', () => {
    const stableFingerprint = 'a'.repeat(64);
    const driftFingerprint = 'b'.repeat(64);
    const audit = buildPolicyBuilderPhase6BoundedChainCompletionAudit({
      chain: {
        boundedEvidenceResult: {
          ok: true,
          statusId: 'ready',
          projectionFingerprint: {
            fingerprint: stableFingerprint,
          },
        },
        boundedIntentResult: {
          ok: false,
          statusId: 'blocked_by_intent_audit',
          issueCount: 1,
          evidenceBoundary: {
            projectionFingerprint: {
              fingerprint: driftFingerprint,
              provenance: {
                rawLabel: 'Animated Movies',
              },
            },
          },
        },
        boundedLearningResult: {
          ok: true,
          statusId: 'ready',
          intentBoundary: {
            evidenceBoundary: {
              projectionFingerprint: {
                fingerprint: stableFingerprint,
              },
            },
          },
        },
        boundedReadinessResult: {
          ok: true,
          statusId: 'ready',
          boundaryContext: {
            evidenceBoundary: {
              projectionFingerprint: {
                fingerprint: stableFingerprint,
              },
            },
            projectionFingerprintMatch: true,
          },
        },
        boundedWorkflowResult: {
          ok: true,
          statusId: 'ready',
          boundaryContext: {
            intentBoundary: {
              projectionFingerprint: {
                fingerprint: stableFingerprint,
              },
            },
            readinessBoundary: {
              projectionFingerprint: {
                fingerprint: stableFingerprint,
              },
            },
            projectionFingerprintMatch: true,
          },
        },
        boundedMigrationResult: {
          ok: true,
          statusId: 'ready',
          boundaryContext: {
            workflowBoundary: {
              projectionFingerprint: {
                fingerprint: stableFingerprint,
              },
            },
            projectionFingerprintMatch: true,
          },
        },
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_COMPLETION_RISK_IDS.BOUNDED_CHAIN_FAILED,
      }),
      expect.objectContaining({
        riskId: PHASE6R_COMPLETION_RISK_IDS.BOUNDED_CHAIN_PROVENANCE_MISMATCH,
      }),
      expect.objectContaining({
        riskId: PHASE6R_COMPLETION_RISK_IDS.BOUNDED_CHAIN_RAW_PROVENANCE,
      }),
    ]));
  });

  test('rejects component records that have no path evidence or failed audit', () => {
    const result = validatePhase6ComponentCompletion({
      id: PHASE6R_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE,
      label: 'Evidence engine',
      docPath: 'missing-doc.md',
      servicePath: 'missing-service.mjs',
      testPath: 'missing-test.mjs',
      expectedNextPhaseId: 'wrong_next_phase',
    }, {
      pathExists: () => false,
      componentAuditMap: {
        [PHASE6R_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE]: {
          ok: false,
          issueCount: 1,
          nextPhase: {
            phaseId: '6r_2',
          },
        },
      },
    });

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_COMPLETION_RISK_IDS.MISSING_EVIDENCE,
      }),
      expect.objectContaining({
        riskId: PHASE6R_COMPLETION_RISK_IDS.ARTIFACT_PATH_NOT_FOUND,
      }),
      expect.objectContaining({
        riskId: PHASE6R_COMPLETION_RISK_IDS.COMPONENT_AUDIT_FAILED,
      }),
      expect.objectContaining({
        riskId: PHASE6R_COMPLETION_RISK_IDS.NEXT_PHASE_MISMATCH,
      }),
    ]));
  });

  test('rejects missing legacy cutline decisions and premature Phase 8 storage migration', () => {
    const migrationPlan = buildPolicyBuilderPhase6MigrationPlan();
    const artifacts = migrationPlan.artifacts
      .filter(artifact =>
        artifact.path !== 'client/src/components/policies/PolicyIntentImpactPreviewCard.vue' &&
        artifact.decisionId !== PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.PHASE8_STORAGE_BLOCKER
      );
    const audit = buildPolicyBuilderPhase6ArtifactInventoryCutlineAudit({
      artifacts,
    });

    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_COMPLETION_RISK_IDS.LEGACY_ARTIFACT_WITHOUT_CUTLINE,
      }),
      expect.objectContaining({
        riskId: PHASE6R_COMPLETION_RISK_IDS.PHASE8_STORAGE_NOT_BLOCKED,
      }),
    ]));
  });

  test('rejects legacy diagnostic artifacts still allowed in normal workflow', () => {
    const artifacts = listPolicyBuilderPhase6MigrationArtifacts().map(artifact =>
      artifact.path === 'client/src/components/policies/PolicyIntentReplayPreviewCard.vue'
        ? { ...artifact, normalWorkflowAllowed: true }
        : artifact
    );
    const audit = buildPolicyBuilderPhase6ArtifactInventoryCutlineAudit({
      artifacts,
    });

    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_COMPLETION_RISK_IDS.LEGACY_ARTIFACT_ALLOWED_IN_NORMAL_WORKFLOW,
      }),
    ]));
  });
});
