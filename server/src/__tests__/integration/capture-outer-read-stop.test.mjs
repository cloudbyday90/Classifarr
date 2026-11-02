/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { reservationDeferred as deferred } from '../helpers/adjudicationReservationFixture.mjs';
import { createAdjudicationBudgetWorkerFixture } from '../helpers/adjudicationBudgetWorkerFixture.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { RESET_ADJUDICATION_DAY_SQL, PRUNE_ADJUDICATION_PROGRESS_SQL } from '../../services/adjudicationBudgetSql.mjs';

const query = (...args) => getPool().query(...args);
const snapshot = async () => ({ budget: (await query('SELECT * FROM adjudication_capture_budget')).rows,
  cached: (await query('SELECT * FROM cached_adjudication_batch')).rows });
beforeEach(async () => { await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

const cases = ['disabled', 'outside_window', 'cooldown', 'ready'].flatMap(mode =>
  ['delayed', 'lost'].flatMap(reply => [true, false].map(stop => ({ mode, reply, stop }))));

test.each(cases)('durable outer maintenance: $mode, $reply acknowledgement, stop=$stop', async ({ mode, reply, stop }) => {
  const f = await createAdjudicationBudgetWorkerFixture(), db = createReadinessDatabase({ max: 1 });
  const committed = deferred(), release = deferred(), admission = jest.fn(async () => ({ status: 'deferred' }));
  const workload = jest.fn(), repository = createAdjudicationBudgetRepository(db);
  const budget = { ...f.budget, read: jest.fn(signal => repository.read(signal)) };
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies, budget, withAdmission: admission, withWorkload: workload });
  let spy, running;
  try {
    // Disabled exercises fresh bootstrap. Other states prove committed rollover/prune survive stop.
    if (mode !== 'disabled') {
      await repository.configure({ dailyCalls: 5, dailyTokens: 42240 });
      await query(`UPDATE adjudication_capture_budget SET quota_day=quota_day-1,calls_reserved=2,tokens_reserved=16896,
        progress_key=$1,progress='{}',captured_at=statement_timestamp()-interval '8 days',
        expires_at=statement_timestamp()-interval '1 day',next_check_at=statement_timestamp()-interval '1 minute'`, ['a'.repeat(64)]);
    }
    if (mode === 'cooldown') await query("UPDATE adjudication_capture_budget SET next_check_at=statement_timestamp()+interval '5 minutes'");
    if (mode === 'outside_window') await query(`UPDATE adjudication_capture_budget SET workload_mode='scheduled',
      window_start_minute=(EXTRACT(HOUR FROM statement_timestamp() AT TIME ZONE 'UTC')::int*60+720)%1440,
      window_end_minute=(EXTRACT(HOUR FROM statement_timestamp() AT TIME ZONE 'UTC')::int*60+780)%1440`);
    await query(`INSERT INTO cached_adjudication_batch(singleton,batch,captured_at,expires_at)
      VALUES(true,'{}',statement_timestamp(),statement_timestamp()+interval '1 day')`);
    const before = await snapshot();
    const client = await db.pool.connect(), native = client.query.bind(client);
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0] === 'COMMIT') {
        committed.resolve(); await release.promise;
        if (reply === 'lost') throw Error('Synthetic lost outer maintenance acknowledgement');
      }
      return result;
    }); client.release();
    const first = worker.run(); expect(worker.run()).toBe(first);
    let settled = false; running = first.finally(() => { settled = true; });
    await Promise.race([committed.promise, running.then(() => { throw Error('fixture_commit_not_observed'); })]);
    const durable = await snapshot();
    expect(durable.budget).toHaveLength(1);
    expect(durable.budget[0]).toMatchObject({ daily_calls: mode === 'disabled' ? 0 : 5,
      calls_reserved: 0, tokens_reserved: 0, progress: null, captured_at: null, expires_at: null });
    expect(durable.cached).toEqual(before.cached);
    if (mode !== 'disabled') expect(durable.budget[0].quota_day).not.toEqual(before.budget[0].quota_day);
    if (stop) { worker.stop(); expect(await worker.run()).toEqual({ status: 'stopped' }); }
    else expect(worker.run()).toBe(first);
    await Promise.resolve(); expect(settled).toBe(false);
    release.resolve();
    const expected = stop ? 'stopped' : reply === 'lost' ? 'unavailable' : mode === 'ready' ? 'deferred' : mode;
    expect(await running).toEqual({ status: expected });
    expect(await snapshot()).toEqual(durable);
    for (const command of ['BEGIN', 'COMMIT', RESET_ADJUDICATION_DAY_SQL, PRUNE_ADJUDICATION_PROGRESS_SQL]) {
      expect(spy.mock.calls.filter(([sql]) => sql === command)).toHaveLength(1);
    }
    expect(budget.read).toHaveBeenCalledTimes(1);
    // Admission is an observation stub; production admission has its own post-callback stop fence.
    expect(admission).toHaveBeenCalledTimes(!stop && reply === 'delayed' && mode === 'ready' ? 1 : 0);
    expect(workload).not.toHaveBeenCalled(); expect(f.repository.readState).not.toHaveBeenCalled();
    expect(f.capture).not.toHaveBeenCalled();
    for (const method of ['reserve', 'checkpoint', 'finish', 'advance']) expect(f.budget[method]).not.toHaveBeenCalled();
    if (!stop && reply === 'lost') expect(await worker.run()).toEqual({ status: 'cooldown' });
    worker.stop(); expect(await worker.run()).toEqual({ status: 'stopped' });
    expect(budget.read).toHaveBeenCalledTimes(1);
  } finally { release.resolve(); await running; worker.stop(); spy?.mockRestore(); await db.pool.end(); }
});
