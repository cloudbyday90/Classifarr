/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertUpgradeDrillEnvironment } from './publishedUpgradeFixtures.mjs';
import { runScheduledInstallationProbe } from './scheduledInstallationProbe.mjs';
import { waitForScheduledProgress, readScheduledTasks, readScheduledInventory,
  waitForScheduledCompletion, assertScheduledInventory, assertScheduledTaskInventory } from './scheduledInstallationEvidence.mjs';
import { writeScheduledCrashCheckpoint, readScheduledCrashCheckpoint } from './scheduledCrashCheckpoint.mjs';
import { METADATA_REFILL_OWNER_LOCK } from '../services/queueRefillCoordination.mjs';

const readRuns = async (db, ids) => (await db.query(`SELECT library_id,run_id FROM library_ingestion_state
  WHERE library_id=ANY($1::integer[]) AND phase='complete' ORDER BY library_id`, [ids])).rows;

export async function armScheduledCrash(db) {
  assertUpgradeDrillEnvironment();
  return runScheduledInstallationProbe(db, { beforeBackfill: async ({ ids, owner }) => {
    const ownerPid = (await owner.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await writeScheduledCrashCheckpoint({ version: 1, ownerPid, libraries: await readRuns(db, ids),
      inventory: await readScheduledInventory(db, ids) });
    // Retain the real refill lock until the whole container is killed, or fail on a bounded deadline.
    await waitForScheduledProgress(() => false, 'crash_pending');
  } });
}

export async function verifyScheduledCrashBoundary(db) {
  assertUpgradeDrillEnvironment();
  const checkpoint = await readScheduledCrashCheckpoint();
  const ids = checkpoint.libraries.map(row => row.library_id);
  assert.deepEqual(await readRuns(db, ids), checkpoint.libraries);
  assert.deepEqual(await assertScheduledInventory(db, ids), checkpoint.inventory);
  assert.equal((await readScheduledTasks(db, ids)).length, 0);
  const locks = await db.query(`SELECT count(*)::integer AS count FROM pg_locks
    WHERE locktype='advisory' AND pid=$1 AND classid=0 AND objid=$2 AND objsubid=1 AND granted`,
  [checkpoint.ownerPid, METADATA_REFILL_OWNER_LOCK]);
  assert.equal(locks.rows[0].count, 1);
  return { boundary: 'ingestion_committed_before_backfill', queuedTasks: 0, refillLock: 'held' };
}

/** Read only: do not reseed, repair statuses, restart providers or invoke workers. */
export async function verifyScheduledCrashRecovery(db) {
  assertUpgradeDrillEnvironment();
  const checkpoint = await readScheduledCrashCheckpoint();
  const ids = checkpoint.libraries.map(row => row.library_id);
  assert.deepEqual(await readRuns(db, ids), checkpoint.libraries);
  assert.deepEqual(await readScheduledInventory(db, ids), checkpoint.inventory);
  await waitForScheduledCompletion(db, ids);
  assert.deepEqual(await readRuns(db, ids), checkpoint.libraries);
  assert.deepEqual(await assertScheduledInventory(db, ids), checkpoint.inventory);
  await assertScheduledTaskInventory(db, ids, checkpoint.inventory);
  return { driver: 'startup_scheduler', checkpoint: 'preserved', ingestionRuns: 'unchanged',
    inventory: 'unchanged', backfill: 'completed', profiles: 'current', completedTasks: 4, routingTasks: 0 };
}
