import { jest } from '@jest/globals';
import {
  POLICY_COMPATIBILITY_DELETION_COVERAGE_IDS,
  POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS,
  buildPolicyCompatibilityDeletionGates,
} from '../../services/policyCompatibilityDeletionGates.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS,
  buildPolicyCompatibilityDeletionCurrentInventory,
} from '../../services/policyCompatibilityDeletionCurrentInventory.mjs';
import {
  buildPolicyCompatibilityDeletionReconciliationStateInventory,
} from '../../services/policyCompatibilityDeletionReconciliationStateInventory.mjs';
import {
  DEFAULT_MAX_EVIDENCE_AGE_MS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle,
  loadPolicyCompatibilityDeletionExecutionPlanEvidenceBundle,
  validatePolicyCompatibilityDeletionExecutionPlanEvidenceBundle,
} from '../../services/policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs';
import {
  buildPolicyNativeRuntimeCutoverVerification,
} from '../../services/policyNativeRuntimeCutoverVerification.mjs';
import {
  buildPolicyBackupRestoreVerificationEvidence,
} from '../../services/policyBackupRestoreVerificationEvidence.mjs';

const COLLECTION_TIME = '2026-07-14T20:00:00.000Z';

function buildCompleteCoverage() {
  return Object.fromEntries(
    Object.values(POLICY_COMPATIBILITY_DELETION_COVERAGE_IDS)
      .map(coverageId => [coverageId, true])
  );
}

function policy(overrides = {}) {
  return {
    id: 14,
    library_id: 4,
    library_name: 'Animated Movies',
    library_media_type: 'movie',
    name: 'Animated Policy',
    presets: [{
      id: 7,
      key: 'family',
      name: 'Family',
      signals: {
        genres: { require_any: ['Family'] },
      },
      custom_signals: null,
    }],
    ...overrides,
  };
}

function nativePolicy(overrides = {}) {
  return policy({
    native_intent: {
      active: true,
      intent_version: 2,
      contract: {
        schema_version: 1,
        policy_id: 14,
        library_id: 4,
        library_name: 'Animated Movies',
        library_media_type: 'movie',
        source: 'native_intent',
        inference_state: 'inferred',
        model: {
          mode: 'native_intent',
          intent_supported: true,
          native_intent: true,
          conversion_available: false,
        },
        purpose: [{
          intent_role: 'purpose',
          signal_type: 'genres',
          operator: 'require_any',
          values: { require_any: ['Animation'] },
          constraint_mode: 'advisory',
          semantics: 'identity',
          source: 'native_intent',
          inference_state: 'inferred',
        }],
        hard_limits: [],
        helpful_hints: [],
        avoid: [],
        review_behavior: {},
        template_links: [],
        warnings: [],
        unsupported_signals: [],
      },
    },
    ...overrides,
  });
}

function authoritativePolicy(policyId = 14) {
  return {
    policy_id: policyId,
    active_intent_count: 1,
    authoritative_native_intent_count: 1,
    active_intent_sources: ['native_intent'],
    active_intent_validation_statuses: ['valid'],
  };
}

function nativeIntentRow(overrides = {}) {
  return {
    id: 501,
    policy_id: 14,
    library_id: 4,
    schema_version: 1,
    intent_version: 2,
    active: true,
    source: 'native_intent',
    inference_state: 'inferred',
    review_behavior: {},
    validation_status: 'valid',
    purpose_rule_count: 1,
    ...overrides,
  };
}

function readyBackupRestoreEvidence({ generatedAt = COLLECTION_TIME } = {}) {
  return buildPolicyBackupRestoreVerificationEvidence({
    record: {
      verification_version: 1,
      restore_mode: 'replace',
      backup_version: '2.0',
      verification_status: 'verified',
      schema_parity_verified: true,
      native_authority_verified: true,
      policy_library_mismatch_count: 0,
      verified_at: generatedAt,
      restore_gate_state: 'ready',
      restore_gate_reason_id: 'restore_verified',
      restore_gate_verified_at: generatedAt,
    },
    generatedAt,
  });
}

