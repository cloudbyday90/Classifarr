/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { setTimeout as sleep } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createOwnedCaptureFixture, ownedCaptureSnapshot } from '../helpers/adjudicationOwnedCaptureFixture.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';
import { INVENTORY_DISCOVERY_LOCK } from '../../services/inventoryDiscoveryAdmission.mjs';

const query = (...args) => getPool().query(...args);
async function until(predicate) {
  const end = Date.now() + 5000;
  do { if (await predicate()) return; await sleep(10); } while (Date.now() < end);
  throw Error('fixture_condition_not_reached');
}
beforeEach(async () => { await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

test('queued failure cleanup keeps its resource permit and real advisory lock until settlement', async () => {
  const f = await createOwnedCaptureFixture(), contender = createReadinessDatabase();
  let held, worker, execution;
  f.repository.readState.mockImplementation(async () => { held = await f.db.pool.connect(); throw Error('PRIVATE provider failure'); });
  try {
    worker = f.createWorker(); execution = worker.run();
    await until(() => f.finish.mock.calls.length === 1 && f.db.pool.waitingCount === 1);
    const permit = f.resources.tryAcquire('discovery');
    try { expect(permit.allowed).toBe(false); expect(permit.reason).toBe('busy'); } finally { permit.release?.(); }
    const entered = jest.fn();
    expect(await contender.withSessionAdvisoryLock(INVENTORY_DISCOVERY_LOCK, entered)).toBe(false);
    expect(entered).not.toHaveBeenCalled(); expect(await ownedCaptureSnapshot()).toEqual(f.before);
    held.release(); held = null; expect(await execution).toEqual({ status: 'unavailable' });
    expect(f.finish).toHaveBeenCalledTimes(1);
    const after = await ownedCaptureSnapshot(); expect(after.budget[0].status).toBe('unavailable');
    expect(after.budget[0].calls_reserved).toBe(1); expect(after.cached).toEqual(f.before.cached);
    expect(after.budget[0].progress).toEqual(f.before.budget[0].progress);
    expect(await contender.withSessionAdvisoryLock(INVENTORY_DISCOVERY_LOCK, entered)).toBe(true);
    const available = f.resources.tryAcquire('discovery');
    try { expect(available.allowed).toBe(true); } finally { available.release?.(); }
  } finally {
    worker?.stop(); held?.release(); await execution?.catch(() => {}); // swallow-error: Join the owned cleanup before pool teardown.
    f.finish.mockRestore(); await f.db.pool.end(); await contender.pool.end();
  }
});

test('a busy real admission never writes failure status beside its current owner', async () => {
  const f = await createOwnedCaptureFixture(), owner = createReadinessDatabase(); let worker;
  try {
    await owner.withSessionAdvisoryLock(INVENTORY_DISCOVERY_LOCK, async () => {
      worker = f.createWorker(); expect(await worker.run()).toEqual({ status: 'deferred' });
      expect(f.finish).not.toHaveBeenCalled(); expect(f.capture).not.toHaveBeenCalled();
      expect(await ownedCaptureSnapshot()).toEqual(f.before);
    });
    expect(await worker.run()).toEqual({ status: 'cooldown' });
  } finally { worker?.stop(); f.finish.mockRestore(); await f.db.pool.end(); await owner.pool.end(); }
});

test('observed advisory-session loss prevents queued finalizer DML after a newer owner writes', async () => {
  const f = await createOwnedCaptureFixture(), next = createReadinessDatabase();
  let held, worker, execution, queries, admissionSignal;
  f.repository.readState.mockImplementation(async () => {
    held = await f.db.pool.connect(); queries = jest.spyOn(held, 'query'); throw Error('PRIVATE capture failure');
  });
  try {
    worker = f.createWorker({ withAdmission: (callback, options) => f.admission(signal => {
      admissionSignal = signal; return callback(signal);
    }, options) });
    execution = worker.run(); await until(() => f.finish.mock.calls.length === 1 && f.db.pool.waitingCount === 1);
    const locks = (await query(`SELECT pid FROM pg_locks WHERE locktype='advisory' AND granted
      AND database=(SELECT oid FROM pg_database WHERE datname=current_database()) AND classid=0 AND objid=$1`, [INVENTORY_DISCOVERY_LOCK])).rows;
    expect(locks).toHaveLength(1); await query('SELECT pg_terminate_backend($1)', [locks[0].pid]);
    await until(() => admissionSignal.aborted);
    await next.withSessionAdvisoryLock(INVENTORY_DISCOVERY_LOCK, async () => {
      const budget = createAdjudicationBudgetRepository(next);
      expect((await budget.finish(f.state.revision, 'captured', 'd'.repeat(64))).rowCount).toBe(1);
    });
    const newer = await ownedCaptureSnapshot();
    held.release(); held = null; expect(await execution).toEqual({ status: 'unavailable' });
    expect(queries.mock.calls).toEqual([['ROLLBACK']]); expect(f.finish).toHaveBeenCalledTimes(1);
    expect(await ownedCaptureSnapshot()).toEqual(newer);
    expect(newer.budget[0]).toMatchObject({ status: 'captured', published_fingerprint: 'd'.repeat(64), calls_reserved: 1 });
  } finally {
    worker?.stop(); held?.release(); await execution?.catch(() => {}); // swallow-error: Settle the owned lease-loss fixture before closing pools.
    queries?.mockRestore(); f.finish.mockRestore(); await f.db.pool.end(); await next.pool.end();
  }
});
