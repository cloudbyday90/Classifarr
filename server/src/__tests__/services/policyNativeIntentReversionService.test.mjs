import { jest } from '@jest/globals';

import {
  POLICY_NATIVE_INTENT_REVERSION_RISK_IDS,
  POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS,
  POLICY_NATIVE_INTENT_REVERSION_TARGET_IDS,
  applyPolicyNativeIntentReversion,
} from '../../services/policyNativeIntentReversionService.mjs';

const NOW = '2026-07-14T12:00:00.000Z';

function snapshotPayload(overrides = {}) {
  return {
    policy_id: 44,
    library_id: 6,
    restore_sections: [
      'preset_attachments',
      'weights',
      'thresholds',
      'custom_signals',
      'routing_mapping_references',
      'migration_actor',
      'migration_reason',
    ],
    legacy_policy: {},
    presets: [],
    routing_target: null,
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  return {
    id: 901,
    intent_id: 101,
    policy_id: 44,
    snapshot_version: 1,
    snapshot_payload: snapshotPayload(),
    payload_redacted: false,
    restore_path: 'policy/rollback/policies/44/v1',
    expires_at: '2026-07-28T12:00:00.000Z',
    created_at: '2026-07-14T10:00:00.000Z',
    restored_at: null,
    ...overrides,
  };
}

function compatibilityIntents() {
  return [{
    id: 101,
    policy_id: 44,
    library_id: 6,
    intent_version: 1,
    active: true,
    replaced_by_intent_id: null,
  }];
}

function replacementIntents() {
  return [
    {
      id: 101,
      policy_id: 44,
      library_id: 6,
      intent_version: 1,
      active: false,
      replaced_by_intent_id: 202,
    },
    {
      id: 202,
      policy_id: 44,
      library_id: 6,
      intent_version: 2,
      active: true,
      replaced_by_intent_id: null,
    },
  ];
}

function createClient({
  policy = { id: 44, library_id: 6 },
  rollbackSnapshot = snapshot(),
  intents = compatibilityIntents(),
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

      if (statement.includes('FROM policy_intent_rollback_snapshots')) {
        return {
          rows: rollbackSnapshot ? [rollbackSnapshot] : [],
          rowCount: rollbackSnapshot ? 1 : 0,
        };
      }

      if (statement.includes('FROM policy_intents')) {
        return { rows: intents, rowCount: intents.length };
      }

      if (statement.includes('UPDATE policy_intent_rollback_snapshots')) {
        return { rows: [{ id: 901 }], rowCount: 1 };
      }

      if (statement.includes('INSERT INTO policy_intent_migration_events')) {
        return { rows: [{ id: 502 }], rowCount: 1 };
      }

      return { rows: [], rowCount: 1 };
    }),
  };
}

function request(overrides = {}) {
  return {
    policyId: 44,
    snapshotId: 901,
    action: {
      actorSourceId: 'manual_operator',
      actorId: 7,
      reasonCode: 'operator_requested_reversion',
    },
    now: NOW,
    ...overrides,
  };
}

