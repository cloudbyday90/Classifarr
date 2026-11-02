/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { setTimeout as sleep } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { reservationFixture, claimReservationOwner, reservationDeferred as deferred } from '../helpers/adjudicationReservationFixture.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';
import { isAdjudicationCheckpointRefusal } from '../../services/adjudicationCheckpointRefusal.mjs';
import { LOCK_OWNED_ADJUDICATION_BUDGET_SQL } from '../../services/adjudicationBudgetSql.mjs';
import { RECORD_ADJUDICATION_PROGRESS_SQL } from '../../services/adjudicationCheckpointSql.mjs';

const query = (...args) => getPool().query(...args);
const plan = [{ key: 'c'.repeat(64), prompt: 'Synthetic comparison', count: 2 }];
const template = () => ({ version: 'cached_adjudication.v1', configuration: 'a'.repeat(64),
  identity: { model: 'synthetic:latest', digest: 'b'.repeat(64), contextLength: 8192 }, records: [] });
const record = (response = 'Synthetic response') => ({ key: plan[0].key,
  generated: { response, latencyMs: 1, promptTokens: 10, outputTokens: 10,
    outputLimitReached: false, contextLimitSuspected: false, inputTruncation: 'unknown' } });
const snapshot = async () => ({ budget: (await query('SELECT * FROM adjudication_capture_budget')).rows,
  cached: (await query('SELECT * FROM cached_adjudication_batch')).rows });
beforeEach(async () => { await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

async function prepared(options) {
  const f = await reservationFixture(options);
  try {
    const checkpoint = f.budget.checkpoint(f.state.revision, f.owner.attemptId);
    await checkpoint.open(plan, template());
    await f.budget.reserve(f.state.revision, undefined, f.owner.attemptId);
    await checkpoint.record(record());
    return { ...f, checkpoint };
  } catch (error) { await f.db.pool.end(); throw error; }
}
const invoke = (checkpoint, operation, signal) => operation === 'open' ? checkpoint.open(plan, template(), signal)
  : operation === 'record' ? checkpoint.record(record('Replacement response'), signal) : checkpoint.publish(undefined, signal);
async function until(predicate) {
  const end = Date.now() + 5000;
  do { if (await predicate()) return; await sleep(10); } while (Date.now() < end);
  throw Error('fixture_condition_not_reached');
}
const waiting = pid => until(async () => (await query("SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'", [pid])).rowCount === 1);

test.each(['open', 'record', 'publish'])('a replaced claim cannot %s an automatic checkpoint', async operation => {
  const f = await prepared();
  try {
    await claimReservationOwner(f.db, f.state.revision);
    const before = await snapshot();
    const error = await invoke(f.checkpoint, operation).catch(value => value);
    expect(isAdjudicationCheckpointRefusal(error)).toBe(true);
    expect(await snapshot()).toEqual(before);
    expect(before.budget[0]).toMatchObject({ calls_reserved: 1, tokens_reserved: 8448 });
  } finally { await f.db.pool.end(); }
});

test('missing authority starts no SQL and proven absence rolls back bootstrap', async () => {
  const db = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
  try {
    expect(() => budget.checkpoint(0)).toThrow('claim_invalid');
    expect(await snapshot()).toEqual({ budget: [], cached: [] });
    const checkpoint = budget.checkpoint(0, '41db1265-8bc1-4ab3-992f-885799a4af1d');
    const error = await checkpoint.open(plan, template()).catch(value => value);
    expect(isAdjudicationCheckpointRefusal(error)).toBe(true);
    expect(await snapshot()).toEqual({ budget: [], cached: [] });
  } finally { await db.pool.end(); }
});

test.each(['open', 'record', 'publish'])('%s waiting behind replacement refuses before retained reuse or DML', async operation => {
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
    execution = Promise.allSettled([invoke(f.checkpoint, operation)]); await waiting(pid);
    release.resolve(); const owner = (await replacement)[0]; expect(owner.status).toBe('fulfilled');
    const result = (await execution)[0]; expect(result.status).toBe('rejected');
    expect(isAdjudicationCheckpointRefusal(result.reason)).toBe(true);
    before.budget[0].finalization_attempt_id = owner.value.attemptId;
    expect(await snapshot()).toEqual(before);
  } finally { release.resolve(); await replacement; await execution; await f.db.pool.end(); await next.pool.end(); }
});

test.each(['open', 'record', 'publish'])('earlier %s holds the budget row until commit before replacement', async operation => {
  const f = await prepared({ max: 1 }), next = createReadinessDatabase({ max: 1 });
  const locked = deferred(), release = deferred(); let spy, execution, replacement;
  try {
    const client = await f.db.pool.connect(), native = client.query.bind(client);
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0] === LOCK_OWNED_ADJUDICATION_BUDGET_SQL) { locked.resolve(); await release.promise; }
      return result;
    }); client.release();
    execution = Promise.allSettled([invoke(f.checkpoint, operation)]); await locked.promise;
    const other = await next.pool.connect(), pid = other.processID; other.release();
    replacement = Promise.allSettled([claimReservationOwner(next, f.state.revision)]); await waiting(pid);
    release.resolve(); expect((await execution)[0].status).toBe('fulfilled');
    const owner = (await replacement)[0]; expect(owner.status).toBe('fulfilled');
    const after = await snapshot();
    expect(after.budget[0]).toMatchObject({ finalization_attempt_id: owner.value.attemptId, calls_reserved: 1, tokens_reserved: 8448 });
    expect(after.budget[0].progress.records[0].generated.response).toBe(operation === 'record' ? 'Replacement response' : 'Synthetic response');
    expect(after.cached).toHaveLength(operation === 'publish' ? 1 : 0);
  } finally { release.resolve(); await execution; await replacement; spy?.mockRestore(); await f.db.pool.end(); await next.pool.end(); }
});

