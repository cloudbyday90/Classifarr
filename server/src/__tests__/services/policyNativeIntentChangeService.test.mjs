/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS,
  applyPolicyNativeIntentChange,
} from '../../services/policyNativeIntentChangeService.mjs';
import {
  buildPolicyNativeIntentChangeCommandFingerprint,
} from '../../services/policyNativeIntentChangeReceiptContract.mjs';

const VALID_PURPOSE_CHANGE_VALUES = [{
  signal_type: 'genres',
  operator: 'require_any',
  values: { require_any: ['Animation'] },
  constraint_mode: 'advisory',
  semantics: 'identity',
}];

const CANONICAL_PURPOSE_CHANGE_VALUES = [{
  ...VALID_PURPOSE_CHANGE_VALUES[0],
  source: 'native_intent',
  inference_state: 'inferred',
}];

const VALID_INPUT = {
  policyId: 42,
  expectedRevision: 3,
  actorId: 1,
  actorRole: 'admin',
  idempotencyKey: 'a'.repeat(32),
  changeCommands: [{ commandId: 'update_purpose', values: VALID_PURPOSE_CHANGE_VALUES }],
  authorityState: { stateId: 'single_active_native_intent', currentRevision: 3 },
};

function buildReceiptRow(overrides = {}) {
  return {
    id: 300,
    receipt_version: 1,
    policy_id: 42,
    actor_id: 1,
    idempotency_key: 'a'.repeat(32),
    command_fingerprint: 'f'.repeat(64),
    source_intent_version: 3,
    target_intent_id: 100,
    target_intent_version: 4,
    migration_event_id: 200,
    applied_command_ids: ['update_purpose'],
    result_status_id: 'applied',
    created_at: new Date('2026-08-16T18:00:00.000Z'),
    ...overrides,
  };
}

function buildMockClient({
  policyRow,
  intentRow,
  deactivateSucceeds = true,
  lockAcquired = true,
  receiptRow = null,
}) {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });

      if (sql.includes('pg_try_advisory_xact_lock')) {
        return { rows: [{ acquired: lockAcquired }] };
      }

      if (sql.includes('FROM policy_native_intent_change_receipts')) {
        return { rows: receiptRow ? [receiptRow] : [] };
      }

      if (sql.includes('FROM library_policies') && sql.includes('FOR UPDATE')) {
        return { rows: policyRow ? [policyRow] : [] };
      }

      if (sql.includes('FROM policy_intents') && sql.includes('active = TRUE') && sql.includes('FOR UPDATE')) {
        return { rows: intentRow ? [intentRow] : [] };
      }

      if (sql.includes('UPDATE policy_intents') && sql.includes('SET active = FALSE')) {
        return { rowCount: deactivateSucceeds ? 1 : 0 };
      }

      if (sql.includes('INSERT INTO policy_intents')) {
        return { rows: [{ id: 100, intent_version: 4 }] };
      }

      if (sql.includes('INSERT INTO policy_intent_migration_events')) {
        return { rows: [{ id: 200 }] };
      }

      if (sql.includes('INSERT INTO policy_native_intent_change_receipts')) {
        return { rows: [buildReceiptRow()] };
      }

      return { rows: [] };
    },
  };

  return { client, queries };
}

function buildMockDbClient(client) {
  return {
    async withTransaction(fn) {
      return fn(client);
    },
  };
}