describe('policyNativeIntentReversionService', () => {
  test('deactivates a current snapshot intent and restores compatibility authority atomically', async () => {
    const client = createClient();
    const dbClient = { withTransaction: jest.fn(async work => work(client)) };

    const result = await applyPolicyNativeIntentReversion({ dbClient, ...request() });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.APPLIED_TO_COMPATIBILITY,
      policyId: 44,
      snapshotId: 901,
      reversion: expect.objectContaining({
        applied: true,
        targetId: POLICY_NATIVE_INTENT_REVERSION_TARGET_IDS.COMPATIBILITY_BRIDGE,
        rawSnapshotExposed: false,
        legacyRowsChanged: false,
      }),
      sideEffects: expect.objectContaining({
        nativeAuthorityChanged: true,
        rollbackSnapshotMarkedRestored: true,
        migrationEventWritten: true,
        legacyRowsChanged: false,
      }),
      validation: { ok: true, issueCount: 0, issues: [] },
    }));
    expect(dbClient.withTransaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE policy_intents'),
      [101, NOW, 44, 6]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE policy_intent_rollback_snapshots'),
      [901, 44, NOW]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("'rollback_applied'"),
      expect.arrayContaining([101, 44, 'operator', 7, 1, null, 'operator_requested_reversion'])
    );
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE library_policies'),
      expect.anything()
    );
    expect(JSON.stringify(result)).not.toContain('legacy_policy');
  });

  test('restores only the direct predecessor when a rebuild replacement is authoritative', async () => {
    const client = createClient({ intents: replacementIntents() });
    const dbClient = { withTransaction: async work => work(client) };

    const result = await applyPolicyNativeIntentReversion({ dbClient, ...request() });

    expect(result.statusId).toBe(
      POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.APPLIED_TO_PREVIOUS_NATIVE_INTENT
    );
    expect(result.reversion.targetId).toBe(POLICY_NATIVE_INTENT_REVERSION_TARGET_IDS.PREVIOUS_NATIVE_INTENT);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('AND replaced_by_intent_id = $5'),
      [101, NOW, 44, 6, 202]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("'rollback_applied'"),
      expect.arrayContaining([101, 44, 'operator', 7, 2, 1])
    );
  });

  test('blocks expired snapshots without changing native authority', async () => {
    const client = createClient({
      rollbackSnapshot: snapshot({ expires_at: '2026-07-14T12:00:00.000Z' }),
    });
    const dbClient = { withTransaction: async work => work(client) };

    const result = await applyPolicyNativeIntentReversion({ dbClient, ...request() });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.BLOCKED_BY_SNAPSHOT);
    expect(result.validation.issues[0].riskId).toBe(POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.SNAPSHOT_EXPIRED);
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE policy_intents'),
      expect.anything()
    );
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_intent_migration_events'),
      expect.anything()
    );
  });

  test('blocks redacted or incomplete manifests without revealing their payload', async () => {
    const client = createClient({
      rollbackSnapshot: snapshot({
        payload_redacted: true,
        snapshot_payload: { secret: 'must-not-leak' },
      }),
    });
    const dbClient = { withTransaction: async work => work(client) };

    const result = await applyPolicyNativeIntentReversion({ dbClient, ...request() });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.BLOCKED_BY_SNAPSHOT);
    expect(result.validation.issues[0].riskId).toBe(
      POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.SNAPSHOT_NOT_RESTORABLE
    );
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE policy_intents'),
      expect.anything()
    );

    const incompleteClient = createClient({
      rollbackSnapshot: snapshot({
        snapshot_payload: snapshotPayload({ legacy_policy: null }),
      }),
    });
    const incompleteResult = await applyPolicyNativeIntentReversion({
      dbClient: { withTransaction: async work => work(incompleteClient) },
      ...request(),
    });

    expect(incompleteResult.validation.issues[0].riskId).toBe(
      POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.SNAPSHOT_MANIFEST_INVALID
    );
    expect(incompleteClient.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE policy_intents'),
      expect.anything()
    );
  });

  test('blocks ordinary policy activity before starting a transaction', async () => {
    const dbClient = { withTransaction: jest.fn() };

    const result = await applyPolicyNativeIntentReversion({
      dbClient,
      ...request({ action: { actorSourceId: 'ordinary_policy_read', reasonCode: 'bad' } }),
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.BLOCKED_BY_ACTION);
    expect(result.validation.issues[0].riskId).toBe(POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.ACTION_NOT_ALLOWED);
    expect(dbClient.withTransaction).not.toHaveBeenCalled();
  });

  test('requires an explicit bounded reason code and a transaction boundary', async () => {
    const invalidActionResult = await applyPolicyNativeIntentReversion({
      dbClient: { withTransaction: jest.fn() },
      ...request({ action: { actorSourceId: 'manual_operator', actorId: 7, reasonCode: '' } }),
    });
    const noTransactionResult = await applyPolicyNativeIntentReversion({
      ...request(),
      dbClient: {},
    });

    expect(invalidActionResult.validation.issues[0].riskId).toBe(
      POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.ACTION_REASON_INVALID
    );
    expect(noTransactionResult.statusId).toBe(
      POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY
    );

    const missingActorResult = await applyPolicyNativeIntentReversion({
      dbClient: { withTransaction: jest.fn() },
      ...request({ action: { actorSourceId: 'manual_operator', reasonCode: 'operator_requested_reversion' } }),
    });
    expect(missingActorResult.validation.issues[0].riskId).toBe(
      POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.ACTION_ACTOR_INVALID
    );
  });

  test('blocks ambiguous or non-successor native authority without mutations', async () => {
    const client = createClient({
      intents: [
        ...compatibilityIntents(),
        {
          id: 202,
          policy_id: 44,
          library_id: 6,
          intent_version: 2,
          active: true,
          replaced_by_intent_id: null,
        },
      ],
    });
    const dbClient = { withTransaction: async work => work(client) };

    const result = await applyPolicyNativeIntentReversion({ dbClient, ...request() });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.BLOCKED_BY_AUTHORITY);
    expect(result.validation.issues[0].riskId).toBe(
      POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.MULTIPLE_ACTIVE_INTENTS
    );
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE policy_intents'),
      expect.anything()
    );
  });

  test('is idempotent when a rollback snapshot was already restored', async () => {
    const client = createClient({
      rollbackSnapshot: snapshot({ restored_at: '2026-07-14T11:00:00.000Z' }),
    });
    const dbClient = { withTransaction: async work => work(client) };

    const result = await applyPolicyNativeIntentReversion({ dbClient, ...request() });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.ALREADY_REVERTED);
    expect(result.validation.ok).toBe(true);
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('FROM policy_intents'),
      expect.anything()
    );
  });

  test('returns a bounded rolled-back failure when persistence rejects', async () => {
    const client = createClient({ failStatement: 'INSERT INTO policy_intent_migration_events' });
    const dbClient = {
      withTransaction: async work => {
        try {
          return await work(client);
        } catch (error) {
          throw error;
        }
      },
    };

    const result = await applyPolicyNativeIntentReversion({ dbClient, ...request() });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.FAILED_ROLLED_BACK);
    expect(result.validation.issues[0].riskId).toBe(
      POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.TRANSACTION_FAILED
    );
  });
});
