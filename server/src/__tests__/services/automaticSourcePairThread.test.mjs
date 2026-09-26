/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { runAutomaticSourcePairThread } from '../../services/automaticSourcePairThreadClient.mjs';
import { computeAutomaticSourcePair } from '../../services/automaticSourcePairComputation.mjs';
import { sourcePairFixture, sourcePairIdentity } from '../fixtures/sourceDescriptionPairFixture.mjs';

const snapshot = () => ({ observedAt: '2026-09-25 01:00:00+00', inputs: { source: sourcePairFixture(), identity: sourcePairIdentity } });
test('real fixed ESM worker returns only bounded aggregates and terminates', async () => {
  const result = await runAutomaticSourcePairThread(snapshot(), null);
  expect(result.report).toMatchObject({ status: 'complete', sampled: 48, limits: { providerCalls: 0, routingWrites: 0 } });
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

test.each(['abort', 'deadline', 'error', 'exit', 'invalid', 'success'])('worker %s always joins and strips error text', async mode => {
  let instance, options;
  class FakeWorker extends EventEmitter {
    constructor(_url, supplied) {
      super(); instance = this; options = supplied;
      this.stdout = { resume: jest.fn() }; this.stderr = { resume: jest.fn() }; this.terminate = jest.fn(async () => 0);
    }
  }
  const controller = new AbortController();
  const promise = runAutomaticSourcePairThread(snapshot(), null, controller.signal, { WorkerClass: FakeWorker, timeoutMs: 10 });
  const assertion = mode === 'success' ? expect(promise).resolves.toMatchObject({ report: { status: 'complete' } })
    : expect(promise).rejects.toThrow(/automatic_source_pair_(cancelled|deadline|worker_unavailable)/);
  if (mode === 'abort') controller.abort();
  if (mode === 'error') instance.emit('error', new Error('PRIVATE'));
  if (mode === 'exit') instance.emit('exit', 0);
  if (mode === 'invalid') instance.emit('message', { result: { report: { secret: 'PRIVATE' } } });
  if (mode === 'success') instance.emit('message', { result: computeAutomaticSourcePair(snapshot(), null) });
  await assertion;
  expect(instance.terminate).toHaveBeenCalledTimes(1);
  expect(options).toMatchObject({ env: { LOG_LEVEL: 'fatal', FILE_LOGGING_ENABLED: 'false' }, execArgv: [], stdout: true, stderr: true, resourceLimits: { maxOldGenerationSizeMb: 512 } });
});

test('refuses pre-cancelled and over-budget work before creating a worker', async () => {
  const WorkerClass = jest.fn(), controller = new AbortController(); controller.abort();
  await expect(runAutomaticSourcePairThread(snapshot(), null, controller.signal, { WorkerClass })).rejects.toThrow();
  await expect(runAutomaticSourcePairThread({ private: 'x'.repeat(65 * 1024 * 1024) }, null, undefined, { WorkerClass })).rejects.toThrow('input_budget');
  expect(WorkerClass).not.toHaveBeenCalled();
});

test.each(['missing', 'invalid', 'unexpected', 'valid'])('private capture admission boundary: %s', async mode => {
  let worker;
  class FakeWorker extends EventEmitter {
    constructor() { super(); worker = this; this.terminate = jest.fn(async () => 0); }
  }
  const result = computeAutomaticSourcePair(snapshot(), null);
  if (mode !== 'unexpected') result.plan = [];
  if (mode !== 'missing') result.captureAdmission = mode === 'invalid' ? [{ private: 'PRIVATE' }] : [];
  const promise = runAutomaticSourcePairThread(snapshot(), null, undefined, { WorkerClass: FakeWorker, includePlan: mode !== 'unexpected' });
  const assertion = mode === 'valid' ? expect(promise).resolves.toMatchObject({ plan: [], captureAdmission: [] })
    : expect(promise).rejects.toThrow('automatic_source_pair_worker_unavailable');
  worker.emit('message', { result });
  await assertion;
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});
