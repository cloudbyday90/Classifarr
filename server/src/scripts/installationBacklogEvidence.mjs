/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { readLibraryProfileRefreshStatus } from '../services/libraryProfileRefreshStatus.mjs';
import { readScheduledInventory } from './scheduledInstallationEvidence.mjs';

export const readBacklogRuns = async (db, ids) => (await db.query(`SELECT library_id,run_id,sync_status_id,capture_generation::text
  FROM library_ingestion_state WHERE library_id=ANY($1::integer[]) AND phase='complete' ORDER BY library_id`, [ids])).rows;

// The current run_id is a retryable scan head, not the identity of committed work.
// A later failed preflight must not invalidate an already completed capture/handoff.
export const readCommittedBacklogRuns = async (db, libraries) => (await db.query(`SELECT s.library_id,
  s.backfill_run_id AS run_id,h.id AS sync_status_id,c.generation::text AS capture_generation
  FROM library_ingestion_state s
  JOIN media_server_sync_status h ON h.library_id=s.library_id AND h.id=ANY($2::integer[]) AND h.status='completed'
  JOIN media_source_capture_state c ON c.library_id=s.library_id AND c.phase='complete' AND c.source='media_sync'
  WHERE s.library_id=ANY($1::integer[]) AND s.backfill_completed_at IS NOT NULL ORDER BY s.library_id`,
[libraries.map(row => row.library_id), libraries.map(row => row.sync_status_id)])).rows;

export const readBacklogTasks = async (db, ids) => (await db.query(`SELECT q.id,q.status,q.task_type,q.attempts,
  q.payload->>'itemId' AS item_id,q.payload->>'source_library_id' AS library_id,
  q.payload->'media'->>'media_type' AS media_type,q.payload->'result'->'enriched' AS enriched,
  (extract(epoch FROM q.started_at)*1000)::double precision AS started_ms,
  (extract(epoch FROM q.visible_at)*1000)::double precision AS visible_ms,
  a.starts,a.completions,(extract(epoch FROM a.last_started_at)*1000)::double precision AS last_started_ms,
  (extract(epoch FROM a.first_completed_at)*1000)::double precision AS completed_ms
  FROM task_queue q LEFT JOIN installation_backlog_dispatch a ON a.task_id=q.id
  WHERE q.payload->>'source_library_id'=ANY($1::text[]) ORDER BY q.id`, [ids.map(String)])).rows;

export const readDatabaseEpoch = async db => (await db.query(
  'SELECT (extract(epoch FROM pg_postmaster_start_time())*1000)::double precision AS epoch')).rows[0].epoch;

export async function waitForBacklog(check, { now = Date.now, sleep = delay, timeout = 900000 } = {}) {
  assert.ok(Number.isSafeInteger(timeout) && timeout > 0 && timeout <= 900000);
  const start = now();
  while (now() - start < timeout) {
    if (await check()) return Math.max(1, now() - start);
    await sleep(1000);
  }
  throw new Error('unfinished_backfill_timeout');
}

export async function assertBacklogIdentity(db, checkpoint) {
  const ids = checkpoint.libraries.map(row => row.library_id);
  assert.deepEqual(await readCommittedBacklogRuns(db, checkpoint.libraries), checkpoint.libraries);
  assert.deepEqual(await readScheduledInventory(db, ids), checkpoint.inventory);
  assert.equal((await db.query(`SELECT count(*)::integer AS count FROM media_source_observations
    WHERE library_id=ANY($1::integer[]) AND external_id LIKE '%-audio'`, [ids])).rows[0].count, 0);
  assert.equal((await db.query("SELECT count(*)::integer AS count FROM task_queue WHERE task_type<>'metadata_enrichment'")).rows[0].count, 0);
}

export async function backlogProfilesCurrent(db, ids) {
  const states = (await readLibraryProfileRefreshStatus(db)).libraries.filter(row => ids.includes(row.libraryId));
  return states.length === 2 && states.every(row => row.statusId === 'current' &&
    row.sourceRevision === row.profileRevision && row.acknowledgedRevision === row.sourceRevision);
}

export function assertBacklogTaskIdentities(tasks, original) {
  const identity = row => `${row.id}:${row.library_id}:${row.item_id}:${row.media_type}:${row.task_type}`;
  assert.deepEqual(tasks.map(identity), original.map(identity));
}

export function assertBacklogCompleted(tasks, original) {
  assertBacklogTaskIdentities(tasks, original);
  for (let index = 0; index < tasks.length; index++) {
    const row = tasks[index], before = original[index];
    assert.equal(row.status, 'completed');
    assert.equal(row.enriched, true);
    assert.equal(row.attempts, 0);
    assert.equal(row.completions, 1);
    assert.equal(row.starts, before.status === 'processing' ? 2 : 1);
    assert.ok(Number.isFinite(row.last_started_ms) && Number.isFinite(row.completed_ms));
    assert.ok(row.completed_ms >= row.last_started_ms);
    if (before.status === 'processing') assert.ok(row.last_started_ms >= before.visible_ms);
  }
}

/** Durable evidence of sibling completion before any interrupted claim becomes eligible. */
export function sawSiblingProgress(tasks, original) {
  const interrupted = original.filter(row => row.status === 'processing');
  const deadline = Math.min(...interrupted.map(row => row.visible_ms));
  return tasks.some(row => row.media_type === 'tv' && row.status === 'completed' &&
    Number.isFinite(row.completed_ms) && row.completed_ms < deadline);
}
