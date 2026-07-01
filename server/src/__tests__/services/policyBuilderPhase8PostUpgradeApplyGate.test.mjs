import { jest } from '@jest/globals';
import {
  PHASE8R_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS,
  PHASE8R_POST_UPGRADE_APPLY_GATE_STATUS_IDS,
  applyPolicyBuilderPhase8PostUpgradeApplyGate,
  buildPolicyBuilderPhase8PostUpgradeApplyGate,
} from '../../services/policyBuilderPhase8PostUpgradeApplyGate.mjs';
import {
  buildPolicyBuilderPhase8PostUpgradeDryRun,
} from '../../services/policyBuilderPhase8PostUpgradeDryRun.mjs';

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
  return buildPolicyBuilderPhase8PostUpgradeDryRun({
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

      if (String(sql).includes('INSERT INTO policy_intents')) {
        return { rows: [{ id: '501' }], rowCount: 1 };
      }

      return { rows: [], rowCount: 1 };
    }),
  };

  return client;
}

describe('policyBuilderPhase8PostUpgradeApplyGate', () => {
  test('blocks apply when no dry-run is supplied', () => {
    const gate = buildPolicyBuilderPhase8PostUpgradeApplyGate({
      dryRun: null,
      hasTransactionBoundary: true,
      now: '2026-07-01T12:00:00.000Z',
    });

    expect(gate.statusId).toBe(PHASE8R_POST_UPGRADE_APPLY_GATE_STATUS_IDS.BLOCKED_BY_DRY_RUN);
    expect(gate.operatorErrorIds).toEqual([
      PHASE8R_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.DRY_RUN_REQUIRED,
    ]);
    expect(gate.validation.ok).toBe(true);
  });

  test('blocks apply when the dry-run has expired', () => {
    const gate = buildPolicyBuilderPhase8PostUpgradeApplyGate({
      dryRun: readyDryRun('2026-07-01T12:00:00.000Z'),
      hasTransactionBoundary: true,
      now: '2026-07-01T12:16:00.000Z',
    });

    expect(gate.statusId).toBe(PHASE8R_POST_UPGRADE_APPLY_GATE_STATUS_IDS.BLOCKED_BY_STALE_DRY_RUN);
    expect(gate.operatorErrorIds).toEqual([
      PHASE8R_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.DRY_RUN_STALE,
    ]);
  });

  test('applies ready policies in a database transaction', async () => {
    const client = createApplyClient();
    const dbClient = {
      withTransaction: jest.fn(async (work) => work(client)),
    };

    const result = await applyPolicyBuilderPhase8PostUpgradeApplyGate({
      dbClient,
      dryRun: readyDryRun(),
      policies: [policy()],
      now: '2026-07-01T12:00:00.000Z',
      actorId: 42,
    });

    expect(dbClient.withTransaction).toHaveBeenCalledTimes(1);
    expect(result.statusId).toBe(PHASE8R_POST_UPGRADE_APPLY_GATE_STATUS_IDS.APPLIED);
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

  test('returns rollback-safe failure details when transaction work rejects', async () => {
    const client = createApplyClient({ failOnRules: true });
    const dbClient = {
      withTransaction: jest.fn(async (work) => work(client)),
    };

    const result = await applyPolicyBuilderPhase8PostUpgradeApplyGate({
      dbClient,
      dryRun: readyDryRun(),
      policies: [policy()],
      now: '2026-07-01T12:00:00.000Z',
    });

    expect(result.statusId).toBe(PHASE8R_POST_UPGRADE_APPLY_GATE_STATUS_IDS.FAILED_ROLLED_BACK);
    expect(result.applied).toBe(false);
    expect(result.operatorErrorIds).toEqual([
      PHASE8R_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.APPLY_FAILED_ROLLED_BACK,
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
});
