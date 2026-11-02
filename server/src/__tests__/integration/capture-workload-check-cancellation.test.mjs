/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createEvaluationWorkloadGuard } from '../../services/evaluationWorkloadGuard.mjs';
import { createEvaluationWorkloadChecks } from '../../services/evaluationWorkloadChecks.mjs';
import { createEvaluationWorkloadRepository } from '../../services/evaluationWorkloadRepository.mjs';
import { createFinalizationFixtureBudget as createAdjudicationBudgetRepository, seedFixtureReservationAuthority } from '../helpers/adjudicationFinalizationFixture.mjs';
import { createLocalDescriptionBenchmarkClient } from '../../services/localDescriptionBenchmarkClient.mjs';
import { READ_ADJUDICATION_BUDGET_SQL } from '../../services/adjudicationBudgetSql.mjs';
import { INVENTORY_BACKGROUND_READINESS_SQL } from '../../services/inventoryBackgroundReadiness.mjs';

const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const query = (...args) => getPool().query(...args);
let revision;
async function until(predicate) {
  const end = Date.now() + 5000;
  do { const answer = await predicate(); if (answer) return answer; await sleep(10); } while (Date.now() < end);
  throw Error('fixture_condition_not_reached');
}
const active = sql => until(async () => (await query(`SELECT pid FROM pg_stat_activity
  WHERE datname=current_database() AND state='active' AND query LIKE $1`, [`${sql.slice(0, 80)}%`])).rows[0]?.pid);
const gone = pid => until(async () => !(await query('SELECT 1 FROM pg_stat_activity WHERE pid=$1', [pid])).rows.length);

