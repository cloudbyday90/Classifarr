/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  ClassificationCandidateBoundVerificationCapabilityChangeReceiptReadService,
  normalizeCandidateBoundVerificationCapabilityChangeReceiptQuery,
} from '../../services/classificationCandidateBoundVerificationCapabilityChangeReceiptReadService.mjs';

function receiptRow(id) {
  return {
    id: String(id),
    before_status_id: 'primary_path_ineligible',
    after_status_id: 'verification_ready',
    configuration_revision: String(id + 100),
    created_at: '2026-08-13T12:00:00.000Z',
  };
}

describe('candidate-bound verification capability change receipt read service', () => {
  test('returns a bounded, status-only projection with actor-scoped keyset pagination', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const listForActor = jest.fn().mockResolvedValue([11, 10, 9, 8, 7, 6].map(receiptRow));
    const db = {
      withTransaction: jest.fn(async (callback) => callback(client)),
    };
    const service = new ClassificationCandidateBoundVerificationCapabilityChangeReceiptReadService({
      db,
      receiptRepository: { listForActor },
    });

    const result = await service.list({ actorId: 'user:42', query: { limit: '5' } });

    expect(client.query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(listForActor).toHaveBeenCalledWith({
      client,
      actorId: 'user:42',
      beforeReceiptId: null,
      limit: 6,
    });
    expect(result.receipts).toHaveLength(5);
    expect(result.receipts[0]).toEqual(expect.objectContaining({
      receiptId: '11',
      before: { statusId: 'primary_path_ineligible', label: 'Strict verification needs attention' },
      after: { statusId: 'verification_ready', label: 'Strict verification is available' },
      configurationRevision: '111',
    }));
    expect(result.nextBefore).toBe('7');
    expect(result).not.toHaveProperty('actorId');
    expect(result.receipts[0]).not.toHaveProperty('provider');
    expect(result.receipts[0]).not.toHaveProperty('model');
    expect(result.receipts[0]).not.toHaveProperty('apiKey');
    expect(result.sideEffects).toEqual({
      providerCalled: false,
      configurationPersisted: false,
      routingChanged: false,
      policyChanged: false,
      retryQueued: false,
    });
  });

  test('rejects unknown query fields and caller-selected actor forms', async () => {
    expect(() => normalizeCandidateBoundVerificationCapabilityChangeReceiptQuery({ actorId: 'user:7' }))
      .toThrow('Unsupported verification capability receipt query parameters');
    expect(() => normalizeCandidateBoundVerificationCapabilityChangeReceiptQuery({ limit: '21' }))
      .toThrow('outside the supported range');

    const service = new ClassificationCandidateBoundVerificationCapabilityChangeReceiptReadService({
      db: { withTransaction: jest.fn() },
      receiptRepository: { listForActor: jest.fn() },
    });
    await expect(service.list({ actorId: 'admin:42' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
