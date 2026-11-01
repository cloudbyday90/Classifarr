/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createAdjudicationBudgetWorkerFixture } from '../helpers/adjudicationBudgetWorkerFixture.mjs';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';

const query = (...args) => getPool().query(...args);
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const snapshot = async () => (await query('SELECT * FROM adjudication_capture_budget')).rows;
const options = { dailyCalls: 1, dailyTokens: 8448 };
beforeEach(async () => { await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

async function setup() {
  const f = await createAdjudicationBudgetWorkerFixture(), db = createReadinessDatabase({ max: 1 });
  const budget = createAdjudicationBudgetRepository(db);
  try {
    const state = await budget.configure(options), finish = jest.spyOn(budget, 'finish');
    return { ...f, db, budget, state, finish, worker: () => createAdjudicationBudgetWorker({ ...f.dependencies, budget }) };
  } catch (error) { await db.pool.end(); throw error; }
}

test.each(['deferred', 'waiting_for_replay', 'budget_exhausted', 'captured'])(
  'a real revision change before primary %s acknowledges zero, defers and preserves current state', async primary => {
    const f = await setup(); let current, worker;
    const change = async () => { await f.budget.configure(options); current = await snapshot(); };
    try {
      if (primary === 'deferred') f.repository.readState.mockImplementation(async () => { await change(); return null; });
      if (primary === 'waiting_for_replay') {
        await f.budget.finish(f.state.revision, 'captured', f.prepared.fingerprint); f.finish.mockClear();
        await query('UPDATE adjudication_capture_budget SET next_check_at=statement_timestamp()');
        f.evaluation.input_fingerprint = 'e'.repeat(64);
        f.repository.readSnapshot.mockImplementation(async () => { await change(); return f.snapshot; });
      }
      if (primary === 'budget_exhausted') {
        await f.budget.reserve(f.state.revision);
        f.repository.readState.mockImplementation(async () => { await change(); return f.evaluation; });
      }
      if (primary === 'captured') f.capture.mockImplementation(async (_options, dependencies) => {
        await change(); await dependencies.onPublished(f.prepared.fingerprint, true, new AbortController().signal);
        return { calls: 0, reused: 0, stored: 0 };
      });
      worker = f.worker(); expect(await worker.run()).toEqual({ status: 'deferred' });
      expect(f.finish).toHaveBeenCalledTimes(1);
      expect(f.finish.mock.calls[0].slice(0, 2)).toEqual([f.state.revision, primary]);
      expect((await f.finish.mock.results[0].value).rowCount).toBe(0);
      expect(await snapshot()).toEqual(current);
      expect((await query('SELECT count(*)::int AS n FROM cached_adjudication_batch')).rows[0].n).toBe(0);
    } finally { worker?.stop(); f.finish.mockRestore(); await f.db.pool.end(); }
  });

test.each([
  ['PRIVATE provider failure', 'unavailable'], ['adjudication_budget_exhausted', 'budget_exhausted'],
  ['evaluation_workload_deferred', 'deferred'],
])('cleanup after %s preserves %s across a real revision change', async (message, status) => {
  const f = await setup(); let current, worker;
  try {
    f.capture.mockImplementation(async () => { await f.budget.configure(options); current = await snapshot(); throw Error(message); });
    worker = f.worker(); expect(await worker.run()).toEqual({ status });
    expect(f.finish).toHaveBeenCalledTimes(1); expect((await f.finish.mock.results[0].value).rowCount).toBe(0);
    expect(await snapshot()).toEqual(current); expect(await worker.run()).toEqual({ status: 'cooldown' });
  } finally { worker?.stop(); f.finish.mockRestore(); await f.db.pool.end(); }
});

test('zero caused by deletion still commits the existing disabled singleton bootstrap', async () => {
  const f = await setup(); let worker;
  try {
    f.repository.readState.mockImplementation(async () => { await query('DELETE FROM adjudication_capture_budget'); return null; });
    worker = f.worker(); expect(await worker.run()).toEqual({ status: 'deferred' });
    expect(f.finish).toHaveBeenCalledTimes(1); expect((await f.finish.mock.results[0].value).rowCount).toBe(0);
    expect(await snapshot()).toEqual([expect.objectContaining({ revision: 0, daily_calls: 0, daily_tokens: 0,
      calls_reserved: 0, tokens_reserved: 0, status: 'disabled' })]);
  } finally { worker?.stop(); f.finish.mockRestore(); await f.db.pool.end(); }
});

test.each(['delayed', 'lost', 'stopped'])(
  'a real zero-row COMMIT with %s acknowledgement is interpreted only after settlement', async outcome => {
    const f = await setup(), committed = deferred(), acknowledge = deferred();
    let queries, release, execution, worker, settled = false, current;
    try {
      f.repository.readState.mockImplementation(async () => {
        await f.budget.configure(options); current = await snapshot();
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
        client.release(); return null;
      });
      worker = f.worker(); execution = worker.run().finally(() => { settled = true; }); await committed.promise;
      expect(settled).toBe(false); expect(f.finish).toHaveBeenCalledTimes(1); expect(await snapshot()).toEqual(current);
      if (outcome === 'stopped') worker.stop();
      acknowledge.resolve();
      expect(await execution).toEqual({ status: outcome === 'lost' ? 'unavailable' : outcome === 'stopped' ? 'stopped' : 'deferred' });
      expect(f.finish).toHaveBeenCalledTimes(outcome === 'lost' ? 2 : 1);
      if (outcome === 'lost') {
        // Ordinary failure cleanup remains; the failed acknowledgement itself never proves zero.
        await expect(f.finish.mock.results[0].value).rejects.toThrow('PRIVATE simulated lost commit acknowledgement');
        expect((await f.finish.mock.results[1].value).rowCount).toBe(0); expect(release).toHaveBeenCalledWith(true);
      } else expect((await f.finish.mock.results[0].value).rowCount).toBe(0);
      expect(await snapshot()).toEqual(current);
    } finally {
      worker?.stop(); acknowledge.resolve(); await execution?.catch(() => {}); // swallow-error: Join the owned fault-injected acknowledgement before closing the fixture.
      release?.mockRestore(); queries?.mockRestore(); f.finish.mockRestore(); await f.db.pool.end();
    }
  });
