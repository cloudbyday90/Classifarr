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
import { createLocalDescriptionBenchmarkClient } from '../../services/localDescriptionBenchmarkClient.mjs';

const query = (...args) => getPool().query(...args);
const snapshot = async () => ({ budget: (await query('SELECT * FROM adjudication_capture_budget')).rows,
  cached: (await query('SELECT * FROM cached_adjudication_batch')).rows });
beforeEach(async () => { await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

// Initial authority is explicitly synthetic; replacement uses a real owner-session claim.
test('replacement before advance preserves progress/rotation and starts no provider work or stale cleanup', async () => {
  const f = await createAdjudicationBudgetWorkerFixture(), db = createReadinessDatabase();
  const budget = createFinalizationFixtureBudget(db); let requests = 0, worker, advanceSpy, finishSpy, replacement;
  const server = createServer((request, response) => { requests++; request.resume(); response.end('{}'); });
  const clients = [];
  try {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const state = await budget.configure({ dailyCalls: 5, dailyTokens: 42240 });
    const checkpoint = budget.checkpoint(state.revision), key = 'c'.repeat(64);
    await checkpoint.open([{ key }], { version: 'cached_adjudication.v1', configuration: 'a'.repeat(64),
      identity: { model: 'synthetic:latest', digest: 'b'.repeat(64), contextLength: 8192 }, records: [] });
    await budget.reserve(state.revision);
    await checkpoint.record({ key, generated: { response: 'Synthetic response', latencyMs: 1,
      promptTokens: 10, outputTokens: 10, outputLimitReached: false, contextLimitSuspected: false, inputTruncation: 'unknown' } });
    await checkpoint.publish();
    await query('UPDATE adjudication_capture_budget SET published_fingerprint=$1', [f.evaluation.input_fingerprint]);
    const nativeAdvance = budget.advance;
    advanceSpy = jest.spyOn(budget, 'advance').mockImplementation(async (...args) => {
      await claimReservationOwner(db, args[0]); replacement = await snapshot(); return nativeAdvance(...args);
    });
    finishSpy = jest.spyOn(budget, 'finish');
    const config = { primary_provider: 'ollama', ollama_host: '127.0.0.1', ollama_port: server.address().port, ollama_model: 'synthetic:latest' };
    worker = createAdjudicationBudgetWorker({ ...f.dependencies, budget, readConfig: async () => config,
      capture: captureCachedAdjudication, createClient: () => {
        const client = createLocalDescriptionBenchmarkClient(config); clients.push(client); return client;
      } });
    expect(await worker.run()).toEqual({ status: 'deferred' });
    expect(replacement.budget[0]).toMatchObject({ selection_offset: 0, calls_reserved: 1, tokens_reserved: 8448 });
    expect(replacement.budget[0].progress.records).toHaveLength(1);
    expect(replacement.cached).toHaveLength(1); expect(await snapshot()).toEqual(replacement);
    expect(requests).toBe(0); expect(clients).toHaveLength(0); expect(finishSpy).not.toHaveBeenCalled();
    expect(await worker.run()).toEqual({ status: 'cooldown' }); expect(advanceSpy).toHaveBeenCalledTimes(1);
  } finally {
    worker?.stop(); advanceSpy?.mockRestore(); finishSpy?.mockRestore();
    for (const client of clients) await client.close();
    server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); await db.pool.end();
  }
});
