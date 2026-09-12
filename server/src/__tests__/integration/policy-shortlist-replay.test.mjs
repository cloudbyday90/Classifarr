/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createPolicyShortlistReplayRepository } from '../../services/policyShortlistReplayRuntime.mjs';

let client, repository;
const seed = 'policy-shortlist-replay-20260912';
beforeEach(async () => {
  client = await getPool().connect();
  await client.query(`CREATE TEMP TABLE libraries (id integer, name text, media_type text, is_active boolean);
    CREATE TEMP TABLE classification_history (id serial, tmdb_id integer, media_type text, title text, year integer, metadata jsonb, created_at timestamptz DEFAULT now());
    CREATE TEMP TABLE ai_provider_config (id integer, rag_enabled boolean, primary_provider text, ollama_host text,
      ollama_port integer, ollama_model text, configuration_revision integer);
    INSERT INTO libraries VALUES (1,'Private','movie',true),(2,'Other','movie',true),(3,'Inactive','movie',false);
    INSERT INTO ai_provider_config VALUES (1,true,'ollama','localhost',11434,'test:latest',1)`);
  repository = createPolicyShortlistReplayRepository({ withTransaction: async callback => {
    await client.query('BEGIN');
    try {
      const result = await callback(client);
      expect((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('on');
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } });
});
afterEach(() => { client?.release(true); client = null; });

const metadata = score => ({ overview: 'Private synopsis', genres: ['Documentary'], api_key: 'Never project this',
  studio: 'Studio example', content_rating: 'PG', certification: 'PG', keywords: ['sailing'],
  contentAnalysis: { bestMatch: { type: 'documentary', confidence: 80 }, privateField: 'Never project this' },
  source_library_id: 'not authoritative in replay', policyResult: { action: 'manual', confidence: score,
    ranked: [{ library_id: 1, score }, { library_id: 2, score }] } });
async function add(id, score) {
  await client.query(`INSERT INTO classification_history (tmdb_id,media_type,title,year,metadata)
    VALUES ($1,'movie','Private item',2006,$2::jsonb)`, [id, JSON.stringify(metadata(score))]);
}

test('deduplicates retained policy histories, projects metadata, detects source edits and performs only read-only snapshots', async () => {
  await add(90, 45); await add(90, 62); await add(91, 45);
  const before = await repository.read(seed);
  expect(before.retainedIdentities).toBe(2);
  expect(before.libraries.map(library => library.id)).toEqual([1, 2]);
  expect(before.cases.find(entry => entry.metadata.tmdb_id === 90).policyResult.confidence).toBe(62);
  expect(before.cases[0].metadata).toMatchObject({ studio: 'Studio example', content_rating: 'PG',
    certification: 'PG', keywords: ['sailing'], contentAnalysis: { bestMatch: { type: 'documentary', confidence: 80 } } });
  expect(JSON.stringify(before.cases)).not.toMatch(/api_key|Never project|source_library_id/);
  expect((await repository.read(seed)).fingerprint).toBe(before.fingerprint);
  await client.query('UPDATE ai_provider_config SET configuration_revision=2');
  expect((await repository.read(seed)).fingerprint).not.toBe(before.fingerprint);
  expect((await client.query('SELECT count(*)::integer AS count FROM classification_history')).rows[0].count).toBe(3);
});

test('samples a bounded deterministic set from more than 300 retained identities and discloses the full count', async () => {
  await client.query(`INSERT INTO classification_history (tmdb_id,media_type,title,year,metadata)
    SELECT id,'movie','Private item',2006,$1::jsonb FROM generate_series(1,305) id`, [JSON.stringify(metadata(45))]);
  const first = await repository.read(seed), same = await repository.read(seed), other = await repository.read(`${seed}-other`);
  expect(first.retainedIdentities).toBe(305);
  expect(first.cases).toHaveLength(300);
  expect(same.fingerprint).toBe(first.fingerprint);
  expect(other.cases.map(entry => entry.metadata.tmdb_id)).not.toEqual(first.cases.map(entry => entry.metadata.tmdb_id));
});

test('invalid retained metadata is counted and cannot manufacture a policy replay case', async () => {
  await add(90, 45);
  await client.query(`UPDATE classification_history SET metadata=jsonb_set(metadata,'{overview}','""')`);
  const report = await repository.read(seed);
  expect(report).toMatchObject({ retainedIdentities: 1, skippedMetadata: 1, cases: [] });
});
