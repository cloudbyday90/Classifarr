/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { setTimeout as sleep } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { reservationFixture, claimReservationOwner, reservationDeferred as deferred } from '../helpers/adjudicationReservationFixture.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';
import { isAdjudicationAdvanceRefusal } from '../../services/adjudicationAdvanceRefusal.mjs';
import { LOCK_OWNED_ADJUDICATION_BUDGET_SQL, ADVANCE_ADJUDICATION_BUDGET_SQL } from '../../services/adjudicationBudgetSql.mjs';

const query = (...args) => getPool().query(...args);
const plan = [{ key: 'c'.repeat(64) }];
const template = { version: 'cached_adjudication.v1', configuration: 'a'.repeat(64),
  identity: { model: 'synthetic:latest', digest: 'b'.repeat(64), contextLength: 8192 }, records: [] };
const snapshot = async () => ({ budget: (await query('SELECT * FROM adjudication_capture_budget')).rows,
  cached: (await query('SELECT * FROM cached_adjudication_batch')).rows });
beforeEach(async () => { await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

async function prepared(options) {
  const f = await reservationFixture(options);
  try {
    const checkpoint = f.budget.checkpoint(f.state.revision, f.owner.attemptId);
    await checkpoint.open(plan, template);
    await f.budget.reserve(f.state.revision, undefined, f.owner.attemptId);
    await checkpoint.record({ key: plan[0].key, generated: { response: 'Synthetic response', latencyMs: 1,
      promptTokens: 10, outputTokens: 10, outputLimitReached: false, contextLimitSuspected: false, inputTruncation: 'unknown' } });
    await checkpoint.publish();
    await query('UPDATE adjudication_capture_budget SET published_fingerprint=$1', ['d'.repeat(64)]);
    return f;
  } catch (error) { await f.db.pool.end(); throw error; }
}

test('a replaced claim cannot rotate or clear retained progress', async () => {
  const f = await prepared();
  try {
    await claimReservationOwner(f.db, f.state.revision);
    const before = await snapshot();
    const error = await f.budget.advance(f.state.revision, 60, undefined, f.owner.attemptId).catch(value => value);
    expect(await snapshot()).toEqual(before);
    expect(isAdjudicationAdvanceRefusal(error)).toBe(true);
  } finally { await f.db.pool.end(); }
});

const advance = (f, signal) => f.budget.advance(f.state.revision, 60, signal, f.owner.attemptId);
async function until(predicate) {
  const end = Date.now() + 5000;
  do { if (await predicate()) return; await sleep(10); } while (Date.now() < end);
  throw Error('fixture_condition_not_reached');
}
const waiting = pid => until(async () => (await query("SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'", [pid])).rowCount === 1);

test('missing authority starts no SQL and owned absence rolls back singleton bootstrap', async () => {
  const db = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
  try {
    expect(() => budget.advance(0, 60)).toThrow('claim_invalid');
    expect(await snapshot()).toEqual({ budget: [], cached: [] });
    const error = await budget.advance(0, 60, undefined, '41db1265-8bc1-4ab3-992f-885799a4af1d').catch(value => value);
    expect(isAdjudicationAdvanceRefusal(error)).toBe(true);
    expect(await snapshot()).toEqual({ budget: [], cached: [] });
  } finally { await db.pool.end(); }
});

test('advance waiting behind replacement refuses without erasing progress', async () => {
  const f = await prepared({ max: 1 }), next = createReadinessDatabase({ max: 1 });
  const updated = deferred(), release = deferred(); let replacement, execution;
  try {
    const before = await snapshot();
    replacement = Promise.allSettled([claimReservationOwner(next, f.state.revision, scope => ({ ...scope, query: async (...args) => {
      const result = await scope.query(...args);
      if (args[0].startsWith('UPDATE adjudication_capture_budget SET finalization_attempt_id')) { updated.resolve(); await release.promise; }
      return result;
    } }))]);
    await updated.promise;
    const client = await f.db.pool.connect(), pid = client.processID; client.release();
    execution = Promise.allSettled([advance(f)]); await waiting(pid);
    release.resolve(); const owner = (await replacement)[0]; expect(owner.status).toBe('fulfilled');
    const result = (await execution)[0]; expect(result.status).toBe('rejected');
    expect(isAdjudicationAdvanceRefusal(result.reason)).toBe(true);
    before.budget[0].finalization_attempt_id = owner.value.attemptId;
    expect(await snapshot()).toEqual(before);
  } finally { release.resolve(); await replacement; await execution; await f.db.pool.end(); await next.pool.end(); }
});

test('an earlier advance holds the row through commit before replacement', async () => {
  const f = await prepared({ max: 1 }), next = createReadinessDatabase({ max: 1 });
  const locked = deferred(), release = deferred(); let spy, execution, replacement;
  try {
    const client = await f.db.pool.connect(), native = client.query.bind(client);
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0] === LOCK_OWNED_ADJUDICATION_BUDGET_SQL) { locked.resolve(); await release.promise; }
      return result;
    }); client.release();
    execution = Promise.allSettled([advance(f)]); await locked.promise;
    const other = await next.pool.connect(), pid = other.processID; other.release();
    replacement = Promise.allSettled([claimReservationOwner(next, f.state.revision)]); await waiting(pid);
    release.resolve(); expect((await execution)[0].status).toBe('fulfilled');
    const owner = (await replacement)[0]; expect(owner.status).toBe('fulfilled');
    const after = await snapshot();
    expect(after.budget[0]).toMatchObject({ finalization_attempt_id: owner.value.attemptId, selection_offset: 25,
      progress: null, published_fingerprint: null, calls_reserved: 1, tokens_reserved: 8448 });
    expect(after.cached).toHaveLength(1);
  } finally { release.resolve(); await execution; await replacement; spy?.mockRestore(); await f.db.pool.end(); await next.pool.end(); }
});

