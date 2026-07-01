import { jest } from '@jest/globals';
import {
  PHASE8R_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS,
  PHASE8R_POST_UPGRADE_DRY_RUN_STATUS_IDS,
  buildPolicyBuilderPhase8PostUpgradeDryRun,
  loadPolicyBuilderPhase8PostUpgradePolicies,
  runPolicyBuilderPhase8PostUpgradeDryRun,
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

describe('policyBuilderPhase8PostUpgradeDryRun', () => {
  test('builds an operator-safe post-upgrade dry-run from ready policies', () => {
    const dryRun = buildPolicyBuilderPhase8PostUpgradeDryRun({
      policies: [policy()],
      now: '2026-07-01T12:00:00.000Z',
    });

    expect(dryRun.mode).toBe('dry_run');
    expect(dryRun.statusId).toBe(PHASE8R_POST_UPGRADE_DRY_RUN_STATUS_IDS.READY_FOR_APPLY_GATE);
    expect(dryRun.validation.ok).toBe(true);
    expect(dryRun.selectedPolicyIds).toEqual([14]);
    expect(dryRun.summary).toEqual(expect.objectContaining({
      totalPolicyCount: 1,
      convertibleCount: 1,
      readyToApplyCount: 1,
      blockedCount: 0,
    }));
    expect(dryRun.conversionWorkflow).toEqual(expect.objectContaining({
      mode: 'plan_only',
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(dryRun.conversionWorkflow.action.actorSourceId).toBe('post_upgrade_apply');
    expect(dryRun.sideEffects).toEqual({
      policyStorageMutated: false,
      nativeRowsInserted: false,
      migrationEventsWritten: false,
      rollbackSnapshotsWritten: false,
      legacyPathsDeleted: false,
      postUpgradeApplied: false,
    });
  });

  test('reports review-required status without building an invalid empty-selection workflow', () => {
    const dryRun = buildPolicyBuilderPhase8PostUpgradeDryRun({
      policies: [policy({
        id: 15,
        name: 'Missing Route',
        routingTarget: {},
      })],
    });

    expect(dryRun.statusId).toBe(PHASE8R_POST_UPGRADE_DRY_RUN_STATUS_IDS.REVIEW_REQUIRED);
    expect(dryRun.validation.ok).toBe(true);
    expect(dryRun.conversionWorkflow).toBeNull();
    expect(dryRun.operatorErrorIds).toEqual(expect.arrayContaining([
      PHASE8R_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS.NO_READY_CANDIDATES,
      PHASE8R_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS.OPERATOR_REVIEW_REQUIRED,
    ]));
  });

  test('reports no-policy dry-run without side effects', () => {
    const dryRun = buildPolicyBuilderPhase8PostUpgradeDryRun({
      policies: [],
    });

    expect(dryRun.statusId).toBe(PHASE8R_POST_UPGRADE_DRY_RUN_STATUS_IDS.NO_POLICIES_FOUND);
    expect(dryRun.validation.ok).toBe(true);
    expect(dryRun.summary.totalPolicyCount).toBe(0);
    expect(dryRun.conversionWorkflow).toBeNull();
    expect(dryRun.operatorErrorIds).toEqual([
      PHASE8R_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS.NO_POLICIES_FOUND,
    ]);
    expect(Object.values(dryRun.sideEffects).some(Boolean)).toBe(false);
  });

  test('loads bounded legacy policy input with presets and routing mapping', async () => {
    const dbClient = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 21,
            library_id: 3,
            name: 'Animated Policy',
            library_name: 'Animated Movies',
            library_media_type: 'movie',
            arr_type: 'radarr',
            arr_config_id: 2,
            arr_root_folder_id: 9,
            arr_root_folder_path: '/media/Animated',
            arr_quality_profile_id: 4,
            presets: JSON.stringify([preset({ id: 8, preset_id: 8 })]),
          },
        ],
      }),
    };

    const policies = await loadPolicyBuilderPhase8PostUpgradePolicies({
      dbClient,
      maxPolicies: 7,
    });

    expect(dbClient.query).toHaveBeenCalledWith(expect.stringContaining('FROM library_policies lp'), [8]);
    expect(policies).toEqual([
      expect.objectContaining({
        id: 21,
        library_name: 'Animated Movies',
        presets: [expect.objectContaining({ id: 8 })],
        routingTarget: {
          arr_type: 'radarr',
          arr_config_id: 2,
          arr_root_folder_path: '/media/Animated',
        },
        libraryMapping: expect.objectContaining({
          arr_root_folder_id: 9,
          quality_profile_id: 4,
        }),
      }),
    ]);
  });

  test('runs loader and dry-run together for post-upgrade orchestration', async () => {
    const dbClient = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            ...policy(),
            presets: [preset()],
            arr_type: 'radarr',
            arr_config_id: 1,
            arr_root_folder_path: '/media/Movies',
          },
        ],
      }),
    };

    const dryRun = await runPolicyBuilderPhase8PostUpgradeDryRun({
      dbClient,
      maxPolicies: 10,
      now: '2026-07-01T12:00:00.000Z',
    });

    expect(dryRun.statusId).toBe(PHASE8R_POST_UPGRADE_DRY_RUN_STATUS_IDS.READY_FOR_APPLY_GATE);
    expect(dryRun.validation.ok).toBe(true);
    expect(dryRun.summary.readyToApplyCount).toBe(1);
  });
});
