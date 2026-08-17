/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

import {
  POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_STATE_IDS,
  POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS,
  buildPolicyNativeIntentChangeReceiptRetentionResult,
  getPolicyNativeIntentChangeReceiptCapacityState,
  normalizeRetentionBatchSize,
} from '../../services/policyNativeIntentChangeReceiptRetentionContract.mjs';
import {
  PolicyNativeIntentChangeReceiptRetentionService,
} from '../../services/policyNativeIntentChangeReceiptRetentionService.mjs';

const NOW = '2026-08-16T12:00:00.000Z';

function createLogger() {
  return {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

function createClient({
  lockAcquired = true,
  summaries = [{ total: 3, expired: 2 }, { total: 1, expired: 0 }],
  deletedReceiptCount = 2,
  failDelete = false,
} = {}) {
  const queue = [...summaries];
  const calls = [];
  const client = {
    calls,
    query: jest.fn(async (sql, params = []) => {
      const statement = String(sql);
      calls.push({ sql: statement, params });
      if (statement.includes('pg_try_advisory_xact_lock')) {
        return { rows: [{ acquired: lockAcquired }] };
      }
      if (statement.includes('total_receipt_count')) {
        const next = queue.shift() || { total: 0, expired: 0 };
        return {
          rows: [{
            total_receipt_count: String(next.total),
            expired_receipt_count: String(next.expired),
          }],
        };
      }
      if (statement.includes("set_config('classifarr.policy_native_intent_change_receipt_maintenance'")) {
        return { rows: [{ set_config: 'retention_cleanup' }] };
      }
      if (statement.includes('WITH expired_receipts AS MATERIALIZED')) {
        if (failDelete) throw new Error('simulated delete failure');
        return { rows: [{ deleted_receipt_count: String(deletedReceiptCount) }] };
      }
      throw new Error(`Unexpected statement: ${statement}`);
    }),
  };
  return client;
}

function createDb(client) {
  return {
    withTransaction: jest.fn(async work => work(client)),
  };
}

describe('policyNativeIntentChangeReceiptRetentionService', () => {
  test('uses a transaction-scoped lock and permit to delete only one bounded expired batch', async () => {
    const client = createClient();
    const logger = createLogger();
    const service = new PolicyNativeIntentChangeReceiptRetentionService({
      db: createDb(client),
      logger,
      lockKey: 2013,
    });

    const result = await service.cleanup({ now: NOW, batchSize: 2 });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS.COMPLETED,
      replayRetentionDays: 30,
      batchSize: 2,
      totalReceiptCount: 1,
      expiredReceiptCount: 0,
      deletedReceiptCount: 2,
      hasMore: false,
      receiptIdsExposed: false,
      receiptHistoryExposed: false,
      idempotencyKeysExposed: false,
      commandValuesExposed: false,
      policyAuthorityChanged: false,
      routingChanged: false,
      aiInvoked: false,
    }));

    expect(client.calls[0]).toEqual(expect.objectContaining({
      sql: expect.stringContaining('pg_try_advisory_xact_lock'),
      params: [2013],
    }));
    const permitIndex = client.calls.findIndex(call => call.sql.includes('set_config'));
    const deleteIndex = client.calls.findIndex(call => call.sql.includes('WITH expired_receipts AS MATERIALIZED'));
    expect(permitIndex).toBeGreaterThan(0);
    expect(deleteIndex).toBeGreaterThan(permitIndex);
    expect(client.calls[permitIndex].params).toEqual(['retention_cleanup']);
    expect(client.calls[deleteIndex].sql).toContain('ORDER BY created_at ASC, id ASC');
    expect(client.calls[deleteIndex].sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(client.calls[deleteIndex].params).toEqual(['2026-07-17T12:00:00.000Z', 2]);
    expect(logger.info).toHaveBeenCalledWith(
      'Native intent change receipt retention cleanup completed',
      expect.objectContaining({ deletedReceiptCount: 2 }),
    );
  });

  test('never requests the maintenance permit when all receipts remain protected', async () => {
    const client = createClient({
      summaries: [{ total: 25_000, expired: 0 }],
    });
    const logger = createLogger();
    const service = new PolicyNativeIntentChangeReceiptRetentionService({
      db: createDb(client),
      logger,
      lockKey: 2013,
    });

    const result = await service.cleanup({ now: NOW });

    expect(result).toEqual(expect.objectContaining({
      deletedReceiptCount: 0,
      totalReceiptCount: 25_000,
      expiredReceiptCount: 0,
      capacity: expect.objectContaining({
        stateId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_STATE_IDS.CRITICAL,
      }),
    }));
    expect(client.calls.some(call => call.sql.includes('set_config'))).toBe(false);
    expect(client.calls.some(call => call.sql.includes('WITH expired_receipts AS MATERIALIZED')))
      .toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'Native intent change receipt capacity pressure remains protected',
      expect.objectContaining({ capacityStateId: 'capacity_critical' }),
    );
  });

  test('returns a safe skip when another process owns the transaction lock', async () => {
    const client = createClient({ lockAcquired: false });
    const logger = createLogger();
    const service = new PolicyNativeIntentChangeReceiptRetentionService({
      db: createDb(client),
      logger,
      lockKey: 2013,
    });

    const result = await service.cleanup({ now: NOW });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS.CLEANUP_LOCKED,
      deletedReceiptCount: 0,
      reason: { reasonId: 'cleanup_lock_not_acquired' },
    }));
    expect(client.calls).toHaveLength(1);
    expect(logger.debug).toHaveBeenCalledWith(
      'Native intent change receipt retention cleanup skipped',
      expect.objectContaining({ statusId: 'cleanup_locked' }),
    );
  });

  test('rolls back failed cleanup without returning raw database details', async () => {
    const client = createClient({ failDelete: true });
    const logger = createLogger();
    const service = new PolicyNativeIntentChangeReceiptRetentionService({
      db: createDb(client),
      logger,
      lockKey: 2013,
    });

    const result = await service.cleanup({ now: NOW });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS.FAILED_ROLLED_BACK,
      deletedReceiptCount: 0,
      reason: { reasonId: 'transaction_failed' },
    }));
    expect(JSON.stringify(result)).not.toContain('simulated delete failure');
    expect(logger.error).toHaveBeenCalledWith(
      'Native intent change receipt retention cleanup failed',
      expect.objectContaining({ riskId: 'transaction_failed' }),
    );
  });

  test('requires a database transaction boundary before cleanup work', async () => {
    const service = new PolicyNativeIntentChangeReceiptRetentionService({
      db: {},
      logger: createLogger(),
      lockKey: 2013,
    });

    await expect(service.cleanup({ now: NOW })).resolves.toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS
        .TRANSACTION_BOUNDARY_REQUIRED,
      reason: { reasonId: 'transaction_boundary_required' },
    }));
  });

  test('bounds the contract batch and capacity state without accepting negative counts', () => {
    expect(normalizeRetentionBatchSize(999)).toBe(500);
    expect(normalizeRetentionBatchSize(0)).toBe(100);
    expect(getPolicyNativeIntentChangeReceiptCapacityState(9_999))
      .toBe(POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_STATE_IDS.WITHIN_CAPACITY);
    expect(getPolicyNativeIntentChangeReceiptCapacityState(10_000))
      .toBe(POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_STATE_IDS.WARNING);
    expect(getPolicyNativeIntentChangeReceiptCapacityState(25_000))
      .toBe(POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_STATE_IDS.CRITICAL);
    expect(buildPolicyNativeIntentChangeReceiptRetentionResult({
      statusId: 'unexpected',
      totalReceiptCount: -1,
      expiredReceiptCount: -1,
      deletedReceiptCount: -1,
    })).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS.FAILED_ROLLED_BACK,
      totalReceiptCount: 0,
      expiredReceiptCount: 0,
      deletedReceiptCount: 0,
    }));
  });
});
