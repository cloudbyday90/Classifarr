import {
  ANSWER_OUTCOME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  buildBoundedPolicyEvidenceProjection,
} from '../../services/policyEvidenceBoundary.mjs';
import {
  POLICY_EVIDENCE_QUALITY_STATUS_IDS,
} from '../../services/policyEvidenceQuality.mjs';
import {
  buildPolicyIntentDraftFromBoundedEvidence,
} from '../../services/policyIntentEngine.mjs';
import {
  buildPolicyLearningDecisionFromBoundedIntent,
} from '../../services/policyLearningGuard.mjs';
import {
  buildPolicyAutomationReadinessFromBoundedContracts,
} from '../../services/policyAutomationReadinessEngine.mjs';
import {
  buildPolicyOperatorWorkflowFromBoundedReadiness,
} from '../../services/policyOperatorWorkflow.mjs';
import {
  PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS,
  PHASE6R_MIGRATION_BOUNDARY_STATUS_IDS,
  PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS,
  PHASE6R_MIGRATION_GATE_IDS,
  PHASE6R_MIGRATION_VERIFIER_KIND_IDS,
  buildPolicyBuilderPhase6MigrationDeletionAudit,
  buildPolicyBuilderPhase6MigrationPlan,
  buildPolicyBuilderPhase6MigrationPlanFromBoundedWorkflow,
  listPolicyBuilderPhase6MigrationArtifacts,
  validateMigrationArtifact,
  validatePolicyBuilderPhase6MigrationPlan,
} from '../../services/policyBuilderPhase6MigrationDeletionPath.mjs';

