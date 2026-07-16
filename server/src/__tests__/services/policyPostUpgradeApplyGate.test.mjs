import { jest } from '@jest/globals';
import {
  POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS,
  POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS,
  applyPolicyPostUpgradeApplyGate,
  buildPolicyPostUpgradeApplyGate,
  runPolicyPostUpgradeApplyGate,
} from '../../services/policyPostUpgradeApplyGate.mjs';
import {
  buildPolicyPostUpgradeDryRun,
} from '../../services/policyPostUpgradeDryRun.mjs';
import {
  POLICY_CONVERSION_ACTOR_SOURCE_IDS,
} from '../../services/policyConversionActorSources.mjs';

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
    library_media_type: 'movie',
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
    libraryMapping: {
      arr_type: 'radarr',
      arr_config_id: 1,
      arr_root_folder_id: 9,
      arr_root_folder_path: '/media/Movies',
      quality_profile_id: 3,
    },
    profileFreshness: {
      state: 'fresh',
      stale: false,
    },
    ...overrides,
  };
}

function readyDryRun(now = '2026-07-01T12:00:00.000Z') {
  return buildPolicyPostUpgradeDryRun({
    policies: [policy()],
    now,
  });
}

function createApplyClient({ failOnRules = false } = {}) {
  const client = {
    query: jest.fn(async (sql) => {
      if (failOnRules && String(sql).includes('INSERT INTO policy_intent_rules')) {
        throw new Error('rule insert failed');
      }

      if (String(sql).includes('SELECT id') && String(sql).includes('FROM policy_intents')) {
        return { rows: [] };
      }

      if (String(sql).includes('FROM library_policies') && String(sql).includes('FOR UPDATE')) {
        return { rows: [{ id: 14, library_id: 4 }], rowCount: 1 };
      }

      if (String(sql).includes('INSERT INTO policy_intents')) {
        return { rows: [{ id: '501' }], rowCount: 1 };
      }

      return { rows: [], rowCount: 1 };
    }),
  };

  return client;
}

