/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { setTimeout as sleep } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';
import { createAdjudicationFinalizationClaim } from '../../services/adjudicationFinalizationClaim.mjs';
import { INVENTORY_DISCOVERY_LOCK } from '../../services/inventoryDiscoveryAdmission.mjs';
import { isAdjudicationReservationRefusal } from '../../services/adjudicationReservationRefusal.mjs';
import { LOCK_OWNED_ADJUDICATION_BUDGET_SQL, RESERVE_ADJUDICATION_SQL, RESET_ADJUDICATION_RESERVATION_DAY_SQL } from '../../services/adjudicationBudgetSql.mjs';
import { reservationFixture, reservationDeferred as deferred, claimReservationOwner } from '../helpers/adjudicationReservationFixture.mjs';

const query = (...args) => getPool().query(...args);
const options = { dailyCalls: 5, dailyTokens: 42240 };
const snapshot = async () => (await query('SELECT * FROM adjudication_capture_budget')).rows;
async function claim(db, revision) {
  let result;
  expect(await db.withSessionAdvisoryLock(INVENTORY_DISCOVERY_LOCK, async scope => {
    result = await createAdjudicationFinalizationClaim(scope)(revision);
  })).toBe(true);
  return result;
}
beforeEach(async () => { await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });
async function until(predicate) {
  const end = Date.now() + 5000;
  do { if (await predicate()) return; await sleep(10); } while (Date.now() < end);
  throw Error('fixture_condition_not_reached');
}

test('a replaced claim cannot reset yesterday or charge another automatic generation', async () => {
  const db = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
  try {
    const state = await budget.configure(options), old = await claim(db, state.revision);
    await claim(db, state.revision);
    await query("UPDATE adjudication_capture_budget SET quota_day=(statement_timestamp() AT TIME ZONE 'UTC')::date-1,calls_reserved=1,tokens_reserved=8448");
    const before = await snapshot();
    await expect(budget.reserve(state.revision, undefined, old.attemptId)).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  } finally { await db.pool.end(); }
});

test('ownership refusal rolls back default-singleton bootstrap; missing authority starts no SQL', async () => {
  const db = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
  try {
    const id = '41db1265-8bc1-4ab3-992f-885799a4af1d';
    expect(() => budget.reserve(0)).toThrow('claim_invalid'); expect(await snapshot()).toEqual([]);
    const error = await budget.reserve(0, undefined, id).catch(value => value);
    expect(isAdjudicationReservationRefusal(error)).toBe(true); expect(await snapshot()).toEqual([]);
  } finally { await db.pool.end(); }
});

test.each(['disabled', 'exhausted', 'future_day', 'closed_window'])(
  'a current owner retains budget refusal semantics for %s without committed reset', async mode => {
    const f = await reservationFixture();
    try {
      if (mode === 'disabled') await query('UPDATE adjudication_capture_budget SET daily_calls=0,daily_tokens=0');
      if (mode === 'exhausted') await query('UPDATE adjudication_capture_budget SET calls_reserved=5,tokens_reserved=42240');
      if (mode === 'future_day') await query('UPDATE adjudication_capture_budget SET quota_day=quota_day+1');
      if (mode === 'closed_window') await query(`UPDATE adjudication_capture_budget SET workload_mode='scheduled',
        quota_day=quota_day-1,calls_reserved=1,tokens_reserved=8448,
        window_start_minute=(EXTRACT(HOUR FROM statement_timestamp() AT TIME ZONE 'UTC')::int*60+EXTRACT(MINUTE FROM statement_timestamp() AT TIME ZONE 'UTC')::int+10)%1440,
        window_end_minute=(EXTRACT(HOUR FROM statement_timestamp() AT TIME ZONE 'UTC')::int*60+EXTRACT(MINUTE FROM statement_timestamp() AT TIME ZONE 'UTC')::int+20)%1440`);
      const before = await snapshot(), error = await f.budget.reserve(f.state.revision, undefined, f.owner.attemptId).catch(value => value);
      expect(error.message).toBe('adjudication_budget_exhausted'); expect(isAdjudicationReservationRefusal(error)).toBe(false);
      expect(await snapshot()).toEqual(before);
    } finally { await f.db.pool.end(); }
  });

test('a current owner rolls over the UTC day exactly once before concurrent charges', async () => {
  const f = await reservationFixture();
  try {
    await query('UPDATE adjudication_capture_budget SET quota_day=quota_day-1,calls_reserved=5,tokens_reserved=42240');
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => f.budget.reserve(f.state.revision, undefined, f.owner.attemptId)));
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(5);
    expect((await snapshot())[0]).toMatchObject({ calls_reserved: 5, tokens_reserved: 42240, finalization_attempt_id: f.owner.attemptId });
    expect((await query("SELECT quota_day=(statement_timestamp() AT TIME ZONE 'UTC')::date AS today FROM adjudication_capture_budget")).rows[0].today).toBe(true);
  } finally { await f.db.pool.end(); }
});

