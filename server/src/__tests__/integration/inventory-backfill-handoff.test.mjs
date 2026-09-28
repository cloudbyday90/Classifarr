/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, beforeEach } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { materializeInventoryBackfillPage } from '../../services/inventoryBackfillHandoff.mjs';
import { readInventoryBackgroundReadiness } from '../../services/inventoryBackgroundReadiness.mjs';
import { QueueRefillService } from '../../services/queueRefillService.mjs';
import { readRefillCandidatePage } from '../../services/queueRefillCandidates.mjs';
import { withMetadataRefillOwnership } from '../../services/queueRefillCoordination.mjs';

const db = createIntegrationDatabaseModuleMock();
const logger = { error() {}, info() {}, debug() {} };
const payloads = new QueueRefillService({ db, logger });
const relay = (database = db) => materializeInventoryBackfillPage({ db: database,
  buildPayload: item => payloads.buildMetadataEnrichmentPayload(item), logger });
const state = async id => (await db.query('SELECT * FROM library_ingestion_state WHERE library_id=$1', [id])).rows[0];
const tasks = async () => (await db.query('SELECT * FROM task_queue ORDER BY id')).rows;

async function library({ count = 1, type = 'movie', provider = 'jellyfin', metadata = {} } = {}) {
  const server = (await db.query(`INSERT INTO media_server(type,name,url,api_key)
    VALUES ($1,$2::text,'http://synthetic.invalid/'||$2::text,'synthetic-only') RETURNING id`, [provider, randomUUID()])).rows[0].id;
  const id = (await db.query(`INSERT INTO libraries(name,external_id,media_type,media_server_id)
    VALUES ($1,$1,$2,$3) RETURNING id`, [randomUUID(), type, server])).rows[0].id;
  const run = randomUUID();
  await db.query("INSERT INTO library_ingestion_state(library_id,run_id,phase) VALUES ($1,$2,'complete')", [id, run]);
  await db.query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type,metadata)
    SELECT $1,$2,n::text,'Synthetic '||n,$3,$4::jsonb FROM generate_series(1,$5::integer) n`,
  [server, id, type, JSON.stringify(metadata), count]);
  return { id, server, run };
}
beforeEach(async () => {
  await db.query('DELETE FROM task_queue');
  await db.query('UPDATE libraries SET is_active=false');
  await db.query('UPDATE media_server SET is_active=false');
  await db.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
  await db.query('UPDATE tmdb_config SET is_active=false');
  await db.query('UPDATE omdb_config SET is_active=false');
});

test.each(['plex', 'jellyfin', 'emby'].flatMap(provider => ['movie', 'tv'].map(type => [provider, type])))
  ('%s %s legacy completed scan cannot become ready before durable enqueue', async (provider, type) => {
    const l = await library({ provider, type });
    expect((await state(l.id)).backfill_run_id).toBeNull();
    expect(await tasks()).toEqual([]);
    expect(await readInventoryBackgroundReadiness(db)).toBe('backfilling');
    expect((await readRefillCandidatePage(db)).rows.some(item => item.library_id === l.id)).toBe(false);
    expect(await relay()).toEqual({ queued: 1 });
    expect(await relay()).toBeNull();
    expect(await tasks()).toHaveLength(1);
    expect((await state(l.id)).backfill_run_id).toBe(l.run);
    expect(await readInventoryBackgroundReadiness(db)).toBe('backfilling');
    await db.query("UPDATE task_queue SET status='completed'");
    expect(await readInventoryBackgroundReadiness(db)).toBe('ready');
  });

test('a bounded pass resumes durable progress and rotates between libraries', async () => {
  const large = await library({ count: 251 });
  const small = await library({ type: 'tv' });
  expect(await relay()).toEqual({ queued: 250 });
  const checkpoint = await state(large.id);
  expect(checkpoint.backfill_completed_at).toBeNull();
  expect(checkpoint.backfill_after_id).toBeGreaterThan(0);
  expect(await relay()).toEqual({ queued: 1 });
  expect((await state(small.id)).backfill_completed_at).not.toBeNull();
  expect(await relay()).toEqual({ queued: 1 });
  expect((await state(large.id)).backfill_completed_at).not.toBeNull();
  const queued = await tasks();
  expect(queued).toHaveLength(252);
  expect(new Set(queued.map(task => task.payload.itemId)).size).toBe(252);
});

test('a failed transaction after insertion leaves no jobs or acknowledgement', async () => {
  const l = await library();
  const failing = { withTransaction: fn => db.withTransaction(client => fn({
    query: async (...args) => {
      const result = await client.query(...args);
      if (args[0].startsWith('INSERT INTO task_queue')) throw new Error('synthetic interruption');
      return result;
    },
  })) };
  await expect(relay(failing)).rejects.toThrow('synthetic interruption');
  expect(await tasks()).toEqual([]);
  expect((await state(l.id)).backfill_run_id).toBeNull();
  expect(await readInventoryBackgroundReadiness(db)).toBe('backfilling');
  expect(await relay()).toEqual({ queued: 1 });
});

test('concurrent relays and held locks cannot duplicate or hide outstanding work', async () => {
  const l = await library();
  const owner = await db.pool.connect();
  try {
    await owner.query('BEGIN');
    await owner.query('SELECT library_id FROM library_ingestion_state WHERE library_id=$1 FOR UPDATE', [l.id]);
    expect(await relay()).toBeNull();
    expect(await readInventoryBackgroundReadiness(db)).toBe('backfilling');
  } finally { await owner.query('ROLLBACK'); owner.release(); }
  const results = await Promise.all([relay(), relay()]);
  expect(results.filter(Boolean)).toEqual([{ queued: 1 }]);
  expect(await tasks()).toHaveLength(1);
});

test('manual and scheduled facade refills exclude each other across database sessions', async () => {
  await library();
  const entered = Promise.withResolvers(), resume = Promise.withResolvers();
  const first = withMetadataRefillOwnership(db, async () => {
    entered.resolve(); await resume.promise; return relay();
  });
  try {
    await entered.promise;
    let invoked = false;
    expect(await withMetadataRefillOwnership(db, async () => { invoked = true; return relay(); })).toEqual({ queued: 0 });
    expect(invoked).toBe(false);
    expect(await tasks()).toEqual([]);
  } finally { resume.resolve(); }
  expect(await first).toEqual({ queued: 1 });
  expect(await withMetadataRefillOwnership(db, async () => ({ queued: 0 }))).toEqual({ queued: 0 });
});

test('a newer scan resets the cursor while existing pending tasks are reused', async () => {
  const l = await library({ count: 251 });
  await relay();
  const newer = randomUUID();
  await db.query('UPDATE library_ingestion_state SET run_id=$2 WHERE library_id=$1', [l.id, newer]);
  expect(await relay()).toEqual({ queued: 0 });
  expect(await readInventoryBackgroundReadiness(db)).toBe('backfilling');
  expect(await relay()).toEqual({ queued: 1 });
  expect((await state(l.id)).backfill_run_id).toBe(newer);
  expect(await tasks()).toHaveLength(251);
});

test('disabled and unfinished libraries retain demand without creating jobs', async () => {
  const l = await library();
  await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [l.id]);
  expect(await relay()).toBeNull();
  await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [l.id]);
  await db.query("UPDATE library_ingestion_state SET phase='running' WHERE library_id=$1", [l.id]);
  expect(await relay()).toBeNull();
  expect(await readInventoryBackgroundReadiness(db)).toBe('ingesting');
  expect((await state(l.id)).backfill_run_id).toBeNull();
  expect(await tasks()).toEqual([]);
});

test('missing optional providers do not prevent an already-enriched pass from completing', async () => {
  await library({ metadata: { content_analysis: { source: 'metadata_enrichment' } } });
  expect(await relay()).toEqual({ queued: 0 });
  expect(await readInventoryBackgroundReadiness(db)).toBe('ready');
});

test('optional provider cooldown completes the handoff and remains eligible when due later', async () => {
  const l = await library({ metadata: { content_analysis: { source: 'metadata_enrichment' } } });
  await db.query("INSERT INTO tmdb_config(api_key,is_active) VALUES ('synthetic-only',true)");
  // An identity change correctly clears the previous identity's retry state.
  await db.query('UPDATE media_server_items SET tmdb_id=7 WHERE library_id=$1', [l.id]);
  await db.query(`UPDATE media_server_items SET inventory_tmdb_attempted_at=clock_timestamp()-interval '7 hours',
    inventory_tmdb_retry_after=clock_timestamp()+interval '1 day' WHERE library_id=$1`, [l.id]);
  expect(await relay()).toEqual({ queued: 0 });
  expect(await readInventoryBackgroundReadiness(db)).toBe('ready');
  await db.query("UPDATE media_server_items SET inventory_tmdb_retry_after=clock_timestamp()-interval '1 second' WHERE library_id=$1", [l.id]);
  expect((await readRefillCandidatePage(db)).rows.some(item => item.library_id === l.id)).toBe(true);
});

test('an empty complete library can acknowledge its pass without inventing work', async () => {
  const l = await library({ count: 0 });
  expect(await relay()).toEqual({ queued: 0 });
  expect((await state(l.id)).backfill_completed_at).not.toBeNull();
  expect(await tasks()).toEqual([]);
  expect(await readInventoryBackgroundReadiness(db)).toBe('waiting_for_inventory');
});

test('migration reapplication preserves a completed checkpoint and legacy inventory', async () => {
  const l = await library();
  await relay();
  const before = await state(l.id);
  const sql = await readFile(new URL('../../../../database/migrations/20260928_050000_add_inventory_backfill_handoff.sql', import.meta.url), 'utf8');
  await db.query(sql);
  await db.query(sql);
  expect(await state(l.id)).toEqual(before);
  expect(await tasks()).toHaveLength(1);
});
