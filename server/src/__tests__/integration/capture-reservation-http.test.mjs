/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { createServer } from 'node:http';
import { getPool } from './setup.mjs';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { reservationFixture, reservationDeferred as deferred, claimReservationOwner, reservationSnapshot } from '../helpers/adjudicationReservationFixture.mjs';
import { createAdjudicationBudgetFinalization } from '../../services/adjudicationBudgetFinalization.mjs';
import { createLocalDescriptionBenchmarkClient } from '../../services/localDescriptionBenchmarkClient.mjs';

beforeEach(async () => { await getPool().query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch'); });

test.each(['refused', 'lost', 'delayed'])(
  'real generation HTTP respects a %s reservation outcome without refund or replay', async mode => {
    const f = await reservationFixture({ max: 1 }), next = createReadinessDatabase();
    const helper = createAdjudicationBudgetFinalization(f.budget), committed = deferred(), acknowledge = deferred();
    const model = 'synthetic:latest', digest = 'a'.repeat(64); let calls = 0, client, spy, execution;
    const server = createServer((request, response) => {
      request.resume(); response.setHeader('Content-Type', 'application/json');
      if (request.url === '/api/generate') {
        calls++; response.end(JSON.stringify({ model, response: '{"decision":"ABSTAIN","library_number":null}',
          done: true, done_reason: 'stop', prompt_eval_count: 10, eval_count: 10 })); return;
      }
      response.end(JSON.stringify(request.url === '/api/tags' ? { models: [{ name: model, digest }] }
        : { capabilities: ['completion'], model_info: { 'general.architecture': 'synthetic', 'synthetic.context_length': 8192 } }));
    });
    try {
      await helper.claim(f.state.revision, async () => f.owner);
      await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
      client = createLocalDescriptionBenchmarkClient({ primary_provider: 'ollama', ollama_host: '127.0.0.1',
        ollama_port: server.address().port, ollama_model: model });
      const generate = () => client.generate({ prompt: 'Synthetic comparison', count: 2, context: 8192,
        identity: { model, digest, contextLength: 8192 }, responseContract: 'adjudication',
        onGenerationCall: () => helper.reserve(f.state.revision) });
      if (mode === 'refused') {
        await claimReservationOwner(next, f.state.revision);
        const before = await reservationSnapshot();
        await expect(generate()).rejects.toThrow('not_owned');
        expect(helper.notApplied).toBe(true); expect(calls).toBe(0); expect(await reservationSnapshot()).toEqual(before);
      } else {
        const connection = await f.db.pool.connect(), native = connection.query.bind(connection);
        spy = jest.spyOn(connection, 'query').mockImplementation(async (...args) => {
          const result = await native(...args);
          if (args[0] === 'COMMIT') {
            committed.resolve(); await acknowledge.promise;
            if (mode === 'lost') throw Error('PRIVATE simulated lost reservation acknowledgement');
          }
          return result;
        }); connection.release();
        execution = Promise.allSettled([generate()]); await committed.promise;
        expect((await reservationSnapshot())[0]).toMatchObject({ calls_reserved: 1, tokens_reserved: 8448 }); expect(calls).toBe(0);
        const replacement = await claimReservationOwner(next, f.state.revision);
        acknowledge.resolve(); const result = (await execution)[0];
        expect(result.status).toBe(mode === 'lost' ? 'rejected' : 'fulfilled');
        expect(calls).toBe(mode === 'lost' ? 0 : 1); expect(helper.notApplied).toBe(false);
        expect((await reservationSnapshot())[0]).toMatchObject({ calls_reserved: 1, tokens_reserved: 8448,
          finalization_attempt_id: replacement.attemptId });
        await expect(generate()).rejects.toThrow('not_owned'); // No second charge or POST under the old authority.
        expect(calls).toBe(mode === 'lost' ? 0 : 1);
        expect((await reservationSnapshot())[0].calls_reserved).toBe(1);
      }
    } finally {
      acknowledge.resolve(); await execution; spy?.mockRestore(); client?.close();
      server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); });
      await f.db.pool.end(); await next.pool.end();
    }
  });