beforeEach(async () => {
  await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch');
  await query('DELETE FROM task_queue');
  await query('UPDATE libraries SET is_active=false');
  await query('UPDATE media_server SET is_active=false');
  await query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
  const { rows: [server] } = await query(`INSERT INTO media_server(type,name,url,api_key)
    VALUES('jellyfin',$1::text,'http://synthetic.invalid/'||$1::text,'fixture-only') RETURNING id`, [randomUUID()]);
  const { rows: [library] } = await query(`INSERT INTO libraries(name,external_id,media_type,media_server_id)
    VALUES($1,$1,'movie',$2) RETURNING id`, [randomUUID(), server.id]);
  await query(`INSERT INTO library_ingestion_state(library_id,run_id,phase,backfill_run_id,backfill_completed_at)
    VALUES($1,$2,'complete',$2,now())`, [library.id, randomUUID()]);
  await query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type)
    VALUES($1,$2,'fixture','Synthetic','movie')`, [server.id, library.id]);
  const controls = createEvaluationWorkloadRepository({ withTransaction: async callback => {
    const client = await getPool().connect();
    try { await client.query('BEGIN'); const value = await callback(client); await client.query('COMMIT'); return value; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } });
  revision = (await controls.configure({ revision: 0, mode: 'when_idle', dailyRequests: 5, startMinute: null, endMinute: null })).revision;
  await seedFixtureReservationAuthority({ query }, revision);
  expect((await query(INVENTORY_BACKGROUND_READINESS_SQL)).rows[0].readiness).toBe('ready');
});

test('both checks are actually read-only and leave the budget unchanged', async () => {
  const db = createReadinessDatabase(), observed = [];
  const before = (await query('SELECT * FROM adjudication_capture_budget')).rows;
  const scoped = { withTransaction: (callback, options) => db.withTransaction(async client => {
    observed.push((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only);
    return callback(client);
  }, options) };
  try {
    const guard = createEvaluationWorkloadGuard(scoped);
    expect(await guard(async (_signal, check) => { await check(); return 7; }, { revision, signal: new AbortController().signal })).toBe(7);
    expect(observed).toEqual(['on', 'on', 'on', 'on']);
    expect((await query('SELECT * FROM adjudication_capture_budget')).rows).toEqual(before);
  } finally { await db.pool.end(); }
});

test('two role slots survive replacements and late grants execute no SQL', async () => {
  const db = createReadinessDatabase({ max: 1 }), held = await db.pool.connect(), root = new AbortController();
  const queries = jest.spyOn(held, 'query'), connect = jest.spyOn(db.pool, 'connect');
  let checks = createEvaluationWorkloadChecks(db, { revision, signal: root.signal }), released = false;
  try {
    const pending = [checks.monitor(), checks.reservation()].map(promise => promise.catch(error => error));
    await until(() => db.pool.waitingCount === 2); root.abort(Error('parent stopped'));
    for (const error of await Promise.all(pending)) expect(error).toBe(root.signal.reason);
    await checks.close();
    for (let pass = 0; pass < 10; pass++) {
      checks = createEvaluationWorkloadChecks(db, { revision, signal: new AbortController().signal });
      const refused = await Promise.all([checks.monitor(), checks.reservation()].map(promise => promise.catch(error => error)));
      expect(refused.map(error => error.message)).toEqual(['evaluation_workload_deferred', 'evaluation_workload_deferred']);
      await checks.close(); expect(db.pool.waitingCount).toBe(2);
    }
    expect(connect).toHaveBeenCalledTimes(2);
    held.release(); released = true; await until(() => db.pool.waitingCount === 0); await sleep(0);
    expect(queries).not.toHaveBeenCalled();
    const guard = createEvaluationWorkloadGuard(db);
    expect(await guard(async (_signal, check) => { await check(); return 'fresh'; }, { revision, signal: new AbortController().signal })).toBe('fresh');
  } finally {
    await checks.close(); if (!released) held.release();
    queries.mockRestore(); connect.mockRestore(); await db.pool.end();
  }
});

test('one three-second acquisition deadline refuses initial work and never resumes a late grant', async () => {
  const db = createReadinessDatabase({ max: 1 }), held = await db.pool.connect(), callback = jest.fn();
  const queries = jest.spyOn(held, 'query'), connect = jest.spyOn(db.pool, 'connect');
  let released = false;
  try {
    const started = performance.now(), guard = createEvaluationWorkloadGuard(db);
    await expect(guard(callback, { revision, signal: new AbortController().signal })).rejects.toThrow('evaluation_workload_deferred');
    expect(performance.now() - started).toBeLessThan(5000);
    expect(callback).not.toHaveBeenCalled(); expect(db.pool.waitingCount).toBe(1);
    await expect(guard(callback, { revision, signal: new AbortController().signal })).rejects.toThrow('evaluation_workload_deferred');
    expect(connect).toHaveBeenCalledTimes(1);
    held.release(); released = true; await until(() => db.pool.waitingCount === 0); await sleep(0);
    expect(queries).not.toHaveBeenCalled(); expect(callback).not.toHaveBeenCalled();
  } finally {
    if (!released) held.release(); queries.mockRestore(); connect.mockRestore(); await db.pool.end();
  }
});

test.each([['budget', 'adjudication_capture_budget', READ_ADJUDICATION_BUDGET_SQL], ['readiness', 'libraries', INVENTORY_BACKGROUND_READINESS_SQL]])(
  'parent stop cancels real blocked %s SQL without interrupting another reader', async (_name, table, sql) => {
    const db = createReadinessDatabase(), blocker = await getPool().connect(), root = new AbortController(), reason = Error('parent stopped');
    try {
      // Closed fixture identifiers only, never application/user input.
      await blocker.query('BEGIN'); await blocker.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
      const guard = createEvaluationWorkloadGuard(db), callback = jest.fn();
      const rejected = expect(guard(callback, { revision, signal: root.signal })).rejects.toBe(reason);
      const pid = await active(sql), other = db.query('SELECT pg_sleep(0.1),7 AS ok');
      root.abort(reason); await rejected; await gone(pid);
      expect(callback).not.toHaveBeenCalled(); expect((await other).rows[0].ok).toBe(7);
      expect((await db.query('SELECT 42 AS ok')).rows[0].ok).toBe(42);
    } finally { root.abort(); await blocker.query('ROLLBACK'); blocker.release(); await db.pool.end(); }
  },
);

test('callback completion cancels and drains real monitor and fresh reservation SQL together', async () => {
  const db = createReadinessDatabase(), blocker = await getPool().connect(), entered = deferred(), finish = deferred();
  const root = new AbortController(); let check, fresh, execution;
  try {
    const guard = createEvaluationWorkloadGuard(db, { intervalMs: 20 });
    execution = guard(async (_signal, freshCheck) => { check = freshCheck; entered.resolve(); return finish.promise; }, { revision, signal: root.signal });
    await entered.promise; await blocker.query('BEGIN'); await blocker.query('LOCK TABLE adjudication_capture_budget IN ACCESS EXCLUSIVE MODE');
    await active(READ_ADJUDICATION_BUDGET_SQL); fresh = check().catch(error => error);
    const pids = await until(async () => {
      const rows = (await query(`SELECT pid FROM pg_stat_activity WHERE datname=current_database()
        AND state='active' AND query LIKE $1`, [`${READ_ADJUDICATION_BUDGET_SQL.slice(0, 80)}%`])).rows;
      return rows.length === 2 ? rows.map(row => row.pid) : false;
    });
    const started = performance.now(); finish.resolve(7);
    expect(await execution).toBe(7); expect(performance.now() - started).toBeLessThan(2500);
    expect((await fresh).message).toBe('evaluation_workload_deferred');
    await Promise.all(pids.map(gone)); expect(db.pool.waitingCount).toBe(0);
  } finally {
    root.abort(); finish.resolve(7); await execution?.catch(() => {}); // swallow-error: Own a possible fixture cancellation before releasing its blocker.
    await blocker.query('ROLLBACK'); blocker.release(); await db.pool.end();
  }
});

test.each(['repeatable read', 'serializable'])('%s defaults retain a fresh second transaction', async isolation => {
  const db = createReadinessDatabase({ max: 1 }), client = await db.pool.connect(), observed = [];
  // Closed fixture isolation names only.
  await client.query(`SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL ${isolation}`); client.release();
  const scoped = { withTransaction: (callback, options) => db.withTransaction(async reader => {
    observed.push((await reader.query('SHOW transaction_isolation')).rows[0].transaction_isolation);
    return callback({ query: async (sql, parameters) => {
      const result = await reader.query(sql, parameters);
      if (sql === READ_ADJUDICATION_BUDGET_SQL) {
        await query('UPDATE ai_provider_config SET rag_enabled=false WHERE id=1');
        // The original transaction really retains the old snapshot; the next must not.
        expect((await reader.query('SELECT rag_enabled FROM ai_provider_config WHERE id=1')).rows[0].rag_enabled).toBe(true);
      }
      return result;
    } });
  }, options) };
  try {
    const callback = jest.fn(), guard = createEvaluationWorkloadGuard(scoped);
    await expect(guard(callback, { revision, signal: new AbortController().signal })).rejects.toThrow('evaluation_workload_deferred');
    expect(callback).not.toHaveBeenCalled(); expect(observed).toEqual([isolation, isolation]);
  } finally { await db.pool.end(); }
});

test.each([['budget', 'adjudication_capture_budget', READ_ADJUDICATION_BUDGET_SQL], ['readiness', 'libraries', INVENTORY_BACKGROUND_READINESS_SQL]])(
  '%s retains a shorter inherited server timeout when cancellation control is unavailable', async (_name, table, sql) => {
    class UnavailableClient { constructor() { throw Error('PRIVATE control unavailable'); } }
    const db = createReadinessDatabase({ statementMs: 250, Client: UnavailableClient }), blocker = await getPool().connect();
    try {
      await blocker.query('BEGIN'); await blocker.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
      const started = performance.now(), guard = createEvaluationWorkloadGuard(db);
      const rejected = expect(guard(jest.fn(), { revision, signal: new AbortController().signal })).rejects.toThrow('evaluation_workload_deferred');
      const pid = await active(sql); await rejected; await gone(pid);
      expect(performance.now() - started).toBeLessThan(2500);
      expect((await db.query('SELECT 1 AS ok')).rows[0].ok).toBe(1);
    } finally { await blocker.query('ROLLBACK'); blocker.release(); await db.pool.end(); }
  },
);

test('time spent in the first transaction reduces the actual second server timeout', async () => {
  const db = createReadinessDatabase(), blocker = await getPool().connect();
  let secondTimeout;
  const scoped = { withTransaction: (callback, options) => db.withTransaction(reader => callback({
    query: async (sql, parameters) => {
      if (sql === READ_ADJUDICATION_BUDGET_SQL) await sleep(1800);
      if (sql === INVENTORY_BACKGROUND_READINESS_SQL) {
        secondTimeout = (await reader.query("SELECT setting::int AS timeout FROM pg_settings WHERE name='statement_timeout'")).rows[0].timeout;
      }
      return reader.query(sql, parameters);
    },
  }), options) };
  try {
    await blocker.query('BEGIN'); await blocker.query('LOCK TABLE libraries IN ACCESS EXCLUSIVE MODE');
    const guard = createEvaluationWorkloadGuard(scoped), started = performance.now();
    await expect(guard(jest.fn(), { revision, signal: new AbortController().signal })).rejects.toThrow('evaluation_workload_deferred');
    expect(secondTimeout).toBeGreaterThan(0); expect(secondTimeout).toBeLessThanOrEqual(1200);
    expect(performance.now() - started).toBeLessThan(5000);
  } finally { await blocker.query('ROLLBACK'); blocker.release(); await db.pool.end(); }
});

test('a real blocked monitor deadline cancels HTTP, retains the charged attempt and prevents another dispatch', async () => {
  const db = createReadinessDatabase(), blocker = await getPool().connect(), started = deferred(), closed = deferred();
  const model = 'synthetic:latest', digest = 'a'.repeat(64), root = new AbortController();
  let calls = 0, execution;
  const server = createServer((request, response) => {
    if (request.url === '/api/generate') { calls++; request.resume(); response.on('close', closed.resolve); started.resolve(); return; }
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(request.url === '/api/tags' ? { models: [{ name: model, digest }] }
      : { capabilities: ['completion'], model_info: { 'general.architecture': 'synthetic', 'synthetic.context_length': 8192 } }));
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  const client = createLocalDescriptionBenchmarkClient({ primary_provider: 'ollama', ollama_host: '127.0.0.1', ollama_port: server.address().port, ollama_model: model });
  const budget = createAdjudicationBudgetRepository(db), afterGeneration = jest.fn();
  try {
    const guard = createEvaluationWorkloadGuard(db, { intervalMs: 20 });
    execution = guard(async (signal, check) => {
      const generate = () => client.generate({ prompt: 'Synthetic comparison', count: 2, context: 8192,
        identity: { model, digest, contextLength: 8192 }, responseContract: 'adjudication', signal,
        onGenerationCall: async () => { await check(); await budget.reserve(revision, signal); } });
      await generate(); afterGeneration(); await generate();
    }, { revision, signal: root.signal });
    const rejected = expect(execution).rejects.toThrow('evaluation_workload_deferred');
    await started.promise; await blocker.query('BEGIN'); await blocker.query('LOCK TABLE adjudication_capture_budget IN ACCESS EXCLUSIVE MODE');
    const pid = await active(READ_ADJUDICATION_BUDGET_SQL); await rejected;
    await Promise.race([closed.promise, sleep(5000, undefined, { ref: false }).then(() => { throw Error('http_not_cancelled'); })]);
    await gone(pid); await blocker.query('ROLLBACK');
    expect(calls).toBe(1); expect(afterGeneration).not.toHaveBeenCalled();
    expect((await query('SELECT calls_reserved,tokens_reserved FROM adjudication_capture_budget')).rows[0]).toEqual({ calls_reserved: 1, tokens_reserved: 8448 });
    expect((await query('SELECT count(*)::int AS n FROM cached_adjudication_batch')).rows[0].n).toBe(0);
  } finally {
    root.abort(); await execution?.catch(() => {}); // swallow-error: Join any expected HTTP cancellation during fixture teardown.
    await blocker.query('ROLLBACK'); blocker.release(); client.close();
    server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); await db.pool.end();
  }
});
