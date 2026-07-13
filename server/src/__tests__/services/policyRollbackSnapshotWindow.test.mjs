import {
  POLICY_CONVERSION_ACTOR_SOURCE_IDS,
} from '../../services/policyConversionActorSources.mjs';
import {
  POLICY_ROLLBACK_SNAPSHOT_WINDOW_VERSION,
  POLICY_ROLLBACK_AUDIT_RISK_IDS,
  POLICY_ROLLBACK_PAYLOAD_SECTION_IDS,
  POLICY_ROLLBACK_STATUS_IDS,
  buildPolicyRollbackSnapshotWindow,
  buildPolicyRollbackSnapshotWindowAudit,
  validatePolicyRollbackSnapshotWindow,
} from '../../services/policyRollbackSnapshotWindow.mjs';

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
    actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
    actorId: 'admin:1',
    reasonCode: 'native_intent_conversion',
    reason: 'operator accepted native intent conversion',
    ...overrides,
  };
}

describe('policyRollbackSnapshotWindow', () => {
  test('plans a bounded rollback snapshot with all required restore sections', () => {
    const windowPlan = buildPolicyRollbackSnapshotWindow({
      policy: policy(),
      action: action(),
      targetVersion: 2,
      now: '2026-06-01T00:00:00.000Z',
      rollbackWindowDays: 14,
    });
    const sectionIds = windowPlan.snapshot.payloadSections.map(section => section.sectionId);

    expect(windowPlan.validation.ok).toBe(true);
    expect(windowPlan.version).toBe(POLICY_ROLLBACK_SNAPSHOT_WINDOW_VERSION);
    expect(windowPlan.statusId).toBe(POLICY_ROLLBACK_STATUS_IDS.REVERT_READY);
    expect(windowPlan.snapshot).toEqual(expect.objectContaining({
      policyId: 44,
      intentId: 101,
      snapshotVersion: 2,
      restorePath: 'policy/rollback/policies/44/v2',
      expiresAt: '2026-06-15T00:00:00.000Z',
      rollbackWindowDays: 14,
      payloadRedactedForReports: true,
      rawPayloadExposed: false,
      permanentAlternateStorage: false,
    }));
    expect(sectionIds).toEqual(expect.arrayContaining(Object.values(
      POLICY_ROLLBACK_PAYLOAD_SECTION_IDS
    )));
    expect(windowPlan.snapshot.payloadSections.find(section =>
      section.sectionId === POLICY_ROLLBACK_PAYLOAD_SECTION_IDS.CUSTOM_SIGNALS
    )).toEqual(expect.objectContaining({
      restoreRequired: true,
      reportRedacted: true,
      summary: expect.objectContaining({
        directSignalTypeCount: 1,
        presetSignalSetCount: 1,
        rawPayloadSuppressedFromReport: true,
      }),
    }));
    expect(windowPlan.snapshot.payloadSections.find(section =>
      section.sectionId === POLICY_ROLLBACK_PAYLOAD_SECTION_IDS.MIGRATION_ACTOR
    )).toEqual(expect.objectContaining({
      reportRedacted: true,
      summary: expect.objectContaining({
        actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
        actorIdPresent: true,
      }),
    }));
    expect(windowPlan.snapshot.payloadSections.find(section =>
      section.sectionId === POLICY_ROLLBACK_PAYLOAD_SECTION_IDS.MIGRATION_REASON
    )).toEqual(expect.objectContaining({
      reportRedacted: true,
      summary: expect.objectContaining({
        reasonCode: 'native_intent_conversion',
        reasonProvided: true,
      }),
    }));
    expect(JSON.stringify(windowPlan)).not.toContain('admin:1');
    expect(JSON.stringify(windowPlan)).not.toContain('operator accepted native intent conversion');
    expect(windowPlan.sideEffects).toEqual({
      rollbackSnapshotWritten: false,
      policyRestored: false,
      bulkPayloadDeleted: false,
      migrationEventWritten: false,
      legacyRowsChanged: false,
    });
    expect(windowPlan.revert.idempotencyKey).toBe('policy:rollback:44:v2');
    expect(windowPlan.nextStep).toEqual(expect.objectContaining({
      stepId: 'legacy_write_path_shutdown',
    }));
    expect(windowPlan.nextPhase).toBeUndefined();
  });

  test('blocks ordinary read or unrelated save actors from revert eligibility', () => {
    const windowPlan = buildPolicyRollbackSnapshotWindow({
      policy: policy(),
      action: action({
        actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.ORDINARY_POLICY_READ,
      }),
      now: '2026-06-01T00:00:00.000Z',
    });
    const riskIds = windowPlan.validation.issues.map(issue => issue.riskId);

    expect(windowPlan.statusId).toBe(POLICY_ROLLBACK_STATUS_IDS.SNAPSHOT_BLOCKED);
    expect(windowPlan.revert).toEqual(expect.objectContaining({
      eligible: false,
      blockedReason: 'actor_source_not_allowed',
      blockedOrdinaryActor: true,
    }));
    expect(riskIds).toContain(POLICY_ROLLBACK_AUDIT_RISK_IDS.UNKNOWN_ACTOR_SOURCE);
  });

  test('marks expired snapshots as cleanup due and blocks revert after expiry', () => {
    const windowPlan = buildPolicyRollbackSnapshotWindow({
      policy: policy(),
      action: action(),
      now: '2026-06-20T00:00:00.000Z',
      snapshot: {
        expiresAt: '2026-06-15T00:00:00.000Z',
        bulkPayloadDeleted: false,
      },
    });

    expect(windowPlan.validation.ok).toBe(true);
    expect(windowPlan.statusId).toBe(POLICY_ROLLBACK_STATUS_IDS.RETENTION_CLEANUP_DUE);
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
    const windowPlan = buildPolicyRollbackSnapshotWindow({
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
          section.sectionId !== POLICY_ROLLBACK_PAYLOAD_SECTION_IDS.THRESHOLDS
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
    const riskIds = validatePolicyRollbackSnapshotWindow(weakened)
      .issues
      .map(issue => issue.riskId);

    expect(riskIds).toEqual(expect.arrayContaining([
      POLICY_ROLLBACK_AUDIT_RISK_IDS.MISSING_SNAPSHOT_SECTION,
      POLICY_ROLLBACK_AUDIT_RISK_IDS.UNBOUNDED_SNAPSHOT_WINDOW,
      POLICY_ROLLBACK_AUDIT_RISK_IDS.SNAPSHOT_PERMANENT_ALTERNATE_STORAGE,
      POLICY_ROLLBACK_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      POLICY_ROLLBACK_AUDIT_RISK_IDS.ORDINARY_READ_WRITE_REVERT,
      POLICY_ROLLBACK_AUDIT_RISK_IDS.MISSING_RETENTION_POLICY,
      POLICY_ROLLBACK_AUDIT_RISK_IDS.BULKY_PAYLOAD_RETAINED_AFTER_EXPIRY,
      POLICY_ROLLBACK_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });

  test('audits cleanly and points to legacy write path shutdown next', () => {
    const windowPlan = buildPolicyRollbackSnapshotWindow({
      policy: policy(),
      action: action(),
      now: '2026-06-01T00:00:00.000Z',
    });
    const audit = buildPolicyRollbackSnapshotWindowAudit(windowPlan);

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      policyId: 44,
      intentId: 101,
      snapshotSectionCount: Object.values(POLICY_ROLLBACK_PAYLOAD_SECTION_IDS).length,
      rollbackWindowDays: 14,
      revertEligible: true,
      retentionDue: false,
      nextStep: expect.objectContaining({
        stepId: 'legacy_write_path_shutdown',
      }),
    }));
    expect(audit.nextPhase).toBeUndefined();
  });
});
