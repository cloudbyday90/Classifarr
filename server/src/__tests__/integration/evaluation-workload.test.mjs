/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test,expect,beforeEach } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { requireAdmin } from '../../middleware/apiKeyAuth.mjs';
import { registerEvaluationWorkloadRoutes } from '../../routes/statsRouteEvaluationWorkload.mjs';
import { createEvaluationWorkloadRepository } from '../../services/evaluationWorkloadRepository.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';
import { createEvaluationWorkloadGuard } from '../../services/evaluationWorkloadGuard.mjs';
import { createLocalDescriptionBenchmarkClient } from '../../services/localDescriptionBenchmarkClient.mjs';
import { EVALUATION_WINDOW_OPEN_SQL } from '../../services/evaluationWorkloadSql.mjs';

const db = createIntegrationDatabaseModuleMock(), controls = createEvaluationWorkloadRepository(db);
const budget = createAdjudicationBudgetRepository(db);
const input = (revision = 0) => ({ revision,mode: 'when_idle',dailyRequests: 5,startMinute: null,endMinute: null });
beforeEach(async () => { await db.query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

test('status is read-only even on empty setup; CAS, limits, cooldown and reservations survive recreation', async () => {
  expect(await controls.read()).toMatchObject({ mode: 'off',revision: 0 });
  expect((await db.query('SELECT count(*)::int AS n FROM adjudication_capture_budget')).rows[0].n).toBe(0);
  const results = await Promise.allSettled([controls.configure(input()),controls.configure(input())]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(r => r.status === 'rejected').reason.message).toBe('evaluation_workload_conflict');
  await budget.reserve(1); await budget.finish(1,'unavailable');
  const cooldown = (await controls.read()).nextCheckAt;
  const before = (await db.query('SELECT * FROM adjudication_capture_budget')).rows;
  await controls.read(); expect((await db.query('SELECT * FROM adjudication_capture_budget')).rows).toEqual(before);
  await controls.configure({ ...input(1),mode: 'off',dailyRequests: 0 });
  const resumed = await createEvaluationWorkloadRepository(db).configure(input(2));
  expect(resumed).toMatchObject({ revision: 3,requestsReserved: 1,nextCheckAt: cooldown });
  await budget.configure({ dailyCalls: 100,dailyTokens: 16896 });
  expect(await controls.read()).toMatchObject({ dailyRequests: 2,requestsReserved: 1,nextCheckAt: cooldown });
});

test('UTC window boundaries include start, exclude end, support midnight and fence reservations', async () => {
  const clock = (await db.query("SELECT EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC')::int*60+EXTRACT(MINUTE FROM now() AT TIME ZONE 'UTC')::int AS minute")).rows[0].minute;
  const cases = [[clock,(clock+1)%1440,true],[(clock+1439)%1440,clock,false],
    [(clock+1)%1440,(clock+2)%1440,false],[(clock+2)%1440,(clock+1)%1440,true]];
  let revision = 0;
  for (const [startMinute,endMinute,open] of cases) {
    const saved = await controls.configure({ ...input(revision),mode: 'scheduled',startMinute,endMinute });
    revision = saved.revision;
    expect(saved.windowOpen).toBe(open);
    if (open) await budget.reserve(revision);
    else await expect(budget.reserve(revision)).rejects.toThrow('exhausted');
  }
  // Deterministic PostgreSQL clock fixtures prove exact 00:00 and 23:59 boundaries too.
  for (const [at,start,end,expected] of [['2026-10-14 23:59:00+00',1380,120,true],['2026-10-14 00:00:00+00',1380,120,true],
    ['2026-10-14 02:00:00+00',1380,120,false],['2026-10-14 06:00:00+00',360,720,true],['2026-10-14 12:00:00+00',360,720,false]]) {
    const sql = EVALUATION_WINDOW_OPEN_SQL.replaceAll('statement_timestamp()','$1::timestamptz');
    const result = await db.query(`SELECT ${sql} AS open FROM (SELECT 'scheduled'::text AS workload_mode,
      $2::int AS window_start_minute,$3::int AS window_end_minute) fixture`,[at,start,end]);
    expect(result.rows[0].open).toBe(expected);
  }
});

test('migration preserves legacy opt-in and tighter ceilings, is repeatable, and enforces valid windows', async () => {
  await budget.configure({ dailyCalls: 100,dailyTokens: 16896 }); await budget.reserve(1);
  const before = (await db.query('SELECT * FROM adjudication_capture_budget')).rows;
  const sql = await readFile(new URL('../../../../database/migrations/20261014_120000_evaluation_workload_controls.sql',import.meta.url),'utf8');
  await db.query(sql); await db.query(sql);
  expect((await db.query('SELECT * FROM adjudication_capture_budget')).rows).toEqual(before);
  // Reconstruct the preceding table shape only inside this isolated test transaction.
  await db.withTransaction(async client => {
    await client.query('ALTER TABLE adjudication_capture_budget DROP COLUMN workload_mode, DROP COLUMN window_start_minute, DROP COLUMN window_end_minute');
    await client.query(sql);
    const upgraded = (await client.query('SELECT * FROM adjudication_capture_budget')).rows;
    expect(upgraded).toEqual(before);
  });
  for (const assignment of ["workload_mode='unknown'","workload_mode='scheduled'",'window_start_minute=0',
    "workload_mode='scheduled',window_start_minute=0,window_end_minute=0"]) {
    await expect(db.query(`UPDATE adjudication_capture_budget SET ${assignment}`)).rejects.toMatchObject({ code: '23514' });
  }
});

function app(principal) {
  const server = express(), router = express.Router();
  server.use(express.json({ limit: '2kb' }));
  // Fixture principal injection; production router authenticates before these handlers.
  server.use((req,_res,next) => { Object.assign(req,principal); next(); });
  registerEvaluationWorkloadRoutes(router,{ db,requireAdmin,rateLimit });
  server.use('/api/stats',router); return server;
}
test('real HTTP admin authorization, input rejection, no-store reads and stale-write conflict', async () => {
  const url = '/api/stats/evaluation-workload';
  for (const principal of [{},{ user: { role: 'viewer' } },{ apiKey: { permissions: 'read_write' } },{ apiKey: { permissions: 'read_only' } }]) {
    for (const method of ['get','put']) expect((await request(app(principal))[method](url).send(input())).status).toBe(principal.user || principal.apiKey ? 403 : 401);
  }
  const admin = app({ user: { role: 'admin' } });
  expect((await request(admin).get(url).expect(200)).headers['cache-control']).toBe('no-store');
  await request(admin).put(url).send({ ...input(),extra: 'PRIVATE' }).expect(400);
  await request(admin).put(`${url}?run=true`).send(input()).expect(400);
  await request(admin).put(url).send(input()).expect(200);
  await request(admin).put(url).send(input()).expect(409);
  expect((await controls.read()).requestsReserved).toBe(0);
});

test.each(['disable','edit','window','foreground','unknown'])('real HTTP cancellation on %s retains the charged attempt and fences later work', async reason => {
  const saved = await controls.configure(input());
  let entered, closed, readiness = 'ready', calls = 0;
  const started = new Promise(resolve => { entered = resolve; });
  const disconnected = new Promise(resolve => { closed = resolve; });
  const model = 'synthetic:latest', digest = 'a'.repeat(64);
  const server = createServer((req,res) => {
    if (req.url === '/api/generate') { calls++; req.resume(); res.on('close',closed); entered(); return; }
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify(req.url === '/api/tags' ? { models: [{ name: model,digest }] }
      : { capabilities: ['completion'],model_info: { 'general.architecture': 'synthetic','synthetic.context_length': 8192 } }));
  });
  await new Promise(resolve => { server.listen(0,'127.0.0.1',resolve); });
  const guard = createEvaluationWorkloadGuard(db,{ intervalMs: 20,readReadiness: async () => {
    if (readiness === 'unknown') throw new Error('PRIVATE'); return readiness;
  } });
  const client = createLocalDescriptionBenchmarkClient({ primary_provider: 'ollama',ollama_host: '127.0.0.1',ollama_port: server.address().port,ollama_model: model });
  const root = new AbortController(); let execution;
  try {
    execution = guard((signal,check) => client.generate({ prompt: 'Synthetic comparison',count: 2,context: 8192,
      identity: { model,digest,contextLength: 8192 },responseContract: 'adjudication',signal,
      onGenerationCall: async () => { await check(); await budget.reserve(saved.revision,signal); } }),
    { revision: saved.revision,signal: AbortSignal.any([root.signal,AbortSignal.timeout(10000)]) });
    const rejected = expect(execution).rejects.toThrow('evaluation_workload_deferred');
    await Promise.race([started,new Promise((_,reject) => { setTimeout(() => reject(new Error('fixture_not_started')),5000).unref(); })]);
    if (reason === 'disable') await controls.configure({ ...input(1),mode: 'off',dailyRequests: 0 });
    else if (reason === 'edit') await controls.configure({ ...input(1),dailyRequests: 6 });
    // Fixture-only window closure without a revision change isolates the clock gate.
    else if (reason === 'window') await db.query(`UPDATE adjudication_capture_budget SET workload_mode='scheduled',
      window_start_minute=((EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC')::int*60+EXTRACT(MINUTE FROM now() AT TIME ZONE 'UTC')::int)+10)%1440,
      window_end_minute=((EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC')::int*60+EXTRACT(MINUTE FROM now() AT TIME ZONE 'UTC')::int)+20)%1440`);
    else readiness = reason === 'unknown' ? 'unknown' : 'backfilling';
    await rejected;
    await Promise.race([disconnected,new Promise((_,reject) => { setTimeout(() => reject(new Error('http_not_cancelled')),5000).unref(); })]);
    expect(calls).toBe(1); expect((await controls.read()).requestsReserved).toBe(1);
    expect((await db.query('SELECT count(*)::int AS n FROM cached_adjudication_batch')).rows[0].n).toBe(0);
  } finally {
    root.abort(); await execution?.catch(() => {}); // swallow-error: fixture cleanup joins the expected cancellation.
    server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); });
  }
});
