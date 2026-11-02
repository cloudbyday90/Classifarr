/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { setTimeout as sleep } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { claimReservationOwner, reservationDeferred as deferred } from '../helpers/adjudicationReservationFixture.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';
import { LOCK_OWNED_ADJUDICATION_BUDGET_SQL, LOCK_ADJUDICATION_MAINTENANCE_SQL,
  RESET_ADJUDICATION_DAY_SQL, PRUNE_ADJUDICATION_PROGRESS_SQL } from '../../services/adjudicationBudgetSql.mjs';
import { isAdjudicationAdvanceRefusal } from '../../services/adjudicationAdvanceRefusal.mjs';
import { isAdjudicationCheckpointRefusal } from '../../services/adjudicationCheckpointRefusal.mjs';
import { isAdjudicationReservationRefusal } from '../../services/adjudicationReservationRefusal.mjs';

const query = (...args) => getPool().query(...args);
const plan = [{ key: 'c'.repeat(64) }];
const template = { version: 'cached_adjudication.v1', configuration: 'a'.repeat(64),
  identity: { model: 'synthetic:latest', digest: 'b'.repeat(64), contextLength: 8192 }, records: [] };
const snapshot = async () => ({ budget: (await query('SELECT * FROM adjudication_capture_budget')).rows,
  cached: (await query('SELECT * FROM cached_adjudication_batch')).rows });
const privateRefusal = error => [isAdjudicationAdvanceRefusal, isAdjudicationCheckpointRefusal,
  isAdjudicationReservationRefusal].some(check => check(error));
beforeEach(async () => { await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

async function until(predicate) {
  const end = Date.now() + 5000;
  do { if (await predicate()) return; await sleep(10); } while (Date.now() < end);
  throw Error('fixture_condition_not_reached');
}
const waiting = pid => until(async () => (await query("SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'", [pid])).rowCount === 1);
async function prepared(options) {
  const db = createReadinessDatabase(options), budget = createAdjudicationBudgetRepository(db);
  try {
    const state = await budget.configure({ dailyCalls: 5, dailyTokens: 42240 }), owner = await claimReservationOwner(db, state.revision);
    const checkpoint = budget.checkpoint(state.revision, owner.attemptId);
    await checkpoint.open(plan, template); await budget.reserve(state.revision, undefined, owner.attemptId);
    return { db, budget, state, owner, checkpoint };
  } catch (error) { await db.pool.end(); throw error; }
}

test('maintenance waiting behind checkpoint open preserves the newly committed capture', async () => {
  const reader = createReadinessDatabase({ max: 1 }), writer = createReadinessDatabase({ max: 1 });
  const readBudget = createAdjudicationBudgetRepository(reader), writeBudget = createAdjudicationBudgetRepository(writer);
  const bootstrapped = deferred(), resumeReader = deferred(), locked = deferred(), resumeWriter = deferred();
  let readSpy, writeSpy, reading, opening;
  try {
    const state = await writeBudget.configure({ dailyCalls: 5, dailyTokens: 42240 });
    const owner = await claimReservationOwner(writer, state.revision), checkpoint = writeBudget.checkpoint(state.revision, owner.attemptId);
    await checkpoint.open(plan, template);
    await writeBudget.reserve(state.revision, undefined, owner.attemptId);
    await query("UPDATE adjudication_capture_budget SET captured_at=statement_timestamp()-interval '8 days',expires_at=statement_timestamp()-interval '1 day'");
    expect((await query('SELECT * FROM cached_adjudication_batch')).rows).toEqual([]);
    const r = await reader.pool.connect(), readNative = r.query.bind(r), pid = r.processID;
    const resetCounts = [];
    readSpy = jest.spyOn(r, 'query').mockImplementation(async (...args) => {
      const result = await readNative(...args);
      if (args[0].startsWith('INSERT INTO adjudication_capture_budget')) { bootstrapped.resolve(); await resumeReader.promise; }
      if (args[0] === RESET_ADJUDICATION_DAY_SQL) resetCounts.push(result.rowCount);
      return result;
    }); r.release();
    const w = await writer.pool.connect(), writeNative = w.query.bind(w);
    writeSpy = jest.spyOn(w, 'query').mockImplementation(async (...args) => {
      const result = await writeNative(...args);
      if (args[0] === LOCK_OWNED_ADJUDICATION_BUDGET_SQL) { locked.resolve(); await resumeWriter.promise; }
      return result;
    }); w.release();
    reading = Promise.allSettled([readBudget.read()]); await bootstrapped.promise;
    opening = Promise.allSettled([checkpoint.open(plan, template)]); await locked.promise;
    resumeReader.resolve();
    await waiting(pid);
    resumeWriter.resolve();
    const opened = (await opening)[0], read = (await reading)[0];
    expect(opened.status).toBe('fulfilled'); expect(read.status).toBe('fulfilled'); expect(resetCounts).toEqual([0]);
    const saved = (await query('SELECT * FROM adjudication_capture_budget')).rows[0];
    expect(saved.progress).toEqual(opened.value);
    expect(saved.captured_at).toBeInstanceOf(Date); expect(saved.expires_at).toBeInstanceOf(Date);
    expect(saved.finalization_attempt_id).toBe(owner.attemptId);
    expect(saved).toMatchObject({ calls_reserved: 1, tokens_reserved: 8448, status: 'ready', selection_offset: 0 });
    expect((await snapshot()).cached).toEqual([]);
  } finally {
    resumeReader.resolve(); resumeWriter.resolve(); await reading; await opening;
    readSpy?.mockRestore(); writeSpy?.mockRestore(); await reader.pool.end(); await writer.pool.end();
  }
});

test('earlier maintenance retains the row until commit before a new checkpoint open', async () => {
  const f = await prepared({ max: 1 }), writer = createReadinessDatabase({ max: 1 });
  const locked = deferred(), release = deferred(); let spy, reading, opening;
  try {
    await query("UPDATE adjudication_capture_budget SET captured_at=statement_timestamp()-interval '8 days',expires_at=statement_timestamp()-interval '1 day'");
    const client = await f.db.pool.connect(), native = client.query.bind(client);
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0] === LOCK_ADJUDICATION_MAINTENANCE_SQL) { locked.resolve(); await release.promise; }
      return result;
    }); client.release();
    reading = Promise.allSettled([f.budget.read()]); await locked.promise;
    const other = await writer.pool.connect(), pid = other.processID; other.release();
    const checkpoint = createAdjudicationBudgetRepository(writer).checkpoint(f.state.revision, f.owner.attemptId);
    opening = Promise.allSettled([checkpoint.open(plan, template)]); await waiting(pid);
    release.resolve(); expect((await reading)[0].status).toBe('fulfilled');
    const opened = (await opening)[0]; expect(opened.status).toBe('fulfilled');
    expect((await snapshot()).budget[0]).toMatchObject({ progress: opened.value, calls_reserved: 1, finalization_attempt_id: f.owner.attemptId });
  } finally { release.resolve(); await reading; await opening; spy?.mockRestore(); await f.db.pool.end(); await writer.pool.end(); }
});

