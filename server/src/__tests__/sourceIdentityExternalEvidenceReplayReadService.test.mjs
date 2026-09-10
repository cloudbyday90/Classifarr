/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, jest, test } from '@jest/globals';
import { createSourceIdentityExternalEvidenceReplayReadService } from '../services/sourceIdentityExternalEvidenceReplayReadService.mjs';

describe('source identity external evidence replay read service', () => {
  test('uses a repeatable read-only transaction before returning the bounded selection', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const withTransaction = jest.fn(async (callback) => callback(client));
    const readRows = jest.fn(async ({ query, limits }) => {
      await query('SELECT bounded_source_identity_replay');
      return [{ library_id: 1, limit: limits.maximumObservations }];
    });
    const service = createSourceIdentityExternalEvidenceReplayReadService({ withTransaction, readRows });

    await expect(service.read({ maximumObservations: 32 })).resolves.toEqual([{ library_id: 1, limit: 32 }]);

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenNthCalledWith(1, 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(client.query).toHaveBeenNthCalledWith(2, 'SELECT bounded_source_identity_replay');
    expect(readRows).toHaveBeenCalledWith(expect.objectContaining({
      limits: { maximumObservations: 32 },
      query: expect.any(Function),
    }));
  });

  test('rejects a missing transaction boundary', () => {
    expect(() => createSourceIdentityExternalEvidenceReplayReadService({ withTransaction: null }))
      .toThrow('read-only transaction dependency');
  });
});
