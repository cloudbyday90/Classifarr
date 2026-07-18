import { jest } from '@jest/globals';

import {
  POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS,
  POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS,
  applyPolicyInitialIntentEstablishment,
} from '../../services/policyInitialIntentEstablishmentService.mjs';
import {
  buildInitialIntentRequestFingerprint,
  validatePolicyInitialIntentEstablishmentRequest,
} from '../../services/policyInitialIntentEstablishmentContract.mjs';

const NOW = '2026-07-16T17:00:00.000Z';

function request(overrides = {}) {
  return {
    schema_version: 1,
    idempotency_key: '6fe3d170-9390-4ec5-95f7-42ad6f8ec777',
    declared_intent: {
      purpose: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['Animation'] },
      }],
      hard_limits: [],
      helpful_hints: [],
      avoid: [],
    },
    ...overrides,
  };
}

function createClient({
  policy = {
    id: 44,
    library_id: 6,
    name: 'Animation',
    auto_classify_threshold: 85,
    prompt_threshold: 60,
  },
  legacyPresetCount = 0,
  legacyOverrideCount = 0,
  nativeHistory = [],
  existingByKey = null,
  existingByPolicy = null,
  routingTarget = {
    library_id: 6,
    arr_type: 'radarr',
    arr_config_id: 4,
    arr_root_folder_id: 9,
    arr_root_folder_path: '/movies/animation',
    quality_profile_id: 2,
  },
  reserveId = 51,
  initialEstablishmentReconciliationState = null,
  failStatement = null,
} = {}) {
  return {
    query: jest.fn(async sql => {
      const statement = String(sql);
      if (failStatement && statement.includes(failStatement)) {
        throw new Error('persistence failure');
      }

      if (statement.includes('FROM library_policies')) {
        return { rows: policy ? [policy] : [], rowCount: policy ? 1 : 0 };
      }
      if (statement.includes('FROM policy_initial_intent_establishments') && statement.includes('idempotency_key')) {
        return { rows: existingByKey ? [existingByKey] : [], rowCount: existingByKey ? 1 : 0 };
      }
      if (statement.includes('FROM policy_initial_intent_establishments')) {
        return { rows: existingByPolicy ? [existingByPolicy] : [], rowCount: existingByPolicy ? 1 : 0 };
      }
      if (statement.includes('FROM policy_presets')) {
        return { rows: Array.from({ length: legacyPresetCount }, (_, id) => ({ id: id + 1 })) };
      }
      if (statement.includes('FROM policy_overrides')) {
        return { rows: Array.from({ length: legacyOverrideCount }, (_, id) => ({ id: id + 1 })) };
      }
      if (statement.includes('FROM policy_intents')) {
        return { rows: nativeHistory, rowCount: nativeHistory.length };
      }
      if (statement.includes('INSERT INTO policy_initial_intent_establishments')) {
        return { rows: reserveId ? [{ id: reserveId }] : [], rowCount: reserveId ? 1 : 0 };
      }
      if (statement.includes('FROM library_arr_mappings')) {
        return { rows: routingTarget ? [routingTarget] : [], rowCount: routingTarget ? 1 : 0 };
      }
      if (statement.includes('INSERT INTO policy_intents')) {
        return { rows: [{ id: 101 }], rowCount: 1 };
      }
      if (statement.includes('INSERT INTO policy_intent_migration_events')) {
        return { rows: [{ id: 201 }], rowCount: 1 };
      }
      if (statement.includes('INSERT INTO policy_intent_rollback_snapshots')) {
        return { rows: [{ id: 301 }], rowCount: 1 };
      }
      if (statement.includes('UPDATE policy_initial_intent_establishments')) {
        return { rows: [{ id: reserveId }], rowCount: 1 };
      }
      if (statement.includes('DELETE FROM policy_native_intent_reconciliation_states')) {
        return {
          rows: initialEstablishmentReconciliationState ? [initialEstablishmentReconciliationState] : [],
          rowCount: initialEstablishmentReconciliationState ? 1 : 0,
        };
      }

      return { rows: [], rowCount: 1 };
    }),
  };
}

function serviceRequest(overrides = {}) {
  return {
    policyId: 44,
    actorId: 7,
    request: request(),
    now: NOW,
    ...overrides,
  };
}