function buildBoundedWorkflowResult() {
  const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
    evidenceInput: {
      operatorIntent: {
        belongsHere: ['Animated Movies'],
        helpfulMatches: ['Disney'],
        routingTargets: ['Radarr Animated Movies'],
      },
    },
  });
  const boundedIntentResult = buildPolicyIntentDraftFromBoundedEvidence({
    boundedEvidenceResult,
  });
  const boundedLearningResult = buildPolicyLearningDecisionFromBoundedIntent({
    boundedIntentResult,
    learningInput: {
      answerOutcomeId: ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM,
      answer: {
        label: 'Animated Movies',
        destinationLibraryId: 6,
        destinationLibraryName: 'Animated Movies',
      },
      finalOutcome: {
        itemId: 10674,
        status: 'resolved',
      },
    },
  });
  const boundedReadinessResult = buildPolicyAutomationReadinessFromBoundedContracts({
    boundedEvidenceResult,
    boundedIntentResult,
    boundedLearningResult,
    routing: {
      configured: true,
      routeReady: true,
      targetName: 'Radarr Animated Movies',
    },
  });

  return buildPolicyOperatorWorkflowFromBoundedReadiness({
    boundedIntentResult,
    boundedReadinessResult,
  });
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function withWorkflowQuality(result, quality) {
  const nextResult = clonePlain(result);
  nextResult.boundaryContext.intentBoundary.quality = clonePlain(quality);
  nextResult.boundaryContext.readinessBoundary.evidenceQuality = clonePlain(quality);
  nextResult.boundaryContext.readinessBoundary.intentQuality = clonePlain(quality);
  nextResult.boundaryContext.readinessBoundary.learningQuality = clonePlain(quality);
  nextResult.boundaryContext.qualityMatch = true;
  nextResult.workflow.boundaryContext = clonePlain(nextResult.boundaryContext);
  return nextResult;
}

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

  test('builds a bounded migration plan from a bounded operator workflow result', () => {
    const boundedWorkflowResult = buildBoundedWorkflowResult();

    const result = buildPolicyBuilderPhase6MigrationPlanFromBoundedWorkflow({
      boundedWorkflowResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: PHASE6R_MIGRATION_BOUNDARY_STATUS_IDS.READY,
      issueCount: 0,
      nextPhase: expect.objectContaining({
        phaseId: '7r_1',
      }),
    }));
    expect(result.plan).toEqual(expect.objectContaining({
      version: 'phase6r.migration_deletion_path.v1',
      phase8StorageMigrationBlocked: true,
      boundaryContext: expect.objectContaining({
        projectionFingerprintMatch: true,
      }),
      engineContractBoundary: expect.objectContaining({
        boundedWorkflowRequired: true,
        workflowId: 'destination_first_policy_setup',
      }),
    }));
    expect(result.boundaryContext.workflowBoundary).toEqual(expect.objectContaining({
      quality: expect.objectContaining({
        statusId: boundedWorkflowResult.boundaryContext.intentBoundary.quality.statusId,
      }),
      qualityMatch: true,
    }));
    expect(result.migrationAudit.ok).toBe(true);
    expect(JSON.stringify(result.boundaryContext)).not.toContain('Animated Movies');
  });

  test('blocks bounded migration planning when bounded workflow is missing', () => {
    const result = buildPolicyBuilderPhase6MigrationPlanFromBoundedWorkflow({
      boundedWorkflowResult: {
        ok: false,
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_MIGRATION_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_WORKFLOW,
      plan: null,
      migrationAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_BOUNDED_WORKFLOW,
      }),
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_BOUNDED_PROVENANCE,
      }),
    ]));
  });

  test('blocks bounded migration planning when bounded workflow audit is not passing', () => {
    const boundedWorkflowResult = buildBoundedWorkflowResult();
    const failedWorkflowAuditResult = {
      ...boundedWorkflowResult,
      workflowAudit: {
        ...boundedWorkflowResult.workflowAudit,
        ok: false,
      },
    };

    const result = buildPolicyBuilderPhase6MigrationPlanFromBoundedWorkflow({
      boundedWorkflowResult: failedWorkflowAuditResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_MIGRATION_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_WORKFLOW,
      plan: null,
      migrationAudit: null,
      boundaryContext: expect.objectContaining({
        workflowBoundary: expect.objectContaining({
          workflowAuditOk: false,
        }),
      }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.BOUNDED_WORKFLOW_AUDIT_NOT_PASSING,
      }),
    ]));
  });

  test('blocks bounded migration planning when workflow provenance does not match', () => {
    const boundedWorkflowResult = buildBoundedWorkflowResult();
    const mismatchedWorkflowResult = {
      ...boundedWorkflowResult,
      boundaryContext: {
        ...boundedWorkflowResult.boundaryContext,
        readinessBoundary: {
          ...boundedWorkflowResult.boundaryContext.readinessBoundary,
          projectionFingerprint: {
            ...boundedWorkflowResult.boundaryContext.readinessBoundary.projectionFingerprint,
            fingerprint: 'f'.repeat(64),
          },
        },
      },
    };

    const result = buildPolicyBuilderPhase6MigrationPlanFromBoundedWorkflow({
      boundedWorkflowResult: mismatchedWorkflowResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_MIGRATION_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_WORKFLOW,
      plan: null,
      migrationAudit: null,
      boundaryContext: expect.objectContaining({
        projectionFingerprintMatch: false,
      }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.BOUNDED_PROVENANCE_MISMATCH,
      }),
    ]));
  });

  test('blocks bounded migration planning when workflow quality is missing', () => {
    const boundedWorkflowResult = clonePlain(buildBoundedWorkflowResult());
    boundedWorkflowResult.workflow.boundaryContext.readinessBoundary.intentQuality = null;

    const result = buildPolicyBuilderPhase6MigrationPlanFromBoundedWorkflow({
      boundedWorkflowResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_MIGRATION_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_WORKFLOW,
      plan: null,
      migrationAudit: null,
      boundaryContext: expect.objectContaining({
        workflowBoundary: expect.objectContaining({
          qualityMatch: false,
        }),
      }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_BOUNDED_QUALITY,
      }),
    ]));
  });

  test('blocks bounded migration planning when workflow quality is insufficient', () => {
    const boundedWorkflowResult = buildBoundedWorkflowResult();
    const insufficientQuality = {
      ...boundedWorkflowResult.boundaryContext.intentBoundary.quality,
      statusId: POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT,
      nextActionId: 'confirm_destination_identity',
      reasonIds: ['missing_identity'],
    };

    const result = buildPolicyBuilderPhase6MigrationPlanFromBoundedWorkflow({
      boundedWorkflowResult: withWorkflowQuality(boundedWorkflowResult, insufficientQuality),
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_MIGRATION_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_WORKFLOW,
      plan: null,
      migrationAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.BOUNDED_QUALITY_INSUFFICIENT,
        nextActionId: 'confirm_destination_identity',
      }),
    ]));
  });

  test('blocks bounded migration planning when workflow quality no longer matches', () => {
    const boundedWorkflowResult = clonePlain(buildBoundedWorkflowResult());
    boundedWorkflowResult.boundaryContext.readinessBoundary.intentQuality = {
      ...boundedWorkflowResult.boundaryContext.intentBoundary.quality,
      nextActionId: 'review_evidence',
      reasonIds: [
        ...boundedWorkflowResult.boundaryContext.intentBoundary.quality.reasonIds,
        'review_evidence_present',
      ].sort(),
    };
    boundedWorkflowResult.workflow.boundaryContext =
      clonePlain(boundedWorkflowResult.boundaryContext);

    const result = buildPolicyBuilderPhase6MigrationPlanFromBoundedWorkflow({
      boundedWorkflowResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: PHASE6R_MIGRATION_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_WORKFLOW,
      plan: null,
      migrationAudit: null,
      boundaryContext: expect.objectContaining({
        workflowBoundary: expect.objectContaining({
          qualityMatch: false,
        }),
      }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS.BOUNDED_QUALITY_MISMATCH,
      }),
    ]));
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
