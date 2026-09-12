/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createDescriptionBenchmarkRepository, INVENTORY_METADATA_BENCHMARK_SQL } from '../../services/inventoryDescriptionBenchmarkRepository.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';

const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 2 };
const rows = [{ tmdb_id: 1, library_id: 1, media_type: 'movie', overview: 'Private synopsis' }];
function setup({ incomplete = false, libraryCount = 3, documents = rows } = {}) {
  const corpus = prepareInventoryDescriptionCorpus(documents);
  const query = jest.fn(async sql => ({ rows: sql === INVENTORY_METADATA_BENCHMARK_SQL ? documents
    : sql.includes('SELECT id, name') ? Array.from({ length: libraryCount }, (_, index) => ({ id: index + 1, name: 'Private', media_type: 'movie' }))
      : sql.includes('embedding::text') && !incomplete ? [...corpus.texts.keys()].map(hash => ({ description_hash: hash, embedding: '[1,0]' })) : [] }));
  return { query, repository: createDescriptionBenchmarkRepository({ withTransaction: async callback => callback({ query }) }) };
}

test('uses a bounded read-only snapshot and exact-model cache without any writes or providers', async () => {
  const { query, repository } = setup();
  const result = await repository.read(identity);
  expect(result.corpus.documents).toHaveLength(1);
  expect(result.vectors.size).toBe(1);
  expect(query.mock.calls.map(([sql]) => sql)).toEqual(expect.arrayContaining([
    'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY', "SET LOCAL transaction_timeout = '90s'",
  ]));
  expect(query.mock.calls.every(([sql]) => /^(SET |\s*SELECT )/.test(sql))).toBe(true);
});

test.each([{ incomplete: true, error: 'cache_incomplete' }, { libraryCount: 65, error: 'library_budget' }])('fails bounded preflight for %j', async ({ error, ...settings }) => {
  await expect(setup(settings).repository.read(identity)).rejects.toThrow(error);
});

test('vector memory cap is enforced before loading vectors; empty inventory stays empty', async () => {
  const { query, repository } = setup();
  await expect(repository.read({ ...identity, dimensions: 20_000_001 })).rejects.toThrow('vector_budget');
  expect(query.mock.calls.some(([sql]) => sql.includes('embedding::text'))).toBe(false);
  const empty = await setup({ documents: [] }).repository.read(identity);
  expect(empty.vectors.size).toBe(0);
});
