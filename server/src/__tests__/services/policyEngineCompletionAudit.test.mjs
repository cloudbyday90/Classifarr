import {
  POLICY_ENGINE_COMPLETION_COMPONENT_IDS,
  POLICY_ENGINE_COMPLETION_RISK_IDS,
  buildPolicyEngineArtifactInventoryCutlineAudit,
  buildPolicyEngineBoundedChainCompletionAudit,
  buildPolicyEngineCompletionAudit,
  listPolicyEngineCompletionComponents,
  listPolicyEngineRequiredLegacyCutlineArtifacts,
  validatePolicyEngineComponentCompletion,
} from '../../services/policyEngineCompletionAudit.mjs';
import {
  POLICY_EVIDENCE_QUALITY_STATUS_IDS,
} from '../../services/policyEvidenceQuality.mjs';
import {
  POLICY_MIGRATION_ARTIFACT_DECISION_IDS,
  buildPolicyMigrationDeletionPlan,
  listPolicyMigrationDeletionArtifacts,
} from '../../services/policyMigrationDeletionPath.mjs';
import {
  POLICY_DECISION_HANDOFF_SOURCE_IDS,
  POLICY_DECISION_HANDOFF_SOURCE_VERSION,
} from '../../services/policyDecisionHandoffSource.mjs';

const stableQuality = Object.freeze({
  version: 'policy.evidence.quality.v1',
  statusId: POLICY_EVIDENCE_QUALITY_STATUS_IDS.USABLE,
  score: 0.9,
  nextActionId: 'proceed_to_intent',
  reasonIds: [
    'compatibility_present',
    'declared_identity_present',
    'observed_identity_present',
  ],
  counts: {
    identity: 2,
    compatibility: 1,
  },
  hasIdentityEvidence: true,
  hasDeclaredIdentityEvidence: true,
  hasObservedIdentityEvidence: true,
  hasStaleProfileEvidence: false,
});

const insufficientQuality = Object.freeze({
  ...stableQuality,
  statusId: POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT,
  score: 0.2,
  nextActionId: 'confirm_destination_identity',
  reasonIds: [
    'missing_identity',
  ],
  counts: {
    identity: 0,
  },
  hasIdentityEvidence: false,
  hasDeclaredIdentityEvidence: false,
  hasObservedIdentityEvidence: false,
});

function buildDecisionSourceAdmission() {
  return {
    version: `${POLICY_DECISION_HANDOFF_SOURCE_VERSION}.audit`,
    ok: true,
    sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING,
    decisionVersion: 'policy.learning_guard.v1',
    issueCount: 0,
    issues: [],
  };
}

function buildDecisionSourceSummary() {
  return {
    sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING,
    decisionVersion: 'policy.learning_guard.v1',
    admitted: true,
  };
}