test.each(['queued', 'locked', 'updated'])('cooperative stop while %s rolls back without ownership evidence', async phase => {
  const f = await prepared({ max: 1 }), stop = new AbortController(); let held, spy, execution;
  try {
    const before = await snapshot(); held = await f.db.pool.connect(); const native = held.query.bind(held);
    spy = jest.spyOn(held, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (phase === 'locked' && args[0] === LOCK_OWNED_ADJUDICATION_BUDGET_SQL || phase === 'updated' && args[0] === ADVANCE_ADJUDICATION_BUDGET_SQL) stop.abort();
      return result;
    });
    if (phase !== 'queued') { held.release(); held = null; }
    execution = Promise.allSettled([advance(f, stop.signal)]);
    if (phase === 'queued') { await until(() => f.db.pool.waitingCount === 1); stop.abort(); held.release(); held = null; }
    const result = (await execution)[0]; expect(result.status).toBe('rejected');
    expect(isAdjudicationAdvanceRefusal(result.reason)).toBe(false);
    if (phase !== 'updated') expect(spy.mock.calls.some(([sql]) => sql === ADVANCE_ADJUDICATION_BUDGET_SQL)).toBe(false);
    expect(await snapshot()).toEqual(before);
  } finally { held?.release(); await execution; spy?.mockRestore(); await f.db.pool.end(); }
});

test.each([[0, 0, 0], [0, 25, 0], [0, 60, 25], [0, 300, 25], [275, 300, 0], [100, 60, 0], [25, 60, 50]])(
  'offset %i with eligible %i becomes %i without changing charge, UUID or cache', async (offset, eligible, expected) => {
    const f = await prepared();
    try {
      await query('UPDATE adjudication_capture_budget SET selection_offset=$1', [offset]);
      const before = await snapshot(); await f.budget.advance(f.state.revision, eligible, undefined, f.owner.attemptId);
      before.budget[0] = { ...before.budget[0], selection_offset: expected, published_fingerprint: null,
        progress_key: null, progress: null, captured_at: null, expires_at: null };
      expect(await snapshot()).toEqual(before);
    } finally { await f.db.pool.end(); }
  });

