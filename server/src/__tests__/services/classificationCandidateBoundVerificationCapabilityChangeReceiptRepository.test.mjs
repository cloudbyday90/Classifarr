/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  ClassificationCandidateBoundVerificationCapabilityChangeReceiptRepository,
} from '../../services/classificationCandidateBoundVerificationCapabilityChangeReceiptRepository.mjs';

const receipt = Object.freeze({
  actorId: 'user:42',
  beforeStatusId: 'primary_path_ineligible',
  afterStatusId: 'verification_ready',
  configurationRevision: 12,
});

describe('candidate-bound verification capability change receipt repository', () => {
  test('records a parameterized, append-only bounded receipt', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: '15', created_at: '2026-08-13T12:00:00.000Z' }],
      }),
    };
    const repository = new ClassificationCandidateBoundVerificationCapabilityChangeReceiptRepository();

    await expect(repository.record({ client, receipt })).resolves.toEqual({
      id: '15',
      created_at: '2026-08-13T12:00:00.000Z',
    });

    const [statement, values] = client.query.mock.calls[0];
    expect(statement).not.toContain('ON CONFLICT');
    expect(values).toEqual([
      'user:42',
      'primary_path_ineligible',
      'verification_ready',
      '12',
      'classification.candidate_bound_verification_capability_change_receipt.v1',
    ]);
    expect(statement).not.toContain('api_key');
    expect(statement).not.toContain('model');
  });

  test('propagates a duplicate-revision failure so the owning transaction can roll back', async () => {
    const duplicateRevisionError = Object.assign(
      new Error('duplicate key value violates unique constraint'),
      { code: '23505' },
    );
    const client = {
      query: jest.fn().mockRejectedValue(duplicateRevisionError),
    };
    const repository = new ClassificationCandidateBoundVerificationCapabilityChangeReceiptRepository();

    await expect(repository.record({ client, receipt })).rejects.toBe(duplicateRevisionError);
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  test('uses the server-provided actor as a mandatory scope for keyset reads', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const repository = new ClassificationCandidateBoundVerificationCapabilityChangeReceiptRepository();

    await repository.listForActor({
      client,
      actorId: 'user:42',
      beforeReceiptId: '15',
      limit: 6,
    });

    const [statement, values] = client.query.mock.calls[0];
    expect(statement).toContain('WHERE actor_id = $1');
    expect(statement).toContain('id < $2::bigint');
    expect(statement).toContain('ORDER BY id DESC');
    expect(values).toEqual(['user:42', '15', 6]);
  });

  test('rejects unscoped and malformed receipt operations before querying', async () => {
    const client = { query: jest.fn() };
    const repository = new ClassificationCandidateBoundVerificationCapabilityChangeReceiptRepository();

    await expect(repository.record({
      client,
      receipt: { ...receipt, actorId: 'admin:42' },
    })).rejects.toThrow('actor ID is invalid');
    await expect(repository.listForActor({
      client,
      actorId: 'user:42',
      limit: 0,
    })).rejects.toThrow('limit must be a positive integer');
    expect(client.query).not.toHaveBeenCalled();
  });
});
