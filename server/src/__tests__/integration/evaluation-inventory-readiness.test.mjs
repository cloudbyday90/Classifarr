/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, beforeEach } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { readEvaluationHistory } from '../../services/evaluationHistoryRepository.mjs';
import { materializeInventoryBackfillPage } from '../../services/inventoryBackfillHandoff.mjs';
import { QueueRefillService } from '../../services/queueRefillService.mjs';

const db = createIntegrationDatabaseModuleMock();
const logger = { error() {}, info() {}, debug() {} };
const refill = new QueueRefillService({ db, logger });
const read = async () => (await readEvaluationHistory(db)).activity.inventory;
const relay = () => materializeInventoryBackfillPage({ db, logger, buildPayload: row => refill.buildMetadataEnrichmentPayload(row) });

async function library(count = 1, type = 'movie') {
  const { rows: [server] } = await db.query(`INSERT INTO media_server(type,name,url,api_key)
    VALUES('jellyfin',$1::text,'http://synthetic.invalid/'||$1::text,'synthetic-only') RETURNING id`, [randomUUID()]);
  const { rows: [l] } = await db.query(`INSERT INTO libraries(name,external_id,media_type,media_server_id)
    VALUES($1,$1,$2,$3) RETURNING id`, [randomUUID(), type, server.id]);
  await db.query("INSERT INTO library_ingestion_state(library_id,run_id,phase) VALUES($1,$2,'complete')", [l.id, randomUUID()]);
  await db.query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type)
    SELECT $1,$2,n::text,'Synthetic', $3 FROM generate_series(1,$4::integer) n`, [server.id, l.id, type, count]);
  return { id: l.id, server: server.id };
}

beforeEach(async () => {
  await db.query('DELETE FROM task_queue');
  await db.query('UPDATE libraries SET is_active=false');
  await db.query('UPDATE media_server SET is_active=false');
  await db.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
  await db.query('UPDATE tmdb_config SET is_active=false');
  await db.query('UPDATE omdb_config SET is_active=false');
});

test('empty queue, durable page progress and finished enqueue are distinct without status writes', async () => {
  await library(501);
  const before = (await db.query('SELECT * FROM library_ingestion_state ORDER BY library_id')).rows;
  expect(await read()).toMatchObject({ status: 'backfilling', completedImports: 1, notStarted: 1,
    scanning: 0, completedHandoffs: 0, dueTasks: 0, processingTasks: 0, latestCheckpointAt: null });
  expect((await db.query('SELECT * FROM library_ingestion_state ORDER BY library_id')).rows).toEqual(before);
  expect(await relay()).toEqual({ queued: 250 });
  expect(await read()).toMatchObject({ status: 'backfilling', notStarted: 0, scanning: 1, dueTasks: 250,
    latestCheckpointAt: expect.any(String) });
  // Synthetic jobs only: no external providers run in this isolated database.
  await db.query("UPDATE task_queue SET status='completed'");
  expect(await read()).toMatchObject({ status: 'backfilling', scanning: 1, dueTasks: 0 });
  await relay(); await relay();
  expect(await read()).toMatchObject({ status: 'backfilling', scanning: 0, completedHandoffs: 1, dueTasks: 251, latestCheckpointAt: null });
  await db.query("UPDATE task_queue SET status='completed'");
  expect(await read()).toMatchObject({ status: 'ready', completedHandoffs: 1, dueTasks: 0 });
});

test('new generation does not inherit completed handoff or old page timestamps', async () => {
  const l = await library(); await relay();
  await db.query("UPDATE task_queue SET status='completed'");
  await db.query('UPDATE library_ingestion_state SET run_id=$2 WHERE library_id=$1', [l.id, randomUUID()]);
  expect(await read()).toMatchObject({ status: 'backfilling', notStarted: 1, scanning: 0, completedHandoffs: 0, latestCheckpointAt: null });
});

test('disabled sources and libraries are excluded; the schema rejects unsupported library media', async () => {
  const disabled = await library(), inactiveSource = await library();
  await expect(library(1, 'music')).rejects.toMatchObject({ code: '23514' });
  await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [disabled.id]);
  await db.query('UPDATE media_server SET is_active=false WHERE id=$1', [inactiveSource.server]);
  expect(await read()).toMatchObject({ status: 'waiting_for_libraries', completedImports: 0, notStarted: 0 });
  await db.query('UPDATE ai_provider_config SET rag_enabled=false WHERE id=1');
  expect(await read()).toMatchObject({ status: 'disabled' });
});

test('future retries are not due; processing and due work of any type retain admission', async () => {
  await library(); await relay();
  await db.query("UPDATE task_queue SET next_retry_at=now()+interval '1 hour'");
  expect(await read()).toMatchObject({ status: 'ready', dueTasks: 0, processingTasks: 0 });
  await db.query("UPDATE task_queue SET status='processing'");
  expect(await read()).toMatchObject({ status: 'backfilling', dueTasks: 0, processingTasks: 1 });
  await db.query("UPDATE task_queue SET status='pending',next_retry_at=NULL");
  expect(await read()).toMatchObject({ status: 'backfilling', dueTasks: 1, processingTasks: 0 });
});

test('read-only diagnostics neither wait for a held generation row nor claim it completed', async () => {
  const l = await library();
  await db.withTransaction(async client => {
    await client.query('SELECT library_id FROM library_ingestion_state WHERE library_id=$1 FOR UPDATE', [l.id]);
    expect(await read()).toMatchObject({ status: 'backfilling', notStarted: 1 });
  });
});

test('unfinished imports take precedence and an empty imported library is not ready inventory', async () => {
  const l = await library(0);
  expect(await read()).toMatchObject({ status: 'waiting_for_inventory', completedImports: 1, notStarted: 1 });
  await db.query("UPDATE library_ingestion_state SET phase='retry_wait' WHERE library_id=$1", [l.id]);
  expect(await read()).toMatchObject({ status: 'ingesting', completedImports: 0, notStarted: 0 });
});
