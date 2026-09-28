/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertInstallationBudgetEnvironment } from './installationConnectionPressure.mjs';
import { createScheduledInstallationFixture, seedScheduledInstallation } from './scheduledInstallationFixture.mjs';
import { METADATA_REFILL_OWNER_LOCK } from '../services/queueRefillCoordination.mjs';
import { waitForScheduledProgress, readScheduledInventory } from './scheduledInstallationEvidence.mjs';
import { installBacklogGate, BACKLOG_GATE_LOCK } from './installationBacklogFixture.mjs';
import { readBacklogCheckpoint, writeBacklogCheckpoint } from './installationBacklogCheckpoint.mjs';
import { BACKLOG_BOUNDARY, backlogRecoveryEvidence } from './installationBacklogContract.mjs';
import { readBacklogRuns, readBacklogTasks, readDatabaseEpoch, waitForBacklog, assertBacklogIdentity,
  backlogProfilesCurrent, assertBacklogTaskIdentities, assertBacklogCompleted, sawSiblingProgress } from './installationBacklogEvidence.mjs';
import { readStudyCgroup } from './resourceStudyMetrics.mjs';
import { installationBudgetSnapshot } from './installationBudgetContract.mjs';

async function assertGateHeld(db, checkpoint) {
  const interrupted = checkpoint.tasks.filter(row => row.status === 'processing').length;
  const result = await db.query(`SELECT count(*)::integer AS count FROM pg_stat_activity
    WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))`, [checkpoint.ownerPid]);
  assert.equal(result.rows[0].count, interrupted);
  const lock = await db.query(`SELECT count(*)::integer AS count FROM pg_locks WHERE locktype='advisory'
    AND pid=$1 AND classid=0 AND objid=$2 AND objsubid=1 AND granted`, [checkpoint.ownerPid, BACKLOG_GATE_LOCK]);
  assert.equal(lock.rows[0].count, 1);
}

export async function armBacklogCrash(db) {
  assertInstallationBudgetEnvironment();
  assert.deepEqual((await db.query('SELECT primary_provider FROM ai_provider_config WHERE id=1')).rows,
    [{ primary_provider: 'none' }]);
  for (const table of ['tmdb_config', 'omdb_config']) assert.equal((await db.query(
    `SELECT count(*)::integer AS count FROM ${table} WHERE is_active`)).rows[0].count, 0);
  const fixture = await createScheduledInstallationFixture({ profile: 'backlog' });
  let owner;
  try {
    owner = await db.pool.connect();
    await waitForScheduledProgress(async () => (await owner.query('SELECT pg_try_advisory_lock($1) AS acquired',
      [METADATA_REFILL_OWNER_LOCK])).rows[0].acquired, 'refill_lock', { timeout: 30000 });
    await owner.query('SELECT pg_advisory_lock($1)', [BACKLOG_GATE_LOCK]);
    const libraries = await seedScheduledInstallation(db, fixture.origin, { profile: 'backlog' });
    const ids = libraries.map(row => row.id);
    await installBacklogGate(db, libraries);
    fixture.release();
    await waitForScheduledProgress(async () => (await readBacklogRuns(db, ids)).length === 2, 'ingestion_complete');
    assert.equal((await readBacklogTasks(db, ids)).length, 0);
    assert.ok(fixture.requests.movie > 0 && fixture.requests.tv > 0 && fixture.requests.audio > 0);
    await owner.query('SELECT pg_advisory_unlock($1)', [METADATA_REFILL_OWNER_LOCK]);
    // Ordinary scheduler latency is not time spent holding an in-flight worker.
    await waitForBacklog(async () => (await readBacklogTasks(db, ids)).some(row => row.status === 'processing'),
      { timeout: 420000 });
    await waitForBacklog(async () => {
      const tasks = await readBacklogTasks(db, ids);
      const handoffs = (await db.query(`SELECT count(*)::integer AS count FROM library_ingestion_state
        WHERE library_id=ANY($1::integer[]) AND backfill_completed_at IS NOT NULL AND backfill_run_id=run_id`, [ids])).rows[0].count;
      return tasks.length === 600 && handoffs === 2 && tasks.some(row => row.status === 'processing');
    }, { timeout: 20000 });
    const checkpoint = { version: 1, ownerPid: (await owner.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
      databaseEpoch: await readDatabaseEpoch(db), libraries: await readBacklogRuns(db, ids),
      inventory: await readScheduledInventory(db, ids), tasks: await readBacklogTasks(db, ids),
      beforeCrash: installationBudgetSnapshot(await readStudyCgroup()) };
    await assertBacklogIdentity(db, checkpoint);
    await assertGateHeld(db, checkpoint);
    await writeBacklogCheckpoint(checkpoint);
    await waitForBacklog(() => false, { timeout: 30000 });
  } finally {
    if (owner) owner.release(true);
    await fixture.close();
  }
}

export async function verifyBacklogBoundary(db) {
  assertInstallationBudgetEnvironment();
  const checkpoint = await readBacklogCheckpoint();
  await assertBacklogIdentity(db, checkpoint);
  assert.deepEqual(await readBacklogTasks(db, checkpoint.libraries.map(row => row.library_id)), checkpoint.tasks);
  assert.equal(await readDatabaseEpoch(db), checkpoint.databaseEpoch);
  installationBudgetSnapshot(checkpoint.beforeCrash);
  await assertGateHeld(db, checkpoint);
  return { ...BACKLOG_BOUNDARY };
}

/** Read-only after restart: no seeding, status repair, worker invocation or timeout override. */
export async function verifyBacklogRecovery(db) {
  assertInstallationBudgetEnvironment();
  const checkpoint = await readBacklogCheckpoint();
  const ids = checkpoint.libraries.map(row => row.library_id);
  assert.ok(await readDatabaseEpoch(db) > checkpoint.databaseEpoch);
  await assertBacklogIdentity(db, checkpoint);
  let tasks;
  const observationMs = await waitForBacklog(async () => {
    tasks = await readBacklogTasks(db, ids);
    assertBacklogTaskIdentities(tasks, checkpoint.tasks);
    assert.ok(tasks.every(row => !['failed', 'cancelled'].includes(row.status)));
    return tasks.every(row => row.status === 'completed') && await backlogProfilesCurrent(db, ids);
  });
  assertBacklogCompleted(tasks, checkpoint.tasks);
  assert.ok(sawSiblingProgress(tasks, checkpoint.tasks));
  await assertBacklogIdentity(db, checkpoint);
  assert.deepEqual(await readBacklogCheckpoint(), checkpoint);
  const interruptedTasks = checkpoint.tasks.filter(row => row.status === 'processing').length;
  return { ...backlogRecoveryEvidence({ driver: 'startup_scheduler', checkpoint: 'preserved', ingestionRuns: 'unchanged',
    inventory: 'unchanged', taskIds: 'unchanged', profiles: 'current', movieItems: 300, tvItems: 300,
    completedTasks: 600, duplicateCompletions: 0, earlyReclaims: 0, routingTasks: 0, music: 'excluded',
    visibilityMs: 600000, siblingProgress: 'before_original_lease_expiry', databaseRestart: 'verified',
    interruptedTasks, pendingTasks: 600 - interruptedTasks, reclaimedTasks: interruptedTasks,
    totalStarts: tasks.reduce((sum, row) => sum + row.starts, 0), observationMs }),
  beforeCrash: installationBudgetSnapshot(checkpoint.beforeCrash),
  afterRecovery: installationBudgetSnapshot(await readStudyCgroup()) };
}
