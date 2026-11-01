/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { setTimeout as sleep } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createInventoryDescriptionRefreshRuntime } from '../../services/inventoryDescriptionRefreshScheduler.mjs';
import { createInventoryRepresentativeProfileRuntime } from '../../services/inventoryRepresentativeProfileScheduler.mjs';
import { INVENTORY_BACKGROUND_READINESS_SQL } from '../../services/inventoryBackgroundReadiness.mjs';

const factories = [createInventoryDescriptionRefreshRuntime, createInventoryRepresentativeProfileRuntime];
async function until(predicate) {
  const end = Date.now() + 5000;
  do { const result = await predicate(); if (result) return result; await sleep(10); } while (Date.now() < end);
  throw Error('fixture_condition_not_reached');
}
const activeRead = () => until(async () => (await getPool().query(
  // pg_stat_activity truncates long query text; match this fixed readiness prefix.
  "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND query LIKE $1", [`${INVENTORY_BACKGROUND_READINESS_SQL.slice(0, 80)}%`],
)).rows[0]?.pid);
const gone = pid => until(async () => !(await getPool().query('SELECT 1 FROM pg_stat_activity WHERE pid=$1', [pid])).rows.length);

test('both scope slots survive repeated runtime replacement while real pool acquisitions remain queued', async () => {
  await getPool().query('UPDATE ai_provider_config SET rag_enabled=false WHERE id=1');
  const db = createReadinessDatabase({ max: 1 }), held = await db.pool.connect();
  const connect = jest.spyOn(db.pool, 'connect'), queries = jest.spyOn(held, 'query');
  const controllers = factories.map(() => new AbortController());
  let runtimes = factories.map(create => create(db)), released = false;
  try {
    const pending = runtimes.map((runtime, index) => runtime.run({ signal: controllers[index].signal }));
    await until(() => db.pool.waitingCount === 2);
    controllers.forEach(controller => controller.abort('PRIVATE caller reason'));
    expect(await Promise.all(pending)).toEqual([{ status: 'cancelled' }, { status: 'cancelled' }]);
    for (let pass = 0; pass < 10; pass++) {
      runtimes.forEach(runtime => runtime.stop());
      runtimes = factories.map(create => create(db));
      expect(await Promise.all(runtimes.map(runtime => runtime.run()))).toEqual([
        { status: 'deferred', reason: 'unavailable' }, { status: 'deferred', reason: 'unavailable' },
      ]);
      expect(db.pool.waitingCount).toBe(2);
    }
    expect(connect).toHaveBeenCalledTimes(2);
    held.release(); released = true;
    await until(() => db.pool.waitingCount === 0); await sleep(0);
    expect(queries).not.toHaveBeenCalled(); // Both late grants returned without BEGIN.
    for (const runtime of runtimes) expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'disabled' });
    expect((await db.query('SELECT 42 AS ok')).rows[0].ok).toBe(42);
  } finally {
    runtimes.forEach(runtime => runtime.stop());
    if (!released) held.release();
    connect.mockRestore(); queries.mockRestore(); await db.pool.end();
  }
});

test('three-second pool-wait deadline defers quietly and only a fresh tick can run after late grant', async () => {
  await getPool().query('UPDATE ai_provider_config SET rag_enabled=false WHERE id=1');
  const db = createReadinessDatabase({ max: 1 }), held = await db.pool.connect();
  const query = jest.spyOn(held, 'query'), connect = jest.spyOn(db.pool, 'connect');
  const runtime = factories[0](db); let released = false;
  try {
    const started = performance.now();
    expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'unavailable' });
    expect(performance.now() - started).toBeLessThan(5000);
    expect(db.pool.waitingCount).toBe(1);
    expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'unavailable' });
    expect(connect).toHaveBeenCalledTimes(1);
    held.release(); released = true; await until(() => db.pool.waitingCount === 0); await sleep(0);
    expect(query).not.toHaveBeenCalled();
    expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'disabled' });
  } finally {
    runtime.stop(); if (!released) held.release();
    query.mockRestore(); connect.mockRestore(); await db.pool.end();
  }
});

test.each(factories.map((create, index) => [index === 0 ? 'description' : 'representative', create]))(
  '%s stop cancels actual blocked readiness SQL without interrupting another reader', async (_name, create) => {
    await getPool().query('UPDATE ai_provider_config SET rag_enabled=false WHERE id=1');
    const db = createReadinessDatabase(), blocker = await getPool().connect();
    const runtime = create(db);
    try {
      await blocker.query('BEGIN'); await blocker.query('LOCK TABLE libraries IN ACCESS EXCLUSIVE MODE');
      const pending = runtime.run(), pid = await activeRead();
      const other = db.query('SELECT pg_sleep(0.2), 7 AS ok');
      runtime.stop();
      expect(await pending).toEqual({ status: 'stopped' });
      await gone(pid); expect((await other).rows[0].ok).toBe(7);
      expect((await db.query('SELECT 42 AS ok')).rows[0].ok).toBe(42);
    } finally {
      runtime.stop(); await blocker.query('ROLLBACK'); blocker.release(); await db.pool.end();
    }
  },
);

test('shorter inherited SQL deadline survives unavailable control and retains native 57014 proof', async () => {
  class UnavailableClient { constructor() { throw Error('PRIVATE control unavailable'); } }
  await getPool().query('UPDATE ai_provider_config SET rag_enabled=false WHERE id=1');
  const db = createReadinessDatabase({ statementMs: 250, Client: UnavailableClient }), blocker = await getPool().connect();
  const runtime = factories[0](db);
  try {
    await blocker.query('BEGIN'); await blocker.query('LOCK TABLE libraries IN ACCESS EXCLUSIVE MODE');
    const started = performance.now(), pending = runtime.run(), pid = await activeRead();
    expect(await pending).toMatchObject({ status: 'deferred', reason: 'unavailable', failure: {
      category: 'database_query_cancelled', sqlState: '57014',
    } });
    expect(performance.now() - started).toBeLessThan(2500);
    await gone(pid); expect((await db.query('SELECT 1 AS ok')).rows[0].ok).toBe(1);
  } finally {
    runtime.stop(); await blocker.query('ROLLBACK'); blocker.release(); await db.pool.end();
  }
});
