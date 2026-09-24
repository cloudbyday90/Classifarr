/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createInventoryDescriptionRefreshRepository } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { createInventoryDescriptionRefreshWorker } from '../../services/inventoryDescriptionRefreshWorker.mjs';
import { createInventoryDescriptionVectorCache } from '../../services/inventoryDescriptionVectorCache.mjs';
import { createLiveInventoryDescriptionRepository } from '../../services/liveInventoryDescriptionRepository.mjs';
import { createLiveInventoryDescriptionRetriever } from '../../services/liveInventoryDescriptionRetriever.mjs';

let client, refresh, live, cache, embedder, database;
const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 3 };
const hash = text => createHash('sha256').update(text).digest('hex');
const query = mediaType => ({ key: `${mediaType}:99`, mediaType, libraryIds: [1, 2], hash: hash('Query'),
  queryMetadata: { genres: ['pattern a'] } });

beforeEach(async () => {
  client = await getPool().connect();
  await client.query(`CREATE TEMP TABLE libraries (id integer, media_type text, is_active boolean);
    CREATE TEMP TABLE media_server_items (id serial, library_id integer, media_server_id integer DEFAULT 1,
      external_id text, media_type text, tmdb_id integer, imdb_id text, tvdb_id integer,
      metadata jsonb, genres jsonb, studio text, content_rating text);
    CREATE TEMP TABLE media_source_observations (library_id integer, media_server_id integer,
      external_id text, last_seen_at timestamptz);
    CREATE TEMP TABLE classification_history (id integer, media_type text, tmdb_id integer,
      metadata jsonb, created_at timestamptz);
    CREATE TEMP TABLE ai_provider_config (id integer, rag_enabled boolean, embedding_provider_mode text,
      primary_provider text, embedding_model text, embedding_ollama_host text,
      embedding_ollama_port integer, embedding_ollama_model text, ollama_host text, ollama_port integer);
    CREATE TEMP TABLE task_queue (status text, next_retry_at timestamptz);
    CREATE TEMP TABLE media_server_sync_status (id integer, library_id integer, status text, created_at timestamptz);
    CREATE TEMP TABLE inventory_description_vector_cache (LIKE public.inventory_description_vector_cache INCLUDING ALL);
    CREATE TEMP TABLE inventory_description_retry_journal (LIKE public.inventory_description_retry_journal INCLUDING ALL);
    INSERT INTO ai_provider_config (id,rag_enabled,embedding_provider_mode,primary_provider,
      embedding_model,ollama_host,ollama_port) VALUES (1,true,'same','ollama','test','localhost',11434);
    INSERT INTO libraries VALUES (1,'movie',true),(2,'movie',true),(3,'music',true),(4,'movie',false);`);
  database = { withTransaction: async callback => {
    await client.query('BEGIN');
    try { const result = await callback(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  } };
  refresh = createInventoryDescriptionRefreshRepository(database);
  live = createLiveInventoryDescriptionRepository(database);
  cache = createInventoryDescriptionVectorCache(refresh);
  embedder = { provider: identity.provider, model: identity.model, inspect: async () => identity,
    embedBatch: jest.fn(async texts => texts.map(() => [1, 0, 0])) };
});
afterEach(() => { client?.release(true); client = null; });

const worker = () => createInventoryDescriptionRefreshWorker({ repository: refresh, cache,
  createEmbedder: () => embedder,
  // Lock lifecycle is unit/integration-tested separately; this connection owns TEMP fixtures.
  withSessionAdvisoryLock: async (_key, callback) => { await callback(); return true; } });
async function add(source, library, overview, type = 'movie', tmdbId = null) {
  await client.query(`INSERT INTO media_server_items (external_id,library_id,media_type,tmdb_id,metadata,genres)
    VALUES ($1,$2,$3,$4,jsonb_build_object('overview',$5::text),$6::jsonb)`,
  [source, library, type, tmdbId, overview, JSON.stringify([library === 1 ? 'pattern a' : 'pattern b'])]);
}
const retrieve = request => live.retrieve({ request, identity, vector: [1, 0, 0] });

test.each(['movie', 'tv'])('%s source-only descriptions backfill, survive restart, train and retrieve without changing approval calibration', async type => {
  await client.query('UPDATE libraries SET media_type=$1 WHERE id IN (1,2)', [type]);
  await add('one', 1, 'First source description', type);
  await add('two', 2, 'Second source description', type);
  await add('copy', 1, 'First source description', type);
  await add('conflict', 1, 'Conflicted source', type);
  await client.query("INSERT INTO media_source_observations VALUES (1,1,'conflict',now())");
  await add('music', 3, 'Music must not be embedded', 'music');
  await add('mismatched', 1, 'Wrong media', type === 'movie' ? 'tv' : 'movie');
  await add('inactive', 4, 'Inactive source');
  await add('missing-anchor', 1, 'Missing anchor', type);
  await client.query("UPDATE media_server_items SET external_id='' WHERE external_id='missing-anchor'");
  await add('invalid-id', 1, 'Invalid present ID', type, -1);
  expect(await worker().run()).toMatchObject({ status: 'up_to_date', eligibleDescriptions: 2, embeddedDescriptions: 2 });
  expect(await worker().run()).toMatchObject({ status: 'up_to_date', cacheHits: 2, embeddedDescriptions: 0 });
  expect(embedder.embedBatch).toHaveBeenCalledTimes(1);
  expect(new Set(embedder.embedBatch.mock.calls[0][0])).toEqual(new Set(['First source description', 'Second source description']));
  const evidence = await retrieve(query(type));
  expect(evidence.map(candidate => candidate.eligible)).toEqual([1, 1]);
  expect(evidence[0].learnedProfile.trainingDescriptions).toBe(2);
  expect(evidence[0].learnedProfile.relativeFit).toBeGreaterThan(0);
  expect(evidence[1].learnedProfile.relativeFit).toBeLessThan(0);
  const calibration = await retrieve({ ...query(type), matchLibraryId: 1 });
  expect(calibration.map(candidate => candidate.eligible)).toEqual([0, 0]);
  expect(calibration[0].matchBaseline.status).toBe('sparse');
  expect((await client.query('SELECT count(*)::integer AS n FROM task_queue')).rows[0].n).toBe(0);
  expect((await client.query('SELECT count(*)::integer AS n FROM classification_history')).rows[0].n).toBe(0);
  expect(JSON.stringify(await worker().run())).not.toMatch(/source description|external_id/);
});

test('source conflict repair, description edits, removals and late TMDB IDs use fresh membership and existing hashes', async () => {
  await add('one', 1, 'First source description');
  await add('two', 2, 'Second source description');
  await worker().run();
  await client.query("INSERT INTO media_source_observations VALUES (1,1,'one',now())");
  expect((await retrieve(query('movie')))[0].eligible).toBe(0);
  await client.query('DELETE FROM media_source_observations');
  expect(await worker().run()).toMatchObject({ cacheHits: 2, embeddedDescriptions: 0 });
  expect((await retrieve(query('movie')))[0].eligible).toBe(1);
  await client.query("UPDATE media_server_items SET tmdb_id=123 WHERE external_id='one'");
  expect(await worker().run()).toMatchObject({ cacheHits: 2, embeddedDescriptions: 0 });
  await client.query("UPDATE media_server_items SET metadata=jsonb_build_object('overview','Edited description') WHERE external_id='two'");
  expect((await retrieve(query('movie')))[1]).toMatchObject({ eligible: 1, indexed: 0, items: [] });
  expect(await worker().run()).toMatchObject({ embeddedDescriptions: 1, cacheHits: 1 });
  expect((await retrieve(query('movie')))[1].items[0].description).toBe('Edited description');
  await client.query("UPDATE media_server_items SET library_id=2 WHERE external_id='one'");
  expect((await retrieve(query('movie'))).map(candidate => candidate.eligible)).toEqual([0, 2]);
  await client.query("DELETE FROM media_server_items WHERE external_id='one'");
  expect((await retrieve(query('movie'))).map(candidate => candidate.eligible)).toEqual([0, 1]);
});

test('failed source embeddings persist due retries across worker restarts and recover without user intervention', async () => {
  await add('one', 1, 'First source description');
  embedder.embedBatch.mockResolvedValueOnce([[1, 0]]);
  expect(await worker().run()).toMatchObject({ status: 'warming_cache', isolatedDescriptions: 1 });
  expect(await worker().run()).toMatchObject({ status: 'waiting_for_retry', deferredDescriptions: 1 });
  expect(embedder.embedBatch).toHaveBeenCalledTimes(1);
  await client.query("UPDATE inventory_description_retry_journal SET next_retry_at=now()-interval '1 second'");
  expect(await worker().run()).toMatchObject({ status: 'up_to_date', embeddedDescriptions: 1 });
  expect((await retrieve(query('movie')))[0].items[0].description).toBe('First source description');
  expect((await client.query('SELECT count(*)::integer AS n FROM inventory_description_retry_journal')).rows[0].n).toBe(0);
});

test('live incoming provider IDs exclude source-only aliases and their copied descriptions before learning or ranking', async () => {
  await add('self', 1, 'Old query description');
  await add('copy', 2, 'Old query description');
  await add('rival', 2, 'Independent description');
  await client.query("UPDATE media_server_items SET imdb_id='tt99' WHERE external_id='self'");
  await worker().run();
  await cache.write(identity, [{ hash: hash('Query'), vector: [1, 0, 0] }]);
  const retriever = createLiveInventoryDescriptionRetriever({ repository: live,
    createEmbedder: () => embedder, rememberQuery: jest.fn() });
  const evidence = await retriever.retrieve({ queryCacheOnly: true,
    contract: { valid: true, candidates: [1, 2].map(libraryId => ({ libraryId, mediaType: 'movie' })) },
    metadata: { media_type: 'movie', tmdb_id: 99, imdb_id: 'tt99', overview: 'Query', genres: ['pattern a'] } });
  expect(evidence.statusId).toBe('available');
  expect(evidence.candidates.map(candidate => candidate.eligible)).toEqual([0, 1]);
  expect(evidence.candidates[1].items[0].description).toBe('Independent description');
  expect(evidence.candidates[1].learnedProfile.trainingDescriptions).toBe(1);
});
