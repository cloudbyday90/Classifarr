/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { expect, jest, test } from '@jest/globals';
import { createLiveInventoryDescriptionRepository, LIVE_INVENTORY_DESCRIPTION_RANK_SQL,
  LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL as INVENTORY_DESCRIPTION_CORPUS_SQL } from '../../services/liveInventoryDescriptionRepository.mjs';
import { INVENTORY_DESCRIPTION_REFRESH_STATE_SQL } from '../../services/inventoryDescriptionRefreshRepository.mjs';
const hash = text => createHash('sha256').update(text).digest('hex');
const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 2 };
const request = { key: 'movie:90', mediaType: 'movie', libraryIds: [1, 2], hash: hash('Query') };
const row = (id, library, overview, media = 'movie') => ({ tmdb_id: id, library_id: library, overview, media_type: media });
function setup(rows = [], ranked = []) {
  const query = jest.fn(async (sql) => ({ rows: sql === INVENTORY_DESCRIPTION_CORPUS_SQL ? rows
    : sql === LIVE_INVENTORY_DESCRIPTION_RANK_SQL ? ranked : [] }));
  const repository = createLiveInventoryDescriptionRepository({ withTransaction: async callback => callback({ query }) });
  return { query, repository, retrieve: (signal, input = request) => repository.retrieve({ request: input, identity, vector: [1, 0], signal }) };
}

test('snapshot joins only current scoped distinct descriptions, holds out self, and returns rival snippets', async () => {
  const rows = [row(90, 1, 'Query'), row(90, 2, 'Query'), row(99, 2, 'Query'), row(1, 1, 'A'), row(2, 1, 'A'),
    row(1, 2, 'A'), row(3, 2, 'B'), row(4, 99, 'Outside'), row(5, 1, 'Wrong type', 'tv'),
    row(6, 1, 'Conflict1'), row(6, 2, 'Conflict2')];
  const { retrieve, query } = setup(rows, [
    { library_id: 1, hash: hash('A'), similarity: 0.8, indexed: 1 },
    { library_id: 2, hash: hash('A'), similarity: 0.8, indexed: 1 },
    { library_id: 2, hash: hash('B'), similarity: null, indexed: 1 },
  ]);
  const results = await retrieve();
  expect(results[0]).toEqual({ libraryId: 1, eligible: 1, indexed: 1,
    items: [{ description: 'A', similarity: 0.8, sharedAcrossCandidates: true }] });
  expect(results[1]).toMatchObject({ eligible: 2, indexed: 1 });
  const parameters = query.mock.calls.find(([sql]) => sql === LIVE_INVENTORY_DESCRIPTION_RANK_SQL)[1];
  expect(JSON.parse(parameters[4])).toEqual([
    { library_id: 1, hash: hash('A') }, { library_id: 2, hash: hash('A') }, { library_id: 2, hash: hash('B') },
  ]);
  expect(query.mock.calls[0][0]).toBe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
});

test('no eligible text skips vector query and returns neutral empty evidence', async () => {
  const { retrieve, query } = setup([row(90, 1, 'Query')]);
  expect(await retrieve()).toEqual([1, 2].map(libraryId => ({ libraryId, eligible: 0, indexed: 0, items: [] })));
  expect(query.mock.calls.some(([sql]) => sql === LIVE_INVENTORY_DESCRIPTION_RANK_SQL)).toBe(false);
});

test.each([{ hash: hash('Outside'), similarity: 1 }, { hash: hash('A'), similarity: NaN }])('invalid database result is rejected', async item => {
  const { retrieve } = setup([row(1, 1, 'A')], [{ library_id: 1, indexed: 1, ...item }]);
  await expect(retrieve()).rejects.toThrow('live_inventory_description_scope_invalid');
});

test('cancellation stops before reading corpus', async () => {
  const { retrieve, query } = setup();
  const controller = new AbortController(); controller.abort();
  await expect(retrieve(controller.signal)).rejects.toThrow();
  expect(query.mock.calls.some(([sql]) => sql === INVENTORY_DESCRIPTION_CORPUS_SQL)).toBe(false);
});

test('configuration and query cache reads use bounded transactions without writing', async () => {
  const { repository, query } = setup();
  expect(await repository.readConfig()).toEqual({});
  expect(query).toHaveBeenCalledWith(INVENTORY_DESCRIPTION_REFRESH_STATE_SQL, undefined);
  expect(await repository.readQueryVector(identity, hash('A'))).toBeNull();
  query.mockImplementation(async sql => ({ rows: sql.includes('embedding::text')
    ? [{ description_hash: hash('A'), embedding: '[1,0]' }] : [{ rag_enabled: true }] }));
  expect(await repository.readQueryVector(identity, hash('A'))).toEqual([1, 0]);
  expect(await repository.readConfig()).toEqual({ rag_enabled: true });
});

test('learned profile budget failure preserves usable descriptions and does not expose partial profiles', async () => {
  const rows = Array.from({ length: 65 }, (_, i) => ({ ...row(i + 1, i + 1, `Example ${i}`), genres: ['test'] }));
  const { retrieve } = setup(rows, [{ library_id: 1, hash: hash('Example 0'), similarity: 0.8, indexed: 1 }]);
  const result = await retrieve(undefined, { ...request, queryMetadata: { genres: ['test'] } });
  expect(result[0].items).toHaveLength(1);
  expect(result.some(candidate => candidate.learnedProfile)).toBe(false);
});

test('changed incoming synopsis holds out old and conflicting stored copies from retrieval too', async () => {
  const { retrieve, query } = setup([row(90, 1, 'Old'), row(90, 2, 'Conflicting old'),
    row(91, 1, 'Old'), row(92, 2, 'Conflicting old'), row(93, 1, 'Query')]);
  expect((await retrieve()).every(candidate => candidate.eligible === 0)).toBe(true);
  expect(query.mock.calls.some(([sql]) => sql === LIVE_INVENTORY_DESCRIPTION_RANK_SQL)).toBe(false);
});
