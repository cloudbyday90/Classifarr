/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { createServer } from 'node:http';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createAdjudicationBudgetWorkerFixture } from '../helpers/adjudicationBudgetWorkerFixture.mjs';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { createFinalizationFixtureBudget as createAdjudicationBudgetRepository } from '../helpers/adjudicationFinalizationFixture.mjs';
import { captureCachedAdjudication } from '../../services/cachedAdjudicationCapture.mjs';
import { projectAdjudicationConfig } from '../../services/cachedAdjudicationRepository.mjs';
import { createLocalDescriptionBenchmarkClient } from '../../services/localDescriptionBenchmarkClient.mjs';

const query = (...args) => getPool().query(...args);
const options = { dailyCalls: 1, dailyTokens: 8448 };
const snapshot = async () => ({ budget: (await query('SELECT * FROM adjudication_capture_budget')).rows,
  cached: (await query('SELECT * FROM cached_adjudication_batch')).rows });
beforeEach(async () => { await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

test('real HTTP capture and cache publication remain charged and saved when the subsequent finish acknowledges zero', async () => {
  const f = await createAdjudicationBudgetWorkerFixture(), db = createReadinessDatabase();
  const budget = createAdjudicationBudgetRepository(db), model = 'synthetic:latest', digest = 'a'.repeat(64);
  let dispatches = 0, client, worker, finish, published, captureFailure;
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json'); request.resume();
    if (request.url === '/api/generate') {
      dispatches++; response.end(JSON.stringify({ model, response: '{"decision":"ABSTAIN","library_number":null}', done: true, done_reason: 'stop',
        prompt_eval_count: 10, eval_count: 10 })); return;
    }
    response.end(JSON.stringify(request.url === '/api/tags' ? { models: [{ name: model, digest }] }
      : { capabilities: ['completion'], model_info: { 'general.architecture': 'synthetic', 'synthetic.context_length': 8192 } }));
  });
  try {
    await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
    await budget.configure(options); finish = jest.spyOn(budget, 'finish');
    const config = { primary_provider: 'ollama', ollama_host: '127.0.0.1', ollama_port: server.address().port, ollama_model: model };
    f.snapshot.inputs.source.adjudicationConfig = projectAdjudicationConfig(config);
    const plan = [{ key: 'c'.repeat(64), prompt: 'Synthetic comparison', count: 2 }];
    const runThread = async supplied => {
      const cached = new Set(supplied.inputs.source.adjudicationBatch?.records.map(row => row.key) ?? []);
      return { ...f.prepared, plan, captureAdmission: [{ item: 'b'.repeat(64), mediaType: 'movie', stratum: 'a'.repeat(64),
        arms: [0, 1].map(() => ({ key: plan[0].key, gap: cached.has(plan[0].key) ? 'none' : 'cache_missing' })) }] };
    };
    f.repository.collectQuality = jest.fn(async supplied => {
      if (supplied.inputs.source.adjudicationBatch?.records.length) {
        await budget.configure(options); published = await snapshot();
      }
    });
    worker = createAdjudicationBudgetWorker({ ...f.dependencies, budget, readConfig: async () => config,
      createClient: () => { client = createLocalDescriptionBenchmarkClient(config); return client; },
      capture: async (input, dependencies) => {
        try { return await captureCachedAdjudication(input, { ...dependencies, runThread }); }
        catch (error) { captureFailure = error; throw error; }
      } });
    const result = await worker.run();
    expect(captureFailure?.message).toBe('adjudication_finalization_not_applied');
    expect(result).toEqual({ status: 'deferred' });
    expect(dispatches).toBe(1); expect(f.repository.collectQuality).toHaveBeenCalledTimes(2);
    expect(finish).toHaveBeenCalledTimes(1); expect((await finish.mock.results[0].value).rowCount).toBe(0);
    expect(published.cached).toHaveLength(1);
    expect(published.cached[0].batch.records).toHaveLength(1);
    expect(published.budget[0]).toMatchObject({ calls_reserved: 1, tokens_reserved: 8448, published_fingerprint: null });
    expect(published.budget[0].progress.records).toHaveLength(1);
    expect(await snapshot()).toEqual(published);
    expect(await worker.run()).toEqual({ status: 'cooldown' }); expect(dispatches).toBe(1);
  } finally {
    worker?.stop(); finish?.mockRestore(); await client?.close();
    server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); await db.pool.end();
  }
});

test('empty-plan capture defers on acknowledged zero without a client, reservation or cache write', async () => {
  const f = await createAdjudicationBudgetWorkerFixture(), db = createReadinessDatabase();
  const budget = createAdjudicationBudgetRepository(db), createClient = jest.fn(), readConfig = jest.fn(); let worker, finish, current;
  try {
    await budget.configure(options); finish = jest.spyOn(budget, 'finish');
    worker = createAdjudicationBudgetWorker({ ...f.dependencies, budget, createClient, readConfig,
      capture: (input, dependencies) => captureCachedAdjudication(input, { ...dependencies, runThread: async () => {
        await budget.configure(options); current = await snapshot();
        return { ...f.prepared, plan: [], captureAdmission: [] };
      } }) });
    expect(await worker.run()).toEqual({ status: 'deferred' });
    expect(finish).toHaveBeenCalledTimes(1); expect((await finish.mock.results[0].value).rowCount).toBe(0);
    expect(createClient).not.toHaveBeenCalled(); expect(readConfig).not.toHaveBeenCalled();
    expect(current.budget[0]).toMatchObject({ calls_reserved: 0, tokens_reserved: 0 });
    expect(current.cached).toHaveLength(0); expect(await snapshot()).toEqual(current);
  } finally { worker?.stop(); finish?.mockRestore(); await db.pool.end(); }
});
