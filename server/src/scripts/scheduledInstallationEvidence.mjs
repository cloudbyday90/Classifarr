/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { readLibraryProfileRefreshStatus } from '../services/libraryProfileRefreshStatus.mjs';

export async function waitForScheduledProgress(check, stage, { now = Date.now, sleep = delay, timeout = 420_000 } = {}) {
  if (!['refill_lock', 'ingestion_started', 'ingestion_complete', 'metadata_and_profiles', 'crash_pending'].includes(stage) ||
    !Number.isSafeInteger(timeout) || timeout < 1 || timeout > 420_000) throw new TypeError('invalid_scheduler_wait');
  const deadline = now() + timeout;
  while (now() < deadline) { if (await check()) return; await sleep(500); }
  throw new Error(`scheduled_installation_timeout:${stage}`);
}

export async function readScheduledTasks(db, ids) {
  return (await db.query(`SELECT task_type,status,payload->>'itemId' AS item_id,
      payload->>'source_library_id' AS library_id,payload->'media'->>'media_type' AS media_type FROM task_queue
    WHERE payload->>'source_library_id'=ANY($1::text[])`, [ids.map(String)])).rows;
}

export async function assertScheduledTaskInventory(db, ids, inventory) {
  const tasks = await readScheduledTasks(db, ids);
  const identity = row => `${row.library_id}:${row.item_id ?? row.id}:${row.media_type}`;
  assert.deepEqual(tasks.map(identity).sort(), inventory.map(identity).sort());
  assert.ok(tasks.every(task => task.task_type === 'metadata_enrichment' && task.status === 'completed'));
}

export async function readScheduledInventory(db, ids) {
  return (await db.query(`SELECT id,library_id,external_id,media_type FROM media_server_items
    WHERE library_id=ANY($1::integer[]) ORDER BY library_id,id`, [ids])).rows;
}

export async function waitForScheduledCompletion(db, ids) {
  await waitForScheduledProgress(async () => {
    const tasks = await readScheduledTasks(db, ids);
    const states = (await readLibraryProfileRefreshStatus(db)).libraries.filter(row => ids.includes(row.libraryId));
    const handoffs = (await db.query(`SELECT count(*)::integer AS count FROM library_ingestion_state
      WHERE library_id=ANY($1::integer[]) AND backfill_run_id=run_id AND backfill_completed_at IS NOT NULL`, [ids])).rows[0].count;
    return handoffs === 2 && tasks.length === 4 && tasks.every(task => task.status === 'completed' && task.task_type === 'metadata_enrichment') &&
      states.length === 2 && states.every(state => state.statusId === 'current' && state.sourceRevision === state.profileRevision &&
        state.acknowledgedRevision === state.sourceRevision);
  }, 'metadata_and_profiles');
}

export async function assertScheduledInventory(db, ids) {
  const inventory = await readScheduledInventory(db, ids);
  assert.deepEqual(inventory.map(row => row.media_type).sort(), ['movie', 'movie', 'tv', 'tv']);
  assert.equal((await db.query(`SELECT count(*)::integer AS count FROM media_source_observations
    WHERE library_id=ANY($1::integer[]) AND external_id LIKE '%-audio'`, [ids])).rows[0].count, 0);
  assert.equal((await db.query(`SELECT count(*)::integer AS count FROM task_queue WHERE task_type<>'metadata_enrichment'`)).rows[0].count, 0);
  return inventory;
}
