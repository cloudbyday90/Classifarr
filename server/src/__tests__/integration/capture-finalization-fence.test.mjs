/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { setTimeout as sleep } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';
import { createAdjudicationFinalizationClaim } from '../../services/adjudicationFinalizationClaim.mjs';
import { INVENTORY_DISCOVERY_LOCK } from '../../services/inventoryDiscoveryAdmission.mjs';
import { restoreAllTables } from '../../services/backupRestore.mjs';
import { createEvaluationWorkloadRepository } from '../../services/evaluationWorkloadRepository.mjs';

const query = (...args) => getPool().query(...args);
const options = { dailyCalls: 5, dailyTokens: 42240 };
const snapshot = async () => (await query('SELECT * FROM adjudication_capture_budget')).rows[0];
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
async function until(predicate) {
  const end = Date.now() + 5000;
  do { if (await predicate()) return; await sleep(10); } while (Date.now() < end);
  throw Error('fixture_condition_not_reached');
}
async function claim(db, revision) {
  let result;
  expect(await db.withSessionAdvisoryLock(INVENTORY_DISCOVERY_LOCK, async scope => {
    result = await createAdjudicationFinalizationClaim(scope)(revision);
  })).toBe(true);
  return result;
}
beforeEach(async () => { await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

test.each(['missing', 'disabled', 'closed_window', 'cooldown', 'exhausted', 'ignored_future'])(
  'the owner claim honors %s state without changing quota or outcome fields', async kind => {
    const db = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
    try {
      const state = await budget.configure(options);
      if (kind === 'missing') await query('DELETE FROM adjudication_capture_budget');
      if (kind === 'disabled') await query('UPDATE adjudication_capture_budget SET daily_calls=0,daily_tokens=0');
      if (kind === 'exhausted') await query('UPDATE adjudication_capture_budget SET calls_reserved=5,tokens_reserved=42240');
      if (kind === 'cooldown') await query("UPDATE adjudication_capture_budget SET next_check_at=statement_timestamp()+interval '30 minutes'");
      if (kind === 'ignored_future') await query("UPDATE adjudication_capture_budget SET next_check_at=statement_timestamp()+interval '2 days'");
      if (kind === 'closed_window') await query(`UPDATE adjudication_capture_budget SET workload_mode='scheduled',
        window_start_minute=(EXTRACT(HOUR FROM statement_timestamp() AT TIME ZONE 'UTC')::int*60+
          EXTRACT(MINUTE FROM statement_timestamp() AT TIME ZONE 'UTC')::int+10)%1440,
        window_end_minute=(EXTRACT(HOUR FROM statement_timestamp() AT TIME ZONE 'UTC')::int*60+
          EXTRACT(MINUTE FROM statement_timestamp() AT TIME ZONE 'UTC')::int+20)%1440`);
      const before = await snapshot(), result = await claim(db, state.revision);
      const allowed = ['exhausted', 'ignored_future'].includes(kind);
      if (allowed) expect(result).toHaveProperty('attemptId'); else expect(result).toBeNull();
      expect(await snapshot()).toEqual(before ? { ...before, finalization_attempt_id: result?.attemptId ?? null } : undefined);
    } finally { await db.pool.end(); }
  });

test('precommit stop rolls a real claim back under inherited isolation and existing limits', async () => {
  const db = createReadinessDatabase({ max: 1 }), budget = createAdjudicationBudgetRepository(db), stop = new AbortController();
  try {
    const state = await budget.configure(options), client = await db.pool.connect();
    await client.query("SET default_transaction_isolation='repeatable read'"); client.release();
    await expect(db.withSessionAdvisoryLock(INVENTORY_DISCOVERY_LOCK, async scope => {
      const queryInScope = async (...args) => {
        const result = await scope.query(...args);
        if (args[0].startsWith('UPDATE adjudication_capture_budget SET finalization_attempt_id')) {
          expect((await scope.query('SHOW transaction_isolation')).rows[0].transaction_isolation).toBe('repeatable read');
          expect((await scope.query('SHOW statement_timeout')).rows[0].statement_timeout).toBe('15s');
          expect((await scope.query('SHOW lock_timeout')).rows[0].lock_timeout).toBe('1s');
          stop.abort();
        }
        return result;
      };
      await createAdjudicationFinalizationClaim({ query: queryInScope, signal: stop.signal })(state.revision);
    })).rejects.toThrow();
    expect((await snapshot()).finalization_attempt_id).toBeNull();
  } finally { await db.pool.end(); }
});

test('configuration changes invalidate claims while rollover and same-revision advance preserve them', async () => {
  const db = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
  try {
    const state = await budget.configure(options), first = await claim(db, state.revision);
    await query("UPDATE adjudication_capture_budget SET quota_day=(statement_timestamp() AT TIME ZONE 'UTC')::date-1");
    await budget.read(); await budget.advance(state.revision, 48);
    expect((await snapshot()).finalization_attempt_id).toBe(first.attemptId);
    const configured = await budget.configure(options);
    expect((await snapshot()).finalization_attempt_id).toBeNull();
    const second = await claim(db, configured.revision); expect(second.attemptId).not.toBe(first.attemptId);
    await createEvaluationWorkloadRepository(db).configure({ revision: configured.revision, mode: 'when_idle',
      dailyRequests: 5, startMinute: null, endMinute: null });
    expect((await snapshot()).finalization_attempt_id).toBeNull();
    const current = await budget.read(), third = await claim(db, current.revision);
    await query('DELETE FROM adjudication_capture_budget'); await budget.configure(options);
    const recreated = await claim(db, 1); expect(recreated.attemptId).not.toBe(third.attemptId);
    expect((await budget.finish(current.revision, 'unavailable', null, undefined, third.attemptId)).rowCount).toBe(0);
  } finally { await db.pool.end(); }
});

test('replacement owner rejects an unobserved old finish without changing charged state or cache', async () => {
  const db = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
  try {
    const state = await budget.configure(options), first = await claim(db, state.revision);
    await budget.reserve(state.revision);
    const second = await claim(db, state.revision);
    expect(second.attemptId).not.toBe(first.attemptId);
    const before = await snapshot();
    // Outside the old ALS scope: local observed-loss checks cannot supply this protection.
    expect((await budget.finish(state.revision, 'unavailable', null, undefined, first.attemptId)).rowCount).toBe(0);
    expect(await snapshot()).toEqual(before);
    expect((await budget.finish(state.revision, 'captured', 'a'.repeat(64), undefined, second.attemptId)).rowCount).toBe(1);
    const completed = await snapshot();
    expect(completed).toMatchObject({ finalization_attempt_id: second.attemptId, calls_reserved: 1, tokens_reserved: 8448, status: 'captured' });
    expect((await budget.finish(state.revision, 'unavailable', null, undefined, second.attemptId)).rowCount).toBe(1);
    expect(() => budget.finish(state.revision, 'captured')).toThrow('adjudication_claim_invalid');
    expect(await budget.read()).not.toHaveProperty('finalization_attempt_id');
  } finally { await db.pool.end(); }
});

test('a blocked owner claim cannot outlive session termination and replace the new owner', async () => {
  const db = createReadinessDatabase(), other = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
  const blocker = await getPool().connect(); let execution;
  try {
    const state = await budget.configure(options);
    await blocker.query('BEGIN'); await blocker.query('SELECT singleton FROM adjudication_capture_budget FOR UPDATE');
    let pid;
    execution = Promise.allSettled([db.withSessionAdvisoryLock(INVENTORY_DISCOVERY_LOCK, async scope => {
      pid = (await scope.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      return createAdjudicationFinalizationClaim(scope)(state.revision);
    })]);
    await until(async () => pid && (await query("SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'", [pid])).rowCount === 1);
    await query('SELECT pg_terminate_backend($1)', [pid]);
    expect((await execution)[0].status).toBe('rejected');
    await blocker.query('ROLLBACK');
    const replacement = await claim(other, state.revision);
    expect((await snapshot()).finalization_attempt_id).toBe(replacement.attemptId);
  } finally { await blocker.query('ROLLBACK'); blocker.release(); await execution; await db.pool.end(); await other.pool.end(); }
});

test.each(['delay', 'lost'])('a committed claim with %s acknowledgement confers no recovered authority after lease loss', async mode => {
  const db = createReadinessDatabase(), other = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
  const committed = deferred(), release = deferred(); let execution, pid;
  try {
    const state = await budget.configure(options), client = await db.pool.connect(), native = client.query.bind(client);
    const spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0] === 'COMMIT') { committed.resolve(); await release.promise; if (mode === 'lost') throw Error('PRIVATE lost acknowledgement'); }
      return result;
    });
    pid = client.processID; client.release();
    execution = Promise.allSettled([claim(db, state.revision)]); await committed.promise;
    expect((await snapshot()).finalization_attempt_id).toMatch(/^[a-f0-9-]{36}$/);
    await query('SELECT pg_terminate_backend($1)', [pid]);
    const replacement = await claim(other, state.revision);
    release.resolve(); expect((await execution)[0].status).toBe('rejected');
    expect((await snapshot()).finalization_attempt_id).toBe(replacement.attemptId); spy.mockRestore();
  } finally { release.resolve(); await execution; await db.pool.end(); await other.pool.end(); }
});

