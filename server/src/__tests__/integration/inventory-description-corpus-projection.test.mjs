/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { buildInventoryDescriptionCorpusSql, prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { buildPreviousInventoryDescriptionCorpusSql } from '../fixtures/previousInventoryDescriptionCorpusSql.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS as retention } from '../../services/sourceConflictAuthorityGuard.mjs';

let client;
beforeEach(async () => {
  client = await getPool().connect();
  await client.query(`
    CREATE TEMP TABLE libraries (id integer, media_type text, is_active boolean);
    CREATE TEMP TABLE media_server_items (id serial PRIMARY KEY, tmdb_id integer, media_type text, library_id integer,
      media_server_id integer DEFAULT 1, external_id text, metadata jsonb, genres jsonb, studio text, content_rating text,
      title text, year integer);
    CREATE TEMP TABLE classification_history (id serial PRIMARY KEY, tmdb_id integer, media_type text, metadata jsonb, created_at timestamptz);
    CREATE TEMP TABLE media_source_observations (library_id integer, media_server_id integer, external_id text, last_seen_at timestamptz);
    INSERT INTO libraries VALUES (10,'movie',true),(20,'movie',true),(30,'movie',false),(40,'tv',true);
  `);
});
afterEach(() => { client?.release(true); client = null; });

async function item(id, metadata, library = 10, media = 'movie') {
  await client.query(`INSERT INTO media_server_items
    (tmdb_id,metadata,library_id,media_type,external_id,genres,studio,content_rating,title,year)
    VALUES ($1,$2::jsonb,$3,$4,$1::integer::text,'["Documentary"]','Example','PG','Synthetic',2006)`,
  [id, JSON.stringify(metadata), library, media]);
}
async function history(id, metadata, media = 'movie', date = '2026-08-01') {
  await client.query('INSERT INTO classification_history (tmdb_id,metadata,media_type,created_at) VALUES ($1,$2::jsonb,$3,$4)',
    [id, JSON.stringify(metadata), media, date]);
}
async function compare(options = {}, media = 'movie') {
  const parameters = options.mediaTypeScoped ? [retention, media] : [retention];
  const previous = (await client.query(buildPreviousInventoryDescriptionCorpusSql(options), parameters)).rows;
  const current = (await client.query(buildInventoryDescriptionCorpusSql(options), parameters)).rows;
  expect(current).toEqual(previous);
  return current;
}

const cases = [
  [{ overview: '  Inventory  ', summary: 'Summary' }, { overview: 'History' }, 'Inventory'],
  [{ overview: '   ', summary: '  Summary  ' }, { overview: 'History' }, 'Summary'],
  [{ overview: false, summary: 42 }, { overview: '  History  ' }, '  History  '],
  [{ overview: ['not text'], summary: {} }, { overview: 42 }, ''],
  [{ overview: null, summary: null }, { overview: 'History' }, 'History'],
  [null, { overview: 'History' }, 'History'],
  ['root string', { overview: 'History' }, 'History'],
  [['root array'], null, ''],
  [{ overview: '\t', summary: 'Summary' }, { overview: 'History' }, '\t'],
  [{ overview: '🦭'.repeat(4001) }, { overview: 'History' }, '🦭'.repeat(4000)],
  [{ summary: 'é'.repeat(4001) }, { overview: 'History' }, 'é'.repeat(4000)],
  [{}, { overview: '🦭'.repeat(4001) }, '🦭'.repeat(4000)],
  [{}, { overview: '' }, ''],
  [{}, { overview: '   ' }, '   '],
  [{}, { overview: { instruction: 'not text' } }, ''],
  [{}, { summary: 'Do not substitute history summary' }, ''],
];

test('preserves typed fallback precedence, whitespace, Unicode and length boundaries', async () => {
  for (const [index, [metadata, stored]] of cases.entries()) {
    await item(index + 1, metadata);
    await history(index + 1, stored);
  }
  await item(100, {}); // Missing history.
  await item(101, {});
  await client.query('UPDATE media_server_items SET metadata=NULL WHERE tmdb_id=101');
  await history(101, { overview: 'SQL null fallback' });
  const rows = await compare();
  expect(rows.map(row => row.overview)).toEqual([...cases.map(entry => entry[2]), '', 'SQL null fallback']);
  expect(prepareInventoryDescriptionCorpus(rows)).toEqual(prepareInventoryDescriptionCorpus(
    (await client.query(buildPreviousInventoryDescriptionCorpusSql(), [retention])).rows));
});

test('uses only the latest typed history row, preserving ties, null timestamps and no older-row rescue', async () => {
  await item(1, {}); await item(1, {}, 40, 'tv');
  await history(1, { overview: 'Older' }, 'movie', '2026-07-01');
  await history(1, { overview: 'Tie loses' }); await history(1, { overview: 'Tie wins' });
  await history(1, { overview: 'TV stays separate' }, 'tv');
  await item(2, {}); await history(2, { overview: 'Older usable text' });
  await history(2, { overview: false }, 'movie', '2026-08-02');
  await item(3, {}); await history(3, { overview: 'Dated' });
  await history(3, { overview: 'Null timestamp first' }, 'movie', null);
  expect((await compare()).map(row => row.overview)).toEqual(['Tie wins', '', 'Null timestamp first', 'TV stays separate']);
});

test('matches every field/scope variant with duplicate memberships, metadata bounds and source exclusions', async () => {
  await item(1, { inventory_tmdb: { overview: 'Small' }, overview: 'Shared' });
  await item(1, { overview: 'Shared' }, 20);
  await item(1, { inventory_tmdb: { overview: 'x'.repeat(100001) }, overview: 'TV' }, 40, 'tv');
  await item(2, { overview: 'Conflict' });
  await client.query("INSERT INTO media_source_observations VALUES (10,1,'2',now())");
  await item(3, { overview: 'Inactive' }, 30);
  await item(4, { overview: 'Wrong library media' }, 40);
  await item(0, { overview: 'Invalid identity' });
  await item(5, {}, 20); await history(5, { overview: 'Fallback' });
  for (const includeCandidateMetadata of [false, true]) {
    for (const includeEvaluationMetadata of [false, true]) {
      for (const media of ['all', 'movie', 'tv']) {
        const options = { includeCandidateMetadata, includeEvaluationMetadata, mediaTypeScoped: media !== 'all' };
        const rows = await compare(options, media);
        expect(rows.map(row => [row.media_type, row.tmdb_id, row.library_id])).toEqual(media === 'tv' ? [['tv', 1, 40]]
          : [['movie', 1, 10], ['movie', 1, 20], ['movie', 5, 20], ...(media === 'all' ? [['tv', 1, 40]] : [])]);
        if (includeCandidateMetadata) expect(rows[0].genres).toEqual(['Documentary']);
        else expect(rows[0]).not.toHaveProperty('genres');
        if (includeEvaluationMetadata && media !== 'movie') expect(rows.at(-1).evaluation_metadata).toEqual({});
        if (!includeEvaluationMetadata) expect(rows[0]).not.toHaveProperty('evaluation_metadata');
      }
    }
  }
});

test('preserves deterministic overflow sentinel after guards and media filtering', async () => {
  await client.query(`INSERT INTO media_server_items (tmdb_id,metadata,library_id,media_type,external_id)
    SELECT id,'{"overview":"Same synopsis"}'::jsonb,10,'movie',id::text FROM generate_series(50003,1,-1) id;
    INSERT INTO media_source_observations VALUES (10,1,'1',now());`);
  await item(1, { overview: 'TV is not in movie limit' }, 40, 'tv');
  const rows = await compare({ mediaTypeScoped: true });
  expect(rows).toHaveLength(50001);
  expect(rows[0].tmdb_id).toBe(2);
  expect(rows.at(-1).tmdb_id).toBe(50002);
  expect(() => prepareInventoryDescriptionCorpus(rows)).toThrow('corpus_limit_exceeded');
});

test('does not execute history fallback when inventory supplies a synopsis', async () => {
  await item(1, { overview: 'Inventory' }); await history(1, { overview: 'Unused' });
  await item(2, { overview: false, summary: 'Summary' }); await history(2, { overview: 'Unused' });
  const plan = (await client.query('EXPLAIN (ANALYZE, FORMAT JSON) ' + buildInventoryDescriptionCorpusSql(), [retention])).rows[0]['QUERY PLAN'][0].Plan;
  const historyScans = [];
  const walk = node => {
    if (node['Relation Name'] === 'classification_history') historyScans.push(node['Actual Loops']);
    for (const child of node.Plans ?? []) walk(child);
  };
  walk(plan);
  expect(historyScans.length).toBeGreaterThan(0);
  expect(historyScans.every(loops => loops === 0)).toBe(true);
});
