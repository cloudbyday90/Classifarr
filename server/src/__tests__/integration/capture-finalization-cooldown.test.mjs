/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { setTimeout as sleep } from 'node:timers/promises';
import { fixtureAttemptId } from '../helpers/adjudicationFinalizationFixture.mjs';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createFinalizationFixtureBudget as createAdjudicationBudgetRepository } from '../helpers/adjudicationFinalizationFixture.mjs';
import { FINISH_ADJUDICATION_BUDGET_SQL, LOCK_ADJUDICATION_FINISH_SQL } from '../../services/adjudicationBudgetSql.mjs';

const query = (...args) => getPool().query(...args);
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
async function until(predicate) {
  const end = Date.now() + 5000;
  do { if (await predicate()) return; await sleep(10); } while (Date.now() < end);
  throw Error('fixture_condition_not_reached');
}
beforeEach(async () => { await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

test.each(['captured', 'waiting_for_replay', 'budget_exhausted', 'deferred'])(
  'a later short %s finish preserves the exact valid unavailable cooldown', async status => {
    const db = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
    try {
      const state = await budget.configure({ dailyCalls: 5, dailyTokens: 42240 });
      await budget.finish(state.revision, 'unavailable');
      const before = (await query('SELECT next_check_at::text FROM adjudication_capture_budget')).rows[0];
      expect((await budget.finish(state.revision, status)).rowCount).toBe(1);
      expect((await query('SELECT next_check_at::text FROM adjudication_capture_budget')).rows[0]).toEqual(before);
      expect(await budget.read()).toMatchObject({ status, cooling_down: true });
    } finally { await db.pool.end(); }
  });

test.each([
  ['-1 minute', 5], ['0 minutes', 5], ['1 minute', 5], ['10 minutes', 10],
  ['60 minutes', 60], ['60 minutes 0.000001 seconds', 5], ['2 days', 5],
])('SQL clock boundary %s produces exactly %s minutes from command receipt', async (offset, expected) => {
  const db = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
  try {
    await budget.configure({ dailyCalls: 5, dailyTokens: 42240 });
    await db.withTransaction(async client => {
      await client.query(`PREPARE cooldown_finish(integer,text,text,uuid) AS ${FINISH_ADJUDICATION_BUDGET_SQL}`);
      // One command message gives all three statements the same server timestamp, including microseconds.
      const results = await client.query(`UPDATE adjudication_capture_budget SET next_check_at=statement_timestamp()+interval '${offset}';
        EXECUTE cooldown_finish(1,'deferred',NULL,'${fixtureAttemptId}');
        SELECT next_check_at=statement_timestamp()+interval '${expected} minutes' AS exact,
          next_check_at>statement_timestamp() AND next_check_at<=statement_timestamp()+interval '60 minutes' AS honored
        FROM adjudication_capture_budget`);
      expect(results[1].rowCount).toBe(1); expect(results[2].rows).toEqual([{ exact: true, honored: true }]);
      await client.query('DEALLOCATE cooldown_finish');
    });
  } finally { await db.pool.end(); }
});

test('unavailable extends a short cooldown without changing quota or fingerprint; disable/resume retains it', async () => {
  const db = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
  try {
    const state = await budget.configure({ dailyCalls: 5, dailyTokens: 42240 }); await budget.reserve(state.revision);
    await budget.finish(state.revision, 'deferred', 'd'.repeat(64));
    const original = (await query('SELECT * FROM adjudication_capture_budget')).rows[0];
    await budget.finish(state.revision, 'unavailable');
    const extended = (await query('SELECT * FROM adjudication_capture_budget')).rows[0];
    expect(extended.next_check_at.getTime() - original.next_check_at.getTime()).toBeGreaterThan(54 * 60000);
    expect({ ...extended, status: original.status, next_check_at: original.next_check_at }).toEqual(original);
    const exact = (await query('SELECT next_check_at::text FROM adjudication_capture_budget')).rows[0];
    await budget.configure({ dailyCalls: 0, dailyTokens: 0 });
    const resumed = await budget.configure({ dailyCalls: 5, dailyTokens: 42240 });
    expect(resumed.cooling_down).toBe(true);
    await budget.finish(resumed.revision, 'captured', 'e'.repeat(64));
    expect((await query('SELECT next_check_at::text FROM adjudication_capture_budget')).rows[0]).toEqual(exact);
    expect(await budget.read()).toMatchObject({ calls_reserved: 1, tokens_reserved: 8448, published_fingerprint: 'e'.repeat(64) });
  } finally { await db.pool.end(); }
});

test.each(['infinity', '-infinity'])('the existing schema refuses %s cooldowns', async value => {
  await query('INSERT INTO adjudication_capture_budget(singleton) VALUES(true)');
  await expect(query('UPDATE adjudication_capture_budget SET next_check_at=$1::timestamptz', [value])).rejects.toMatchObject({ code: '23514' });
});

test.each([['unavailable', 'deferred'], ['deferred', 'unavailable']])(
  'concurrent %s then %s finalizers use the locked row and fresh UPDATE time', async (firstStatus, secondStatus) => {
    const db = createReadinessDatabase({ max: 1 }), otherDb = createReadinessDatabase({ max: 1 });
    const budget = createAdjudicationBudgetRepository(db), otherBudget = createAdjudicationBudgetRepository(otherDb);
    const locked = deferred(), proceed = deferred(); let queries, first, second, firstDeadline;
    try {
      const state = await budget.configure({ dailyCalls: 5, dailyTokens: 42240 });
      const client = await db.pool.connect(), nativeQuery = client.query.bind(client);
      queries = jest.spyOn(client, 'query').mockImplementation(async (sql, parameters) => {
        const result = await nativeQuery(sql, parameters);
        if (sql === LOCK_ADJUDICATION_FINISH_SQL) { locked.resolve(); await proceed.promise; }
        if (sql === FINISH_ADJUDICATION_BUDGET_SQL) {
          firstDeadline = (await nativeQuery('SELECT next_check_at::text FROM adjudication_capture_budget')).rows[0].next_check_at;
        }
        return result;
      });
      client.release(); first = Promise.allSettled([budget.finish(state.revision, firstStatus)]); await locked.promise;
      const otherClient = await otherDb.pool.connect(), pid = otherClient.processID; otherClient.release();
      second = Promise.allSettled([otherBudget.finish(state.revision, secondStatus)]);
      await until(async () => (await query(`SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'
        AND query LIKE 'SELECT singleton FROM adjudication_capture_budget%'`, [pid])).rowCount === 1);
      const waitingAt = (await query('SELECT query_start::text FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0].query_start;
      proceed.resolve();
      expect((await first)[0].status).toBe('fulfilled'); expect((await second)[0].status).toBe('fulfilled');
      expect((await query(`SELECT $1::timestamptz-CASE WHEN $2='unavailable' THEN interval '60 minutes' ELSE interval '5 minutes' END
        >$3::timestamptz AS fresh`, [firstDeadline, firstStatus, waitingAt])).rows[0].fresh).toBe(true);
      const final = (await query('SELECT next_check_at::text,status FROM adjudication_capture_budget')).rows[0];
      expect(final.status).toBe(secondStatus);
      if (firstStatus === 'unavailable') expect(final.next_check_at).toBe(firstDeadline);
      else expect((await query('SELECT $1::timestamptz>$2::timestamptz+interval \'54 minutes\' AS extended',
        [final.next_check_at, firstDeadline])).rows[0].extended).toBe(true);
      expect((await otherBudget.read()).cooling_down).toBe(true);
    } finally {
      proceed.resolve(); await first; await second;
      queries?.mockRestore(); await db.pool.end(); await otherDb.pool.end();
    }
  });

test('a competing prelock retains the existing one-second lock timeout and rolls back without changing state', async () => {
  const db = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db), blocker = await getPool().connect();
  try {
    const state = await budget.configure({ dailyCalls: 5, dailyTokens: 42240 });
    const before = (await query('SELECT * FROM adjudication_capture_budget')).rows;
    await blocker.query('BEGIN'); await blocker.query('SELECT singleton FROM adjudication_capture_budget FOR UPDATE');
    await expect(budget.finish(state.revision, 'unavailable')).rejects.toMatchObject({ code: '55P03' });
    expect((await query('SELECT * FROM adjudication_capture_budget')).rows).toEqual(before);
  } finally { await blocker.query('ROLLBACK'); blocker.release(); await db.pool.end(); }
});

test('finalization retains inherited transaction isolation and existing per-statement limits', async () => {
  const db = createReadinessDatabase({ max: 1 }), budget = createAdjudicationBudgetRepository(db); let queries;
  try {
    const state = await budget.configure({ dailyCalls: 5, dailyTokens: 42240 });
    const client = await db.pool.connect(); await client.query("SET default_transaction_isolation='repeatable read'");
    const nativeQuery = client.query.bind(client), settings = [];
    queries = jest.spyOn(client, 'query').mockImplementation(async (sql, parameters) => {
      const result = await nativeQuery(sql, parameters);
      if (sql === LOCK_ADJUDICATION_FINISH_SQL || sql === FINISH_ADJUDICATION_BUDGET_SQL) settings.push((await nativeQuery(`SELECT
        current_setting('transaction_isolation') AS isolation,current_setting('statement_timeout') AS statement,
        current_setting('lock_timeout') AS lock`)).rows[0]);
      return result;
    });
    client.release(); await budget.finish(state.revision, 'unavailable');
    expect(settings).toEqual(Array(2).fill({ isolation: 'repeatable read', statement: '15s', lock: '1s' }));
  } finally { queries?.mockRestore(); await db.pool.end(); }
});
