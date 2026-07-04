import {
  POLICY_MIGRATION_VERIFIER_STATUS_IDS,
} from '../../services/policyMigrationVerifierRollback.mjs';
import {
  buildPolicyBuilderPhase8MigrationCandidateReport,
} from '../../services/policyBuilderPhase8MigrationCandidateReport.mjs';
import {
  PHASE8R_CONVERSION_ACTOR_SOURCE_IDS,
  PHASE8R_CONVERSION_AUDIT_RISK_IDS,
  PHASE8R_CONVERSION_REASON_IDS,
  PHASE8R_CONVERSION_STEP_STATUS_IDS,
  buildPolicyBuilderPhase8ExplicitConversionWorkflow,
  buildPolicyBuilderPhase8ExplicitConversionWorkflowAudit,
  validatePolicyBuilderPhase8ExplicitConversionWorkflow,
} from '../../services/policyBuilderPhase8ExplicitConversionWorkflow.mjs';
import {
  POLICY_NATIVE_SCHEMA_TABLE_IDS,
} from '../../services/policyNativeSchemaContract.mjs';

function preset(overrides = {}) {
  return {
    id: 7,
    key: 'family',
    name: 'Family',
    source: 'builtin',
    weight: 1,
    signals: {
      genres: { require_any: ['Family'] },
    },
    custom_signals: null,
    ...overrides,
  };
}

function policy(overrides = {}) {
  return {
    id: 14,
    library_id: 4,
    library_name: 'Movies',
    name: 'Movies Policy',
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    require_ai_validation: true,
    trust_patterns: true,
    trust_rag: true,
    trust_history: true,
    combination_mode: 'best_match',
    presets: [preset()],
    routingTarget: {
      arr_type: 'radarr',
      arr_config_id: 1,
      arr_root_folder_path: '/media/Movies',
    },
    profileFreshness: {
      state: 'fresh',
      stale: false,
    },
    ...overrides,
  };
}

function readyReport(overrides = {}) {
  return buildPolicyBuilderPhase8MigrationCandidateReport({
    policies: [policy(overrides)],
  });
}