test('fresh disabled bootstrap needs no flight authority', async () => {
  const db = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
  try {
    expect(await budget.read()).toMatchObject({ daily_calls: 0, daily_tokens: 0, calls_reserved: 0, status: 'disabled' });
    expect((await snapshot()).budget[0].finalization_attempt_id).toBeNull();
  } finally { await db.pool.end(); }
});

test('valid retained data, cooldown and published cache keep their original lease and charge', async () => {
  const f = await prepared();
  try {
    await f.checkpoint.publish();
    await query("UPDATE adjudication_capture_budget SET status='waiting_for_replay',next_check_at=statement_timestamp()+interval '25 minutes',published_fingerprint=$1", ['d'.repeat(64)]);
    const before = await snapshot();
    expect(await f.budget.read()).toMatchObject({ cooling_down: true, calls_reserved: 1, status: 'waiting_for_replay' });
    expect(await snapshot()).toEqual(before);
  } finally { await f.db.pool.end(); }
});

test.each(['expired', 'future'])('legitimate %s progress is pruned without touching charge, authority or shared cache', async mode => {
  const f = await prepared();
  try {
    await f.checkpoint.publish();
    await query(mode === 'expired'
      ? "UPDATE adjudication_capture_budget SET captured_at=statement_timestamp()-interval '8 days',expires_at=statement_timestamp()-interval '1 day'"
      : "UPDATE adjudication_capture_budget SET captured_at=statement_timestamp()+interval '1 day',expires_at=statement_timestamp()+interval '2 days'");
    const before = await snapshot(); await f.budget.read();
    before.budget[0] = { ...before.budget[0], progress_key: null, progress: null, captured_at: null, expires_at: null, published_fingerprint: null };
    expect(await snapshot()).toEqual(before);
  } finally { await f.db.pool.end(); }
});