test('configuration invalidation refuses advance without clearing retained data', async () => {
  const f = await prepared();
  try {
    await f.budget.configure({ dailyCalls: 5, dailyTokens: 42240 });
    const before = await snapshot(), error = await advance(f).catch(value => value);
    expect(isAdjudicationAdvanceRefusal(error)).toBe(true); expect(await snapshot()).toEqual(before);
  } finally { await f.db.pool.end(); }
});

test('advance inherits stronger isolation and the existing write limits', async () => {
  const f = await prepared({ max: 1 }); let spy;
  try {
    const client = await f.db.pool.connect(), native = client.query.bind(client);
    await native("SET default_transaction_isolation='repeatable read'");
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      if (args[0] === ADVANCE_ADJUDICATION_BUDGET_SQL) {
        expect((await native('SHOW transaction_isolation')).rows[0].transaction_isolation).toBe('repeatable read');
        expect((await native('SHOW statement_timeout')).rows[0].statement_timeout).toBe('15s');
        expect((await native('SHOW lock_timeout')).rows[0].lock_timeout).toBe('1s');
      }
      return native(...args);
    }); client.release(); await advance(f);
  } finally { spy?.mockRestore(); await f.db.pool.end(); }
});

test('a stronger-isolation serialization error is not exact owner-zero evidence', async () => {
  const f = await prepared({ max: 1 }), next = createReadinessDatabase({ max: 1 });
  const observed = deferred(), release = deferred(); let spy, execution;
  try {
    const before = await snapshot(), client = await f.db.pool.connect(), native = client.query.bind(client);
    await native("SET default_transaction_isolation='repeatable read'");
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0].startsWith('INSERT INTO adjudication_capture_budget')) { observed.resolve(); await release.promise; }
      return result;
    }); client.release();
    execution = Promise.allSettled([advance(f)]); await observed.promise;
    const owner = await claimReservationOwner(next, f.state.revision); release.resolve();
    const result = (await execution)[0]; expect(result.status).toBe('rejected');
    expect(result.reason.code).toBe('40001'); expect(isAdjudicationAdvanceRefusal(result.reason)).toBe(false);
    before.budget[0].finalization_attempt_id = owner.attemptId;
    expect(await snapshot()).toEqual(before);
    expect(spy.mock.calls.some(([sql]) => sql === ADVANCE_ADJUDICATION_BUDGET_SQL)).toBe(false);
  } finally { release.resolve(); await execution; spy?.mockRestore(); await f.db.pool.end(); await next.pool.end(); }
});

test.each(['delayed', 'lost'])('advance commit with %s acknowledgement remains applied exactly once', async reply => {
  const f = await prepared({ max: 1 }), next = createReadinessDatabase({ max: 1 });
  const committed = deferred(), release = deferred(); let spy, execution;
  try {
    const client = await f.db.pool.connect(), native = client.query.bind(client);
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0] === 'COMMIT') { committed.resolve(); await release.promise; if (reply === 'lost') throw Error('Synthetic lost advance acknowledgement'); }
      return result;
    }); client.release();
    execution = Promise.allSettled([advance(f)]); await committed.promise;
    const durable = await snapshot(), owner = await claimReservationOwner(next, f.state.revision);
    release.resolve(); const result = (await execution)[0];
    expect(result.status).toBe(reply === 'lost' ? 'rejected' : 'fulfilled');
    if (reply === 'lost') expect(isAdjudicationAdvanceRefusal(result.reason)).toBe(false);
    expect(spy.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
    expect(spy.mock.calls.filter(([sql]) => sql === ADVANCE_ADJUDICATION_BUDGET_SQL)).toHaveLength(1);
    durable.budget[0].finalization_attempt_id = owner.attemptId;
    expect(await snapshot()).toEqual(durable);
    expect(durable.budget[0]).toMatchObject({ selection_offset: 25, progress: null, calls_reserved: 1, tokens_reserved: 8448 });
  } finally { release.resolve(); await execution; spy?.mockRestore(); await f.db.pool.end(); await next.pool.end(); }
});
