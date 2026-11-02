/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createOwnedCaptureFixture, ownedCaptureMemory, ownedCaptureSnapshot } from '../helpers/adjudicationOwnedCaptureFixture.mjs';
import { INVENTORY_DISCOVERY_LOCK } from '../../services/inventoryDiscoveryAdmission.mjs';
import { createAdjudicationFinalizationAdmission as createInventoryDiscoveryAdmission } from '../../services/adjudicationFinalizationAdmission.mjs';

const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
beforeEach(async () => { await getPool().query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

test.each(['delayed', 'lost', 'stopped'])(
  'a real cleanup COMMIT retains admission through its %s acknowledgement', async outcome => {
    const f = await createOwnedCaptureFixture(), contender = createReadinessDatabase(), committed = deferred(), acknowledge = deferred();
    let queries, release, worker, execution, settled = false;
    f.repository.readState.mockImplementation(async () => {
      const client = await f.db.pool.connect(), nativeQuery = client.query.bind(client);
      queries = jest.spyOn(client, 'query').mockImplementation(async (sql, parameters) => {
        if (sql === 'BEGIN') release = jest.spyOn(client, 'release');
        const result = await nativeQuery(sql, parameters);
        if (sql === 'COMMIT') {
          committed.resolve(); await acknowledge.promise;
          if (outcome === 'lost') throw Error('PRIVATE simulated lost COMMIT acknowledgement');
        }
        return result;
      });
      client.release(); throw Error('PRIVATE provider failure');
    });
    try {
      worker = f.createWorker(); execution = worker.run().finally(() => { settled = true; }); await committed.promise;
      expect(settled).toBe(false);
      expect(await contender.withSessionAdvisoryLock(INVENTORY_DISCOVERY_LOCK, jest.fn())).toBe(false);
      const permit = f.resources.tryAcquire('discovery');
      try { expect(permit.allowed).toBe(false); } finally { permit.release?.(); }
      const durable = await ownedCaptureSnapshot(); expect(durable.budget[0]).toMatchObject({ status: 'unavailable', calls_reserved: 1 });
      expect(durable.cached).toEqual(f.before.cached); expect(durable.budget[0].progress).toEqual(f.before.budget[0].progress);
      if (outcome === 'stopped') worker.stop();
      acknowledge.resolve(); expect(await execution).toEqual({ status: outcome === 'stopped' ? 'stopped' : 'unavailable' });
      expect(await ownedCaptureSnapshot()).toEqual(durable); expect(f.finish).toHaveBeenCalledTimes(1);
      expect(queries.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
      if (outcome === 'lost') expect(release).toHaveBeenCalledWith(true);
      expect(await contender.withSessionAdvisoryLock(INVENTORY_DISCOVERY_LOCK, jest.fn())).toBe(true);
    } finally {
      worker?.stop(); acknowledge.resolve(); await execution?.catch(() => {}); // swallow-error: Settle the owned acknowledgement fault before teardown.
      release?.mockRestore(); queries?.mockRestore(); f.finish.mockRestore(); await f.db.pool.end(); await contender.pool.end();
    }
  });

test.each(['callback_failure', 'after_success'])(
  'real unlock acknowledgement failure in %s preserves the correct outcome without another finish', async phase => {
    const f = await createOwnedCaptureFixture(); let queries, worker, callbackError, atUnlock;
    try {
      const client = await f.db.pool.connect(), nativeQuery = client.query.bind(client);
      queries = jest.spyOn(client, 'query').mockImplementation(async (sql, parameters) => {
        const result = await nativeQuery(sql, parameters);
        if (sql === 'SELECT pg_advisory_unlock($1)') {
          atUnlock = await ownedCaptureSnapshot(); throw Error('PRIVATE simulated unlock acknowledgement failure');
        }
        return result;
      });
      client.release();
      if (phase === 'callback_failure') f.repository.readState.mockRejectedValue(Error('adjudication_budget_exhausted'));
      const withLock = (key, callback) => f.db.withSessionAdvisoryLock(key, async context => {
        try { return await callback(context); }
        catch (error) { callbackError = error; throw error; }
      });
      const admission = createInventoryDiscoveryAdmission({ withSessionAdvisoryLock: withLock,
        readMemory: ownedCaptureMemory, resourceAdmission: f.resources });
      worker = f.createWorker({ withAdmission: admission });
      expect(await worker.run()).toEqual({ status: phase === 'callback_failure' ? 'budget_exhausted' : 'unavailable' });
      expect(f.finish).toHaveBeenCalledTimes(1);
      expect(queries.mock.calls.filter(([sql]) => sql === 'SELECT pg_advisory_unlock($1)')).toHaveLength(1);
      expect(atUnlock.budget[0].status).toBe(phase === 'callback_failure' ? 'budget_exhausted' : 'captured');
      expect(await ownedCaptureSnapshot()).toEqual(atUnlock);
      if (phase === 'callback_failure') expect(callbackError?.message).toBe('adjudication_budget_exhausted');
      else expect(callbackError).toBeUndefined();
    } finally { worker?.stop(); queries?.mockRestore(); f.finish.mockRestore(); await f.db.pool.end(); }
  });

test('the real post-success memory checkpoint defers locally without rewriting captured status', async () => {
  const f = await createOwnedCaptureFixture(); let worker, captured = false, afterCapture;
  try {
    const nativeFinish = f.finish.getMockImplementation();
    f.finish.mockImplementation(async (...args) => {
      const result = await nativeFinish(...args);
      if (args[1] === 'captured') { afterCapture = await ownedCaptureSnapshot(); captured = true; }
      return result;
    });
    const admission = createInventoryDiscoveryAdmission({ ...f.db, resourceAdmission: f.resources,
      readMemory: () => captured ? { available: 0, constrained: 8e9, total: 8e9 } : ownedCaptureMemory() });
    worker = f.createWorker({ withAdmission: admission });
    expect(await worker.run()).toEqual({ status: 'deferred' });
    expect(captured).toBe(true); expect(f.finish).toHaveBeenCalledTimes(1);
    expect(afterCapture.budget[0].status).toBe('captured'); expect(await ownedCaptureSnapshot()).toEqual(afterCapture);
  } finally { worker?.stop(); f.finish.mockRestore(); await f.db.pool.end(); }
});