describe('policyPostUpgradeApplyGate', () => {
  test('blocks apply when no dry-run is supplied', () => {
    const gate = buildPolicyPostUpgradeApplyGate({
      dryRun: null,
      hasTransactionBoundary: true,
      now: '2026-07-01T12:00:00.000Z',
    });

    expect(gate.version).toBe('policy.post_upgrade_apply_gate.v1');
    expect(gate.statusId).toBe(POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.BLOCKED_BY_DRY_RUN);
    expect(gate.operatorErrorIds).toEqual([
      POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.DRY_RUN_REQUIRED,
    ]);
    expect(gate.validation.ok).toBe(true);
    expect(gate.nextStep).toEqual(expect.objectContaining({
      stepId: 'native_runtime_cutover_verification',
    }));
    expect(gate.nextPhase).toBeUndefined();
  });

  test('blocks apply when the dry-run has expired', () => {
    const gate = buildPolicyPostUpgradeApplyGate({
      dryRun: readyDryRun('2026-07-01T12:00:00.000Z'),
      hasTransactionBoundary: true,
      now: '2026-07-01T12:16:00.000Z',
    });

    expect(gate.statusId).toBe(POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.BLOCKED_BY_STALE_DRY_RUN);
    expect(gate.operatorErrorIds).toEqual([
      POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.DRY_RUN_STALE,
    ]);
  });

  test('applies ready policies in a database transaction', async () => {
    const client = createApplyClient();
    const dbClient = {
      withTransaction: jest.fn(async (work) => work(client)),
    };

    const result = await applyPolicyPostUpgradeApplyGate({
      dbClient,
      dryRun: readyDryRun(new Date().toISOString()),
      policies: [policy()],
      now: '2026-07-01T12:00:00.000Z',
      actorId: 42,
    });

    expect(dbClient.withTransaction).toHaveBeenCalledTimes(1);
    expect(result.statusId).toBe(POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.APPLIED);
    expect(result.applied).toBe(true);
    expect(result.appliedPolicyCount).toBe(1);
    expect(result.results).toEqual([
      expect.objectContaining({
        policyId: 14,
        intentId: 501,
        alreadyConverted: false,
        rulesInserted: 1,
        templateApplicationsInserted: 1,
      }),
    ]);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM library_policies'),
      [14, 4]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_rollback_snapshots'),
      expect.any(Array)
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_migration_events'),
      expect.any(Array)
    );
    expect(result.sideEffects).toEqual(expect.objectContaining({
      rollbackSnapshotsWritten: true,
      nativeRowsInserted: true,
      migrationEventsWritten: true,
      legacyPathsDeleted: false,
    }));
  });

  test('stops a final apply after the authority row lock when a reconciliation guard becomes active', async () => {
    const client = createApplyClient();
    const dbClient = { withTransaction: jest.fn(async work => work(client)) };
    const policyWriteGuard = jest.fn().mockResolvedValue({
      allowed: false,
      reasonId: 'rollback_reconciliation_hold',
    });

    const result = await applyPolicyPostUpgradeApplyGate({
      dbClient,
      dryRun: readyDryRun(new Date().toISOString()),
      policies: [policy()],
      now: '2026-07-15T15:00:00.000Z',
      policyWriteGuard,
    });

    expect(policyWriteGuard).toHaveBeenCalledWith(expect.objectContaining({
      client,
      policyId: 14,
    }));
    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.APPLIED,
      appliedPolicyCount: 0,
      results: [expect.objectContaining({
        policyId: 14,
        skippedByReconciliationGuard: true,
        guardReasonId: 'rollback_reconciliation_hold',
      })],
    }));
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intents'),
      expect.anything(),
    );
  });

  test('records the reconciliation actor source without treating it as an operator action', async () => {
    const client = createApplyClient();
    const dbClient = {
      withTransaction: jest.fn(async (work) => work(client)),
    };
    const dryRun = buildPolicyPostUpgradeDryRun({
      policies: [policy()],
      now: '2026-07-01T12:00:00.000Z',
      action: {
        actorSourceId: POLICY_CONVERSION_ACTOR_SOURCE_IDS.NATIVE_INTENT_RECONCILIATION,
        reasonCode: 'native_intent_reconciliation',
      },
    });

    const result = await applyPolicyPostUpgradeApplyGate({
      dbClient,
      dryRun,
      policies: [policy()],
      now: '2026-07-01T12:00:00.000Z',
    });

    expect(result.statusId).toBe(POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.APPLIED);
    const eventCall = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO policy_intent_migration_events')
    );
    expect(eventCall[1][3]).toBe('reconciler');
    expect(JSON.parse(eventCall[1][8])).toEqual(expect.objectContaining({
      actorSourceId: 'native_intent_reconciliation',
    }));
  });

  test('defers a ready conversion without a transaction when its execution budget is exhausted', async () => {
    const dbClient = {
      withTransaction: jest.fn(),
    };

    const result = await applyPolicyPostUpgradeApplyGate({
      dbClient,
      dryRun: readyDryRun(new Date().toISOString()),
      policies: [policy()],
      executionDeadlineAt: new Date(Date.now() - 1_000).toISOString(),
    });

    expect(result.statusId).toBe(POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.DEFERRED_BY_EXECUTION_BUDGET);
    expect(result.operatorErrorIds).toContain(
      POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.EXECUTION_BUDGET_EXHAUSTED,
    );
    expect(dbClient.withTransaction).not.toHaveBeenCalled();
  });

  test('persists a missing routing status without blocking native-intent conversion', async () => {
    const client = createApplyClient();
    const dbClient = {
      withTransaction: jest.fn(async work => work(client)),
    };
    const unmappedPolicy = policy({
      routingTarget: {},
      libraryMapping: {},
    });
    const dryRun = buildPolicyPostUpgradeDryRun({
      policies: [unmappedPolicy],
      now: '2026-07-01T12:00:00.000Z',
    });

    const result = await applyPolicyPostUpgradeApplyGate({
      dbClient,
      dryRun,
      policies: [unmappedPolicy],
      now: '2026-07-01T12:00:00.000Z',
      actorId: 42,
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.APPLIED,
      applied: true,
      appliedPolicyCount: 1,
    }));
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_routing_targets'),
      ['501', 4, null, null, null, null, null, 'missing']
    );
  });

  test('fails closed when the policy authority row cannot be locked', async () => {
    const client = createApplyClient();
    client.query.mockImplementation(async sql => {
      if (String(sql).includes('FROM library_policies') && String(sql).includes('FOR UPDATE')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 1 };
    });
    const dbClient = { withTransaction: jest.fn(async work => work(client)) };

    const result = await applyPolicyPostUpgradeApplyGate({
      dbClient,
      dryRun: readyDryRun(),
      policies: [policy()],
      now: '2026-07-01T12:00:00.000Z',
    });

    expect(result.statusId).toBe(POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.FAILED_ROLLED_BACK);
    expect(result.operatorErrorIds).toContain(
      POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.POLICY_AUTHORITY_UNAVAILABLE
    );
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intents'),
      expect.anything()
    );
  });

  test('returns rollback-safe failure details when transaction work rejects', async () => {
    const client = createApplyClient({ failOnRules: true });
    const dbClient = {
      withTransaction: jest.fn(async (work) => work(client)),
    };

    const result = await applyPolicyPostUpgradeApplyGate({
      dbClient,
      dryRun: readyDryRun(),
      policies: [policy()],
      now: '2026-07-01T12:00:00.000Z',
    });

    expect(result.statusId).toBe(POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.FAILED_ROLLED_BACK);
    expect(result.applied).toBe(false);
    expect(result.operatorErrorIds).toEqual([
      POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.APPLY_FAILED_ROLLED_BACK,
    ]);
    expect(result.rollback).toEqual(expect.objectContaining({
      assumedComplete: true,
    }));
    expect(result.sideEffects).toEqual({
      rollbackSnapshotsWritten: false,
      nativeRowsInserted: false,
      migrationEventsWritten: false,
      legacyPathsDeleted: false,
      policyStorageMutated: false,
    });
  });

  test('classifies a serializable database failure as retryable without exposing its message', async () => {
    const serializationError = Object.assign(
      new Error('could not serialize access due to concurrent update'),
      { code: '40001' },
    );
    const dbClient = {
      withTransaction: jest.fn(async () => {
        throw serializationError;
      }),
    };

    const result = await applyPolicyPostUpgradeApplyGate({
      dbClient,
      dryRun: readyDryRun(),
      policies: [policy()],
      now: '2026-07-01T12:00:00.000Z',
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.FAILED_ROLLED_BACK,
      failureCategory: 'transient_database',
      operatorErrorIds: ['transient_database'],
    }));
    expect(JSON.stringify(result)).not.toContain('concurrent update');
  });

  test('does not enter the apply transaction when loaded authority is ambiguous', async () => {
    const dbClient = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [
            {
              ...policy(),
              arr_type: 'radarr',
              arr_config_id: 1,
              arr_root_folder_path: '/media/Movies',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { id: 91, policy_id: 14, intent_version: 1, validation_status: 'valid' },
            { id: 92, policy_id: 14, intent_version: 2, validation_status: 'valid' },
          ],
        }),
      withTransaction: jest.fn(),
    };

    const result = await runPolicyPostUpgradeApplyGate({
      dbClient,
      now: '2026-07-01T12:00:00.000Z',
    });

    expect(result.statusId).toBe(POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.BLOCKED_BY_DRY_RUN);
    expect(result.applied).toBe(false);
    expect(result.readyPolicyIds).toEqual([]);
    expect(dbClient.withTransaction).not.toHaveBeenCalled();
    expect(dbClient.query).toHaveBeenCalledTimes(2);
  });
});
