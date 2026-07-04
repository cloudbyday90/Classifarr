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
  POLICY_MIGRATION_ARTIFACT_DECISION_IDS,
  POLICY_MIGRATION_BOUNDARY_STATUS_IDS,
  POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS,
  POLICY_MIGRATION_GATE_IDS,
  POLICY_MIGRATION_VERIFIER_KIND_IDS,
  buildPolicyMigrationDeletionAudit,
  buildPolicyMigrationDeletionPlan,
  buildPolicyMigrationDeletionPlanFromBoundedWorkflow,
  listPolicyMigrationDeletionArtifacts,
  validateMigrationArtifact,
  validatePolicyMigrationDeletionPlan,
} from '../../services/policyMigrationDeletionPath.mjs';

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

describe('policyMigrationDeletionPath', () => {
  test('classifies real policy-builder diagnostic artifacts', () => {
    const paths = listPolicyMigrationDeletionArtifacts().map(artifact => artifact.path);

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

  test('separates keep, verifier, delete, and native storage blocker decisions', () => {
    const artifacts = listPolicyMigrationDeletionArtifacts();
    const decisions = new Set(artifacts.map(artifact => artifact.decisionId));

    expect(decisions).toEqual(new Set([
      POLICY_MIGRATION_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE,
      POLICY_MIGRATION_ARTIFACT_DECISION_IDS.MIGRATION_VERIFIER,
      POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
      POLICY_MIGRATION_ARTIFACT_DECISION_IDS.NATIVE_STORAGE_BLOCKER,
    ]));

    expect(artifacts.filter(artifact =>
      artifact.decisionId === POLICY_MIGRATION_ARTIFACT_DECISION_IDS.MIGRATION_VERIFIER
    ).map(artifact => artifact.verifierKindId)).toEqual(expect.arrayContaining([
      POLICY_MIGRATION_VERIFIER_KIND_IDS.IMPACT_PARITY,
      POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
      POLICY_MIGRATION_VERIFIER_KIND_IDS.ENRICHMENT_COVERAGE,
    ]));
  });

  test('builds a migration plan with all required gates and native storage blocked', () => {
    const plan = buildPolicyMigrationDeletionPlan();

    expect(plan).toEqual(expect.objectContaining({
      version: 'policy.migration_deletion_path.v1',
      stepId: 'migration_deletion_path',
      normalWorkflowAllowsDiagnostics: false,
      nativeStorageMigrationBlocked: true,
    }));
    expect(plan.requiredGateIds).toEqual([
      POLICY_MIGRATION_GATE_IDS.POLICY_ENGINE_CONTRACTS_STABLE,
      POLICY_MIGRATION_GATE_IDS.REPRESENTATIVE_COMPARISON_DEFINED,
      POLICY_MIGRATION_GATE_IDS.ROLLBACK_SNAPSHOT_DEFINED,
      POLICY_MIGRATION_GATE_IDS.ROLLBACK_WINDOW_DEFINED,
      POLICY_MIGRATION_GATE_IDS.DELETE_CHECKLIST_DEFINED,
      POLICY_MIGRATION_GATE_IDS.NATIVE_STORAGE_BLOCKED_UNTIL_MIGRATION_READY,
    ]);
    expect(plan.rollbackPlan).toEqual(expect.objectContaining({
      snapshotRequired: true,
      restorePathRequired: true,
      retentionWindowDays: 30,
      nativeStorageMigrationAllowed: false,
    }));
    expect(plan.validation.ok).toBe(true);
  });

  test('builds a bounded migration plan from a bounded operator workflow result', () => {
    const boundedWorkflowResult = buildBoundedWorkflowResult();

    const result = buildPolicyMigrationDeletionPlanFromBoundedWorkflow({
      boundedWorkflowResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_MIGRATION_BOUNDARY_STATUS_IDS.READY,
      issueCount: 0,
      nextStep: expect.objectContaining({
        stepId: 'runtime_decision_inventory',
      }),
    }));
    expect(result.plan).toEqual(expect.objectContaining({
      version: 'policy.migration_deletion_path.v1',
      nativeStorageMigrationBlocked: true,
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
    const result = buildPolicyMigrationDeletionPlanFromBoundedWorkflow({
      boundedWorkflowResult: {
        ok: false,
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_MIGRATION_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_WORKFLOW,
      plan: null,
      migrationAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_BOUNDED_WORKFLOW,
      }),
      expect.objectContaining({
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_BOUNDED_PROVENANCE,
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

    const result = buildPolicyMigrationDeletionPlanFromBoundedWorkflow({
      boundedWorkflowResult: failedWorkflowAuditResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_MIGRATION_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_WORKFLOW,
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
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.BOUNDED_WORKFLOW_AUDIT_NOT_PASSING,
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

    const result = buildPolicyMigrationDeletionPlanFromBoundedWorkflow({
      boundedWorkflowResult: mismatchedWorkflowResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_MIGRATION_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_WORKFLOW,
      plan: null,
      migrationAudit: null,
      boundaryContext: expect.objectContaining({
        projectionFingerprintMatch: false,
      }),
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.BOUNDED_PROVENANCE_MISMATCH,
      }),
    ]));
  });

  test('blocks bounded migration planning when workflow quality is missing', () => {
    const boundedWorkflowResult = clonePlain(buildBoundedWorkflowResult());
    boundedWorkflowResult.workflow.boundaryContext.readinessBoundary.intentQuality = null;

    const result = buildPolicyMigrationDeletionPlanFromBoundedWorkflow({
      boundedWorkflowResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_MIGRATION_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_WORKFLOW,
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
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_BOUNDED_QUALITY,
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

    const result = buildPolicyMigrationDeletionPlanFromBoundedWorkflow({
      boundedWorkflowResult: withWorkflowQuality(boundedWorkflowResult, insufficientQuality),
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_MIGRATION_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_WORKFLOW,
      plan: null,
      migrationAudit: null,
    }));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.BOUNDED_QUALITY_INSUFFICIENT,
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

    const result = buildPolicyMigrationDeletionPlanFromBoundedWorkflow({
      boundedWorkflowResult,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_MIGRATION_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_WORKFLOW,
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
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.BOUNDED_QUALITY_MISMATCH,
      }),
    ]));
  });

  test('keeps old diagnostic artifacts out of the normal workflow', () => {
    const diagnosticArtifacts = listPolicyMigrationDeletionArtifacts()
      .filter(artifact => [
        POLICY_MIGRATION_ARTIFACT_DECISION_IDS.MIGRATION_VERIFIER,
        POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
      ].includes(artifact.decisionId));

    expect(diagnosticArtifacts.length).toBeGreaterThan(0);
    diagnosticArtifacts.forEach(artifact => {
      expect(artifact.normalWorkflowAllowed).toBe(false);
      expect(artifact.removalGateIds).toEqual(expect.arrayContaining([
        POLICY_MIGRATION_GATE_IDS.ROLLBACK_SNAPSHOT_DEFINED,
        POLICY_MIGRATION_GATE_IDS.DELETE_CHECKLIST_DEFINED,
      ]));
      expect(artifact.rollbackPlan).toEqual(expect.objectContaining({
        snapshotRequired: true,
        retentionWindowDays: 30,
      }));
    });
  });

  test('passes the default migration deletion audit', () => {
    const audit = buildPolicyMigrationDeletionAudit();

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedArtifactCount).toBeGreaterThanOrEqual(10);
    expect(audit.verifierCount).toBeGreaterThan(0);
    expect(audit.deleteCount).toBeGreaterThan(0);
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'runtime_decision_inventory',
      label: 'Policy Runtime Decision Inventory',
    }));
  });

  test('rejects migration artifacts without owner, replacement, gates, or rollback', () => {
    const result = validateMigrationArtifact({
      path: 'client/src/components/policies/PolicyIntentReplayPreviewCard.vue',
      decisionId: POLICY_MIGRATION_ARTIFACT_DECISION_IDS.DELETE_AFTER_MIGRATION,
      verifierKindId: POLICY_MIGRATION_VERIFIER_KIND_IDS.REPRESENTATIVE_REPLAY,
      normalWorkflowAllowed: true,
      rollbackPlan: {
        snapshotRequired: false,
        retentionWindowDays: 0,
      },
    });

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_OWNER,
      }),
      expect.objectContaining({
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_REPLACEMENT,
      }),
      expect.objectContaining({
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_REMOVAL_GATE,
      }),
      expect.objectContaining({
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_ROLLBACK_PLAN,
      }),
      expect.objectContaining({
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_RETENTION_WINDOW,
      }),
      expect.objectContaining({
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.NORMAL_FLOW_DIAGNOSTIC_SURFACE,
      }),
    ]));
  });

  test('rejects native storage migration before engine and rollback gates pass', () => {
    const plan = buildPolicyMigrationDeletionPlan({
      requiredGateIds: [
        POLICY_MIGRATION_GATE_IDS.POLICY_ENGINE_CONTRACTS_STABLE,
      ],
      rollbackPlan: {
        snapshotRequired: true,
        restorePathRequired: true,
        retentionWindowDays: 30,
        nativeStorageMigrationAllowed: true,
      },
    });
    const validation = validatePolicyMigrationDeletionPlan({
      ...plan,
      nativeStorageMigrationBlocked: false,
      normalWorkflowAllowsDiagnostics: true,
    });

    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.MISSING_REQUIRED_GATE,
      }),
      expect.objectContaining({
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.NATIVE_STORAGE_NOT_BLOCKED,
      }),
      expect.objectContaining({
        riskId: POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS.NORMAL_FLOW_DIAGNOSTIC_SURFACE,
      }),
    ]));
  });
});