test('concurrent deletion after bootstrap is ordinary absence, never owner refusal', async () => {
  const f = await prepared({ max: 1 }), observed = deferred(), release = deferred(); let spy, reading;
  try {
    const client = await f.db.pool.connect(), native = client.query.bind(client);
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0].startsWith('INSERT INTO adjudication_capture_budget')) { observed.resolve(); await release.promise; }
      return result;
    }); client.release();
    reading = Promise.allSettled([f.budget.read()]); await observed.promise;
    await query('DELETE FROM adjudication_capture_budget'); release.resolve();
    const result = (await reading)[0]; expect(result.status).toBe('rejected');
    expect(result.reason.message).toBe('adjudication_budget_changed'); expect(privateRefusal(result.reason)).toBe(false);
    expect(await snapshot()).toEqual({ budget: [], cached: [] });
  } finally { release.resolve(); await reading; spy?.mockRestore(); await f.db.pool.end(); }
});

test('a malformed driver lock response rolls back default bootstrap', async () => {
  const db = createReadinessDatabase({ max: 1 }), budget = createAdjudicationBudgetRepository(db); let spy;
  try {
    const client = await db.pool.connect(), native = client.query.bind(client);
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      return args[0] === LOCK_ADJUDICATION_MAINTENANCE_SQL ? { ...result, rowCount: '1' } : result;
    }); client.release();
    await expect(budget.read()).rejects.toThrow('maintenance_result_invalid');
    expect(await snapshot()).toEqual({ budget: [], cached: [] });
  } finally { spy?.mockRestore(); await db.pool.end(); }
});

test.each(['queued', 'locked', 'updated'])('stop while %s rolls back maintenance without claiming immediate cancellation', async phase => {
  const f = await prepared({ max: 1 }), stop = new AbortController(); let held, spy, reading;
  try {
    await query("UPDATE adjudication_capture_budget SET quota_day=quota_day-1,captured_at=statement_timestamp()-interval '8 days',expires_at=statement_timestamp()-interval '1 day'");
    const before = await snapshot(); held = await f.db.pool.connect(); const native = held.query.bind(held);
    spy = jest.spyOn(held, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (phase === 'locked' && args[0] === LOCK_ADJUDICATION_MAINTENANCE_SQL || phase === 'updated' && args[0] === PRUNE_ADJUDICATION_PROGRESS_SQL) stop.abort();
      return result;
    });
    if (phase !== 'queued') { held.release(); held = null; }
    reading = Promise.allSettled([f.budget.read(stop.signal)]);
    if (phase === 'queued') { await until(() => f.db.pool.waitingCount === 1); stop.abort(); held.release(); held = null; }
    const result = (await reading)[0]; expect(result.status).toBe('rejected'); expect(privateRefusal(result.reason)).toBe(false);
    if (phase !== 'updated') expect(spy.mock.calls.some(([sql]) => sql === RESET_ADJUDICATION_DAY_SQL)).toBe(false);
    expect(await snapshot()).toEqual(before);
  } finally { held?.release(); await reading; spy?.mockRestore(); await f.db.pool.end(); }
});

test('maintenance inherits stronger isolation and existing ordinary-write limits', async () => {
  const f = await prepared({ max: 1 }); let spy;
  try {
    const client = await f.db.pool.connect(), native = client.query.bind(client);
    await native("SET default_transaction_isolation='repeatable read'");
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      if (args[0] === RESET_ADJUDICATION_DAY_SQL) {
        expect((await native('SHOW transaction_isolation')).rows[0].transaction_isolation).toBe('repeatable read');
        expect((await native('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('off');
        expect((await native('SHOW statement_timeout')).rows[0].statement_timeout).toBe('15s');
        expect((await native('SHOW lock_timeout')).rows[0].lock_timeout).toBe('1s');
      }
      return native(...args);
    }); client.release(); await f.budget.read();
  } finally { spy?.mockRestore(); await f.db.pool.end(); }
});

test('stronger-isolation conflict stays a genuine serialization error', async () => {
  const f = await prepared({ max: 1 }), other = createReadinessDatabase();
  const observed = deferred(), release = deferred(); let spy, reading;
  try {
    const client = await f.db.pool.connect(), native = client.query.bind(client);
    await native("SET default_transaction_isolation='repeatable read'");
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0].startsWith('INSERT INTO adjudication_capture_budget')) { observed.resolve(); await release.promise; }
      return result;
    }); client.release();
    reading = Promise.allSettled([f.budget.read()]); await observed.promise;
    await createAdjudicationBudgetRepository(other).configure({ dailyCalls: 5, dailyTokens: 42240 });
    const configured = await snapshot(); release.resolve();
    const result = (await reading)[0]; expect(result.status).toBe('rejected');
    expect(result.reason.code).toBe('40001'); expect(privateRefusal(result.reason)).toBe(false);
    expect(spy.mock.calls.some(([sql]) => sql === RESET_ADJUDICATION_DAY_SQL)).toBe(false);
    expect(await snapshot()).toEqual(configured);
  } finally { release.resolve(); await reading; spy?.mockRestore(); await f.db.pool.end(); await other.pool.end(); }
});

