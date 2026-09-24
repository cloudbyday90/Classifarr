/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createInventoryDescriptionRefreshRepository } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { createInventoryDescriptionVectorCache } from '../../services/inventoryDescriptionVectorCache.mjs';
import { createInventoryDescriptionRefreshWorker } from '../../services/inventoryDescriptionRefreshWorker.mjs';
import { createInventoryRepresentativeProfileRepository } from '../../services/inventoryRepresentativeProfileRepository.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { inventoryRepresentativeSourceKey } from '../../services/inventoryRepresentativeProfile.mjs';
import { createInventoryDescriptionRecovery } from '../../services/inventoryDescriptionRecovery.mjs';
import { createInventoryDescriptionIsolationRepository } from '../../services/inventoryDescriptionIsolationRepository.mjs';
import { createInventoryRepresentativeProfileRefresh } from '../../services/inventoryRepresentativeProfileRefresh.mjs';
import { fitInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfileFit.mjs';
import { resolveLocalStudyEmbeddingConfig } from '../../services/localStudyEmbeddingClient.mjs';
import { readFile } from 'node:fs/promises';
import { createInventoryNeighborhoodRecovery } from '../../services/inventoryNeighborhoodRecovery.mjs';

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
    CREATE TEMP TABLE inventory_description_retry_journal (LIKE public.inventory_description_retry_journal INCLUDING ALL);
  `);
  repository = createInventoryDescriptionRefreshRepository({ withTransaction: async callback => {
    await client.query('BEGIN');
    try { const result = await callback(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  } });
});
afterEach(() => { client?.release(true); client = null; });

test('outlier-aware movie and TV references prioritize supported gaps while ordinary backfill repairs outliers', async () => {
  await client.query(`
    CREATE TEMP TABLE libraries (id int, media_type text, is_active boolean);
    CREATE TEMP TABLE media_server_items (id int, media_server_id int, external_id text,
      library_id int, media_type text, tmdb_id int, metadata jsonb, inventory_tmdb_fetched_at timestamptz,
      imdb_id text, tvdb_id integer);
    CREATE TEMP TABLE media_source_observations (library_id int, media_server_id int,
      external_id text, last_seen_at timestamptz);
    INSERT INTO libraries VALUES (1,'movie',true),(2,'tv',true);
    INSERT INTO media_server_items
      SELECT n,1,'source-'||n,CASE WHEN n<=14 THEN 1 ELSE 2 END,
        CASE WHEN n<=14 THEN 'movie' ELSE 'tv' END,n,
        jsonb_build_object('overview','Synthetic outlier recovery description '||n)
      FROM generate_series(1,28) AS n;
  `);
  const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 3 };
  const profiles = createInventoryRepresentativeProfileRepository({ withTransaction: async callback => {
    await client.query('BEGIN');
    try { const result = await callback(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  } });
  const cache = createInventoryDescriptionVectorCache(repository), empty = await profiles.read(identity);
  const rows = empty.corpus.documents.map(doc => ({ hash: doc.hash, vector: doc.id % 14 === 0 ? [0, 1, 0] : [1, 0, 0] }));
  for (let index = 0; index < rows.length; index += 8) await cache.write(identity, rows.slice(index, index + 8));
  const vectorsByText = new Map(rows.map(row => [empty.corpus.texts.get(row.hash), row.vector]));
  const neighborhoodRecovery = createInventoryNeighborhoodRecovery();
  const worker = createInventoryRepresentativeProfileRefresh({ repository: profiles, readState: repository.readState,
    fit: fitInventoryRepresentativeProfile, neighborhoodRecovery,
    createEmbedder: () => ({ provider: identity.provider, model: identity.model, inspect: async () => identity,
      embedBatch: () => { throw new Error('Profile publication must not perform inference'); } }),
  });
  let backfill;
  try {
    expect(await worker.run()).toMatchObject({ status: 'published', availableDescriptions: 28, discardedDescriptions: 2, groups: 2 });
    const complete = await profiles.read(identity), configKey = JSON.stringify(resolveLocalStudyEmbeddingConfig(complete.state));
    const model = worker.read(inventoryRepresentativeSourceKey(complete, identity, configKey));
    const supported = [], unassigned = [];
    for (const profile of model.libraries.values()) {
      supported.push(...profile.membership.groups[0].slice(0, 2));
      unassigned.push(...profile.membership.unassigned);
    }
    await client.query("UPDATE inventory_description_vector_cache SET created_at=now()-interval '31 days' WHERE description_hash=ANY($1::text[])", [[...supported, ...unassigned]]);
    const partial = await profiles.read(identity);
    const priority = neighborhoodRecovery.prioritize({ corpus: partial.corpus, identity, configKey, present: new Set(partial.vectors.keys()) });
    expect(priority.summary).toMatchObject({ referencedLibraries: 2, unknownLibraries: 0, prioritizedDescriptions: 4 });
    expect(new Set(priority.priority)).toEqual(new Set(supported));
    backfill = createInventoryDescriptionRefreshWorker({ repository, cache, neighborhoodRecovery,
      isolation: createInventoryDescriptionIsolationRepository(repository),
      withSessionAdvisoryLock: async (_key, callback) => { await callback(); return true; },
      createEmbedder: () => ({ provider: identity.provider, model: identity.model, inspect: async () => identity,
        embedBatch: async batch => batch.map(text => vectorsByText.get(text)) }),
    });
    expect(await backfill.run()).toMatchObject({ status: 'up_to_date', embeddedDescriptions: 6, remainingDescriptions: 0 });
    const restored = await profiles.read(identity);
    expect(restored.vectors.size).toBe(28);
    expect(neighborhoodRecovery.prioritize({ corpus: restored.corpus, identity, configKey, present: new Set(restored.vectors.keys()) }).priority).toEqual([]);
    expect((await client.query('SELECT count(*)::int AS count FROM task_queue')).rows[0].count).toBe(0);
    expect((await client.query('SELECT count(*)::int AS count FROM media_server_items')).rows[0].count).toBe(28);
  } finally { backfill?.stop(); worker.stop(); }
});

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

test('malformed batch exclusion survives restart and backfills only missing pgvector checkpoints', async () => {
  const identity = { provider: 'ollama', model: 'test:latest', digest: 'c'.repeat(64), dimensions: 3 };
  const texts = new Map(Array.from({ length: 10 }, (_, index) => [String(index).padStart(64, '0'), `Synthetic synopsis ${index}`]));
  const cache = createInventoryDescriptionVectorCache(repository);
  const batchSizes = [];
  const dependencies = {
    repository: { ...repository, readCorpus: async () => ({ texts }) }, cache,
    withSessionAdvisoryLock: async (key, callback) => { await callback(); return true; },
    createEmbedder: () => ({ provider: identity.provider, model: identity.model, inspect: async () => identity,
      embedBatch: async batch => {
        batchSizes.push(batch.length);
        return batch.map(() => batchSizes.length === 2 ? [1, 0] : [1, 0, 0]);
      } }),
    recovery: createInventoryDescriptionRecovery({ random: () => 0 }),
  };
  expect(await createInventoryDescriptionRefreshWorker(dependencies).run()).toMatchObject({ status: 'warming_cache', isolatedDescriptions: 2 });
  expect((await cache.findPresent(identity, [...texts.keys()])).size).toBe(8);
  const restarted = createInventoryDescriptionRefreshWorker({ ...dependencies, recovery: createInventoryDescriptionRecovery() });
  expect(await restarted.run()).toMatchObject({ status: 'waiting_for_retry', deferredDescriptions: 2 });
  await client.query("UPDATE inventory_description_retry_journal SET next_retry_at=now()-interval '1 second'");
  expect(await restarted.run()).toMatchObject({ status: 'up_to_date', cacheHits: 8, embeddedDescriptions: 2 });
  expect(batchSizes).toEqual([8, 2, 1, 1]);
  expect((await cache.read(identity, [...texts.keys()])).size).toBe(10);
  expect((await client.query('SELECT count(*)::int AS count FROM task_queue')).rows[0].count).toBe(0);
});

test('retry journal persists due times, attempt counts and representation separation', async () => {
  const journal = createInventoryDescriptionIsolationRepository(repository);
  const identity = { provider: 'ollama', model: 'test:latest', digest: 'd'.repeat(64), dimensions: 3 };
  const hash = 'e'.repeat(64), other = 'f'.repeat(64);
  await journal.defer(identity, [hash, other], { code: 'batch', attempts: 0, delayMs: 60000 });
  expect(await journal.read(identity, [hash])).toEqual(new Map([[hash, { attempts: 0, due: false }]]));
  expect(await journal.read({ ...identity, digest: 'a'.repeat(64) }, [hash])).toEqual(new Map());
  await client.query("UPDATE inventory_description_retry_journal SET next_retry_at=now()-interval '1 second' WHERE description_hash=$1", [hash]);
  expect(await journal.read(identity, [hash])).toEqual(new Map([[hash, { attempts: 0, due: true }]]));
  await journal.defer(identity, [hash], { code: 'zero', attempts: 1, delayMs: 120000 });
  expect(await journal.read(identity, [hash])).toEqual(new Map([[hash, { attempts: 1, due: false }]]));
  await journal.defer(identity, [hash], { code: 'zero', attempts: 1, delayMs: 120000 });
  expect((await client.query('SELECT count(*)::int AS count FROM inventory_description_retry_journal')).rows[0].count).toBe(2);
  await client.query("UPDATE inventory_description_retry_journal SET expires_at=now()-interval '1 second' WHERE description_hash=$1", [hash]);
  expect(await journal.read(identity, [hash])).toEqual(new Map());
  await journal.pruneExpired();
  expect((await journal.read(identity, [other])).size).toBe(1);
  await journal.clear(identity, [other]);
  expect((await client.query('SELECT count(*)::int AS count FROM inventory_description_retry_journal')).rows[0].count).toBe(0);
});

test('retry journal admits existing rows but cannot grow beyond the shared-lock capacity budget', async () => {
  const journal = createInventoryDescriptionIsolationRepository(repository);
  const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 3 };
  const sample = '0'.repeat(63) + '1';
  await journal.defer(identity, [sample], { code: 'zero', attempts: 1, delayMs: 60000 });
  await client.query(`INSERT INTO inventory_description_retry_journal
    SELECT projection_version,model_name,model_digest,dimensions,lpad(to_hex(n),64,'0'),attempts,failure_code,next_retry_at,last_failed_at,expires_at
    FROM inventory_description_retry_journal CROSS JOIN generate_series(2,19999) AS n`);
  await expect(journal.defer(identity, ['e'.repeat(64), 'f'.repeat(64)], { code: 'batch', attempts: 0, delayMs: 60000 })).rejects.toThrow('description_isolation_capacity_exceeded');
  expect(await journal.read(identity, ['e'.repeat(64), 'f'.repeat(64)])).toEqual(new Map());
  expect((await client.query('SELECT count(*)::int AS count FROM inventory_description_retry_journal')).rows[0].count).toBe(19999);
  await journal.defer(identity, ['e'.repeat(64)], { code: 'batch', attempts: 0, delayMs: 60000 });
  await expect(journal.defer(identity, ['f'.repeat(64)], { code: 'batch', attempts: 0, delayMs: 60000 })).rejects.toThrow('description_isolation_capacity_exceeded');
  await journal.defer(identity, [sample], { code: 'zero', attempts: 2, delayMs: 120000 });
  expect((await journal.read(identity, [sample])).get(sample).attempts).toBe(2);
  expect((await client.query('SELECT count(*)::int AS count FROM inventory_description_retry_journal')).rows[0].count).toBe(20000);
});

test('additive journal migration works fresh and is idempotent with existing retry state', async () => {
  const sql = await readFile(new URL('../../../../database/migrations/20260913_220000_add_description_retry_journal.sql', import.meta.url), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query('DROP TABLE pg_temp.inventory_description_retry_journal');
    await client.query('CREATE SCHEMA isolation_migration_test');
    await client.query('SET LOCAL search_path TO isolation_migration_test');
    await client.query(sql);
    await client.query(`INSERT INTO inventory_description_retry_journal VALUES ('test','test:latest',$1,3,$2,0,'batch',now(),now(),now()+interval '30 days')`, ['a'.repeat(64), 'b'.repeat(64)]);
    await client.query(sql);
    expect((await client.query('SELECT count(*)::int AS count FROM inventory_description_retry_journal')).rows[0].count).toBe(1);
  } finally { await client.query('ROLLBACK'); }
});

test('representative snapshots reconcile membership, conflicts and expired pgvector rows without writes', async () => {
  await client.query(`
    CREATE TEMP TABLE libraries (id int, media_type text, is_active boolean);
    CREATE TEMP TABLE media_server_items (id int, media_server_id int, external_id text,
      library_id int, media_type text, tmdb_id int, metadata jsonb, inventory_tmdb_fetched_at timestamptz,
      imdb_id text, tvdb_id integer);
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

test('partial movie and TV profiles publish, backfill and withdraw expired coverage using real pgvector snapshots', async () => {
  await client.query(`
    CREATE TEMP TABLE libraries (id int, media_type text, is_active boolean);
    CREATE TEMP TABLE media_server_items (id int, media_server_id int, external_id text,
      library_id int, media_type text, tmdb_id int, metadata jsonb, inventory_tmdb_fetched_at timestamptz,
      imdb_id text, tvdb_id integer);
    CREATE TEMP TABLE media_source_observations (library_id int, media_server_id int,
      external_id text, last_seen_at timestamptz);
    INSERT INTO libraries VALUES (1,'movie',true),(2,'tv',true);
    INSERT INTO media_server_items
      SELECT n,1,'source-'||n,CASE WHEN n<=10 THEN 1 ELSE 2 END,
        CASE WHEN n<=10 THEN 'movie' ELSE 'tv' END,n,
        jsonb_build_object('overview','Synthetic coverage description '||n)
      FROM generate_series(1,20) AS n;
  `);
  const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 3 };
  const profiles = createInventoryRepresentativeProfileRepository({ withTransaction: async callback => {
    await client.query('BEGIN');
    try { const result = await callback(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  } });
  const cache = createInventoryDescriptionVectorCache(repository);
  const empty = await profiles.read(identity);
  const rows = empty.corpus.documents.map(doc => ({ hash: doc.hash, vector: doc.type === 'movie' ? [1, 0, 0] : [0, 1, 0] }));
  const missing = rows.shift();
  for (let index = 0; index < rows.length; index += 8) await cache.write(identity, rows.slice(index, index + 8));
  let time = 0;
  const neighborhoodRecovery = createInventoryNeighborhoodRecovery({ now: () => time });
  const worker = createInventoryRepresentativeProfileRefresh({ repository: profiles, readState: repository.readState,
    fit: fitInventoryRepresentativeProfile, now: () => time, neighborhoodRecovery,
    createEmbedder: () => ({ provider: identity.provider, model: identity.model, inspect: async () => identity,
      embedBatch: () => { throw new Error('Profile publication must not perform inference'); } }),
  });
  const keyFor = snapshot => inventoryRepresentativeSourceKey(snapshot, identity, JSON.stringify(resolveLocalStudyEmbeddingConfig(snapshot.state)));
  try {
    expect(await worker.run()).toMatchObject({ status: 'published', availableDescriptions: 19, missingDescriptions: 1,
      readyLibraries: 2, partialLibraries: 1, waitingLibraries: 0 });
    const partialKey = keyFor(await profiles.read(identity));
    expect(worker.read(partialKey).libraries.size).toBe(2);
    await cache.write(identity, [missing]); time += 300_000;
    expect(await worker.run()).toMatchObject({ status: 'published', availableDescriptions: 20, partialLibraries: 0 });
    expect(worker.read(partialKey)).toBeUndefined();
    const movieRows = empty.corpus.documents.filter(doc => doc.type === 'movie').slice(0, 2);
    await client.query("UPDATE inventory_description_vector_cache SET created_at=now()-interval '31 days' WHERE description_hash=ANY($1::text[])", [movieRows.map(doc => doc.hash)]);
    time += 300_000;
    expect(await worker.run()).toMatchObject({ status: 'published', readyLibraries: 1, waitingLibraries: 1, trainingDescriptions: 10 });
    const reduced = worker.read(keyFor(await profiles.read(identity)));
    expect(reduced.libraries.size).toBe(2);
    expect(reduced.libraries.get(1).coverage.status).toBe('waiting');
    expect(reduced.libraries.get(2).coverage.status).toBe('complete');
    const isolation = createInventoryDescriptionIsolationRepository(repository);
    await isolation.defer(identity, [movieRows[0].hash], { code: 'zero', attempts: 1, delayMs: 60000 });
    const backfill = createInventoryDescriptionRefreshWorker({ repository, cache, isolation, neighborhoodRecovery,
      now: () => time, withSessionAdvisoryLock: async (key, callback) => { await callback(); return true; },
      createEmbedder: () => ({ provider: identity.provider, model: identity.model, inspect: async () => identity,
        embedBatch: async batch => batch.map(() => [1, 0, 0]) }),
    });
    expect(await backfill.run()).toMatchObject({ status: 'warming_cache', embeddedDescriptions: 1, remainingDescriptions: 1,
      neighborhoodRecovery: { referencedLibraries: 2, unknownLibraries: 0, prioritizedDescriptions: 2 } });
    expect(await backfill.run()).toMatchObject({ status: 'waiting_for_retry', embeddedDescriptions: 0 });
    await client.query("UPDATE inventory_description_retry_journal SET next_retry_at=now()-interval '1 second'");
    expect(await backfill.run()).toMatchObject({ status: 'up_to_date', embeddedDescriptions: 1, remainingDescriptions: 0 });
    backfill.stop(); time += 300_000;
    expect(await worker.run()).toMatchObject({ status: 'published', availableDescriptions: 20, readyLibraries: 2, waitingLibraries: 0 });
    expect((await client.query('SELECT count(*)::int AS count FROM task_queue')).rows[0].count).toBe(0);
    expect((await client.query('SELECT count(*)::int AS count FROM media_server_items')).rows[0].count).toBe(20);
  } finally { worker.stop(); }
});