function createLiveRuntimeEvidenceDbClient() {
  return {
    query: jest.fn(async query => {
      if (query === 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY') {
        return { rows: [] };
      }
      if (query.includes('WITH active_intent_counts')) {
        return {
          rows: [{
            policy_id: 14,
            native_intent_id: 501,
            rollback_snapshot_id: 901,
            rollback_payload_redacted: false,
            rollback_restored_at: null,
            rollback_expires_at: '2026-08-01T12:00:00.000Z',
          }],
        };
      }
      if (query.includes('FROM policy_backup_restore_verifications verification')) {
        return {
          rows: [{
            verification_version: 1,
            restore_mode: 'replace',
            backup_version: '2.0',
            verification_status: 'verified',
            schema_parity_verified: true,
            native_authority_verified: true,
            policy_library_mismatch_count: 0,
            verified_at: COLLECTION_TIME,
            restore_gate_state: 'ready',
            restore_gate_reason_id: 'restore_verified',
            restore_gate_verified_at: COLLECTION_TIME,
          }],
        };
      }
      if (query.includes('WITH active_intents')) {
        return { rows: [authoritativePolicy()] };
      }
      if (query.includes('policy_native_intent_reconciliation_states')) {
        return { rows: [{ requires_maintenance_state_count: 0 }] };
      }
      if (query.includes('FROM library_policies policy')) {
        return { rows: [policy()] };
      }
      if (query.includes('ranked_active_intents')) {
        return { rows: [nativeIntentRow()] };
      }
      if (query.includes('FROM policy_intent_rules')) {
        return {
          rows: [{
            intent_id: 501,
            intent_role: 'purpose',
            collection: 'purpose',
            signal_type: 'genres',
            operator: 'require_any',
            values: { require_any: ['Animation'] },
            constraint_mode: 'advisory',
            semantics: 'identity',
            source: 'native_intent',
            inference_state: 'inferred',
            sort_order: 0,
          }],
        };
      }
      if (query.includes('FROM policy_intent_template_applications')) {
        return { rows: [] };
      }
      if (query.includes('FROM policy_intent_validation_status')) {
        return { rows: [{ intent_id: 501, status: 'valid', error_count: 0, warning_count: 0 }] };
      }

      throw new Error(`Unexpected query: ${query}`);
    }),
  };
}

function readyInputs({ generatedAt = COLLECTION_TIME } = {}) {
  return {
    currentPolicyInventory: buildPolicyCompatibilityDeletionCurrentInventory({
      policyRows: [authoritativePolicy()],
      generatedAt,
    }),
    reconciliationStateInventory:
      buildPolicyCompatibilityDeletionReconciliationStateInventory({
        requiresMaintenanceStateCount: 0,
        generatedAt,
      }),
    cutoverVerification: buildPolicyNativeRuntimeCutoverVerification({
      convertedPolicy: nativePolicy(),
      unconvertedPolicy: policy({ id: 15 }),
      rollbackAvailable: true,
      legacyDeletionBlocked: true,
      supportDiagnosticsSafe: true,
      generatedAt,
    }),
    deletionGatePlan: buildPolicyCompatibilityDeletionGates({
      coverage: buildCompleteCoverage(),
      supportStanceId:
        POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS.UNSUPPORTED_AFTER_WINDOW,
      unconvertedPolicyCount: 0,
      requiresMaintenanceStateCount: 0,
      generatedAt,
    }),
    backupRestoreEvidence: readyBackupRestoreEvidence({ generatedAt }),
  };
}

function readyBundle(overrides = {}) {
  return buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle({
    ...readyInputs(),
    rollbackSupportVerified: true,
    supportDiagnosticsVerified: true,
    deletionManifestApproved: true,
    generatedAt: COLLECTION_TIME,
    now: COLLECTION_TIME,
    ...overrides,
  });
}

