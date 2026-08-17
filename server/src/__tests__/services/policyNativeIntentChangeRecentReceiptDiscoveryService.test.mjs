/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS,
} from '../../services/policyNativeIntentChangeRecentReceiptDiscoveryContract.mjs';
import {
  createPolicyNativeIntentChangeRecentReceiptDiscoveryService,
} from '../../services/policyNativeIntentChangeRecentReceiptDiscoveryService.mjs';

function createReadOnlyDb(client = { query: jest.fn() }) {
  return {
    withTransaction: jest.fn(async work => work(client)),
  };
}

describe('policyNativeIntentChangeRecentReceiptDiscoveryService', () => {
  test('uses a repeatable read-only transaction and returns one bounded matching receipt', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const dbClient = createReadOnlyDb(client);
    const loadContext = jest.fn().mockResolvedValue({
      result_status_id: 'applied',
      source_intent_version: 3,
      target_intent_version: 4,
    });
    const service = createPolicyNativeIntentChangeRecentReceiptDiscoveryService({ loadContext });

    const result = await service.getRecentReceipt({ dbClient, policyId: 17, actorId: 7 });

    expect(dbClient.withTransaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(loadContext).toHaveBeenCalledWith({
      client,
      actorId: 7,
      policyId: 17,
      maxAgeSeconds: 3600,
    });
    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS.COMPLETE,
      recentChange: {
        resultStatusId: 'applied',
        sourceIntentVersion: 3,
        targetIntentVersion: 4,
      },
    }));
  });

  test('returns a bounded empty result for a qualifying actor and policy without a recent receipt', async () => {
    const loadContext = jest.fn().mockResolvedValue(null);
    const service = createPolicyNativeIntentChangeRecentReceiptDiscoveryService({ loadContext });

    const result = await service.getRecentReceipt({
      dbClient: createReadOnlyDb(),
      policyId: 17,
      actorId: 7,
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS.COMPLETE,
      policyId: 17,
      recentChange: null,
    }));
  });

  test('fails closed for invalid actor scope, malformed persisted data, or a read failure', async () => {
    const loadContext = jest.fn().mockResolvedValue({
      result_status_id: 'applied',
      source_intent_version: 4,
      target_intent_version: 4,
    });
    const service = createPolicyNativeIntentChangeRecentReceiptDiscoveryService({ loadContext });

    const invalidActor = await service.getRecentReceipt({
      dbClient: createReadOnlyDb(),
      policyId: 17,
      actorId: 0,
    });
    const invalidReceipt = await service.getRecentReceipt({
      dbClient: createReadOnlyDb(),
      policyId: 17,
      actorId: 7,
    });

    expect(invalidActor.statusId).toBe(
      POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS.UNAVAILABLE,
    );
    expect(invalidReceipt.statusId).toBe(
      POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS.UNAVAILABLE,
    );
  });
});
