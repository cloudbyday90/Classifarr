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
        policyNativeIntentReconciliationRuns: [{
          id: 37,
          run_key: 'a9cf9f4a-61e3-4ca7-8fe6-b810efff7c1c',
          reconciler_version: 'native_intent_reconciliation.ledger.v1',
          run_state: 'evaluated',
          source_status_id: 'blocked_by_no_ready_steps',
          reason_id: 'no_candidates',
          started_at: '2026-07-15T00:00:00.000Z',
          finished_at: '2026-07-15T00:00:01.000Z',
          candidate_count: 0,
          converted_count: 0,
          already_native_count: 0,
          deferred_count: 0,
          blocked_count: 0,
          failed_count: 0,
        }],
        policyNativeIntentReconciliationOutcomes: [{
          id: 38,
          run_id: 37,
          policy_id: 10,
          candidate_fingerprint: `sha256:${'a'.repeat(64)}`,
          candidate_status_id: 'ready_to_convert',
          outcome_state: 'deferred_retry',
          reason_id: 'execution_budget_exhausted',
          retry_not_before: null,
          evaluated_at: '2026-07-15T00:00:01.000Z',
        }],
        policyNativeIntentReconciliationStates: [{
          policy_id: 10,
          candidate_fingerprint: `sha256:${'b'.repeat(64)}`,
          candidate_status_id: 'ready_to_convert',
          outcome_state: 'system_failure',
          reason_id: 'transient_database',
          retry_not_before: '2026-07-15T00:05:00.000Z',
          failure_count: 1,
          evaluated_at: '2026-07-15T00:00:01.000Z',
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
      reconciliationRunsRestored: 1,
      reconciliationOutcomesRestored: 1,
      reconciliationStatesRestored: 1,
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
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_native_intent_reconciliation_runs'),
      expect.arrayContaining(['a9cf9f4a-61e3-4ca7-8fe6-b810efff7c1c'])
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_native_intent_reconciliation_outcomes'),
      expect.arrayContaining([expect.any(Number), 110])
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_native_intent_reconciliation_states'),
      expect.arrayContaining([110, `sha256:${'b'.repeat(64)}`, 'system_failure'])
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

  test('restores an expired redacted rollback marker without restoring its original payload', async () => {
    const client = createClient();
    const redactedMarker = {
      retention_marker: {
        version: 1,
        state: 'expired_payload_redacted',
        redacted_at: '2026-07-14T12:00:00.000Z',
        policy_id: 10,
        intent_id: 30,
        snapshot_version: 1,
        created_at: '2026-07-01T12:00:00.000Z',
        expires_at: '2026-07-14T12:00:00.000Z',
        restored_at: null,
        restore_path: 'policy/rollback/policies/10/v1',
        payload_digest: 'a'.repeat(64),
        payload_bytes: 512,
        source_audit: {
          migration_event_id: 34,
          actor_type: 'operator',
          actor_id: 7,
          actor_source_id: null,
          reason_code: 'native_intent_replaced',
        },
      },
    };

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
        policyIntentRollbackSnapshots: [{
          id: 35,
          intent_id: 30,
          policy_id: 10,
          snapshot_version: 1,
          snapshot_payload: redactedMarker,
          payload_redacted: true,
          restore_path: 'policy/rollback/policies/10/v1',
          expires_at: '2026-07-14T12:00:00.000Z',
        }],
      },
      {
        policyIdMap: new Map([[10, 110]]),
        libraryIdMap: new Map([[20, 220]]),
      }
    );

    expect(result.rollbackSnapshotsRestored).toBe(1);

    const snapshotInsertCall = client.query.mock.calls.find(([sql]) => (
      String(sql).includes('INSERT INTO policy_intent_rollback_snapshots')
    ));
    const storedMarker = snapshotInsertCall[1].find(value => (
      typeof value === 'string' && value.includes('expired_payload_redacted')
    ));

    expect(JSON.parse(storedMarker)).toEqual(redactedMarker);
    expect(storedMarker).not.toContain('legacy_policy_snapshot');
    expect(storedMarker).not.toContain('Animation');
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
