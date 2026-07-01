import {
  PHASE8R_CONVERSION_ACTOR_SOURCE_IDS,
} from '../../services/policyBuilderPhase8ExplicitConversionWorkflow.mjs';
import {
  PHASE8R_ROLLBACK_AUDIT_RISK_IDS,
  PHASE8R_ROLLBACK_PAYLOAD_SECTION_IDS,
  PHASE8R_ROLLBACK_STATUS_IDS,
  buildPolicyBuilderPhase8RollbackSnapshotWindow,
  buildPolicyBuilderPhase8RollbackSnapshotWindowAudit,
  validatePolicyBuilderPhase8RollbackSnapshotWindow,
} from '../../services/policyBuilderPhase8RollbackSnapshotWindow.mjs';

function policy(overrides = {}) {
  return {
    id: 44,
    intent_id: 101,
    library_id: 6,
    library_name: 'Animated Movies',
    library_media_type: 'movie',
    arr_type: 'radarr',
    arr_config_id: 1,
    arr_root_folder_id: 10,
    arr_root_folder_path: '/media/Plexmedia/Animated Movies',
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    require_ai_validation: true,
    trust_patterns: true,
    trust_rag: true,
    trust_history: false,
    combination_mode: 'best_match',
    customSignals: {
      genres: {
        require_any: ['Animation'],
      },
    },
    presets: [
      {
        id: 7,
        key: 'animation',
        weight: 1.25,
        custom_signals: {
          genres: {
            boost: ['Family'],
          },
        },
      },
    ],
    ...overrides,
  };
}

function action(overrides = {}) {
  return {
    actorSourceId: PHASE8R_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
    actorId: 'admin:1',
    reasonCode: 'phase8r_native_intent_conversion',
    reason: 'operator accepted native intent conversion',
    ...overrides,
  };
}

