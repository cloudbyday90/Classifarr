/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  PolicyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService,
} from '../../services/policyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService.mjs';

const RECEIPT_ID = '4b8d027d-8daf-4186-a9f8-89df6f69c95e';

function createDb() {
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  return {
    client,
    db: {
      withTransaction: jest.fn(async callback => callback(client)),
    },
  };
}

describe('PolicyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService', () => {
  test('returns one actor-bound receipt reference without exposing receipt contents', async () => {
    const { db, client } = createDb();
    const receiptRepository = {
      findMostRecentReceiptForActor: jest.fn().mockResolvedValue({
        receipt_id: RECEIPT_ID,
        actor_id: 'user:7',
        requested_record_count: 50,
      }),
    };
    const service = new PolicyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService({ db, receiptRepository });

    const result = await service.run({ actorId: 'user:7' });

    expect(client.query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(receiptRepository.findMostRecentReceiptForActor).toHaveBeenCalledWith(client, { actorId: 'user:7' });
    expect(result).toEqual({
      version: 'policy.runtime_historic_route_safety_refresh_recent_receipt_discovery.v1',
      mode: 'read_only',
      recentReceipt: { retryReceipt: RECEIPT_ID },
      sideEffects: {
        classificationRowsMutated: false,
        retryCommandsExecuted: false,
        routesExecuted: false,
        learningWritten: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('actor_id');
    expect(JSON.stringify(result)).not.toContain('requested_record_count');
  });

  test('returns no receipt when the actor has no receipt in the fixed discovery window', async () => {
    const { db } = createDb();
    const service = new PolicyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService({
      db,
      receiptRepository: { findMostRecentReceiptForActor: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.run({ actorId: 'user:7' })).resolves.toMatchObject({ recentReceipt: null });
  });

  test('rejects invalid actor input before opening a read transaction', async () => {
    const { db } = createDb();
    const service = new PolicyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService({
      db,
      receiptRepository: { findMostRecentReceiptForActor: jest.fn() },
    });

    await expect(service.run({ actorId: 'admin' })).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });
    expect(db.withTransaction).not.toHaveBeenCalled();
  });
});
