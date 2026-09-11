/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { INVENTORY_SEMANTIC_SAMPLE_SQL } from '../../services/inventorySemanticSampleQuery.mjs';
import { createInventorySemanticSampler } from '../../services/inventorySemanticSampler.mjs';

let client;
beforeEach(async () => {
  client = await getPool().connect();
  // Session-local shadows exercise real PostgreSQL/pgvector without modifying
  // public fixture data. Destroy the connection at teardown to drop all shadows.
  await client.query(`
    CREATE TEMP TABLE libraries (id integer, name text, media_type text, is_active boolean);
    CREATE TEMP TABLE classification_history (
      id integer, tmdb_id integer, media_type text, library_id integer,
      metadata jsonb, created_at timestamptz DEFAULT now()
    );
    CREATE TEMP TABLE classification_embeddings (
      id integer, classification_id integer, embedding vector(3), provider text DEFAULT 'test',
      model text DEFAULT 'test-v1', embedding_dims integer DEFAULT 3,
      is_stale boolean DEFAULT false, updated_at timestamptz DEFAULT now()
    );
    CREATE TEMP TABLE media_server_items (
      id integer, tmdb_id integer, media_type text, library_id integer,
      media_server_id integer DEFAULT 1, external_id text, title text, year integer,
      genres text[] DEFAULT ARRAY['Documentary'], metadata jsonb DEFAULT '{"summary":"Current description"}', content_rating text
    );
    CREATE TEMP TABLE media_source_observations (
      library_id integer, media_server_id integer, external_id text, last_seen_at timestamptz
    );
    CREATE TEMP TABLE policy_authorized_outcome_source_event_receipts (
      classification_id integer, destination_library_id integer,
      final_outcome_status_id text, persistence_status_id text
    );
    INSERT INTO libraries VALUES (10,'Movies','movie',true), (20,'Comedy','movie',true),
      (30,'Inactive','movie',false), (40,'TV','tv',true);
    INSERT INTO classification_history (id,tmdb_id,media_type,library_id) VALUES
      (1,1,'movie',10), (2,1,'movie',20), (3,2,'movie',10),
      (4,100,'movie',10), (5,100,'movie',10), (6,101,'movie',20),
      (7,102,'movie',20), (8,103,'movie',20), (9,104,'movie',20),
      (10,105,'movie',10), (11,106,'movie',10), (12,1,'tv',40),
      (13,107,'movie',10), (14,108,'movie',10), (15,109,'movie',10);
    INSERT INTO media_server_items (id,tmdb_id,media_type,library_id,external_id,title,year)
      SELECT id,tmdb_id,media_type,library_id,id::text,'Item ' || id,2026 FROM classification_history;
    INSERT INTO classification_embeddings (id,classification_id,embedding) VALUES
      (1,1,'[1,0,0]'), (2,2,'[1,0,0]'), (3,3,'[1,0,0]'),
      (4,4,'[1,0,0]'), (5,5,'[1,1,0]'), (6,6,'[1,0.5,0]'),
      (7,7,'[1,0,0]'), (8,8,'[1,0,0]'), (9,9,'[0,0,0]'),
      (10,10,'[1,0,0]'), (11,11,'[1,0,0]'), (12,12,'[1,0,0]'),
      (13,13,'[1,0.2,0]'), (14,14,'[1,0.3,0]'), (15,15,'[1,0.4,0]');
    UPDATE classification_embeddings SET model = 'incompatible' WHERE id = 7;
    UPDATE classification_embeddings SET is_stale = true WHERE id = 8;
    UPDATE classification_embeddings SET provider = 'other' WHERE id = 10;
    UPDATE classification_embeddings SET embedding_dims = 2 WHERE id = 11;
    INSERT INTO media_source_observations VALUES (10,1,'13',now());
    INSERT INTO policy_authorized_outcome_source_event_receipts VALUES (6,20,'routed','ready');
  `);
});

afterEach(() => { client?.release(true); client = null; });

async function retrieve(tmdbId = 1, mediaType = 'movie', heldIds = [1, 2]) {
  return (await client.query(INVENTORY_SEMANTIC_SAMPLE_SQL, [
    mediaType, tmdbId, [10, 20, 30, 40], heldIds.map(() => mediaType), heldIds, 30,
  ])).rows;
}

test('holds out identities across libraries, removes incompatible/conflicting vectors, and deduplicates before limits', async () => {
  const rows = await retrieve();
  expect(rows.map(row => row.tmdb_id)).toEqual([108, 109, 100, 101]);
  expect(rows.filter(row => row.observed_membership).map(row => row.library_id)).toEqual([10, 10, 10, 20]);
  expect(rows.find(row => row.tmdb_id === 100).similarity).toBeCloseTo(Math.SQRT1_2);
  expect(rows.find(row => row.tmdb_id === 101).has_authorized_outcome).toBe(true);
  expect(rows.every(row => row.overview === 'Current description')).toBe(true);
  expect(rows.some(row => 'embedding' in row || 'provider' in row)).toBe(false);
});

test('missing query embeddings retain library candidates with no fabricated neighbors', async () => {
  const rows = await retrieve(9999);
  expect(rows).toHaveLength(2);
  expect(rows.every(row => row.tmdb_id === null && row.query_embedding_available === false)).toBe(true);
});

test('pairs media type and identity instead of treating matching numeric IDs as the same item', async () => {
  const rows = (await client.query(INVENTORY_SEMANTIC_SAMPLE_SQL, [
    'tv', 1, [40], ['movie'], [1], 30,
  ])).rows;
  expect(rows.map(row => row.tmdb_id)).toEqual([1]);
  // Normal sampler includes the TV identity too; this direct SQL fixture
  // isolates the paired-identity predicate, not a valid sampler request.
});

test('runs the full sampler without policies in a bounded read-only snapshot and restores settings', async () => {
  const before = (await client.query('SHOW enable_indexscan')).rows[0].enable_indexscan;
  const sampler = createInventorySemanticSampler({
    withTransaction: async work => {
      await client.query('BEGIN');
      try {
        const result = await work(client);
        expect((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('on');
        expect((await client.query('SHOW transaction_isolation')).rows[0].transaction_isolation).toBe('repeatable read');
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    },
  });
  const first = await sampler.sample({ size: 2 });
  const second = await sampler.sample({ size: 2 });
  expect(first.report).toEqual(second.report);
  expect(first.cases.map(entry => entry.item.metadata.tmdb_id)).toEqual(second.cases.map(entry => entry.item.metadata.tmdb_id));
  expect(first.report.summary.sampled).toBe(2);
  expect(first.report.activeLibraries).toBe(3);
  expect(first.report.summary.accuracy).toBeNull();
  expect(JSON.stringify(first.report)).not.toMatch(/Current description|Item |Movies|Comedy/);
  expect((await client.query('SHOW enable_indexscan')).rows[0].enable_indexscan).toBe(before);
});