test('a reservation waiting behind a replacement claim cannot touch quota', async () => {
  const f = await reservationFixture({ max: 1 }), next = createReadinessDatabase();
  const updated = deferred(), release = deferred(); let replacement, reservation, expected;
  try {
    await query('UPDATE adjudication_capture_budget SET quota_day=quota_day-1,calls_reserved=1,tokens_reserved=8448');
    replacement = Promise.allSettled([claimReservationOwner(next, f.state.revision, scope => ({ ...scope, query: async (...args) => {
      const result = await scope.query(...args);
      if (args[0].startsWith('UPDATE adjudication_capture_budget SET finalization_attempt_id')) { updated.resolve(); await release.promise; }
      return result;
    } }))]);
    await updated.promise;
    const client = await f.db.pool.connect(), pid = client.processID; client.release();
    reservation = Promise.allSettled([f.budget.reserve(f.state.revision, undefined, f.owner.attemptId)]);
    await until(async () => (await query("SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'", [pid])).rowCount === 1);
    release.resolve(); const claimResult = (await replacement)[0]; expect(claimResult.status).toBe('fulfilled');
    expected = claimResult.value.attemptId;
    const refused = (await reservation)[0]; expect(refused.status).toBe('rejected'); expect(isAdjudicationReservationRefusal(refused.reason)).toBe(true);
    expect((await snapshot())[0]).toMatchObject({ calls_reserved: 1, tokens_reserved: 8448, finalization_attempt_id: expected });
    expect((await query("SELECT quota_day<(statement_timestamp() AT TIME ZONE 'UTC')::date AS yesterday FROM adjudication_capture_budget")).rows[0].yesterday).toBe(true);
  } finally { release.resolve(); await replacement; await reservation; await f.db.pool.end(); await next.pool.end(); }
});

test('an earlier locked reservation commits its charge before the replacement can claim', async () => {
  const f = await reservationFixture({ max: 1 }), next = createReadinessDatabase({ max: 1 });
  const locked = deferred(), release = deferred(); let spy, reservation, replacement;
  try {
    const client = await f.db.pool.connect(), native = client.query.bind(client);
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args); if (args[0] === LOCK_OWNED_ADJUDICATION_BUDGET_SQL) { locked.resolve(); await release.promise; } return result;
    }); client.release();
    reservation = Promise.allSettled([f.budget.reserve(f.state.revision, undefined, f.owner.attemptId)]); await locked.promise;
    const other = await next.pool.connect(), pid = other.processID; other.release();
    replacement = Promise.allSettled([claimReservationOwner(next, f.state.revision)]);
    await until(async () => (await query("SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'", [pid])).rowCount === 1);
    release.resolve(); expect((await reservation)[0].status).toBe('fulfilled');
    const owner = (await replacement)[0]; expect(owner.status).toBe('fulfilled');
    expect((await snapshot())[0]).toMatchObject({ calls_reserved: 1, tokens_reserved: 8448, finalization_attempt_id: owner.value.attemptId });
  } finally { release.resolve(); await reservation; await replacement; spy?.mockRestore(); await f.db.pool.end(); await next.pool.end(); }
});

test.each(['queued', 'locked'])('cooperative stop while %s preserves counters and is not ownership evidence', async phase => {
  const f = await reservationFixture({ max: 1 }), controller = new AbortController(); let held, spy, execution;
  try {
    const before = await snapshot(); held = await f.db.pool.connect(); const native = held.query.bind(held);
    spy = jest.spyOn(held, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (phase === 'locked' && args[0] === LOCK_OWNED_ADJUDICATION_BUDGET_SQL) controller.abort();
      return result;
    });
    if (phase === 'locked') { held.release(); held = null; }
    execution = Promise.allSettled([f.budget.reserve(f.state.revision, controller.signal, f.owner.attemptId)]);
    if (phase === 'queued') { await until(() => f.db.pool.waitingCount === 1); controller.abort(); held.release(); held = null; }
    const result = (await execution)[0]; expect(result.status).toBe('rejected'); expect(isAdjudicationReservationRefusal(result.reason)).toBe(false);
    expect(spy.mock.calls.some(([sql]) => [RESET_ADJUDICATION_RESERVATION_DAY_SQL, RESERVE_ADJUDICATION_SQL].includes(sql))).toBe(false);
    expect(await snapshot()).toEqual(before);
  } finally { held?.release(); await execution; spy?.mockRestore(); await f.db.pool.end(); }
});

test('reservation inherits isolation and keeps its existing statement and lock limits', async () => {
  const f = await reservationFixture({ max: 1 }); let spy;
  try {
    const client = await f.db.pool.connect(), native = client.query.bind(client);
    await native("SET default_transaction_isolation='repeatable read'");
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      if (args[0] === RESERVE_ADJUDICATION_SQL) {
        expect((await native('SHOW transaction_isolation')).rows[0].transaction_isolation).toBe('repeatable read');
        expect((await native('SHOW statement_timeout')).rows[0].statement_timeout).toBe('15s');
        expect((await native('SHOW lock_timeout')).rows[0].lock_timeout).toBe('1s');
      }
      return native(...args);
    }); client.release();
    await f.budget.reserve(f.state.revision, undefined, f.owner.attemptId);
    expect((await snapshot())[0].calls_reserved).toBe(1);
  } finally { spy?.mockRestore(); await f.db.pool.end(); }
});
