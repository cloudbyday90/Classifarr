/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventoryDescriptionRefreshRepository, INVENTORY_DESCRIPTION_REFRESH_STATE_SQL } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { INVENTORY_DESCRIPTION_CORPUS_SQL } from '../../services/inventoryDescriptionCorpus.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from '../../services/sourceConflictAuthorityGuard.mjs';

test('repository bounds SQL locally and reads only saved configuration and current corpus', async () => {
  const row = { media_type: 'movie', tmdb_id: 1, library_id: 2, overview: 'A documentary.' };
  const client = { query: jest.fn(async sql => ({ rows: sql === INVENTORY_DESCRIPTION_CORPUS_SQL ? [row] : [] })) };
  const withTransaction = jest.fn(async callback => callback(client));
  const repository = createInventoryDescriptionRefreshRepository({ withTransaction });
  expect(await repository.readState()).toBeNull();
  const corpus = await repository.readCorpus();
  expect(corpus.coverage.eligibleIdentities).toBe(1);
  expect(client.query.mock.calls).toEqual([
    ["SET LOCAL statement_timeout = '15s'"], ["SET LOCAL lock_timeout = '2s'"], [INVENTORY_DESCRIPTION_REFRESH_STATE_SQL, []],
    ["SET LOCAL statement_timeout = '15s'"], ["SET LOCAL lock_timeout = '2s'"], [INVENTORY_DESCRIPTION_CORPUS_SQL, [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]],
  ]);
  expect(INVENTORY_DESCRIPTION_REFRESH_STATE_SQL).not.toMatch(/api_key|password|token|SELECT \*/i);
});

test('SQL errors propagate to the worker cooldown without returning a partial corpus', async () => {
  const client = { query: jest.fn().mockRejectedValue(new Error('statement timeout')) };
  const repository = createInventoryDescriptionRefreshRepository({ withTransaction: callback => callback(client) });
  await expect(repository.readCorpus()).rejects.toThrow('statement timeout');
});
