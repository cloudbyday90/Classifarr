/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { beforeEach, afterEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createLiveInventoryDescriptionRepository } from '../../services/liveInventoryDescriptionRepository.mjs';
import { createInventoryDescriptionVectorCache } from '../../services/inventoryDescriptionVectorCache.mjs';
import { createDescriptionBenchmarkRepository } from '../../services/inventoryDescriptionBenchmarkRepository.mjs';
import { prepareDescriptionBenchmark } from '../../services/inventoryDescriptionBenchmarkSample.mjs';

let client;
let repository;
let cache;
const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 3 };
const hash = text => createHash('sha256').update(text).digest('hex');
const request = { key: 'movie:90', mediaType: 'movie', libraryIds: [10, 20], hash: hash('Query') };
beforeEach(async () => {
  client = await getPool().connect();
  await client.query(`
    CREATE TEMP TABLE libraries (id integer, media_type text, is_active boolean);
    CREATE TEMP TABLE classification_history (id integer, tmdb_id integer, media_type text, metadata jsonb, created_at timestamptz);
    CREATE TEMP TABLE media_server_items (id serial, tmdb_id integer, media_type text, library_id integer,
      media_server_id integer DEFAULT 1, external_id text, metadata jsonb);
    CREATE TEMP TABLE media_source_observations (library_id integer, media_server_id integer, external_id text, last_seen_at timestamptz);
    CREATE TEMP TABLE inventory_description_vector_cache (LIKE public.inventory_description_vector_cache INCLUDING ALL);
    INSERT INTO libraries VALUES (10,'movie',true), (20,'movie',true), (30,'movie',false), (40,'tv',true);
  `);
  repository = createLiveInventoryDescriptionRepository({ withTransaction: async callback => {
    await client.query('BEGIN');
    try { const result = await callback(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  } });
  cache = createInventoryDescriptionVectorCache({ query: client.query.bind(client) });
});
afterEach(() => { client?.release(true); client = null; });

async function add(id, library, text, vector = [1, 0, 0], media = 'movie') {
  await client.query(`INSERT INTO media_server_items (tmdb_id,library_id,media_type,external_id,metadata)
    VALUES ($1::integer,$2,$3,$1::integer::text,$4::jsonb)`, [id, library, media, JSON.stringify({ overview: text })]);
  if (vector) await cache.write(identity, [{ hash: hash(text), vector }]);
}
const retrieve = (representation = identity) => repository.retrieve({ request, identity: representation, vector: [1, 0, 0] });

test('real cosine ranking compares all candidates, excludes self and duplicates, and bounds each candidate', async () => {
  await add(90, 10, 'Query');
  await add(90, 20, 'Query');
  await add(91, 10, 'Query');
  await add(1, 10, 'Shared');
  await add(2, 10, 'Shared');
  await add(1, 20, 'Shared');
  await add(3, 10, 'Voyage', [1, 1, 0]);
  await add(4, 10, 'Far', [0, 1, 0]);
  await add(5, 10, 'Opposite', [-1, 0, 0]);
  await add(6, 20, 'Comedy', [1, 0.5, 0]);
  const timeoutBefore = (await client.query('SHOW statement_timeout')).rows[0];
  const result = await retrieve();
  expect(result.map(candidate => [candidate.eligible, candidate.indexed, candidate.items.length])).toEqual([[4, 4, 3], [2, 2, 2]]);
  expect(result[0].items.map(item => item.description)).toEqual(['Shared', 'Voyage', 'Far']);
  expect(result[0].items[1].similarity).toBeCloseTo(Math.SQRT1_2);
  expect(result[0].items[0].sharedAcrossCandidates).toBe(true);
  expect(JSON.stringify(result)).not.toContain('Query');
  expect((await client.query('SHOW statement_timeout')).rows[0]).toEqual(timeoutBefore);
  expect(await repository.readQueryVector(identity, hash('Query'))).toEqual([1, 0, 0]);
});

test('current membership, conflict, text, representation and expiry boundaries control retrieval', async () => {
  await add(1, 10, 'Current');
  await add(2, 20, 'Missing', null);
  await add(3, 30, 'Inactive');
  await add(4, 10, 'Wrong media', [1, 0, 0], 'tv');
  await add(5, 40, 'TV', [1, 0, 0], 'tv');
  await add(6, 10, 'Conflict A');
  await add(6, 20, 'Conflict B');
  await add(7, 10, 'Source conflict');
  await client.query("INSERT INTO media_source_observations VALUES (10,1,'7',now())");
  const result = await retrieve();
  expect(result.map(candidate => [candidate.eligible, candidate.indexed])).toEqual([[1, 1], [1, 0]]);
  expect(result[0].items[0].description).toBe('Current');
  expect((await retrieve({ ...identity, digest: 'b'.repeat(64) }))[0].indexed).toBe(0);
  await expect(retrieve({ ...identity, dimensions: 2 })).rejects.toThrow();
});

test('deleted, edited and expired inventory cannot reuse old description evidence', async () => {
  await add(1, 10, 'Old');
  await add(2, 20, 'Expired');
  await client.query("UPDATE inventory_description_vector_cache SET created_at=now()-interval '31 days' WHERE description_hash=$1", [hash('Expired')]);
  await client.query("UPDATE media_server_items SET metadata='{}' WHERE tmdb_id=1");
  expect((await retrieve()).map(candidate => [candidate.eligible, candidate.indexed])).toEqual([[0, 0], [1, 0]]);
  await client.query('UPDATE media_server_items SET metadata=$1::jsonb WHERE tmdb_id=1', [JSON.stringify({ overview: 'Changed' })]);
  expect((await retrieve())[0]).toMatchObject({ eligible: 1, indexed: 0, items: [] });
  await client.query('DELETE FROM media_server_items WHERE tmdb_id=2');
  expect((await retrieve())[1]).toMatchObject({ eligible: 0, indexed: 0, items: [] });
});

test('benchmark snapshots real inventory and cache read-only, holds out 100 titles, and fails on stale provenance', async () => {
  await client.query("ALTER TABLE libraries ADD COLUMN name text DEFAULT 'Private library'");
  const benchmark = createDescriptionBenchmarkRepository({ withTransaction: async callback => {
    await client.query('BEGIN');
    try {
      const result = await callback(client);
      expect((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('on');
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } });
  for (let index = 1; index <= 120; index++) await add(index, index % 2 ? 10 : 20, `Synopsis ${index}`);
  const before = (await client.query('SELECT count(*)::integer AS count FROM inventory_description_vector_cache')).rows[0].count;
  const snapshot = await benchmark.read(identity);
  expect(snapshot.corpus.documents).toHaveLength(120);
  expect(snapshot.libraries.map(library => library.id)).toEqual([10, 20, 40]);
  const prepared = prepareDescriptionBenchmark(snapshot, snapshot.vectors, 3, { seed: 'benchmark-test-seed-2026' });
  expect(prepared.cases).toHaveLength(100);
  expect(prepared.cases.every(entry => entry.candidates.reduce((sum, candidate) => sum + candidate.eligible, 0) === 20)).toBe(true);
  expect((await client.query('SELECT count(*)::integer AS count FROM inventory_description_vector_cache')).rows[0].count).toBe(before);
  await expect(benchmark.read({ ...identity, digest: 'b'.repeat(64) })).rejects.toThrow('cache_incomplete');
  await client.query("UPDATE inventory_description_vector_cache SET created_at=now()-interval '31 days'");
  await expect(benchmark.read(identity)).rejects.toThrow('cache_incomplete');
});
