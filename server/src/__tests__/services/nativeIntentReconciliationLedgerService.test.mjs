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
  NativeIntentReconciliationLedgerService,
} from '../../services/nativeIntentReconciliationLedgerService.mjs';

describe('NativeIntentReconciliationLedgerService', () => {
  test('writes a run and its compact outcomes in a post-conversion transaction', async () => {
    const client = {
      query: jest.fn(async sql => {
        if (String(sql).includes('INSERT INTO policy_native_intent_reconciliation_runs')) {
          return { rows: [{ id: 70 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    const db = {
      withTransaction: jest.fn(async callback => callback(client)),
    };
    const logger = { info: jest.fn() };
    const service = new NativeIntentReconciliationLedgerService({
      db,
      loggerInstance: logger,
      now: () => new Date('2026-07-15T12:00:04.000Z'),
      buildRecord: input => ({
        run: {
          runKey: 'a9cf9f4a-61e3-4ca7-8fe6-b810efff7c1c',
          reconcilerVersion: 'native_intent_reconciliation.ledger.v1',
          runState: 'applied',
          sourceStatusId: 'applied',
          reasonId: 'conversion_applied',
          startedAt: input.startedAt,
          finishedAt: input.finishedAt,
          candidateCount: 1,
          convertedCount: 1,
          alreadyNativeCount: 0,
          deferredCount: 0,
          blockedCount: 0,
          failedCount: 0,
        },
        outcomes: [{
          policyId: 10,
          candidateFingerprint: `sha256:${'a'.repeat(64)}`,
          candidateStatusId: 'ready_to_convert',
          outcomeState: 'applied',
          reasonId: 'conversion_applied',
          retryNotBefore: null,
          rawLegacyJson: { customSignals: ['must not be persisted'] },
        }],
      }),
    });

    const result = await service.record({
      applyGate: { statusId: 'applied' },
      startedAt: '2026-07-15T12:00:00.000Z',
    });

    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      statusId: 'persisted',
      runId: 70,
      rawPayloadExposed: false,
      counts: { candidateCount: 1, convertedCount: 1 },
    });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_native_intent_reconciliation_outcomes'),
      expect.not.arrayContaining([expect.stringContaining('must not be persisted')]),
    );
    expect(JSON.stringify(client.query.mock.calls)).not.toContain('customSignals');
  });

  test('requires an atomic transaction boundary for every ledger write', async () => {
    const service = new NativeIntentReconciliationLedgerService({ db: {} });

    await expect(service.record({ applyGate: { statusId: 'applied' } }))
      .rejects.toThrow('requires a transaction boundary');
  });
});
