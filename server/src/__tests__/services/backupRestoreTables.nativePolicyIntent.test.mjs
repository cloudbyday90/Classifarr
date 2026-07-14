import { jest } from '@jest/globals';
import {
  restoreNativePolicyIntentStorage,
} from '../../services/backupRestoreTables.mjs';

function createClient() {
  return {
    query: jest.fn(async (sql) => {
      if (typeof sql === 'string' && sql.includes('INSERT INTO policy_intents')) {
        return { rows: [{ id: 501 }], rowCount: 1 };
      }
      if (typeof sql === 'string' && sql.includes('SELECT id')) {
        return { rows: [{ id: 501 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }),
  };
}

describe('backupRestoreTables native policy intent restore', () => {
  test('restores native policy intent rows with remapped policy, library, and intent ids', async () => {
    const client = createClient();
    const policyIdMap = new Map([[10, 110]]);
    const libraryIdMap = new Map([[20, 220]]);

    const result = await restoreNativePolicyIntentStorage(
      client,
      {
        policyIntents: [{
          id: 30,
          policy_id: 10,
          library_id: 20,
          schema_version: 1,
          intent_version: 1,
          active: true,
          source: 'native_intent',
          inference_state: 'inferred',
          review_behavior: { require_ai_validation: true },
          validation_status: 'valid',
        }],
        policyIntentRules: [{
          id: 31,
          intent_id: 30,
          intent_role: 'purpose',
          collection: 'purpose',
          signal_type: 'genres',
          operator: 'include',
          values: { include: ['Animation'] },
          inference_state: 'inferred',
        }],
        policyIntentRoutingTargets: [{
          id: 32,
          intent_id: 30,
          library_id: 20,
          arr_type: 'radarr',
          arr_config_id: 1,
          arr_root_folder_path: '/media/Animated Movies',
          target_status: 'configured',
        }],
        policyIntentTemplateApplications: [{
          id: 33,
          intent_id: 30,
          preset_key: 'animated_movies',
          preset_name: 'Animated Movies',
          signal_count: 1,
          link_state: 'applied',
        }],
        policyIntentMigrationEvents: [{
          id: 34,
          intent_id: 30,
          policy_id: 10,
          event_type: 'conversion_applied',
          actor_type: 'operator',
          reason_code: 'restore_test',
          metadata: { restored: true },
        }],
        policyIntentRollbackSnapshots: [{
          id: 35,
          intent_id: 30,
          policy_id: 10,
          snapshot_version: 1,
          snapshot_payload: { policy: { id: 10 } },
          payload_redacted: true,
          restore_path: 'policy/rollback/policies/10/v1',
          expires_at: '2026-07-15T00:00:00.000Z',
        }],
        policyIntentValidationStatus: [{
          id: 36,
          intent_id: 30,
          schema_version: 1,
          status: 'valid',
          validator_version: 'phase8r.test',
          error_count: 0,
          warning_count: 0,
          errors: [],
          warnings: [],
        }],
      },
      { policyIdMap, libraryIdMap }
    );

    expect(result).toEqual({
      intentsRestored: 1,
      intentRulesRestored: 1,
      routingTargetsRestored: 1,
      templateApplicationsRestored: 1,
      migrationEventsRestored: 1,
      rollbackSnapshotsRestored: 1,
      validationStatusesRestored: 1,
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intents'),
      expect.arrayContaining([110, 220])
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_rules'),
      expect.arrayContaining([501, expect.anything()])
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_routing_targets'),
      expect.arrayContaining([501, 220])
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_migration_events'),
      expect.arrayContaining([501, 110])
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_rollback_snapshots'),
      expect.arrayContaining([501, 110])
    );
  });

  test('skips native rows when restored policy or library parents are unavailable', async () => {
    const client = createClient();

    const result = await restoreNativePolicyIntentStorage(
      client,
      {
        policyIntents: [{
          id: 30,
          policy_id: 10,
          library_id: 20,
          schema_version: 1,
          intent_version: 1,
          active: true,
          source: 'native_intent',
          inference_state: 'inferred',
          validation_status: 'valid',
        }],
        policyIntentRules: [{
          intent_id: 30,
          intent_role: 'purpose',
          collection: 'purpose',
          signal_type: 'genres',
          operator: 'include',
          values: { include: ['Animation'] },
          inference_state: 'inferred',
        }],
      },
      {
        policyIdMap: new Map(),
        libraryIdMap: new Map([[20, 220]]),
      }
    );

    expect(result.intentsRestored).toBe(0);
    expect(result.intentRulesRestored).toBe(0);
    expect(client.query).not.toHaveBeenCalled();
  });

  test('fails closed when an active intent conflict cannot be mapped exactly', async () => {
    const client = {
      query: jest.fn(async sql => {
        if (String(sql).includes('INSERT INTO policy_intents')) {
          return { rows: [], rowCount: 0 };
        }
        if (String(sql).includes('SELECT id') && String(sql).includes('FROM policy_intents')) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };

    await expect(restoreNativePolicyIntentStorage(
      client,
      {
        policyIntents: [{
          id: 30,
          policy_id: 10,
          library_id: 20,
          schema_version: 1,
          intent_version: 2,
          active: true,
          source: 'native_intent',
          inference_state: 'inferred',
          validation_status: 'valid',
        }],
      },
      { policyIdMap: new Map([[10, 110]]), libraryIdMap: new Map([[20, 220]]) }
    )).rejects.toThrow('active intent authority cannot be resolved');
  });
});
