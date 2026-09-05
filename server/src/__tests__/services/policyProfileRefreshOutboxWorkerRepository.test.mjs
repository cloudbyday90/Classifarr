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
  claimPolicyProfileRefreshOutboxBatch,
  closeExpiredPolicyProfileRefreshOutboxClaims,
  completePolicyProfileRefreshOutboxClaim,
  failPolicyProfileRefreshOutboxClaim,
} from '../../services/policyProfileRefreshOutboxWorkerRepository.mjs';

const claimToken = '3c3cdd11-8871-4f14-874a-8ea0b1e15a5d';

function clientWith(rows) {
  return { query: jest.fn().mockResolvedValue({ rows }) };
}

describe('policyProfileRefreshOutboxWorkerRepository', () => {
  test('claims only eligible committed records with a deterministic SKIP LOCKED batch', async () => {
    const client = clientWith([{
      id: '91',
      library_id: '8',
      attempt_count: 2,
      request_type: 'learning_evidence',
    }]);

    const records = await claimPolicyProfileRefreshOutboxBatch({
      client,
      claimToken,
      limit: 5,
      leaseSeconds: 120,
    });

    expect(records).toEqual([{
      id: '91',
      libraryId: '8',
      attemptCount: 2,
      requestType: 'learning_evidence',
    }]);
    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(client.query.mock.calls[0][0]).toContain('ORDER BY created_at ASC, id ASC');
    expect(client.query.mock.calls[0][0]).toContain('request_type = ANY($1::text[])');
    expect(client.query.mock.calls[0][1]).toEqual([
      ['learning_evidence', 'native_readiness', 'inventory_change'],
      3,
      'pending',
      'processing',
      5,
      claimToken,
      120,
    ]);
  });

  test('closes an expired final-attempt lease before another worker can run it', async () => {
    const client = clientWith([{ id: '91' }]);

    const closed = await closeExpiredPolicyProfileRefreshOutboxClaims({ client });

    expect(closed).toBe(1);
    expect(client.query.mock.calls[0][0]).toContain('lease_expires_at <= NOW()');
    expect(client.query.mock.calls[0][1]).toEqual([
      'failed',
      'profile_refresh_lease_expired',
      'processing',
      3,
    ]);
  });

  test('completes only the current worker claim', async () => {
    const client = clientWith([{ id: '91' }]);

    await expect(completePolicyProfileRefreshOutboxClaim({
      client,
      outboxId: '91',
      claimToken,
    })).resolves.toBe(true);

    expect(client.query.mock.calls[0][0]).toContain('claim_token = $4::uuid');
    expect(client.query.mock.calls[0][1]).toEqual([
      'completed',
      '91',
      'processing',
      claimToken,
    ]);
  });

  test('returns a bounded terminal state after the final failed attempt', async () => {
    const client = clientWith([{ id: '91', processing_state: 'failed', attempt_count: 3 }]);

    const result = await failPolicyProfileRefreshOutboxClaim({
      client,
      outboxId: '91',
      claimToken,
      retryDelaySeconds: 60,
    });

    expect(result).toEqual({ updated: true, terminal: true });
    expect(client.query.mock.calls[0][0]).toContain('WHEN attempt_count >= $1 OR NOT $2::boolean THEN $3');
    expect(client.query.mock.calls[0][1]).toEqual([
      3,
      true,
      'failed',
      'pending',
      60,
      'profile_refresh_execution_failed',
      '91',
      'processing',
      claimToken,
    ]);
  });

  test('makes a fixed non-retryable failure terminal before the attempt limit', async () => {
    const client = clientWith([{ id: '91', processing_state: 'failed', attempt_count: 1 }]);

    await expect(failPolicyProfileRefreshOutboxClaim({
      client,
      outboxId: '91',
      claimToken,
      retryDelaySeconds: 60,
      retryable: false,
      failureCode: 'profile_refresh_configuration_invalid',
    })).resolves.toEqual({ updated: true, terminal: true });

    expect(client.query.mock.calls[0][1]).toEqual(expect.arrayContaining([
      false,
      'profile_refresh_configuration_invalid',
    ]));
  });
});
