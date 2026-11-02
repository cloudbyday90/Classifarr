/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createAdjudicationBudgetWorkerFixture } from '../helpers/adjudicationBudgetWorkerFixture.mjs';
import { claimReservationOwner } from '../helpers/adjudicationReservationFixture.mjs';
import { createFinalizationFixtureBudget } from '../helpers/adjudicationFinalizationFixture.mjs';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { captureCachedAdjudication } from '../../services/cachedAdjudicationCapture.mjs';
import { projectAdjudicationConfig } from '../../services/cachedAdjudicationRepository.mjs';
import { createLocalDescriptionBenchmarkClient } from '../../services/localDescriptionBenchmarkClient.mjs';

const query = (...args) => getPool().query(...args);
const snapshot = async () => ({ budget: (await query('SELECT * FROM adjudication_capture_budget')).rows,
  cached: (await query('SELECT * FROM cached_adjudication_batch')).rows });
beforeEach(async () => { await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

// Synthetic initial authority isolates the worker/HTTP boundary; real claim ordering has its own suite.
test.each(['open', 'record', 'publish'])('replacement before %s prevents stale saving without refund or another HTTP generation', async stage => {
  const f = await createAdjudicationBudgetWorkerFixture(), db = createReadinessDatabase();
  const budget = createFinalizationFixtureBudget(db), model = 'synthetic:latest', digest = 'a'.repeat(64);
  let generations = 0, client, worker, checkpointSpy, finishSpy, replacement;
  const server = createServer((request, response) => {
    request.resume(); response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/generate') {
      expect(request.method).toBe('POST'); generations++;
      response.end(JSON.stringify({ model, response: '{"decision":"ABSTAIN","library_number":null}', done: true,
        done_reason: 'stop', prompt_eval_count: 10, eval_count: 10 }));
    } else response.end(JSON.stringify(request.url === '/api/tags' ? { models: [{ name: model, digest }] }
      : { capabilities: ['completion'], model_info: { 'general.architecture': 'synthetic', 'synthetic.context_length': 8192 } }));
  });
  try {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    await budget.configure({ dailyCalls: 1, dailyTokens: 8448 });
    const config = { primary_provider: 'ollama', ollama_host: '127.0.0.1', ollama_port: server.address().port, ollama_model: model };
    f.snapshot.inputs.source.adjudicationConfig = projectAdjudicationConfig(config);
    const nativeCheckpoint = budget.checkpoint;
    checkpointSpy = jest.spyOn(budget, 'checkpoint').mockImplementation((revision, attemptId) => {
      const checkpoint = nativeCheckpoint(revision, attemptId), operation = checkpoint[stage];
      return { ...checkpoint, [stage]: async (...args) => {
        await claimReservationOwner(db, revision); replacement = await snapshot(); return operation(...args);
      } };
    });
    finishSpy = jest.spyOn(budget, 'finish');
    const plan = [{ key: 'c'.repeat(64), prompt: 'Synthetic comparison', count: 2 }];
    const runThread = async supplied => {
      const cached = new Set(supplied.inputs.source.adjudicationBatch?.records.map(row => row.key) ?? []);
      return { ...f.prepared, plan, captureAdmission: [{ item: 'b'.repeat(64), mediaType: 'movie', stratum: 'a'.repeat(64),
        arms: [0, 1].map(() => ({ key: plan[0].key, gap: cached.has(plan[0].key) ? 'none' : 'cache_missing' })) }] };
    };
    worker = createAdjudicationBudgetWorker({ ...f.dependencies, budget, readConfig: async () => config,
      createClient: () => { client = createLocalDescriptionBenchmarkClient(config); return client; },
      capture: (input, dependencies) => captureCachedAdjudication(input, { ...dependencies, runThread }) });
    expect(await worker.run()).toEqual({ status: 'deferred' });
    expect(generations).toBe(stage === 'open' ? 0 : 1);
    expect(replacement.budget[0]).toMatchObject({ calls_reserved: generations, tokens_reserved: generations * 8448 });
    expect(replacement.cached).toEqual([]); expect(await snapshot()).toEqual(replacement);
    expect(finishSpy).not.toHaveBeenCalled();
    expect(await worker.run()).toEqual({ status: 'cooldown' });
    expect(generations).toBe(stage === 'open' ? 0 : 1);
  } finally {
    worker?.stop(); checkpointSpy?.mockRestore(); finishSpy?.mockRestore(); await client?.close();
    server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); await db.pool.end();
  }
});