test('existing row-lock timeout rejects without maintenance writes or retry', async () => {
  const f = await prepared({ max: 1 }), observed = deferred(), release = deferred(); let spy, reading, holder;
  try {
    const before = await snapshot(), client = await f.db.pool.connect(), native = client.query.bind(client);
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0].startsWith('INSERT INTO adjudication_capture_budget')) { observed.resolve(); await release.promise; }
      return result;
    }); client.release();
    reading = Promise.allSettled([f.budget.read()]); await observed.promise;
    holder = await getPool().connect(); await holder.query('BEGIN');
    await holder.query('SELECT singleton FROM adjudication_capture_budget FOR UPDATE'); release.resolve();
    const result = (await reading)[0]; expect(result.status).toBe('rejected');
    expect(result.reason.code).toBe('55P03'); expect(privateRefusal(result.reason)).toBe(false);
    expect(spy.mock.calls.filter(([sql]) => sql === LOCK_ADJUDICATION_MAINTENANCE_SQL)).toHaveLength(1);
    expect(spy.mock.calls.some(([sql]) => sql === RESET_ADJUDICATION_DAY_SQL)).toBe(false);
    expect(await snapshot()).toEqual(before);
  } finally { release.resolve(); if (holder) { await holder.query('ROLLBACK'); holder.release(); } await reading; spy?.mockRestore(); await f.db.pool.end(); }
});

test.each(['delayed', 'lost'])('maintenance COMMIT with %s acknowledgement is not replayed over a new current-day charge', async reply => {
  const f = await prepared({ max: 1 }), other = createReadinessDatabase();
  const committed = deferred(), release = deferred(); let spy, reading;
  try {
    await query("UPDATE adjudication_capture_budget SET quota_day=quota_day-1,captured_at=statement_timestamp()-interval '8 days',expires_at=statement_timestamp()-interval '1 day'");
    const client = await f.db.pool.connect(), native = client.query.bind(client);
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0] === 'COMMIT') { committed.resolve(); await release.promise; if (reply === 'lost') throw Error('Synthetic lost maintenance acknowledgement'); }
      return result;
    }); client.release();
    reading = Promise.allSettled([f.budget.read()]); await committed.promise;
    expect((await snapshot()).budget[0]).toMatchObject({ calls_reserved: 0, tokens_reserved: 0, progress: null });
    await createAdjudicationBudgetRepository(other).reserve(f.state.revision, undefined, f.owner.attemptId);
    const charged = await snapshot(); release.resolve();
    const result = (await reading)[0]; expect(result.status).toBe(reply === 'lost' ? 'rejected' : 'fulfilled');
    if (reply === 'lost') expect(privateRefusal(result.reason)).toBe(false);
    else expect(result.value.calls_reserved).toBe(0); // The earlier read is not current reservation authority.
    expect(await snapshot()).toEqual(charged);
    expect(charged.budget[0]).toMatchObject({ calls_reserved: 1, tokens_reserved: 8448, finalization_attempt_id: f.owner.attemptId });
    for (const command of ['COMMIT', RESET_ADJUDICATION_DAY_SQL, PRUNE_ADJUDICATION_PROGRESS_SQL]) {
      expect(spy.mock.calls.filter(([sql]) => sql === command)).toHaveLength(1);
    }
    // An independent later invocation sees today's charge; it must not reset it again.
    expect(await createAdjudicationBudgetRepository(other).read()).toMatchObject({ calls_reserved: 1, tokens_reserved: 8448 });
    expect(await snapshot()).toEqual(charged);
  } finally { release.resolve(); await reading; spy?.mockRestore(); await f.db.pool.end(); await other.pool.end(); }
});