describe('policyBuilderPhase8ExplicitConversionWorkflow', () => {
  test('plans selected ready policies with rollback, native records, migration event, and idempotency key', () => {
    const workflow = buildPolicyBuilderPhase8ExplicitConversionWorkflow({
      candidateReport: readyReport(),
      selectedPolicyIds: [14],
      action: {
        actorSourceId: PHASE8R_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
        actorId: 3,
      },
      targetVersion: 2,
      now: '2026-06-01T00:00:00.000Z',
    });
    const [step] = workflow.steps;

    expect(workflow.validation.ok).toBe(true);
    expect(workflow.mode).toBe('plan_only');
    expect(step).toEqual(expect.objectContaining({
      policyId: 14,
      statusId: PHASE8R_CONVERSION_STEP_STATUS_IDS.READY_TO_APPLY,
      readyToApply: true,
      idempotencyKey: 'phase8r:convert:14:v2',
      legacyBehaviorRetainedUntilCommit: true,
    }));
    expect(step.rollbackSnapshot).toEqual(expect.objectContaining({
      planned: true,
      tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS,
      restorePath: 'policy/rollback/policies/14/v2',
      expiresAt: '2026-06-15T00:00:00.000Z',
      retentionWindowDays: 14,
    }));
    expect(step.migrationEvent).toEqual(expect.objectContaining({
      planned: true,
      tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_MIGRATION_EVENTS,
      actorSourceId: PHASE8R_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
    }));
    expect(step.nativeRecords.map(record => record.tableId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS,
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES,
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROUTING_TARGETS,
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_TEMPLATE_APPLICATIONS,
      POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_VALIDATION_STATUS,
    ]));
    expect(step.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: PHASE8R_CONVERSION_REASON_IDS.SERVER_VALIDATION_REQUIRED,
      }),
      expect.objectContaining({
        reasonId: PHASE8R_CONVERSION_REASON_IDS.ROLLBACK_SNAPSHOT_PLANNED,
      }),
      expect.objectContaining({
        reasonId: PHASE8R_CONVERSION_REASON_IDS.MIGRATION_EVENT_PLANNED,
      }),
      expect.objectContaining({
        reasonId: PHASE8R_CONVERSION_REASON_IDS.LEGACY_BEHAVIOR_RETAINED_UNTIL_COMMIT,
      }),
    ]));
    expect(workflow.sideEffects).toEqual({
      policyStorageMutated: false,
      nativeRowsInserted: false,
      migrationEventsWritten: false,
      rollbackSnapshotsWritten: false,
      legacyPathsDeleted: false,
    });
  });

  test('blocks conversion from ordinary reads or unrelated saves', () => {
    const readWorkflow = buildPolicyBuilderPhase8ExplicitConversionWorkflow({
      candidateReport: readyReport(),
      selectedPolicyIds: [14],
      action: {
        actorSourceId: PHASE8R_CONVERSION_ACTOR_SOURCE_IDS.ORDINARY_POLICY_READ,
      },
    });
    const saveWorkflow = buildPolicyBuilderPhase8ExplicitConversionWorkflow({
      candidateReport: readyReport(),
      selectedPolicyIds: [14],
      action: {
        actorSourceId: PHASE8R_CONVERSION_ACTOR_SOURCE_IDS.UNRELATED_POLICY_SAVE,
      },
    });

    expect(readWorkflow.steps[0].statusId)
      .toBe(PHASE8R_CONVERSION_STEP_STATUS_IDS.BLOCKED_BY_ACTOR_SOURCE);
    expect(readWorkflow.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_CONVERSION_AUDIT_RISK_IDS.ORDINARY_READ_OR_SAVE_CONVERSION,
      }),
    ]));
    expect(saveWorkflow.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_CONVERSION_AUDIT_RISK_IDS.ORDINARY_READ_OR_SAVE_CONVERSION,
      }),
    ]));
  });

  test('blocks selected policies that are not ready in the candidate report', () => {
    const candidateReport = buildPolicyBuilderPhase8MigrationCandidateReport({
      policies: [
        policy({
          routingTarget: {},
        }),
      ],
    });
    const workflow = buildPolicyBuilderPhase8ExplicitConversionWorkflow({
      candidateReport,
      selectedPolicyIds: [14],
      action: {
        actorSourceId: PHASE8R_CONVERSION_ACTOR_SOURCE_IDS.POST_UPGRADE_APPLY,
      },
    });

    expect(workflow.validation.ok).toBe(true);
    expect(workflow.steps[0]).toEqual(expect.objectContaining({
      statusId: PHASE8R_CONVERSION_STEP_STATUS_IDS.BLOCKED_BY_CANDIDATE_STATUS,
      readyToApply: false,
      candidateStatusId: 'missing_routing_target',
    }));
  });

  test('requires Phase 7R verifier output for behavior-sensitive policies', () => {
    const missingVerifier = buildPolicyBuilderPhase8ExplicitConversionWorkflow({
      candidateReport: readyReport(),
      selectedPolicyIds: [14],
      behaviorSensitivePolicyIds: [14],
      action: {
        actorSourceId: PHASE8R_CONVERSION_ACTOR_SOURCE_IDS.MAINTAINER_MIGRATION_TOOL,
      },
    });
    const passedVerifier = buildPolicyBuilderPhase8ExplicitConversionWorkflow({
      candidateReport: readyReport(),
      selectedPolicyIds: [14],
      behaviorSensitivePolicyIds: [14],
      verifierReports: [
        {
          policyId: 14,
          statusId: POLICY_MIGRATION_VERIFIER_STATUS_IDS.NO_MIGRATION_DIFFERENCES,
        },
      ],
      action: {
        actorSourceId: PHASE8R_CONVERSION_ACTOR_SOURCE_IDS.MAINTAINER_MIGRATION_TOOL,
      },
    });

    expect(missingVerifier.validation.ok).toBe(true);
    expect(missingVerifier.steps[0].statusId)
      .toBe(PHASE8R_CONVERSION_STEP_STATUS_IDS.BLOCKED_BY_VERIFIER);
    expect(passedVerifier.validation.ok).toBe(true);
    expect(passedVerifier.steps[0].statusId)
      .toBe(PHASE8R_CONVERSION_STEP_STATUS_IDS.READY_TO_APPLY);
    expect(passedVerifier.steps[0].verifierStatusId)
      .toBe(POLICY_MIGRATION_VERIFIER_STATUS_IDS.NO_MIGRATION_DIFFERENCES);
  });

  test('requires rollback snapshot planning before ready conversion', () => {
    const workflow = buildPolicyBuilderPhase8ExplicitConversionWorkflow({
      candidateReport: readyReport(),
      selectedPolicyIds: [14],
      rollbackSnapshot: {
        planned: false,
      },
      action: {
        actorSourceId: PHASE8R_CONVERSION_ACTOR_SOURCE_IDS.TEST_FIXTURE,
      },
    });

    expect(workflow.validation.ok).toBe(true);
    expect(workflow.steps[0]).toEqual(expect.objectContaining({
      statusId: PHASE8R_CONVERSION_STEP_STATUS_IDS.BLOCKED_BY_ROLLBACK_SNAPSHOT,
      readyToApply: false,
    }));
  });

  test('validation rejects weakened ready steps and conversion side effects', () => {
    const workflow = buildPolicyBuilderPhase8ExplicitConversionWorkflow({
      candidateReport: readyReport(),
      selectedPolicyIds: [14],
      action: {
        actorSourceId: PHASE8R_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
      },
    });
    const weakened = {
      ...workflow,
      sideEffects: {
        ...workflow.sideEffects,
        nativeRowsInserted: true,
      },
      steps: workflow.steps.map(step => ({
        ...step,
        rollbackSnapshot: {
          ...step.rollbackSnapshot,
          planned: false,
        },
        migrationEvent: {
          ...step.migrationEvent,
          planned: false,
        },
        nativeRecords: [],
        idempotencyKey: '',
        legacyBehaviorRetainedUntilCommit: false,
        reasons: step.reasons.filter(reason =>
          reason.reasonId !== PHASE8R_CONVERSION_REASON_IDS.SERVER_VALIDATION_REQUIRED
        ),
      })),
    };
    const validation = validatePolicyBuilderPhase8ExplicitConversionWorkflow(weakened);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_CONVERSION_AUDIT_RISK_IDS.READY_STEP_WITHOUT_SERVER_VALIDATION,
      }),
      expect.objectContaining({
        riskId: PHASE8R_CONVERSION_AUDIT_RISK_IDS.READY_STEP_WITHOUT_ROLLBACK,
      }),
      expect.objectContaining({
        riskId: PHASE8R_CONVERSION_AUDIT_RISK_IDS.READY_STEP_WITHOUT_MIGRATION_EVENT,
      }),
      expect.objectContaining({
        riskId: PHASE8R_CONVERSION_AUDIT_RISK_IDS.READY_STEP_WITHOUT_NATIVE_RECORDS,
      }),
      expect.objectContaining({
        riskId: PHASE8R_CONVERSION_AUDIT_RISK_IDS.MISSING_IDEMPOTENCY_KEY,
      }),
      expect.objectContaining({
        riskId: PHASE8R_CONVERSION_AUDIT_RISK_IDS.FAILED_CONVERSION_MUTATES_LEGACY,
      }),
      expect.objectContaining({
        riskId: PHASE8R_CONVERSION_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
      }),
    ]));
  });

  test('audits cleanly and points to native runtime read path', () => {
    const workflow = buildPolicyBuilderPhase8ExplicitConversionWorkflow({
      candidateReport: readyReport(),
      selectedPolicyIds: [14],
      action: {
        actorSourceId: PHASE8R_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
      },
    });
    const audit = buildPolicyBuilderPhase8ExplicitConversionWorkflowAudit(workflow);

    expect(validatePolicyBuilderPhase8ExplicitConversionWorkflow(workflow).ok).toBe(true);
    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      readyToApplyCount: 1,
      nextPhase: expect.objectContaining({
        phaseId: '8r_4',
      }),
    }));
  });
});
