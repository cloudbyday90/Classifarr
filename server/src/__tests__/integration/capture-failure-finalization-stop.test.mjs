/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { setTimeout as sleep } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createFinalizationFixtureBudget as createAdjudicationBudgetRepository } from '../helpers/adjudicationFinalizationFixture.mjs';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';

const query = (...args) => getPool().query(...args);
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const finishUpdate = sql => sql.startsWith('UPDATE adjudication_capture_budget SET status=');
async function until(predicate) {
  const end = Date.now() + 5000;
  do { const answer = await predicate(); if (answer) return answer; await sleep(10); } while (Date.now() < end);
  throw Error('fixture_condition_not_reached');
}
const snapshot = async () => ({ budget: (await query('SELECT * FROM adjudication_capture_budget')).rows,
  cached: (await query('SELECT * FROM cached_adjudication_batch')).rows });

beforeEach(async () => { await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

async function setup() {
  const db = createReadinessDatabase({ max: 1 }), budget = createAdjudicationBudgetRepository(db);
  try {
    const state = await budget.configure({ dailyCalls: 5, dailyTokens: 42240 });
    await budget.reserve(state.revision);
    const plan = [{ key: 'c'.repeat(64), prompt: 'Synthetic prompt', count: 2 }];
    const template = { version: 'cached_adjudication.v1', configuration: 'a'.repeat(64),
      identity: { model: 'synthetic:latest', digest: 'b'.repeat(64), contextLength: 8192 }, records: [] };
    const checkpoint = budget.checkpoint(state.revision);
    await checkpoint.open(plan, template);
    await checkpoint.record({ key: plan[0].key, generated: { response: 'Synthetic response', latencyMs: 1,
      promptTokens: 10, outputTokens: 10, outputLimitReached: false, contextLimitSuspected: false, inputTruncation: 'unknown' } });
    await checkpoint.publish(); await budget.finish(state.revision, 'captured', 'd'.repeat(64));
    await query('UPDATE adjudication_capture_budget SET next_check_at=statement_timestamp()');
    const before = await snapshot(), finish = jest.spyOn(budget, 'finish');
    const worker = readState => createAdjudicationBudgetWorker({ budget, repository: { readState },
      withAdmission: (callback, { signal }) => callback(signal, undefined, { claimFinalization: async revision => ({ revision, attemptId: '41db1265-8bc1-4ab3-992f-885799a4af1d' }) }), withWorkload: jest.fn() });
    return { db, budget, state, before, finish, worker };
  } catch (error) { await db.pool.end(); throw error; }
}

test('stop while finalization is queued permits BEGIN/ROLLBACK but prevents finalizer DML', async () => {
  const f = await setup(); let held, queries, execution, settled = false;
  const worker = f.worker(async () => {
    held = await f.db.pool.connect(); queries = jest.spyOn(held, 'query');
    throw Error('PRIVATE capture failure');
  });
  try {
    execution = worker.run().finally(() => { settled = true; });
    await until(() => held && f.finish.mock.calls.length === 1 && f.db.pool.waitingCount === 1);
    expect(f.finish).toHaveBeenCalledTimes(1); worker.stop();
    expect(f.finish.mock.calls[0][3].aborted).toBe(true);
    await sleep(0); expect(settled).toBe(false); // Cooperative stop does not detach the queued write.
    held.release(); held = null;
    expect(await execution).toEqual({ status: 'stopped' });
    expect(queries.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(await snapshot()).toEqual(f.before);
    expect(await worker.run()).toEqual({ status: 'stopped' }); expect(f.finish).toHaveBeenCalledTimes(1);
  } finally {
    worker.stop(); held?.release(); await execution?.catch(() => {}); // swallow-error: Join an expected fixture failure before closing its pool.
    queries?.mockRestore(); f.finish.mockRestore(); await f.db.pool.end();
  }
});

test('stop during the finish prelock prevents the later UPDATE after lock acquisition', async () => {
  const f = await setup(), blocker = await getPool().connect(); let queries, execution;
  const worker = f.worker(async () => {
    const client = await f.db.pool.connect(), nativeQuery = client.query.bind(client);
    queries = jest.spyOn(client, 'query').mockImplementation(async (sql, parameters) => {
      const result = await nativeQuery(sql, parameters);
      if (sql.startsWith('INSERT INTO adjudication_capture_budget')) {
        await blocker.query('BEGIN');
        await blocker.query('SELECT singleton FROM adjudication_capture_budget WHERE singleton FOR UPDATE');
      }
      return result;
    });
    client.release(); throw Error('PRIVATE capture failure');
  });
  try {
    execution = worker.run();
    await until(async () => (await query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
      AND wait_event_type='Lock' AND query LIKE 'SELECT singleton FROM adjudication_capture_budget%'`)).rows.length);
    worker.stop(); await blocker.query('ROLLBACK');
    expect(await execution).toEqual({ status: 'stopped' });
    expect(queries.mock.calls.filter(([sql]) => finishUpdate(sql))).toHaveLength(0);
    expect(queries.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
    expect(queries.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
    expect(await snapshot()).toEqual(f.before); expect(f.finish).toHaveBeenCalledTimes(1);
    queries.mockRestore(); expect((await f.db.query('SELECT 42 AS ok')).rows[0].ok).toBe(42);
  } finally {
    worker.stop(); await blocker.query('ROLLBACK'); blocker.release(); await execution?.catch(() => {}); // swallow-error: Settle the owned write before fixture teardown.
    queries?.mockRestore(); f.finish.mockRestore(); await f.db.pool.end();
  }
});

test('stop after real UPDATE execution rolls back when its acknowledgement settles', async () => {
  const f = await setup(), updated = deferred(), acknowledge = deferred(); let queries, execution, written, settled = false;
  const worker = f.worker(async () => {
    const client = await f.db.pool.connect(), nativeQuery = client.query.bind(client);
    queries = jest.spyOn(client, 'query').mockImplementation(async (sql, parameters) => {
      const result = await nativeQuery(sql, parameters);
      if (finishUpdate(sql)) {
        written = (await nativeQuery('SELECT status FROM adjudication_capture_budget')).rows[0].status;
        updated.resolve(); await acknowledge.promise;
      }
      return result;
    });
    client.release(); throw Error('PRIVATE capture failure');
  });
  try {
    execution = worker.run().finally(() => { settled = true; }); await updated.promise;
    expect(written).toBe('unavailable'); expect(await snapshot()).toEqual(f.before);
    worker.stop(); await sleep(0); expect(settled).toBe(false);
    acknowledge.resolve(); expect(await execution).toEqual({ status: 'stopped' });
    expect(queries.mock.calls.filter(([sql]) => finishUpdate(sql))).toHaveLength(1);
    expect(queries.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
    expect(queries.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
    expect(await snapshot()).toEqual(f.before); expect(f.finish).toHaveBeenCalledTimes(1);
  } finally {
    worker.stop(); acknowledge.resolve(); await execution?.catch(() => {}); // swallow-error: Join the owned fault-injected acknowledgement before teardown.
    queries?.mockRestore(); f.finish.mockRestore(); await f.db.pool.end();
  }
});

test.each(['delayed', 'lost'])('stop after real COMMIT with %s acknowledgement never claims rollback or replays', async outcome => {
  const f = await setup(), committed = deferred(), acknowledge = deferred();
  let queries, release, execution;
  const worker = f.worker(async () => {
    const client = await f.db.pool.connect(), nativeQuery = client.query.bind(client);
    queries = jest.spyOn(client, 'query').mockImplementation(async (sql, parameters) => {
      if (sql === 'BEGIN') release = jest.spyOn(client, 'release');
      const result = await nativeQuery(sql, parameters);
      if (sql === 'COMMIT') {
        committed.resolve(); await acknowledge.promise;
        if (outcome === 'lost') throw Error('PRIVATE simulated lost commit acknowledgement');
      }
      return result;
    });
    client.release(); throw Error('PRIVATE capture failure');
  });
  try {
    execution = worker.run(); await committed.promise;
    const durable = await snapshot(), row = durable.budget[0], original = f.before.budget[0];
    expect(row.status).toBe('unavailable');
    const wait = row.next_check_at.getTime() - Date.now(); expect(wait).toBeGreaterThan(59 * 60000); expect(wait).toBeLessThanOrEqual(60 * 60000);
    expect({ ...row, status: original.status, next_check_at: original.next_check_at }).toEqual(original);
    expect(durable.cached).toEqual(f.before.cached);
    expect(row.calls_reserved).toBe(1); expect(row.tokens_reserved).toBe(8448);
    worker.stop(); acknowledge.resolve(); expect(await execution).toEqual({ status: 'stopped' });
    expect(await snapshot()).toEqual(durable);
    expect(f.finish).toHaveBeenCalledTimes(1);
    expect(queries.mock.calls.filter(([sql]) => finishUpdate(sql))).toHaveLength(1);
    expect(queries.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
    if (outcome === 'lost') expect(release).toHaveBeenCalledWith(true);
    else expect(release).toHaveBeenCalledWith();
    expect(await worker.run()).toEqual({ status: 'stopped' });
  } finally {
    worker.stop(); acknowledge.resolve(); await execution?.catch(() => {}); // swallow-error: A fault-injected acknowledgement failure is owned by this fixture.
    release?.mockRestore(); queries?.mockRestore(); f.finish.mockRestore(); await f.db.pool.end();
  }
});

test('an unstopped stale-revision finish retains its existing zero-row result and changes no state', async () => {
  const f = await setup();
  try {
    await f.budget.configure({ dailyCalls: 5, dailyTokens: 42240 });
    const current = await snapshot(), signal = new AbortController().signal;
    expect((await f.budget.finish(f.state.revision, 'unavailable', null, signal)).rowCount).toBe(0);
    expect(await snapshot()).toEqual(current);
  } finally { f.finish.mockRestore(); await f.db.pool.end(); }
});
