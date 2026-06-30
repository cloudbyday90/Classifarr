import {
  PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS,
  PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS,
  PHASE6R_MIGRATION_GATE_IDS,
  PHASE6R_MIGRATION_VERIFIER_KIND_IDS,
  buildPolicyBuilderPhase6MigrationDeletionAudit,
  buildPolicyBuilderPhase6MigrationPlan,
  listPolicyBuilderPhase6MigrationArtifacts,
  validateMigrationArtifact,
  validatePolicyBuilderPhase6MigrationPlan,
} from '../../services/policyBuilderPhase6MigrationDeletionPath.mjs';

describe('policyBuilderPhase6MigrationDeletionPath', () => {
  test('classifies real policy-builder diagnostic artifacts', () => {
    const paths = listPolicyBuilderPhase6MigrationArtifacts().map(artifact => artifact.path);

    expect(paths).toEqual(expect.arrayContaining([
      'client/src/components/policies/PolicyIntentImpactPreviewCard.vue',
      'client/src/components/policies/PolicyIntentReplayPreviewCard.vue',
      'client/src/composables/usePolicyIntentImpactPreview.js',
      'client/src/composables/usePolicyIntentReplayPreview.js',
      'server/src/routes/policiesRoutePolicyWrite.mjs',
      'server/src/services/policyIntentImpactPreview.mjs',
      'server/src/services/policyIntentReplayPreview.mjs',
      'server/src/services/policyIntentReplayProviderReadiness.mjs',
      'server/src/services/policyIntentReplayTmdbMetadataCoverageComparison.mjs',
      'database/schema/current.sql',
    ]));
  });

  test('separates keep, verifier, delete, and Phase 8 storage blocker decisions', () => {
    const artifacts = listPolicyBuilderPhase6MigrationArtifacts();
    const decisions = new Set(artifacts.map(artifact => artifact.decisionId));

    expect(decisions).toEqual(new Set([
      PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE,
      PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.MIGRATION_VERIFIER,
      PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
      PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.PHASE8_STORAGE_BLOCKER,
    ]));

    expect(artifacts.filter(artifact =>
      artifact.decisionId === PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.MIGRATION_VERIFIER
    ).map(artifact => artifact.verifierKindId)).toEqual(expect.arrayContaining([
      PHASE6R_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
      PHASE6R_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
      PHASE6R_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    ]));
  });

  test('builds a migration plan with all required gates and Phase 8 storage blocked', () => {
    const plan = buildPolicyBuilderPhase6MigrationPlan();

    expect(plan).toEqual(expect.objectContaining({
      version: 'phase6r.migration_deletion_path.v1',
      phaseId: '6r_6',
      normalWorkflowAllowsDiagnostics: false,
      phase8StorageMigrationBlocked: true,
    }));
    expect(plan.requiredGateIds).toEqual([
      PHASE6R_MIGRATION_GATE_IDS.PHASE6_ENGINE_CONTRACTS_STABLE,
      PHASE6R_MIGRATION_GATE_IDS.REPRESENTATIVE_COMPARISON_DEFINED,
      PHASE6R_MIGRATION_GATE_IDS.ROLLBACK_SNAPSHOT_DEFINED,
      PHASE6R_MIGRATION_GATE_IDS.ROLLBACK_WINDOW_DEFINED,
      PHASE6R_MIGRATION_GATE_IDS.DELETE_CHECKLIST_DEFINED,
      PHASE6R_MIGRATION_GATE_IDS.NATIVE_STORAGE_BLOCKED_UNTIL_PHASE8,
    ]);
    expect(plan.rollbackPlan).toEqual(expect.objectContaining({
      snapshotRequired: true,
      restorePathRequired: true,
      retentionWindowDays: 30,
      phase8StorageMigrationAllowed: false,
    }));
    expect(plan.validation.ok).toBe(true);
  });

  test('keeps old diagnostic artifacts out of the normal workflow', () => {
    const diagnosticArtifacts = listPolicyBuilderPhase6MigrationArtifacts()
      .filter(artifact => [
        PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.MIGRATION_VERIFIER,
        PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
      ].includes(artifact.decisionId));

    expect(diagnosticArtifacts.length).toBeGreaterThan(0);
    diagnosticArtifacts.forEach(artifact => {
      expect(artifact.normalWorkflowAllowed).toBe(false);
      expect(artifact.removalGateIds).toEqual(expect.arrayContaining([
        PHASE6R_MIGRATION_GATE_IDS.ROLLBACK_SNAPSHOT_DEFINED,
        PHASE6R_MIGRATION_GATE_IDS.DELETE_CHECKLIST_DEFINED,
      ]));
      expect(artifact.rollbackPlan).toEqual(expect.objectContaining({
        snapshotRequired: true,
        retentionWindowDays: 30,
      }));
    });
  });

  test('passes the default migration deletion audit', () => {
    const audit = buildPolicyBuilderPhase6MigrationDeletionAudit();

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedArtifactCount).toBeGreaterThanOrEqual(10);
    expect(audit.verifierCount).toBeGreaterThan(0);
    expect(audit.deleteCount).toBeGreaterThan(0);
    expect(audit.nextPhase).toEqual(expect.objectContaining({
      phaseId: '7r_1',
      label: 'Runtime Decision Inventory And Cutline',
    }));
  });

  test('rejects migration artifacts without owner, replacement, gates, or rollback', () => {
    const result = validateMigrationArtifact({
      path: 'client/src/components/policies/PolicyIntentReplayPreviewCard.vue',
      decisionId: PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
      verifierKindId: PHASE6R_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
      normalWorkflowAllowed: true,
      rollbackPlan: {
        snapshotRequired: false,
        retentionWindowDays: 0,
      },
    });

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_OWNER,
      }),
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_REPLACEMENT,
      }),
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_REMOVAL_GATE,
      }),
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_ROLLBACK_PLAN,
      }),
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_RETENTION_WINDOW,
      }),
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.NORMAL_FLOW_DIAGNOSTIC_SURFACE,
      }),
    ]));
  });

  test('rejects Phase 8 native storage migration before engine and rollback gates pass', () => {
    const plan = buildPolicyBuilderPhase6MigrationPlan({
      requiredGateIds: [
        PHASE6R_MIGRATION_GATE_IDS.PHASE6_ENGINE_CONTRACTS_STABLE,
      ],
      rollbackPlan: {
        snapshotRequired: true,
        restorePathRequired: true,
        retentionWindowDays: 30,
        phase8StorageMigrationAllowed: true,
      },
    });
    const validation = validatePolicyBuilderPhase6MigrationPlan({
      ...plan,
      phase8StorageMigrationBlocked: false,
      normalWorkflowAllowsDiagnostics: true,
    });

    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_REQUIRED_GATE,
      }),
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.PHASE8_NOT_BLOCKED,
      }),
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.NORMAL_FLOW_DIAGNOSTIC_SURFACE,
      }),
    ]));
  });
});
