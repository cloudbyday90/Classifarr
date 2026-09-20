/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { INVENTORY_TRAINING_HISTORY_SQL, readInventoryTrainingExclusions } from '../../services/inventoryTrainingProvenance.mjs';
import { buildClassificationCandidateCapture } from '../../services/classificationCandidateCapture.mjs';

const documents = [{ key: 'movie:12', type: 'movie', id: 12 }, { key: 'tv:12', type: 'tv', id: 12 }];
test('bounded parameterized lookup keeps movie/TV identity separate and selects no private history payload', async () => {
  const client = { query: jest.fn(async () => ({ rows: [{ media_type: 'movie', tmdb_id: 12 }] })) };
  expect(await readInventoryTrainingExclusions(client, documents)).toEqual(new Set(['movie:12']));
  expect(client.query).toHaveBeenCalledWith(INVENTORY_TRAINING_HISTORY_SQL, [['movie', 'tv'], [12, 12],
    JSON.stringify(buildClassificationCandidateCapture({ method: 'source_library' }))]);
  expect(INVENTORY_TRAINING_HISTORY_SQL.split('FROM unnest')[0]).toBe('SELECT input.media_type, input.tmdb_id\n  ');
  expect(INVENTORY_TRAINING_HISTORY_SQL).not.toMatch(/title|DELETE|UPDATE|INSERT/i);
  expect(await readInventoryTrainingExclusions(client, [])).toEqual(new Set()); expect(client.query).toHaveBeenCalledTimes(1);
});
test.each([null, [{ media_type: 'movie', tmdb_id: 999 }], [{ media_type: 'movie', tmdb_id: '12' }],
  [{ media_type: 'movie', tmdb_id: 12 }, { media_type: 'movie', tmdb_id: 12 }], new Array(3).fill({})])('rejects malformed or out-of-scope provenance results', async rows => {
  await expect(readInventoryTrainingExclusions({ query: async () => ({ rows }) }, documents)).rejects.toThrow();
});
test('rejects malformed and excessive identities before querying', async () => {
  const query = jest.fn();
  for (const docs of [null, new Array(50001), [{ ...documents[0], key: 'wrong' }], [{ ...documents[0], id: 0 }]]) {
    await expect(readInventoryTrainingExclusions({ query }, docs)).rejects.toThrow();
  }
  expect(query).not.toHaveBeenCalled();
});
