/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { assertUpgradeDrillEnvironment } from './publishedUpgradeFixtures.mjs';
import { createScheduledInstallationFixture, seedScheduledInstallation } from './scheduledInstallationFixture.mjs';
import { readInventoryBackgroundReadiness } from '../services/inventoryBackgroundReadiness.mjs';
import { readLibraryProfileRefreshStatus } from '../services/libraryProfileRefreshStatus.mjs';
import { METADATA_REFILL_OWNER_LOCK } from '../services/queueRefillCoordination.mjs';

export async function waitForScheduledProgress(check, stage, { now = Date.now, sleep = delay, timeout = 420_000 } = {}) {
  if (!['refill_lock', 'ingestion_started', 'ingestion_complete', 'metadata_and_profiles'].includes(stage) ||
    !Number.isSafeInteger(timeout) || timeout < 1 || timeout > 420_000) throw new TypeError('invalid_scheduler_wait');
  const deadline = now() + timeout;
  while (now() < deadline) { if (await check()) return; await sleep(500); }
  throw new Error(`scheduled_installation_timeout:${stage}`);
}

/** Observer only after seeding: never invoke sync, refill, task processing or profile writers. */
export async function runScheduledInstallationProbe(db) {
  assertUpgradeDrillEnvironment();
  const config = (await db.query(`SELECT primary_provider FROM ai_provider_config WHERE id=1`)).rows;
  assert.deepEqual(config, [{ primary_provider: 'none' }]);
  for (const table of ['tmdb_config', 'omdb_config']) {
    assert.equal((await db.query(`SELECT count(*)::integer AS count FROM ${table} WHERE is_active`)).rows[0].count, 0);
  }
  const fixture = await createScheduledInstallationFixture();
  let owner;
  try {
    owner = await db.pool.connect();
    await waitForScheduledProgress(async () => (await owner.query('SELECT pg_try_advisory_lock($1) AS acquired',
      [METADATA_REFILL_OWNER_LOCK])).rows[0].acquired, 'refill_lock', { timeout: 30_000 });
    const libraries = await seedScheduledInstallation(db, fixture.origin);
    const ids = libraries.map(library => library.id);
    const queued = async () => (await db.query(`SELECT task_type,status FROM task_queue
      WHERE payload->>'source_library_id'=ANY($1::text[])`, [ids.map(String)])).rows;
    await waitForScheduledProgress(() => fixture.reached, 'ingestion_started');
    assert.equal(await readInventoryBackgroundReadiness(db), 'ingesting');
    assert.equal((await queued()).length, 0);
    fixture.release();
    await waitForScheduledProgress(async () => (await db.query(`SELECT count(*)::integer AS count
      FROM library_ingestion_state WHERE library_id=ANY($1::integer[]) AND phase='complete'`, [ids])).rows[0].count === 2,
    'ingestion_complete');
    assert.equal(await readInventoryBackgroundReadiness(db), 'backfilling');
    assert.equal((await queued()).length, 0);
    await owner.query('SELECT pg_advisory_unlock($1)', [METADATA_REFILL_OWNER_LOCK]);
    owner.release(); owner = null;
    await waitForScheduledProgress(async () => {
      const tasks = await queued();
      const states = (await readLibraryProfileRefreshStatus(db)).libraries.filter(row => ids.includes(row.libraryId));
      const handoffs = (await db.query(`SELECT count(*)::integer AS count FROM library_ingestion_state
        WHERE library_id=ANY($1::integer[]) AND backfill_run_id=run_id AND backfill_completed_at IS NOT NULL`, [ids])).rows[0].count;
      return handoffs === 2 && tasks.length === 4 && tasks.every(task => task.status === 'completed' && task.task_type === 'metadata_enrichment') &&
        states.length === 2 && states.every(state => state.statusId === 'current' && state.sourceRevision === state.profileRevision &&
          state.acknowledgedRevision === state.sourceRevision);
    }, 'metadata_and_profiles');
    const inventory = (await db.query(`SELECT media_type,count(*)::integer AS count FROM media_server_items
      WHERE library_id=ANY($1::integer[]) GROUP BY media_type ORDER BY media_type`, [ids])).rows;
    assert.deepEqual(inventory, [{ media_type: 'movie', count: 2 }, { media_type: 'tv', count: 2 }]);
    assert.equal((await db.query(`SELECT count(*)::integer AS count FROM media_source_observations
      WHERE library_id=ANY($1::integer[]) AND external_id LIKE '%-audio'`, [ids])).rows[0].count, 0);
    assert.equal((await db.query(`SELECT count(*)::integer AS count FROM task_queue WHERE task_type<>'metadata_enrichment'`)).rows[0].count, 0);
    assert.ok(fixture.requests.movie > 0 && fixture.requests.tv > 0 && fixture.requests.audio > 0);
    return { driver: 'startup_scheduler', ingestion: 'completed', backfill: 'completed', profiles: 'current',
      deferrals: ['ingesting', 'backfilling'], movieItems: 2, tvItems: 2, music: 'excluded', routingTasks: 0 };
  } finally {
    if (owner) owner.release(true);
    await fixture.close();
  }
}