test('lock proof refuses a different backend and a claim operation cannot be replayed', async () => {
  const db = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
  try {
    const state = await budget.configure(options), client = await db.pool.connect();
    try {
      const operation = createAdjudicationFinalizationClaim({ query: client.query.bind(client) });
      expect(await operation(state.revision)).toBeNull();
      await expect(operation(state.revision)).rejects.toThrow('already_attempted');
      expect((await snapshot()).finalization_attempt_id).toBeNull();
    } finally { client.release(); }
  } finally { await db.pool.end(); }
});

test('claim checks cooldown after serialization and preserves inherited isolation', async () => {
  const db = createReadinessDatabase({ max: 1 }), budget = createAdjudicationBudgetRepository(db), blocker = await getPool().connect();
  let execution, pid;
  try {
    const state = await budget.configure(options);
    await blocker.query('BEGIN'); await blocker.query("UPDATE adjudication_capture_budget SET next_check_at=statement_timestamp()+interval '20 minutes'");
    execution = Promise.allSettled([db.withSessionAdvisoryLock(INVENTORY_DISCOVERY_LOCK, async scope => {
      pid = (await scope.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      expect((await scope.query('SHOW transaction_isolation')).rows[0].transaction_isolation).toBe('read committed');
      return createAdjudicationFinalizationClaim(scope)(state.revision);
    })]);
    await until(async () => pid && (await query("SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'", [pid])).rowCount === 1);
    await blocker.query('COMMIT'); expect((await execution)[0]).toMatchObject({ status: 'fulfilled', value: true });
    expect((await snapshot()).finalization_attempt_id).toBeNull();
    await query('UPDATE adjudication_capture_budget SET next_check_at=statement_timestamp()');
    const client = await db.pool.connect(); await client.query("SET default_transaction_isolation='repeatable read'"); client.release();
    expect(await claim(db, state.revision)).toHaveProperty('attemptId');
  } finally { await blocker.query('ROLLBACK'); blocker.release(); await execution; await db.pool.end(); }
});

test.each(['merge', 'replace'])('%s restore invalidates authority atomically while preserving the other budget fields', async mode => {
  const db = createReadinessDatabase(), budget = createAdjudicationBudgetRepository(db);
  try {
    const state = await budget.configure(options); await claim(db, state.revision); await budget.reserve(state.revision);
    const before = await snapshot();
    await expect(db.withTransaction(async client => { await restoreAllTables(client, { data: {} }, mode); throw Error('fixture rollback'); })).rejects.toThrow('fixture rollback');
    expect(await snapshot()).toEqual(before);
    await db.withTransaction(client => restoreAllTables(client, { data: {} }, mode));
    expect(await snapshot()).toEqual({ ...before, finalization_attempt_id: null });
  } finally { await db.pool.end(); }
});
