/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createSourceDescriptionEvaluationRepository } from '../../services/sourceDescriptionEvaluationRuntime.mjs';
import { createInventoryDescriptionVectorCache } from '../../services/inventoryDescriptionVectorCache.mjs';
import { evaluateSourceDescriptionPair } from '../../services/sourceDescriptionPairedEvaluation.mjs';
import { sourcePairFixture, sourcePairIdentity as identity } from '../fixtures/sourceDescriptionPairFixture.mjs';

let client, repository, database, fixture;
beforeEach(async () => {
  client = await getPool().connect();
  await client.query(`CREATE TEMP TABLE libraries (id integer, name text, media_type text, is_active boolean);
    CREATE TEMP TABLE media_server_items (id serial, library_id integer, media_server_id integer,
      external_id text, media_type text, tmdb_id integer, imdb_id text, tvdb_id integer,
      metadata jsonb, genres jsonb, studio text, content_rating text);
    CREATE TEMP TABLE media_source_observations (library_id integer, media_server_id integer,
      external_id text, last_seen_at timestamptz);
    CREATE TEMP TABLE classification_history (id integer, media_type text, tmdb_id integer,
      metadata jsonb, created_at timestamptz, library_id integer, status text);
    CREATE TEMP TABLE classification_corrections (id integer, classification_id integer, corrected_library_id integer,
      original_library_id integer, corrected_by text, created_at timestamp);
    CREATE TEMP TABLE policy_feedback_evaluation (id integer, media_type text, tmdb_id integer,
      selected_library_id integer, was_correction boolean, responded_at timestamptz, evaluation_correct boolean);
    CREATE TEMP TABLE ai_provider_config (id integer, rag_enabled boolean, embedding_provider_mode text,
      primary_provider text, embedding_model text, embedding_ollama_host text,
      embedding_ollama_port integer, embedding_ollama_model text, ollama_host text, ollama_port integer,
      ollama_model text, configuration_revision integer);
    CREATE TEMP TABLE inventory_description_vector_cache (LIKE public.inventory_description_vector_cache INCLUDING ALL);
    INSERT INTO ai_provider_config (id,rag_enabled,embedding_provider_mode,primary_provider,
      embedding_model,ollama_host,ollama_port) VALUES (1,true,'same','ollama','test','localhost',11434);`);
  fixture = sourcePairFixture(48);
  for (const library of fixture.libraries) await client.query('INSERT INTO libraries VALUES ($1,$2,$3,true)',
    [library.id, library.name, library.media_type]);
  for (const row of fixture.rows) await client.query(`INSERT INTO media_server_items
    (library_id,media_server_id,external_id,media_type,tmdb_id,metadata,genres,studio,content_rating)
    VALUES ($1,$2,$3,$4,$5,jsonb_build_object('overview',$6::text),$7::jsonb,$8,$9)`,
  [row.library_id, row.media_server_id, row.external_id, row.media_type, row.tmdb_id, row.overview,
    JSON.stringify(row.genres), row.studio, row.content_rating]);
  database = { withTransaction: async callback => {
    await client.query('BEGIN');
    try { const value = await callback(client); await client.query('COMMIT'); return value; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  } };
  const cache = createInventoryDescriptionVectorCache({ query: (...args) => client.query(...args) });
  const entries = [...fixture.vectors].map(([hash, vector]) => ({ hash, vector }));
  for (let offset = 0; offset < entries.length; offset += 8) await cache.write(identity, entries.slice(offset, offset + 8));
  repository = createSourceDescriptionEvaluationRepository(database);
});
afterEach(() => { client?.release(true); client = null; });

test('real PostgreSQL snapshot pairs movie/TV evidence and verified feedback without any mutation', async () => {
  await client.query(`INSERT INTO policy_feedback_evaluation VALUES (1,'movie',1,2,true,now(),true);
    INSERT INTO classification_history (id,media_type,tmdb_id,library_id,status) VALUES (1,'tv',3,4,'corrected');
    INSERT INTO classification_corrections VALUES (1,1,4,3,'operator',now());`);
  const captured = await repository.read(identity);
  expect(captured.operatorFeedbackRows).toHaveLength(2);
  expect(captured.corpus.documents).toHaveLength(48);
  expect(captured.corpus.documents.filter(doc => doc.id === null)).toHaveLength(24);
  const result = evaluateSourceDescriptionPair(captured, identity, { seed: 'source-pair-integration', size: 8 });
  expect(result.status).toBe('complete'); expect(result.metrics.cases).toBe(8);
  expect(result.coverage.correctionLabels).toBe(2);
  expect(result.qualityStatus).toBe('correction_cohort_measured');
  for (const arm of [result.metrics.baseline, result.metrics.sourceAware]) {
    expect(Object.values(arm.correctionOutcomes).reduce((a, b) => a + b, 0)).toBe(result.metrics.correctionCases);
  }
  expect((await client.query('SELECT count(*)::integer AS n FROM media_server_items')).rows[0].n).toBe(48);
  expect((await client.query('SELECT count(*)::integer AS n FROM inventory_description_vector_cache')).rows[0].n).toBe(48);
});

test('source conflicts, music, inactive and mismatched library items cannot enter either arm', async () => {
  await client.query(`INSERT INTO libraries VALUES (5,'Not a video library','music',true),(6,'Inactive','movie',false);
    INSERT INTO media_server_items (library_id,media_server_id,external_id,media_type,tmdb_id,metadata) VALUES
      (5,1,'music','music',99,'{"overview":"Music"}'),
      (6,1,'inactive','movie',98,'{"overview":"Inactive"}'),
      (1,1,'wrong','tv',97,'{"overview":"Mismatched"}');
    INSERT INTO media_source_observations VALUES (1,1,'PRIVATE-source-4',now());`);
  const captured = await repository.read(identity);
  expect(captured.corpus.documents).toHaveLength(47);
  expect(captured.libraries).toHaveLength(4);
  expect(captured.rows.some(row => row.external_id === 'PRIVATE-source-4')).toBe(false);
  expect(evaluateSourceDescriptionPair(captured, identity, { seed: 'source-pair-integration', size: 8 }).status).toBe('complete');
});

test('expired or wrong-model vectors produce an explicit incomplete-cache report; snapshot enforces read-only', async () => {
  await client.query("UPDATE inventory_description_vector_cache SET created_at=now()-interval '31 days' WHERE description_hash=$1",
    [[...fixture.vectors.keys()][0]]);
  const captured = await repository.read(identity);
  expect(evaluateSourceDescriptionPair(captured, identity)).toMatchObject({ status: 'cache_incomplete', metrics: null,
    coverage: { missingCachedDescriptions: 1 } });
  const wrongModel = await repository.read({ ...identity, digest: 'b'.repeat(64) });
  expect(wrongModel.vectors.size).toBe(0);
  await database.withTransaction(async reader => {
    await reader.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect((await reader.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('on');
  });
});