test.each(['queued', 'locked', 'updated'])('cooperative stop while %s rolls back without ownership evidence', async phase => {
  const f = await prepared({ max: 1 }), controller = new AbortController(); let held, spy, execution;
  try {
    const before = await snapshot(); held = await f.db.pool.connect(); const native = held.query.bind(held);
    spy = jest.spyOn(held, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (phase === 'locked' && args[0] === LOCK_OWNED_ADJUDICATION_BUDGET_SQL || phase === 'updated' && args[0] === RECORD_ADJUDICATION_PROGRESS_SQL) controller.abort();
      return result;
    });
    if (phase !== 'queued') { held.release(); held = null; }
    execution = Promise.allSettled([invoke(f.checkpoint, 'record', controller.signal)]);
    if (phase === 'queued') { await until(() => f.db.pool.waitingCount === 1); controller.abort(); held.release(); held = null; }
    const result = (await execution)[0]; expect(result.status).toBe('rejected');
    expect(isAdjudicationCheckpointRefusal(result.reason)).toBe(false);
    if (phase !== 'updated') expect(spy.mock.calls.some(([sql]) => sql === RECORD_ADJUDICATION_PROGRESS_SQL)).toBe(false);
    expect(await snapshot()).toEqual(before);
  } finally { held?.release(); await execution; spy?.mockRestore(); await f.db.pool.end(); }
});

test('a retention lease expiring during the owner-lock wait uses fresh statement time', async () => {
  const f = await prepared({ max: 1 }); let holder, execution;
  try {
    holder = await getPool().connect(); await holder.query('BEGIN');
    await holder.query("UPDATE adjudication_capture_budget SET expires_at=statement_timestamp()+interval '200 milliseconds'");
    const client = await f.db.pool.connect(), pid = client.processID; client.release();
    execution = Promise.allSettled([invoke(f.checkpoint, 'record')]); await waiting(pid); await sleep(250);
    await holder.query('COMMIT'); holder.release(); holder = null;
    const result = (await execution)[0]; expect(result.status).toBe('rejected');
    expect(result.reason.message).toBe('adjudication_budget_changed');
    expect(isAdjudicationCheckpointRefusal(result.reason)).toBe(false);
    expect((await snapshot()).budget[0].progress.records).toEqual([record()]);
  } finally { if (holder) { await holder.query('ROLLBACK'); holder.release(); } await execution; await f.db.pool.end(); }
});