describe('policyInitialIntentEstablishmentService', () => {
  test('records first native intent atomically without automated routing', async () => {
    const client = createClient();
    const dbClient = { withTransaction: jest.fn(async work => work(client)) };

    const result = await applyPolicyInitialIntentEstablishment({
      dbClient,
      ...serviceRequest(),
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.ESTABLISHED,
      policyId: 44,
      establishment: expect.objectContaining({
        applied: true,
        intentId: 101,
        rollbackSnapshotId: 301,
        automationStarted: false,
      }),
      sideEffects: expect.objectContaining({
        nativeAuthorityCreated: true,
        rollbackSnapshotCreated: true,
        routingConfigurationCopied: true,
        automatedRoutingStarted: false,
        legacyRowsChanged: false,
      }),
    }));
    expect(dbClient.withTransaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("'initial_intent_established'"),
      expect.arrayContaining([101, 44, 7])
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_rollback_snapshots'),
      expect.arrayContaining([101, 44])
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("candidate_status_id = 'requires_initial_policy_establishment'"),
      [44]
    );
  });

  test('reports a matching initial-establishment reconciliation marker as cleared', async () => {
    const client = createClient({
      initialEstablishmentReconciliationState: { policy_id: 44 },
    });
    const dbClient = { withTransaction: async work => work(client) };

    const result = await applyPolicyInitialIntentEstablishment({
      dbClient,
      ...serviceRequest(),
    });

    expect(result.sideEffects.reconciliationStateCleared).toBe(true);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("reason_id = 'requires_initial_policy_establishment'"),
      [44]
    );
  });

  test('blocks a policy with any legacy attachment or override before reserving establishment', async () => {
    const client = createClient({ legacyPresetCount: 1 });
    const dbClient = { withTransaction: async work => work(client) };

    const result = await applyPolicyInitialIntentEstablishment({ dbClient, ...serviceRequest() });

    expect(result.statusId).toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.BLOCKED_BY_AUTHORITY);
    expect(result.validation.issues[0].riskId)
      .toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.LEGACY_CONFIGURATION_PRESENT);
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_initial_intent_establishments'),
      expect.anything()
    );
  });

  test('blocks policies with any historical native intent rather than overwriting authority', async () => {
    const client = createClient({ nativeHistory: [{ id: 88, intent_version: 1, active: false }] });
    const dbClient = { withTransaction: async work => work(client) };

    const result = await applyPolicyInitialIntentEstablishment({ dbClient, ...serviceRequest() });

    expect(result.validation.issues[0].riskId)
      .toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.NATIVE_INTENT_HISTORY_PRESENT);
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intents'),
      expect.anything()
    );
  });

  test('returns the bounded original outcome for a matching idempotent replay', async () => {
    const validatedRequest = validatePolicyInitialIntentEstablishmentRequest(request());
    const existingByKey = {
      id: 51,
      policy_id: 44,
      library_id: 6,
      intent_id: 101,
      migration_event_id: 201,
      rollback_snapshot_id: 301,
      idempotency_key: request().idempotency_key,
      request_fingerprint: buildInitialIntentRequestFingerprint(validatedRequest),
      authority_source_id: 'operator_declared_intent',
      accepted_by: 7,
      state: 'established',
      native_intent_active: true,
    };
    const client = createClient({ existingByKey });
    const dbClient = { withTransaction: async work => work(client) };

    const result = await applyPolicyInitialIntentEstablishment({ dbClient, ...serviceRequest() });

    expect(result.statusId).toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.REPLAYED);
    expect(result.establishment.replayed).toBe(true);
    expect(result.sideEffects.nativeAuthorityCreated).toBe(false);
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intents'),
      expect.anything()
    );
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM policy_native_intent_reconciliation_states'),
      expect.anything()
    );
  });

  test('rolls back the entire transition when a late persistence write fails', async () => {
    const client = createClient({ failStatement: 'INSERT INTO policy_intent_rollback_snapshots' });
    const dbClient = { withTransaction: jest.fn(async work => {
      try {
        return await work(client);
      } catch (error) {
        throw error;
      }
    }) };

    const result = await applyPolicyInitialIntentEstablishment({ dbClient, ...serviceRequest() });

    expect(result.statusId).toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.FAILED_ROLLED_BACK);
    expect(result.validation.issues[0].riskId)
      .toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.TRANSACTION_FAILED);
    expect(JSON.stringify(result)).not.toContain('persistence failure');
  });

  test('rolls back establishment when reconciliation-state finalization fails', async () => {
    const client = createClient({
      failStatement: 'DELETE FROM policy_native_intent_reconciliation_states',
    });
    const dbClient = { withTransaction: jest.fn(async work => work(client)) };

    const result = await applyPolicyInitialIntentEstablishment({ dbClient, ...serviceRequest() });

    expect(result.statusId).toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.FAILED_ROLLED_BACK);
    expect(result.validation.issues[0].riskId)
      .toBe(POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS.TRANSACTION_FAILED);
  });
});
