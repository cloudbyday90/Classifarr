/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createInventoryDescriptionRefreshRepository } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { createInventoryDescriptionVectorCache } from '../../services/inventoryDescriptionVectorCache.mjs';
import { createInventoryDescriptionRefreshWorker } from '../../services/inventoryDescriptionRefreshWorker.mjs';

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