test('checkpoint transactions inherit stronger isolation and retain existing write limits', async () => {
  const f = await prepared({ max: 1 }); let spy;
  try {
    const client = await f.db.pool.connect(), native = client.query.bind(client);
    await native("SET default_transaction_isolation='repeatable read'");
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      if (args[0] === RECORD_ADJUDICATION_PROGRESS_SQL) {
        expect((await native('SHOW transaction_isolation')).rows[0].transaction_isolation).toBe('repeatable read');
        expect((await native('SHOW statement_timeout')).rows[0].statement_timeout).toBe('15s');
        expect((await native('SHOW lock_timeout')).rows[0].lock_timeout).toBe('1s');
      }
      return native(...args);
    }); client.release(); await invoke(f.checkpoint, 'record');
  } finally { spy?.mockRestore(); await f.db.pool.end(); }
});

test('zero publication source after lease expiry rolls back the preceding progress replacement', async () => {
  const f = await prepared({ max: 1 }); let spy;
  try {
    await query("UPDATE adjudication_capture_budget SET expires_at=statement_timestamp()+interval '200 milliseconds'");
    const before = await snapshot(), client = await f.db.pool.connect(), native = client.query.bind(client);
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0] === RECORD_ADJUDICATION_PROGRESS_SQL) await sleep(250);
      return result;
    }); client.release();
    const error = await f.checkpoint.publish(template()).catch(value => value);
    expect(error.message).toBe('adjudication_budget_changed'); expect(isAdjudicationCheckpointRefusal(error)).toBe(false);
    expect(await snapshot()).toEqual(before);
  } finally { spy?.mockRestore(); await f.db.pool.end(); }
});

test.each(['open', 'record', 'publish'].flatMap(operation => ['delayed', 'lost'].map(reply => ({ operation, reply }))))(
  '$operation commit with $reply acknowledgement stays durable without replay or ownership inference', async ({ operation, reply }) => {
    const f = await prepared({ max: 1 }), next = createReadinessDatabase({ max: 1 });
    const committed = deferred(), release = deferred(); let spy, execution;
    try {
      const client = await f.db.pool.connect(), native = client.query.bind(client);
      spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
        const result = await native(...args);
        if (args[0] === 'COMMIT') { committed.resolve(); await release.promise; if (reply === 'lost') throw Error('Synthetic lost checkpoint acknowledgement'); }
        return result;
      }); client.release();
      execution = Promise.allSettled([operation === 'open'
        ? f.checkpoint.open([{ ...plan[0], key: 'e'.repeat(64) }], template()) : invoke(f.checkpoint, operation)]);
      await committed.promise; const durable = await snapshot();
      const owner = await claimReservationOwner(next, f.state.revision);
      release.resolve(); const result = (await execution)[0];
      expect(result.status).toBe(reply === 'lost' ? 'rejected' : 'fulfilled');
      if (reply === 'lost') expect(isAdjudicationCheckpointRefusal(result.reason)).toBe(false);
      expect(spy.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
      durable.budget[0].finalization_attempt_id = owner.attemptId;
      expect(await snapshot()).toEqual(durable);
      expect(durable.budget[0]).toMatchObject({ calls_reserved: 1, tokens_reserved: 8448 });
      expect(durable.budget[0].progress.records).toEqual(operation === 'open' ? [] : [record(operation === 'record' ? 'Replacement response' : 'Synthetic response')]);
      expect(durable.cached).toHaveLength(operation === 'publish' ? 1 : 0);
    } finally { release.resolve(); await execution; spy?.mockRestore(); await f.db.pool.end(); await next.pool.end(); }
  });