describe('policyEngineCompletionAudit', () => {
  test('lists policy engine components in handoff order', () => {
    expect(listPolicyEngineCompletionComponents().map(component => component.id))
      .toEqual([
        POLICY_ENGINE_COMPLETION_COMPONENT_IDS.ARTIFACT_INVENTORY_CUTLINE,
        POLICY_ENGINE_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE,
        POLICY_ENGINE_COMPLETION_COMPONENT_IDS.INTENT_ENGINE,
        POLICY_ENGINE_COMPLETION_COMPONENT_IDS.LEARNING_GUARD,
        POLICY_ENGINE_COMPLETION_COMPONENT_IDS.READINESS_ENGINE,
        POLICY_ENGINE_COMPLETION_COMPONENT_IDS.OPERATOR_WORKFLOW,
        POLICY_ENGINE_COMPLETION_COMPONENT_IDS.MIGRATION_DELETION_PATH,
      ]);
  });

  test('requires legacy replay, impact, provider, and TMDB artifacts to have cutline decisions', () => {
    const requiredPaths = listPolicyEngineRequiredLegacyCutlineArtifacts();
    const classifiedPaths = listPolicyMigrationDeletionArtifacts()
      .map(artifact => artifact.path);

    expect(requiredPaths).toEqual(expect.arrayContaining([
      'client/src/components/policies/PolicyIntentImpactPreviewCard.vue',
      'client/src/components/policies/PolicyIntentReplayPreviewCard.vue',
      'server/src/services/policyIntentReplayTmdbMetadataExecutionSwitch.mjs',
      'server/src/services/policyIntentReplayTmdbProviderClient.mjs',
    ]));
    expect(classifiedPaths).toEqual(expect.arrayContaining(requiredPaths));
  });

  test('passes the default artifact inventory cutline audit', () => {
    const audit = buildPolicyEngineArtifactInventoryCutlineAudit();

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedArtifactCount).toBeGreaterThanOrEqual(20);
    expect(audit.classifiedArtifactCount).toBeGreaterThan(audit.checkedArtifactCount);
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'evidence_engine',
      label: 'Evidence Engine',
    }));
  });

  test('passes the default policy engine completion audit', () => {
    const audit = buildPolicyEngineCompletionAudit();

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedComponentCount).toBe(7);
    expect(audit.requiredComponentCount).toBe(7);
    expect(audit.boundedChainOk).toBe(true);
    expect(audit.boundedChainAudit.checkedStepCount).toBe(6);
    expect(audit.boundedChainAudit.issueCount).toBe(0);
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'runtime_decision_inventory',
      label: 'Policy Runtime Decision Inventory',
    }));
  });

  test('passes the default bounded policy engine chain completion audit', () => {
    const audit = buildPolicyEngineBoundedChainCompletionAudit();

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.checkedStepCount).toBe(6);
    expect(audit.fingerprintCount).toBe(6);
    expect(audit.qualitySnapshotCount).toBeGreaterThanOrEqual(6);
    expect(audit.qualityStatuses).toEqual([
      POLICY_EVIDENCE_QUALITY_STATUS_IDS.USABLE,
    ]);
    expect(audit.decisionSource).toEqual({
      sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING,
      decisionVersion: 'policy.learning_guard.v1',
      admitted: true,
    });
    expect(audit.decisionSourceAuditCount).toBe(3);
    expect(audit.sharedProjectionFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(new Set(audit.steps.map(step => step.projectionFingerprint)).size).toBe(1);
    expect(audit.steps.every(step => step.auditOk === true)).toBe(true);
    expect(audit.steps.every(step => step.qualityOk === true)).toBe(true);
    expect(JSON.stringify(audit.steps)).not.toContain('Animated Movies');
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'runtime_decision_inventory',
    }));
  });

  test('rejects bounded chain steps with non-passing nested audits', () => {
    const stableFingerprint = 'a'.repeat(64);
    const projectionFingerprint = {
      fingerprint: stableFingerprint,
    };
    const audit = buildPolicyEngineBoundedChainCompletionAudit({
      chain: {
        boundedEvidenceResult: {
          ok: true,
          statusId: 'ready',
          projection: {
            quality: stableQuality,
          },
          projectionFingerprint,
          projectionAudit: {
            ok: true,
          },
          projectionFingerprintAudit: {
            ok: true,
          },
        },
        boundedIntentResult: {
          ok: true,
          statusId: 'ready',
          evidenceBoundary: {
            quality: stableQuality,
            projectionFingerprint,
          },
          intentAudit: {
            ok: false,
          },
          evidenceFingerprintAudit: {
            ok: true,
          },
        },
        boundedLearningResult: {
          ok: true,
          statusId: 'ready',
          intentBoundary: {
            evidenceBoundary: {
              quality: stableQuality,
              projectionFingerprint,
            },
          },
          learningAudit: {
            ok: true,
          },
        },
        boundedReadinessResult: {
          ok: true,
          statusId: 'ready',
          boundaryContext: {
            evidenceBoundary: {
              quality: stableQuality,
              projectionFingerprint,
            },
            intentBoundary: {
              quality: stableQuality,
            },
            learningBoundary: {
              quality: stableQuality,
            },
            projectionFingerprintMatch: true,
          },
          readinessAudit: {
            ok: true,
          },
        },
        boundedWorkflowResult: {
          ok: true,
          statusId: 'ready',
          boundaryContext: {
            intentBoundary: {
              quality: stableQuality,
              projectionFingerprint,
            },
            readinessBoundary: {
              evidenceQuality: stableQuality,
              intentQuality: stableQuality,
              learningQuality: stableQuality,
              projectionFingerprint,
            },
            projectionFingerprintMatch: true,
          },
          workflow: {
            boundaryContext: {
              intentBoundary: {
                quality: stableQuality,
              },
              readinessBoundary: {
                evidenceQuality: stableQuality,
                intentQuality: stableQuality,
                learningQuality: stableQuality,
              },
            },
          },
          workflowAudit: {
            ok: true,
          },
        },
        boundedMigrationResult: {
          ok: true,
          statusId: 'ready',
          boundaryContext: {
            workflowBoundary: {
              quality: stableQuality,
              projectionFingerprint,
            },
            projectionFingerprintMatch: true,
          },
          migrationAudit: {
            ok: true,
          },
        },
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.sharedProjectionFingerprint).toBe(stableFingerprint);
    expect(audit.steps.find(step =>
      step.stepId === POLICY_ENGINE_COMPLETION_COMPONENT_IDS.INTENT_ENGINE
    )).toEqual(expect.objectContaining({
      auditOk: false,
      auditChecks: expect.arrayContaining([
        expect.objectContaining({
          auditId: 'intent_audit',
          ok: false,
        }),
      ]),
    }));
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_AUDIT_NOT_PASSING,
        componentId: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.INTENT_ENGINE,
      }),
    ]));
  });

  test('rejects bounded chain failures, provenance drift, and raw provenance leakage', () => {
    const stableFingerprint = 'a'.repeat(64);
    const driftFingerprint = 'b'.repeat(64);
    const audit = buildPolicyEngineBoundedChainCompletionAudit({
      chain: {
        boundedEvidenceResult: {
          ok: true,
          statusId: 'ready',
          projection: {
            quality: stableQuality,
          },
          projectionFingerprint: {
            fingerprint: stableFingerprint,
          },
        },
        boundedIntentResult: {
          ok: false,
          statusId: 'blocked_by_intent_audit',
          issueCount: 1,
          evidenceBoundary: {
            quality: stableQuality,
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
              quality: stableQuality,
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
              quality: stableQuality,
              projectionFingerprint: {
                fingerprint: stableFingerprint,
              },
            },
            intentBoundary: {
              quality: stableQuality,
            },
            learningBoundary: {
              quality: stableQuality,
            },
            projectionFingerprintMatch: true,
          },
        },
        boundedWorkflowResult: {
          ok: true,
          statusId: 'ready',
          boundaryContext: {
            intentBoundary: {
              quality: stableQuality,
              projectionFingerprint: {
                fingerprint: stableFingerprint,
              },
            },
            readinessBoundary: {
              evidenceQuality: stableQuality,
              intentQuality: stableQuality,
              learningQuality: stableQuality,
              projectionFingerprint: {
                fingerprint: stableFingerprint,
              },
            },
            projectionFingerprintMatch: true,
          },
          workflow: {
            boundaryContext: {
              intentBoundary: {
                quality: stableQuality,
              },
              readinessBoundary: {
                evidenceQuality: stableQuality,
                intentQuality: stableQuality,
                learningQuality: stableQuality,
              },
            },
          },
        },
        boundedMigrationResult: {
          ok: true,
          statusId: 'ready',
          boundaryContext: {
            workflowBoundary: {
              quality: stableQuality,
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
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_FAILED,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_PROVENANCE_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_RAW_PROVENANCE,
      }),
    ]));
  });

  test('rejects missing, invalid, and mismatched decision-source provenance', () => {
    const stableFingerprint = 'd'.repeat(64);
    const projectionFingerprint = { fingerprint: stableFingerprint };
    const buildChain = () => ({
      boundedEvidenceResult: {
        ok: true,
        statusId: 'ready',
        projection: { quality: stableQuality },
        projectionFingerprint,
        projectionAudit: { ok: true },
        projectionFingerprintAudit: { ok: true },
      },
      boundedIntentResult: {
        ok: true,
        statusId: 'ready',
        evidenceBoundary: { quality: stableQuality, projectionFingerprint },
        intentAudit: { ok: true },
        evidenceFingerprintAudit: { ok: true },
      },
      boundedLearningResult: {
        ok: true,
        statusId: 'ready',
        intentBoundary: {
          evidenceBoundary: { quality: stableQuality, projectionFingerprint },
        },
        learningAudit: { ok: true },
      },
      boundedReadinessResult: {
        ok: true,
        statusId: 'ready',
        decisionSourceAdmission: buildDecisionSourceAdmission(),
        boundaryContext: {
          evidenceBoundary: { quality: stableQuality, projectionFingerprint },
          intentBoundary: { quality: stableQuality },
          learningBoundary: {
            quality: stableQuality,
            decisionSource: buildDecisionSourceSummary(),
          },
          projectionFingerprintMatch: true,
        },
        readiness: {
          inputs: {
            boundaryContext: {
              learningBoundary: { decisionSource: buildDecisionSourceSummary() },
            },
          },
        },
        readinessAudit: { ok: true },
      },
      boundedWorkflowResult: {
        ok: true,
        statusId: 'ready',
        decisionSourceAdmission: buildDecisionSourceAdmission(),
        boundaryContext: {
          intentBoundary: { quality: stableQuality, projectionFingerprint },
          readinessBoundary: {
            evidenceQuality: stableQuality,
            intentQuality: stableQuality,
            learningQuality: stableQuality,
            projectionFingerprint,
            decisionSource: buildDecisionSourceSummary(),
          },
          projectionFingerprintMatch: true,
        },
        workflow: {
          boundaryContext: {
            intentBoundary: { quality: stableQuality },
            readinessBoundary: {
              evidenceQuality: stableQuality,
              intentQuality: stableQuality,
              learningQuality: stableQuality,
              decisionSource: buildDecisionSourceSummary(),
            },
          },
        },
        workflowAudit: { ok: true },
      },
      boundedMigrationResult: {
        ok: true,
        statusId: 'ready',
        boundaryContext: {
          workflowBoundary: {
            quality: stableQuality,
            projectionFingerprint,
            decisionSource: buildDecisionSourceSummary(),
          },
          projectionFingerprintMatch: true,
        },
        migrationAudit: { ok: true },
      },
    });

    const missingSourceChain = buildChain();
    missingSourceChain.boundedWorkflowResult.decisionSourceAdmission = null;
    const missingSourceAudit = buildPolicyEngineBoundedChainCompletionAudit({
      chain: missingSourceChain,
    });

    expect(missingSourceAudit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_DECISION_SOURCE_MISSING,
      }),
    ]));

    const invalidSourceChain = buildChain();
    invalidSourceChain.boundedMigrationResult.boundaryContext
      .workflowBoundary.decisionSource.admitted = false;
    const invalidSourceAudit = buildPolicyEngineBoundedChainCompletionAudit({
      chain: invalidSourceChain,
    });

    expect(invalidSourceAudit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_DECISION_SOURCE_INVALID,
      }),
    ]));

    const mismatchedSourceChain = buildChain();
    mismatchedSourceChain.boundedMigrationResult.boundaryContext
      .workflowBoundary.decisionSource = {
        sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.LIBRARY_REBUILD,
        decisionVersion: 'policy.library_rebuild_readiness_summary.v1',
        admitted: true,
      };
    const mismatchedSourceAudit = buildPolicyEngineBoundedChainCompletionAudit({
      chain: mismatchedSourceChain,
    });

    expect(mismatchedSourceAudit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_DECISION_SOURCE_MISMATCH,
      }),
    ]));
  });

  test('rejects bounded chain quality gaps, insufficient quality, and quality drift', () => {
    const stableFingerprint = 'c'.repeat(64);
    const projectionFingerprint = {
      fingerprint: stableFingerprint,
    };
    const mismatchedQuality = {
      ...stableQuality,
      statusId: POLICY_EVIDENCE_QUALITY_STATUS_IDS.NEEDS_REVIEW,
      nextActionId: 'review_evidence',
      reasonIds: [
        'review_evidence_present',
      ],
    };
    const audit = buildPolicyEngineBoundedChainCompletionAudit({
      chain: {
        boundedEvidenceResult: {
          ok: true,
          statusId: 'ready',
          projection: {
            quality: insufficientQuality,
          },
          projectionFingerprint,
          projectionAudit: {
            ok: true,
          },
          projectionFingerprintAudit: {
            ok: true,
          },
        },
        boundedIntentResult: {
          ok: true,
          statusId: 'ready',
          evidenceBoundary: {
            quality: stableQuality,
            projectionFingerprint,
          },
          intentAudit: {
            ok: true,
          },
          evidenceFingerprintAudit: {
            ok: true,
          },
        },
        boundedLearningResult: {
          ok: true,
          statusId: 'ready',
          intentBoundary: {
            evidenceBoundary: {
              quality: null,
              projectionFingerprint,
            },
          },
          learningAudit: {
            ok: true,
          },
        },
        boundedReadinessResult: {
          ok: true,
          statusId: 'ready',
          boundaryContext: {
            evidenceBoundary: {
              quality: stableQuality,
              projectionFingerprint,
            },
            intentBoundary: {
              quality: mismatchedQuality,
            },
            learningBoundary: {
              quality: stableQuality,
            },
            projectionFingerprintMatch: true,
          },
          readinessAudit: {
            ok: true,
          },
        },
        boundedWorkflowResult: {
          ok: true,
          statusId: 'ready',
          boundaryContext: {
            intentBoundary: {
              quality: stableQuality,
              projectionFingerprint,
            },
            readinessBoundary: {
              evidenceQuality: stableQuality,
              intentQuality: stableQuality,
              learningQuality: stableQuality,
              projectionFingerprint,
            },
            projectionFingerprintMatch: true,
          },
          workflow: {
            boundaryContext: {
              intentBoundary: {
                quality: stableQuality,
              },
              readinessBoundary: {
                evidenceQuality: stableQuality,
                intentQuality: stableQuality,
                learningQuality: stableQuality,
              },
            },
          },
          workflowAudit: {
            ok: true,
          },
        },
        boundedMigrationResult: {
          ok: true,
          statusId: 'ready',
          boundaryContext: {
            workflowBoundary: {
              quality: stableQuality,
              projectionFingerprint,
            },
            projectionFingerprintMatch: true,
          },
          migrationAudit: {
            ok: true,
          },
        },
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.sharedProjectionFingerprint).toBe(stableFingerprint);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_MISSING,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_INSUFFICIENT,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.BOUNDED_CHAIN_QUALITY_MISMATCH,
      }),
    ]));
  });

  test('rejects component records that have no path evidence or failed audit', () => {
    const result = validatePolicyEngineComponentCompletion({
      id: POLICY_ENGINE_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE,
      label: 'Evidence engine',
      docPath: 'missing-doc.md',
      servicePath: 'missing-service.mjs',
      testPath: 'missing-test.mjs',
      expectedNextStepId: 'wrong_next_step',
    }, {
      pathExists: () => false,
      componentAuditMap: {
        [POLICY_ENGINE_COMPLETION_COMPONENT_IDS.EVIDENCE_ENGINE]: {
          ok: false,
          issueCount: 1,
          nextStep: {
            stepId: 'intent_inference',
          },
        },
      },
    });

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.MISSING_EVIDENCE,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.ARTIFACT_PATH_NOT_FOUND,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.COMPONENT_AUDIT_FAILED,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.NEXT_STEP_MISMATCH,
      }),
    ]));
  });

  test('rejects missing legacy cutline decisions and premature native storage migration', () => {
    const migrationPlan = buildPolicyMigrationDeletionPlan();
    const artifacts = migrationPlan.artifacts
      .filter(artifact =>
        artifact.path !== 'client/src/components/policies/PolicyIntentImpactPreviewCard.vue' &&
        artifact.decisionId !== POLICY_MIGRATION_ARTIFACT_DECISION_IDS.NATIVE_STORAGE_BLOCKER
      );
    const audit = buildPolicyEngineArtifactInventoryCutlineAudit({
      artifacts,
    });

    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.LEGACY_ARTIFACT_WITHOUT_CUTLINE,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.NATIVE_STORAGE_NOT_BLOCKED,
      }),
    ]));
  });

  test('rejects legacy diagnostic artifacts still allowed in normal workflow', () => {
    const artifacts = listPolicyMigrationDeletionArtifacts().map(artifact =>
      artifact.path === 'client/src/components/policies/PolicyIntentReplayPreviewCard.vue'
        ? { ...artifact, normalWorkflowAllowed: true }
        : artifact
    );
    const audit = buildPolicyEngineArtifactInventoryCutlineAudit({
      artifacts,
    });

    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_ENGINE_COMPLETION_RISK_IDS.LEGACY_ARTIFACT_ALLOWED_IN_NORMAL_WORKFLOW,
      }),
    ]));
  });
});