describe('policyBuilderPhase8RollbackSnapshotWindow', () => {
  test('plans a bounded rollback snapshot with all required restore sections', () => {
    const windowPlan = buildPolicyBuilderPhase8RollbackSnapshotWindow({
      policy: policy(),
      action: action(),
      targetVersion: 2,
      now: '2026-06-01T00:00:00.000Z',
      rollbackWindowDays: 14,
    });
    const sectionIds = windowPlan.snapshot.payloadSections.map(section => section.sectionId);

    expect(windowPlan.validation.ok).toBe(true);
    expect(windowPlan.statusId).toBe(PHASE8R_ROLLBACK_STATUS_IDS.REVERT_READY);
    expect(windowPlan.snapshot).toEqual(expect.objectContaining({
      policyId: 44,
      intentId: 101,
      snapshotVersion: 2,
      restorePath: 'phase8r/rollback/policies/44/v2',
      expiresAt: '2026-06-15T00:00:00.000Z',
      rollbackWindowDays: 14,
      payloadRedactedForReports: true,
      rawPayloadExposed: false,
      permanentAlternateStorage: false,
    }));
    expect(sectionIds).toEqual(expect.arrayContaining(Object.values(
      PHASE8R_ROLLBACK_PAYLOAD_SECTION_IDS
    )));
    expect(windowPlan.snapshot.payloadSections.find(section =>
      section.sectionId === PHASE8R_ROLLBACK_PAYLOAD_SECTION_IDS.CUSTOM_SIGNALS
    )).toEqual(expect.objectContaining({
      restoreRequired: true,
      reportRedacted: true,
      summary: expect.objectContaining({
        directSignalTypeCount: 1,
        presetSignalSetCount: 1,
        rawPayloadSuppressedFromReport: true,
      }),
    }));
    expect(windowPlan.sideEffects).toEqual({
      rollbackSnapshotWritten: false,
      policyRestored: false,
      bulkPayloadDeleted: false,
      migrationEventWritten: false,
      legacyRowsChanged: false,
    });
    expect(windowPlan.nextPhase).toEqual(expect.objectContaining({
      phaseId: '8r_6',
    }));
  });

  test('blocks ordinary read or unrelated save actors from revert eligibility', () => {
    const windowPlan = buildPolicyBuilderPhase8RollbackSnapshotWindow({
      policy: policy(),
      action: action({
        actorSourceId: PHASE8R_CONVERSION_ACTOR_SOURCE_IDS.ORDINARY_POLICY_READ,
      }),
      now: '2026-06-01T00:00:00.000Z',
    });
    const riskIds = windowPlan.validation.issues.map(issue => issue.riskId);

    expect(windowPlan.statusId).toBe(PHASE8R_ROLLBACK_STATUS_IDS.SNAPSHOT_BLOCKED);
    expect(windowPlan.revert).toEqual(expect.objectContaining({
      eligible: false,
      blockedReason: 'actor_source_not_allowed',
      blockedOrdinaryActor: true,
    }));
    expect(riskIds).toContain(PHASE8R_ROLLBACK_AUDIT_RISK_IDS.UNKNOWN_ACTOR_SOURCE);
  });

  test('marks expired snapshots as cleanup due and blocks revert after expiry', () => {
    const windowPlan = buildPolicyBuilderPhase8RollbackSnapshotWindow({
      policy: policy(),
      action: action(),
      now: '2026-06-20T00:00:00.000Z',
      snapshot: {
        expiresAt: '2026-06-15T00:00:00.000Z',
        bulkPayloadDeleted: false,
      },
    });

    expect(windowPlan.validation.ok).toBe(true);
    expect(windowPlan.statusId).toBe(PHASE8R_ROLLBACK_STATUS_IDS.RETENTION_CLEANUP_DUE);
    expect(windowPlan.revert).toEqual(expect.objectContaining({
      eligible: false,
      blockedReason: 'rollback_window_expired',
    }));
    expect(windowPlan.retention).toEqual(expect.objectContaining({
      retentionDue: true,
      deleteBulkyPayloadAfterExpiry: true,
      retainBulkPayloadAfterExpiry: false,
    }));
    expect(windowPlan.retention.minimalAuditMetadataFields).toEqual(expect.arrayContaining([
      'policy_id',
      'intent_id',
      'expires_at',
      'payload_digest',
    ]));
  });

  test('validation rejects unbounded permanent snapshots, raw payload exposure, and side effects', () => {
    const windowPlan = buildPolicyBuilderPhase8RollbackSnapshotWindow({
      policy: policy(),
      action: action(),
      now: '2026-06-01T00:00:00.000Z',
    });
    const weakened = {
      ...windowPlan,
      snapshot: {
        ...windowPlan.snapshot,
        expiresAt: null,
        permanentAlternateStorage: true,
        rawPayloadExposed: true,
        payloadRedactedForReports: false,
        payloadSections: windowPlan.snapshot.payloadSections.filter(section =>
          section.sectionId !== PHASE8R_ROLLBACK_PAYLOAD_SECTION_IDS.THRESHOLDS
        ),
      },
      revert: {
        ...windowPlan.revert,
        eligible: true,
        blockedOrdinaryActor: true,
      },
      retention: {
        ...windowPlan.retention,
        windowDays: 0,
        postWindowActionId: null,
        deleteBulkyPayloadAfterExpiry: false,
        retainBulkPayloadAfterExpiry: true,
        minimalAuditMetadataFields: [],
      },
      sideEffects: {
        ...windowPlan.sideEffects,
        policyRestored: true,
      },
    };
    const riskIds = validatePolicyBuilderPhase8RollbackSnapshotWindow(weakened)
      .issues
      .map(issue => issue.riskId);

    expect(riskIds).toEqual(expect.arrayContaining([
      PHASE8R_ROLLBACK_AUDIT_RISK_IDS.MISSING_SNAPSHOT_SECTION,
      PHASE8R_ROLLBACK_AUDIT_RISK_IDS.UNBOUNDED_SNAPSHOT_WINDOW,
      PHASE8R_ROLLBACK_AUDIT_RISK_IDS.SNAPSHOT_PERMANENT_ALTERNATE_STORAGE,
      PHASE8R_ROLLBACK_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      PHASE8R_ROLLBACK_AUDIT_RISK_IDS.ORDINARY_READ_WRITE_REVERT,
      PHASE8R_ROLLBACK_AUDIT_RISK_IDS.MISSING_RETENTION_POLICY,
      PHASE8R_ROLLBACK_AUDIT_RISK_IDS.BULKY_PAYLOAD_RETAINED_AFTER_EXPIRY,
      PHASE8R_ROLLBACK_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });

  test('audits cleanly and points to legacy write path shutdown next', () => {
    const windowPlan = buildPolicyBuilderPhase8RollbackSnapshotWindow({
      policy: policy(),
      action: action(),
      now: '2026-06-01T00:00:00.000Z',
    });
    const audit = buildPolicyBuilderPhase8RollbackSnapshotWindowAudit(windowPlan);

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      policyId: 44,
      intentId: 101,
      snapshotSectionCount: Object.values(PHASE8R_ROLLBACK_PAYLOAD_SECTION_IDS).length,
      rollbackWindowDays: 14,
      revertEligible: true,
      retentionDue: false,
      nextPhase: expect.objectContaining({
        phaseId: '8r_6',
      }),
    }));
  });
});
