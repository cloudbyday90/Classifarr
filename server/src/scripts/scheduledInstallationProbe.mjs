/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertUpgradeDrillEnvironment } from './publishedUpgradeFixtures.mjs';
import { createScheduledInstallationFixture, seedScheduledInstallation } from './scheduledInstallationFixture.mjs';
import { readInventoryBackgroundReadiness } from '../services/inventoryBackgroundReadiness.mjs';
import { METADATA_REFILL_OWNER_LOCK } from '../services/queueRefillCoordination.mjs';
import { waitForScheduledProgress, readScheduledTasks, waitForScheduledCompletion, assertScheduledInventory, assertScheduledTaskInventory } from './scheduledInstallationEvidence.mjs';

/** Observer only after seeding: never invoke sync, refill, task processing or profile writers. */
export async function runScheduledInstallationProbe(db, { beforeBackfill = async () => {} } = {}) {
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
    const queued = () => readScheduledTasks(db, ids);
    await waitForScheduledProgress(() => fixture.reached, 'ingestion_started');
    assert.equal(await readInventoryBackgroundReadiness(db), 'ingesting');
    assert.equal((await queued()).length, 0);
    fixture.release();
    await waitForScheduledProgress(async () => (await db.query(`SELECT count(*)::integer AS count
      FROM library_ingestion_state WHERE library_id=ANY($1::integer[]) AND phase='complete'`, [ids])).rows[0].count === 2,
    'ingestion_complete');
    assert.equal(await readInventoryBackgroundReadiness(db), 'backfilling');
    assert.equal((await queued()).length, 0);
    assert.ok(fixture.requests.movie > 0 && fixture.requests.tv > 0 && fixture.requests.audio > 0);
    await assertScheduledInventory(db, ids);
    await beforeBackfill({ ids, owner });
    await owner.query('SELECT pg_advisory_unlock($1)', [METADATA_REFILL_OWNER_LOCK]);
    owner.release(); owner = null;
    await waitForScheduledCompletion(db, ids);
    await assertScheduledTaskInventory(db, ids, await assertScheduledInventory(db, ids));
    return { driver: 'startup_scheduler', ingestion: 'completed', backfill: 'completed', profiles: 'current',
      deferrals: ['ingesting', 'backfilling'], movieItems: 2, tvItems: 2, music: 'excluded', routingTasks: 0 };
  } finally {
    if (owner) owner.release(true);
    await fixture.close();
  }
}