describe('policyCompatibilityDeletionExecutionPlanEvidenceBundle', () => {
  test('builds one current, side-effect-free evidence bundle for execution planning', () => {
    const bundle = readyBundle();

    expect(bundle.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS.READY);
    expect(bundle.readyForExecutionPlan).toBe(true);
    expect(bundle.validation.ok).toBe(true);
    expect(bundle.evidence).toEqual(expect.objectContaining({
      currentPolicyInventory: expect.objectContaining({
        generatedAt: COLLECTION_TIME,
        statusId: POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS
          .ALL_ENABLED_POLICIES_NATIVE,
      }),
      reconciliationStateInventory: expect.objectContaining({
        generatedAt: COLLECTION_TIME,
        requiresMaintenanceStateCount: 0,
      }),
      cutoverVerification: expect.objectContaining({ generatedAt: COLLECTION_TIME }),
      deletionGatePlan: expect.objectContaining({ generatedAt: COLLECTION_TIME }),
      backupRestoreEvidence: expect.objectContaining({
        generatedAt: COLLECTION_TIME,
        backupRestoreVerified: true,
      }),
    }));
    expect(bundle.deletionReadiness.currentPolicyInventory).toEqual(expect.objectContaining({
      generatedAt: COLLECTION_TIME,
      unconvertedPolicyCount: 0,
    }));
    expect(bundle.deletionGatePlan.unconvertedPolicyCount).toBe(0);
    expect(Object.values(bundle.sideEffects).some(Boolean)).toBe(false);
  });

  test('blocks evidence that was collected outside one bounded observation window', () => {
    const inputs = readyInputs();
    inputs.deletionGatePlan.generatedAt = '2026-07-14T19:59:00.000Z';

    const bundle = buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle({
      ...inputs,
      rollbackSupportVerified: true,
      supportDiagnosticsVerified: true,
      deletionManifestApproved: true,
      generatedAt: COLLECTION_TIME,
      now: COLLECTION_TIME,
    });

    expect(bundle.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS
        .BLOCKED_BY_EVIDENCE_FRESHNESS);
    expect(bundle.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
          .EVIDENCE_TIMESTAMP_MISMATCH,
        evidenceType: 'deletionGatePlan',
      }),
    ]));
  });

  test('blocks stale evidence instead of treating an old ready report as current', () => {
    const staleTime = '2026-07-14T19:54:59.999Z';
    const bundle = buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle({
      ...readyInputs({ generatedAt: staleTime }),
      rollbackSupportVerified: true,
      supportDiagnosticsVerified: true,
      deletionManifestApproved: true,
      generatedAt: staleTime,
      now: COLLECTION_TIME,
    });

    expect(bundle.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS
        .BLOCKED_BY_EVIDENCE_FRESHNESS);
    expect(bundle.risks.filter(risk => (
      risk.riskId === POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .EVIDENCE_TIMESTAMP_STALE
    ))).toHaveLength(5);
    expect(bundle.freshness.maximumEvidenceAgeMs).toBe(DEFAULT_MAX_EVIDENCE_AGE_MS);
  });

  test('blocks a gate count that diverges from the current inventory', () => {
    const inputs = readyInputs();
    inputs.deletionGatePlan.unconvertedPolicyCount = 1;

    const bundle = buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle({
      ...inputs,
      rollbackSupportVerified: true,
      supportDiagnosticsVerified: true,
      deletionManifestApproved: true,
      generatedAt: COLLECTION_TIME,
      now: COLLECTION_TIME,
    });

    expect(bundle.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS
        .BLOCKED_BY_CURRENT_POLICY_INVENTORY);
    expect(bundle.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
          .INVENTORY_GATE_COUNT_MISMATCH,
      }),
    ]));
  });

  test('blocks a requires-maintenance count that diverges from current reconciliation state', () => {
    const inputs = readyInputs();
    inputs.deletionGatePlan.requiresMaintenanceStateCount = 1;

    const bundle = buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle({
      ...inputs,
      rollbackSupportVerified: true,
      supportDiagnosticsVerified: true,
      deletionManifestApproved: true,
      generatedAt: COLLECTION_TIME,
      now: COLLECTION_TIME,
    });

    expect(bundle.statusId).toBe(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS
        .BLOCKED_BY_RECONCILIATION_STATE_INVENTORY
    );
    expect(bundle.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
          .RECONCILIATION_STATE_GATE_COUNT_MISMATCH,
      }),
    ]));
  });

  test('collects the live enabled-policy inventory and derives gate counts from it', async () => {
    const transactionClient = createLiveRuntimeEvidenceDbClient();
    const dbClient = {
      query: jest.fn(),
      withTransaction: jest.fn(async callback => callback(transactionClient)),
    };

    const bundle = await loadPolicyCompatibilityDeletionExecutionPlanEvidenceBundle(dbClient, {
      coverage: buildCompleteCoverage(),
      rollbackSupportVerified: true,
      supportDiagnosticsVerified: true,
      deletionManifestApproved: true,
      now: COLLECTION_TIME,
    });

    expect(transactionClient.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE policy.enabled = TRUE')
    );
    expect(bundle.statusId).toBe(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS
        .BLOCKED_BY_DELETION_GATES
    );
    expect(bundle.deletionGatePlan.unconvertedPolicyCount)
      .toBe(bundle.evidence.currentPolicyInventory.unconvertedPolicyCount);
    expect(bundle.deletionGatePlan.requiresMaintenanceStateCount)
      .toBe(bundle.evidence.reconciliationStateInventory.requiresMaintenanceStateCount);
    expect(bundle.generatedAt).toBe(COLLECTION_TIME);
  });

  test('requires transaction-owned database access for a bound evidence snapshot', async () => {
    await expect(loadPolicyCompatibilityDeletionExecutionPlanEvidenceBundle({
      query: jest.fn(),
    })).rejects.toThrow('query(text) and withTransaction(fn)');
  });

  test('collects both database inventories in one read-only repeatable-read transaction', async () => {
    const transactionClient = createLiveRuntimeEvidenceDbClient();
    const dbClient = {
      query: jest.fn(),
      withTransaction: jest.fn(async callback => callback(transactionClient)),
    };

    const bundle = await loadPolicyCompatibilityDeletionExecutionPlanEvidenceBundle(dbClient, {
      coverage: buildCompleteCoverage(),
      rollbackSupportVerified: true,
      supportDiagnosticsVerified: true,
      deletionManifestApproved: true,
      now: COLLECTION_TIME,
    });

    expect(dbClient.withTransaction).toHaveBeenCalledTimes(1);
    expect(transactionClient.query).toHaveBeenNthCalledWith(
      1,
      'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'
    );
    expect(dbClient.query).not.toHaveBeenCalled();
    expect(bundle.readyForExecutionPlan).toBe(false);
  });

  test('derives runtime recovery evidence from the transaction snapshot and ignores caller safety flags', async () => {
    const transactionClient = createLiveRuntimeEvidenceDbClient();
    const dbClient = {
      query: jest.fn(),
      withTransaction: jest.fn(async callback => callback(transactionClient)),
    };

    const bundle = await loadPolicyCompatibilityDeletionExecutionPlanEvidenceBundle(dbClient, {
      convertedPolicy: policy({ id: 99 }),
      unconvertedPolicy: policy({ id: 100 }),
      rollbackAvailable: false,
      legacyDeletionBlocked: false,
      supportDiagnosticsSafe: false,
      coverage: buildCompleteCoverage(),
      supportStanceId:
        POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS.UNSUPPORTED_AFTER_WINDOW,
      backupRestoreVerified: false,
      rollbackSupportVerified: true,
      supportDiagnosticsVerified: true,
      deletionManifestApproved: true,
      now: COLLECTION_TIME,
    });

    expect(bundle.statusId).toBe(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS
        .BLOCKED_BY_DELETION_GATES
    );
    expect(bundle.evidence.cutoverVerification).toEqual(expect.objectContaining({
      convertedReadAssessedPolicyCount: 1,
      convertedReadInvalidPolicyCount: 0,
      unconvertedReadAssessedPolicyCount: 0,
      unconvertedReadInvalidPolicyCount: 0,
    }));
    expect(bundle.evidence.cutoverVerification.statusId)
      .toBe('ready_for_cutover_monitoring');
    expect(bundle.deletionGatePlan.supportStanceId)
      .toBe(POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS.BLOCK_DELETION);
    expect(transactionClient.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM library_policies policy')
    );
    expect(transactionClient.query).toHaveBeenCalledWith(
      expect.stringContaining('ranked_active_intents'),
      [[14]]
    );
    expect(dbClient.query).not.toHaveBeenCalled();
  });

  test('rejects mutated bundle invariants and reported side effects', () => {
    const bundle = readyBundle();
    const validation = validatePolicyCompatibilityDeletionExecutionPlanEvidenceBundle({
      ...bundle,
      riskCount: 2,
      readyForExecutionPlan: true,
      sideEffects: {
        ...bundle.sideEffects,
        writesDatabase: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .RISK_COUNT_MISMATCH,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .READY_STATE_MISMATCH,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .SIDE_EFFECT_PERFORMED,
    ]));
  });
});