describe('applyPolicyNativeIntentChange', () => {
  test('applies a change when admission passes and revision matches inside the transaction', async () => {
    const { client, queries } = buildMockClient({
      policyRow: { id: 42, library_id: 7 },
      intentRow: {
        id: 50, policy_id: 42, library_id: 7, intent_version: 3,
        active: true, source: 'native_intent', inference_state: 'inferred',
        validation_status: 'valid',
      },
    });
    const dbClient = buildMockDbClient(client);

    const result = await applyPolicyNativeIntentChange({
      ...VALID_INPUT,
      dbClient,
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED);
    expect(result.change.applied).toBe(true);
    expect(result.change.newIntentId).toBe(100);
    expect(result.change.newIntentVersion).toBe(4);
    expect(result.change.appliedCommandIds).toEqual(['update_purpose']);
    expect(result.change.migrationEventId).toBe(200);
    expect(result.retry).toEqual(expect.objectContaining({
      mode: 'durable_idempotency_receipt',
      receiptPersisted: true,
      replayed: false,
      idempotencyKeyExposed: false,
    }));
    expect(result.sideEffects.policyStorageMutated).toBe(true);
    expect(result.sideEffects.databaseWritten).toBe(true);
    expect(queries.length).toBeGreaterThanOrEqual(5);
    expect(queries.find(({ sql }) => (
      sql.includes('INSERT INTO policy_intent_migration_events')
    ))?.sql).toContain('native_intent_change_applied');
    expect(queries.find(({ sql }) => (
      sql.includes('INSERT INTO policy_native_intent_change_receipts')
    ))?.params).toEqual(expect.arrayContaining([
      'a'.repeat(32),
      expect.any(String),
      JSON.stringify(['update_purpose']),
    ]));
  });

  test('replays an exact committed request before checking the now-stale active revision', async () => {
    const fingerprint = buildPolicyNativeIntentChangeCommandFingerprint({
      policyId: 42,
      actorId: 1,
      expectedRevision: 3,
      changeCommands: [{ commandId: 'update_purpose', values: CANONICAL_PURPOSE_CHANGE_VALUES }],
    });
    const { client, queries } = buildMockClient({
      receiptRow: buildReceiptRow({
        command_fingerprint: fingerprint,
        idempotency_key: 'a'.repeat(32),
      }),
      policyRow: { id: 42, library_id: 7 },
      intentRow: null,
    });
    const dbClient = buildMockDbClient(client);

    const replayed = await applyPolicyNativeIntentChange({ ...VALID_INPUT, dbClient });

    expect(replayed.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED);
    expect(replayed.change).toEqual(expect.objectContaining({
      applied: true,
      replayed: true,
      newIntentId: 100,
      newIntentVersion: 4,
      appliedCommandIds: ['update_purpose'],
    }));
    expect(replayed.sideEffects).toEqual(expect.objectContaining({
      policyStorageMutated: false,
      databaseWritten: false,
    }));
    expect(queries.some(({ sql }) => sql.includes('FROM library_policies'))).toBe(false);
  });

  test('rejects a reused key whose canonical request differs from its committed receipt', async () => {
    const receiptFingerprint = buildPolicyNativeIntentChangeCommandFingerprint({
      policyId: 42,
      actorId: 1,
      expectedRevision: 3,
      changeCommands: [{ commandId: 'update_purpose', values: CANONICAL_PURPOSE_CHANGE_VALUES }],
    });
    const { client, queries } = buildMockClient({
      receiptRow: buildReceiptRow({ command_fingerprint: receiptFingerprint }),
      policyRow: { id: 42, library_id: 7 },
      intentRow: null,
    });

    const result = await applyPolicyNativeIntentChange({
      ...VALID_INPUT,
      dbClient: buildMockDbClient(client),
      changeCommands: [{
        commandId: 'update_purpose',
        values: [{ ...VALID_PURPOSE_CHANGE_VALUES[0], values: { require_any: ['Comedy'] } }],
      }],
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.IDEMPOTENCY_KEY_REUSED);
    expect(result.change.applied).toBe(false);
    expect(queries.some(({ sql }) => sql.includes('FROM library_policies'))).toBe(false);
  });

  test('returns a bounded conflict when the same key is currently held by another transaction', async () => {
    const { client, queries } = buildMockClient({
      lockAcquired: false,
      policyRow: { id: 42, library_id: 7 },
      intentRow: null,
    });

    const result = await applyPolicyNativeIntentChange({
      ...VALID_INPUT,
      dbClient: buildMockDbClient(client),
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.IDEMPOTENCY_KEY_IN_PROGRESS);
    expect(result.change.applied).toBe(false);
    expect(queries).toHaveLength(1);
  });

  test('returns stale_revision when the revision changed after the lock', async () => {
    const { client } = buildMockClient({
      policyRow: { id: 42, library_id: 7 },
      intentRow: {
        id: 50, policy_id: 42, library_id: 7, intent_version: 5,
        active: true, source: 'native_intent', inference_state: 'inferred',
        validation_status: 'valid',
      },
    });
    const dbClient = buildMockDbClient(client);

    const result = await applyPolicyNativeIntentChange({
      ...VALID_INPUT,
      dbClient,
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.STALE_REVISION);
    expect(result.change.applied).toBe(false);
  });

  test('returns unavailable_authority when no active intent exists after lock', async () => {
    const { client } = buildMockClient({
      policyRow: { id: 42, library_id: 7 },
      intentRow: null,
    });
    const dbClient = buildMockDbClient(client);

    const result = await applyPolicyNativeIntentChange({
      ...VALID_INPUT,
      dbClient,
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.UNAVAILABLE_AUTHORITY);
  });

  test('returns authorization_rejected when actor is not admin', async () => {
    const result = await applyPolicyNativeIntentChange({
      ...VALID_INPUT,
      actorRole: 'user',
      dbClient: buildMockDbClient({ query: async () => ({ rows: [] }) }),
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.AUTHORIZATION_REJECTED);
    expect(result.change.applied).toBe(false);
  });

  test('returns blocked_by_transaction_boundary without a database client', async () => {
    const result = await applyPolicyNativeIntentChange(VALID_INPUT);

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY);
  });

  test('returns failed_rolled_back when the transaction throws', async () => {
    const dbClient = {
      async withTransaction() {
        throw new Error('database connection lost');
      },
    };

    const result = await applyPolicyNativeIntentChange({
      ...VALID_INPUT,
      dbClient,
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.FAILED_ROLLED_BACK);
    expect(result.change.applied).toBe(false);
  });

  test('returns retryable when change commands are empty', async () => {
    const result = await applyPolicyNativeIntentChange({
      ...VALID_INPUT,
      changeCommands: [],
      dbClient: buildMockDbClient({ query: async () => ({ rows: [] }) }),
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.RETRYABLE);
  });

  test('does not start a transaction when a durable idempotency key is missing', async () => {
    let transactionCount = 0;
    const result = await applyPolicyNativeIntentChange({
      ...VALID_INPUT,
      idempotencyKey: undefined,
      dbClient: {
        async withTransaction() {
          transactionCount += 1;
          throw new Error('must not enter transaction');
        },
      },
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.RETRYABLE);
    expect(result.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: 'missing_idempotency_key' }),
    ]));
    expect(transactionCount).toBe(0);
  });

  test('does not touch the database when admission is rejected', async () => {
    let queryCount = 0;
    const dbClient = {
      async withTransaction(fn) {
        return fn({
          async query() { queryCount++; return { rows: [] }; },
        });
      },
    };

    const result = await applyPolicyNativeIntentChange({
      ...VALID_INPUT,
      actorRole: 'user',
      dbClient,
    });

    expect(result.change.applied).toBe(false);
    expect(queryCount).toBe(0);
  });
});
