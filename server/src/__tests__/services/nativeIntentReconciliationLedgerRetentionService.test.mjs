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
  NativeIntentReconciliationLedgerRetentionService,
} from '../../services/nativeIntentReconciliationLedgerRetentionService.mjs';

describe('NativeIntentReconciliationLedgerRetentionService', () => {
  test('prunes detail before headers with a transaction-scoped advisory lock', async () => {
    const client = {
      query: jest.fn(async sql => {
        const statement = String(sql);
        if (statement.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired: true }] };
        if (statement.includes('DELETE FROM policy_native_intent_reconciliation_outcomes')) {
          return { rows: [{ id: 1 }, { id: 2 }] };
        }
        if (statement.includes('DELETE FROM policy_native_intent_reconciliation_runs')) {
          return { rows: [{ id: 3 }] };
        }
        return { rows: [] };
      }),
    };
    const db = { withTransaction: jest.fn(async callback => callback(client)) };
    const logger = { info: jest.fn(), error: jest.fn() };
    const service = new NativeIntentReconciliationLedgerRetentionService({
      db,
      loggerInstance: logger,
      lockKey: 2009,
    });

    const result = await service.cleanup({
      now: '2026-07-15T12:00:00.000Z',
      batchSize: 10,
    });

    expect(result).toEqual({
      statusId: 'completed',
      evaluatedAt: '2026-07-15T12:00:00.000Z',
      outcomeDeletedCount: 2,
      runDeletedCount: 1,
      rawPayloadExposed: false,
    });
    const outcomeDelete = client.query.mock.calls.find(([sql]) => (
      String(sql).includes('DELETE FROM policy_native_intent_reconciliation_outcomes')
    ));
    const runDelete = client.query.mock.calls.find(([sql]) => (
      String(sql).includes('DELETE FROM policy_native_intent_reconciliation_runs')
    ));
    expect(outcomeDelete[1]).toEqual(['2026-06-15T12:00:00.000Z', 10]);
    expect(runDelete[1]).toEqual(['2026-04-16T12:00:00.000Z', 10]);
  });

  test('does not delete rows when another cleanup owns the advisory lock', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [{ acquired: false }] }),
    };
    const service = new NativeIntentReconciliationLedgerRetentionService({
      db: { withTransaction: jest.fn(async callback => callback(client)) },
      loggerInstance: { info: jest.fn(), error: jest.fn() },
      lockKey: 2009,
    });

    await expect(service.cleanup({ now: '2026-07-15T12:00:00.000Z' })).resolves.toMatchObject({
      statusId: 'cleanup_locked',
      outcomeDeletedCount: 0,
      runDeletedCount: 0,
    });
    expect(client.query).toHaveBeenCalledTimes(1);
  });
});
