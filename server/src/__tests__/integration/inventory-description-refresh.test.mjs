/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createInventoryDescriptionRefreshRepository } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { createInventoryDescriptionVectorCache } from '../../services/inventoryDescriptionVectorCache.mjs';
import { createInventoryDescriptionRefreshWorker } from '../../services/inventoryDescriptionRefreshWorker.mjs';
import { createInventoryRepresentativeProfileRepository } from '../../services/inventoryRepresentativeProfileRepository.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { inventoryRepresentativeSourceKey } from '../../services/inventoryRepresentativeProfile.mjs';

let client;
let repository;
beforeEach(async () => {
  client = await getPool().connect();
  await client.query(`
    CREATE TEMP TABLE ai_provider_config (id int, rag_enabled boolean, embedding_provider_mode text,
      primary_provider text, embedding_model text, embedding_ollama_host text, embedding_ollama_port int,
      embedding_ollama_model text, ollama_host text, ollama_port int);
    INSERT INTO ai_provider_config (id,rag_enabled,embedding_provider_mode,primary_provider,embedding_model,ollama_host)
      VALUES (1,true,'same','ollama','test','localhost');
    CREATE TEMP TABLE task_queue (status text, next_retry_at timestamp DEFAULT now());
    CREATE TEMP TABLE media_server_sync_status (id serial, library_id int, status text, created_at timestamptz DEFAULT now());
    CREATE TEMP TABLE inventory_description_vector_cache (LIKE public.inventory_description_vector_cache INCLUDING ALL);
  `);
  repository = createInventoryDescriptionRefreshRepository({ withTransaction: async callback => {
    await client.query('BEGIN');
    try { const result = await callback(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  } });
});
afterEach(() => { client?.release(true); client = null; });

test('real admission SQL sees sync and queue pressure and does not leak local timeouts', async () => {
  const timeoutBefore = (await client.query('SHOW statement_timeout')).rows[0];
  expect(await repository.readState()).toMatchObject({ rag_enabled: true, busy: false });
  await client.query("INSERT INTO task_queue (status,next_retry_at) VALUES ('pending',now()+interval '1 hour')");
  expect((await repository.readState()).busy).toBe(false);
  await client.query("UPDATE task_queue SET next_retry_at=now()-interval '1 second'");
  expect((await repository.readState()).busy).toBe(true);
  await client.query("UPDATE task_queue SET status='processing'");
  expect((await repository.readState()).busy).toBe(true);
  await client.query("UPDATE task_queue SET status='completed'");
  await client.query("INSERT INTO media_server_sync_status (library_id,status) VALUES (1,'running')");
  expect((await repository.readState()).busy).toBe(true);
  // Historical abandoned rows cannot block refresh after a newer completed sync.
  await client.query("INSERT INTO media_server_sync_status (library_id,status) VALUES (1,'completed')");
  expect((await repository.readState()).busy).toBe(false);
  await client.query("INSERT INTO media_server_sync_status (library_id,status) VALUES (2,'running')");
  expect((await repository.readState()).busy).toBe(true);
  expect((await client.query('SHOW statement_timeout')).rows[0]).toEqual(timeoutBefore);
  // Exercise the real guarded inventory SQL independently of the historical sampler.
  expect((await repository.readCorpus()).coverage).toHaveProperty('uniqueDescriptions');
});

test('worker resumes actual pgvector checkpoints without any routing write', async () => {
  const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 3 };
  const hash = 'b'.repeat(64);
  const cache = createInventoryDescriptionVectorCache(repository);
  let embeddings = 0;
  const dependencies = {
    repository: { ...repository, readCorpus: async () => ({ texts: new Map([[hash, 'Private documentary synopsis']]) }) },
    cache, withSessionAdvisoryLock: async (key, callback) => { await callback(); return true; },
    createEmbedder: () => ({ provider: identity.provider, model: identity.model, inspect: async () => identity,
      embedBatch: async () => { embeddings++; return [[1, 0, 0]]; } }),
  };
  expect(await createInventoryDescriptionRefreshWorker(dependencies).run()).toMatchObject({ status: 'up_to_date', embeddedDescriptions: 1 });
  expect(await createInventoryDescriptionRefreshWorker(dependencies).run()).toMatchObject({ status: 'up_to_date', cacheHits: 1, embeddedDescriptions: 0 });
  expect(embeddings).toBe(1);
  expect((await cache.read(identity, [hash])).get(hash)).toEqual([1, 0, 0]);
});

test('representative snapshots reconcile membership, conflicts and expired pgvector rows without writes', async () => {
  await client.query(`
    CREATE TEMP TABLE libraries (id int, media_type text, is_active boolean);
    CREATE TEMP TABLE media_server_items (id int, media_server_id int, external_id text,
      library_id int, media_type text, tmdb_id int, metadata jsonb);
    CREATE TEMP TABLE media_source_observations (library_id int, media_server_id int,
      external_id text, last_seen_at timestamptz);
    INSERT INTO libraries VALUES (1,'movie',true),(2,'tv',true);
    INSERT INTO media_server_items VALUES (1,1,'source-1',1,'movie',1,'{"overview":"Synthetic movie description"}');
  `);
  const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 3 };
  const corpus = prepareInventoryDescriptionCorpus([{ media_type: 'movie', tmdb_id: 1, library_id: 1,
    overview: 'Synthetic movie description' }]);
  const hash = [...corpus.texts.keys()][0];
  await createInventoryDescriptionVectorCache(repository).write(identity, [{ hash, vector: [1, 0, 0] }]);
  const profiles = createInventoryRepresentativeProfileRepository({ withTransaction: async callback => {
    await client.query('BEGIN');
    try { const result = await callback(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  } });
  const first = await profiles.read(identity);
  expect(first.observedKeys).toEqual(new Set(['movie:1']));
  expect(first.state.busy).toBe(false);
  expect(first.vectors.get(hash)).toEqual([1, 0, 0]);
  expect(first.libraries).toEqual([{ id: 1, media_type: 'movie' }, { id: 2, media_type: 'tv' }]);
  await client.query("INSERT INTO media_source_observations VALUES (1,1,'source-1',now())");
  const conflicted = await profiles.read(identity);
  expect(conflicted.corpus.documents).toHaveLength(0);
  expect(conflicted.observedKeys.has('movie:1')).toBe(true);
  await client.query("INSERT INTO media_server_items VALUES (2,1,'source-2',2,'tv',2,'{}')");
  const descriptionless = await profiles.read(identity);
  expect(descriptionless.corpus.documents).toHaveLength(0);
  expect(descriptionless.observedKeys).toEqual(new Set(['movie:1', 'tv:2']));
  expect(inventoryRepresentativeSourceKey(conflicted, identity, 'config')).not.toBe(inventoryRepresentativeSourceKey(first, identity, 'config'));
  await client.query('DELETE FROM media_source_observations');
  expect((await profiles.read(identity)).corpus.documents).toHaveLength(1);
  await client.query("UPDATE inventory_description_vector_cache SET created_at=now()-interval '31 days'");
  expect((await profiles.read(identity)).vectors.size).toBe(0);
  await client.query('UPDATE libraries SET is_active=false WHERE id=1');
  const inactive = await profiles.read(identity);
  expect(inactive.corpus.documents).toHaveLength(0);
  expect(inactive.observedKeys).toEqual(new Set(['tv:2']));
});
