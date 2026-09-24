/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { readLibraryEvidenceCoverage } from '../../services/libraryEvidenceCoverageService.mjs';
import { recordDescriptionRepresentation } from '../../services/inventoryDescriptionRepresentationCheckpoint.mjs';
import { createInventoryDescriptionVectorCache } from '../../services/inventoryDescriptionVectorCache.mjs';
import { resolveLocalStudyEmbeddingConfig } from '../../services/localStudyEmbeddingClient.mjs';
import { projectInventoryDescription } from '../../services/inventoryDescriptionProjection.mjs';

let client;
let database;
const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 2 };
const config = { rag_enabled: true, embedding_provider_mode: 'same', primary_provider: 'ollama',
  embedding_model: 'test', ollama_host: 'localhost', ollama_port: 11434 };

beforeEach(async () => {
  client = await getPool().connect();
  await client.query(`CREATE TEMP TABLE libraries (id integer PRIMARY KEY, media_type text, is_active boolean);
    CREATE TEMP TABLE library_profile_inventory_state (library_id integer PRIMARY KEY, revision bigint);
    CREATE TEMP TABLE media_server_items (id integer, library_id integer, media_server_id integer,
      external_id text, media_type text, tmdb_id integer, metadata jsonb,
      imdb_id text, tvdb_id integer);
    CREATE TEMP TABLE media_source_observations (library_id integer, media_server_id integer,
      external_id text, last_seen_at timestamptz);
    CREATE TEMP TABLE classification_history (id integer, media_type text, tmdb_id integer,
      metadata jsonb, created_at timestamptz);
    CREATE TEMP TABLE ai_provider_config (id integer, rag_enabled boolean, embedding_provider_mode text,
      primary_provider text, embedding_model text, embedding_ollama_host text,
      embedding_ollama_port integer, embedding_ollama_model text, ollama_host text, ollama_port integer);
    CREATE TEMP TABLE inventory_description_vector_cache (LIKE public.inventory_description_vector_cache INCLUDING ALL);
    CREATE TEMP TABLE inventory_description_retry_journal (LIKE public.inventory_description_retry_journal INCLUDING ALL);
    CREATE TEMP TABLE inventory_description_representation_checkpoint
      (LIKE public.inventory_description_representation_checkpoint INCLUDING ALL);
    INSERT INTO libraries VALUES (1,'movie',true),(2,'tv',true);
    INSERT INTO library_profile_inventory_state VALUES (1,7);
    INSERT INTO ai_provider_config (id,rag_enabled,embedding_provider_mode,primary_provider,
      embedding_model,ollama_host,ollama_port) VALUES (1,true,'same','ollama','test','localhost',11434);
    INSERT INTO media_server_items (id,library_id,media_server_id,external_id,media_type,tmdb_id,metadata) VALUES
      (1,1,1,'one','movie',1,'{"overview":"Private description one"}'::jsonb),
      (2,1,1,'two','movie',2,'{}'::jsonb),
      (3,1,1,'three','movie',NULL,'{"overview":"Private invalid identity"}'::jsonb),
      (4,1,1,'four','movie',4,'{"overview":"Private conflicted description"}'::jsonb),
      (5,1,1,'five','tv',5,'{"overview":"Private mismatched type"}'::jsonb);
    INSERT INTO media_source_observations VALUES (1,1,'four',now());`);
  database = { withTransaction: async callback => {
    await client.query('BEGIN');
    try { const result = await callback(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  } };
});

afterEach(() => { client?.release(true); client = null; });

test('movie coverage counts distinct descriptions and a recently verified cache without leaking text', async () => {
  const configKey = JSON.stringify(resolveLocalStudyEmbeddingConfig(config));
  await recordDescriptionRepresentation({ query: (...args) => client.query(...args) }, identity, configKey);
  const text = projectInventoryDescription({ metadata: { overview: 'Private description one' } }).text;
  await createInventoryDescriptionVectorCache({ query: (...args) => client.query(...args) })
    .write(identity, [{ hash: createHash('sha256').update(text).digest('hex'), vector: [1, 0] }]);
  const result = await readLibraryEvidenceCoverage(database, 1);
  expect(result).toMatchObject({ statusId: 'measured', inventoryRevision: '7',
    source: { itemCount: 5, candidateRowCount: 2,
      excluded: { typeMismatch: 1, missingIdentity: 1, sourceConflict: 1 } },
    sourceEvidence: { statusId: 'measured', typeMatchedItemCount: 4,
      anchoredItemCount: 4, conflictBlockedItemCount: 1, eligibleItemCount: 3,
      describedItemCount: 2, missingDescriptionItemCount: 1,
      describedWithoutTmdbItemCount: 1 },
    description: { candidateIdentityCount: 2, usableIdentityCount: 1, missingIdentityCount: 1 },
    retrieval: { statusId: 'recently_verified', eligibleIdentityCount: 1, indexedIdentityCount: 1 },
    classificationQuality: 'not_measured' });
  expect(JSON.stringify(result)).not.toContain('Private');
  expect(JSON.stringify(result)).not.toMatch(/external_id|imdb_id|tvdb_id|media_server_id/);
  await client.query("UPDATE inventory_description_representation_checkpoint SET verified_at=now()-interval '11 minutes'");
  const stale = await readLibraryEvidenceCoverage(database, 1);
  expect(stale.retrieval).toMatchObject({ statusId: 'model_unverified', indexedIdentityCount: null });
});

test('no inventory and unsupported source types do not become a false zero-percent score', async () => {
  expect(await readLibraryEvidenceCoverage(database, 2)).toMatchObject({ statusId: 'no_inventory',
    description: null, retrieval: null });
  await client.query("UPDATE libraries SET media_type='music' WHERE id=2");
  expect(await readLibraryEvidenceCoverage(database, 2)).toMatchObject({ statusId: 'unsupported_type',
    sourceEvidence: { statusId: 'no_inventory' },
    description: null, retrieval: null, classificationQuality: 'not_measured' });
  await client.query(`INSERT INTO media_server_items
    (id,library_id,media_server_id,external_id,media_type,metadata)
    VALUES (7,2,1,'music-one','music','{"summary":"Music description"}'::jsonb)`);
  expect(await readLibraryEvidenceCoverage(database, 2)).toMatchObject({ statusId: 'unsupported_type',
    sourceEvidence: { statusId: 'measured', eligibleItemCount: 1,
      describedItemCount: 1, describedWithoutTmdbItemCount: 1 },
    description: null, retrieval: null });
});

test('changed local model invalidates cache evidence and duplicate identities can conflict', async () => {
  await recordDescriptionRepresentation({ query: (...args) => client.query(...args) }, identity,
    JSON.stringify(resolveLocalStudyEmbeddingConfig(config)));
  await client.query(`INSERT INTO media_server_items
    (id,library_id,media_server_id,external_id,media_type,tmdb_id,metadata) VALUES
    (6,1,1,'six','movie',1,'{"overview":"Different private description"}'::jsonb)`);
  await client.query("UPDATE ai_provider_config SET embedding_model='changed' WHERE id=1");
  const result = await readLibraryEvidenceCoverage(database, 1);
  expect(result).toMatchObject({ statusId: 'measured',
    source: { itemCount: 6, candidateRowCount: 3 },
    description: { candidateIdentityCount: 2, usableIdentityCount: 0,
      missingIdentityCount: 1, conflictingIdentityCount: 1 },
    retrieval: { statusId: 'model_unverified', eligibleIdentityCount: 0,
      indexedIdentityCount: null } });
  expect(JSON.stringify(result)).not.toContain('Different private');
});

test('over-limit library reports a bounded unknown state rather than partial coverage', async () => {
  await client.query('DELETE FROM media_server_items WHERE library_id=1');
  await client.query(`INSERT INTO media_server_items
    (id,library_id,media_server_id,external_id,media_type,tmdb_id,metadata)
    SELECT id,1,1,id::text,'movie',id,'{"overview":"private"}'::jsonb
    FROM generate_series(1,10001) AS id`);
  const result = await readLibraryEvidenceCoverage(database, 1);
  expect(result).toMatchObject({ statusId: 'window_truncated',
    source: { itemCount: 10001, candidateRowCount: 10001 },
    sourceEvidence: { statusId: 'window_truncated' },
    description: null, retrieval: null, classificationQuality: 'not_measured' });
  await client.query('UPDATE media_server_items SET tmdb_id=NULL WHERE id=10001');
  expect(await readLibraryEvidenceCoverage(database, 1)).toMatchObject({
    statusId: 'window_truncated', source: { itemCount: 10001, candidateRowCount: 10000 },
    sourceEvidence: { statusId: 'window_truncated' }, description: null });
});
