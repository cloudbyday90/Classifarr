/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { runAutomaticSourcePairThread } from '../../services/automaticSourcePairThreadClient.mjs';
import { runSourcePairQualityThread } from '../../services/sourcePairQualityThreadClient.mjs';
import { createEvidenceBudgetError, INVENTORY_PROFILE_FEATURE_BUDGET, isEvidenceBudgetError } from '../../services/evaluationEvidenceBudget.mjs';
import { computeAutomaticSourcePair } from '../../services/automaticSourcePairComputation.mjs';
import { sourcePairFixture, sourcePairIdentity, sourcePairProfileBudgetSnapshot } from '../fixtures/sourceDescriptionPairFixture.mjs';
import { sourcePairThreadFailure } from '../../services/automaticSourcePairThreadFailure.mjs';

const snapshot = () => ({ observedAt: '2026-09-25 01:00:00+00', inputs: { source: sourcePairFixture(), identity: sourcePairIdentity } });
function acknowledgeTransfer(worker) {
  let count = 0;
  worker.emit('message', { kind: 'evaluation_vectors_ready' });
  while (worker.postMessage.mock.calls.at(-1)[0].kind === 'evaluation_vectors') {
    const message = worker.postMessage.mock.calls.at(-1)[0];
    count += message.entries.length;
    worker.emit('message', { kind: 'evaluation_vectors_ack', sequence: message.sequence, count });
  }
}
test('real fixed ESM worker returns only bounded aggregates and terminates', async () => {
  const result = await runAutomaticSourcePairThread(snapshot(), null);
  expect(result.report).toMatchObject({ status: 'complete', sampled: 48, limits: { providerCalls: 0, routingWrites: 0 } });
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

test.each([false, true])('real learned-profile overflow retains its proof only for automatic evaluation (capture=%s)', async includePlan => {
  const error = await runAutomaticSourcePairThread(sourcePairProfileBudgetSnapshot(), null, undefined, { includePlan }).catch(error => error);
  expect(error).toHaveProperty('message', includePlan ? 'automatic_source_pair_worker_unavailable' : INVENTORY_PROFILE_FEATURE_BUDGET);
  expect(isEvidenceBudgetError(error, INVENTORY_PROFILE_FEATURE_BUDGET)).toBe(!includePlan);
  expect(error).not.toHaveProperty('cause');
});

test('private worker failure uses the minted limit rather than mutable message text', () => {
  expect(sourcePairThreadFailure(new Error(INVENTORY_PROFILE_FEATURE_BUDGET), false)).toEqual({ failed: true });
  const otherBudget = createEvidenceBudgetError('evaluation_vector_budget');
  otherBudget.message = INVENTORY_PROFILE_FEATURE_BUDGET;
  expect(sourcePairThreadFailure(otherBudget, false)).toEqual({ failed: true });
  const profileBudget = createEvidenceBudgetError(INVENTORY_PROFILE_FEATURE_BUDGET);
  profileBudget.message = 'PRIVATE';
  expect(sourcePairThreadFailure(profileBudget, false)).toEqual({ failure: INVENTORY_PROFILE_FEATURE_BUDGET });
});

test.each(['valid', 'early', 'unknown', 'mixed', 'extra', 'accessor', 'capture', 'after abort'])(
  'worker failure frame requires complete transfer and exact shape (%s)', async variant => {
    let worker;
    class FakeWorker extends EventEmitter {
      constructor() {
        super();
        worker = this;
        this.terminate = jest.fn(async () => 0);
        this.postMessage = jest.fn();
      }
    }
    const controller = new AbortController();
    const promise = runAutomaticSourcePairThread(snapshot(), null, controller.signal, {
      WorkerClass: FakeWorker, includePlan: variant === 'capture',
    }).catch(error => error);
    if (variant !== 'early') acknowledgeTransfer(worker);
    const message = { failure: INVENTORY_PROFILE_FEATURE_BUDGET };
    if (variant === 'unknown') message.failure = 'PRIVATE';
    if (variant === 'mixed') message.result = computeAutomaticSourcePair(snapshot(), null);
    if (variant === 'extra') message.extra = 'PRIVATE';
    if (variant === 'accessor') Object.defineProperty(message, 'failure', { get() { throw new Error('PRIVATE'); } });
    if (variant === 'after abort') controller.abort();
    worker.emit('message', message);
    const error = await promise;
    const expected = variant === 'valid' ? INVENTORY_PROFILE_FEATURE_BUDGET
      : variant === 'after abort' ? 'automatic_source_pair_cancelled' : 'automatic_source_pair_worker_unavailable';
    expect(error).toHaveProperty('message', expected);
    expect(isEvidenceBudgetError(error, INVENTORY_PROFILE_FEATURE_BUDGET)).toBe(variant === 'valid');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  },
);

test.each(['abort', 'deadline', 'error', 'exit', 'invalid', 'success'])('worker %s always joins and strips error text', async mode => {
  let instance, options;
  class FakeWorker extends EventEmitter {
    constructor(_url, supplied) {
      super(); instance = this; options = supplied;
      this.stdout = { resume: jest.fn() }; this.stderr = { resume: jest.fn() }; this.terminate = jest.fn(async () => 0);
      this.postMessage = jest.fn();
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
  if (mode === 'success') { acknowledgeTransfer(instance); instance.emit('message', { result: computeAutomaticSourcePair(snapshot(), null) }); }
  await assertion;
  expect(instance.terminate).toHaveBeenCalledTimes(1);
  expect(options).toMatchObject({ env: { LOG_LEVEL: 'fatal', FILE_LOGGING_ENABLED: 'false' }, execArgv: [], stdout: true, stderr: true, resourceLimits: { maxOldGenerationSizeMb: 512 } });
});

test('refuses pre-cancelled and over-budget work before creating a worker', async () => {
  const WorkerClass = jest.fn(), controller = new AbortController(); controller.abort();
  await expect(runAutomaticSourcePairThread(snapshot(), null, controller.signal, { WorkerClass })).rejects.toThrow();
  const oversized = { private: 'x'.repeat(65 * 1024 * 1024) };
  const pair = await runAutomaticSourcePairThread(oversized, null, undefined, { WorkerClass }).catch(error => error);
  const quality = await runSourcePairQualityThread(oversized, null, null, { WorkerClass }).catch(error => error);
  expect(pair).toHaveProperty('message', 'automatic_source_pair_input_budget');
  expect(quality).toHaveProperty('message', 'quality_input_budget');
  expect(isEvidenceBudgetError(pair)).toBe(true);
  expect(isEvidenceBudgetError(quality)).toBe(true);
  expect(WorkerClass).not.toHaveBeenCalled();
});

test.each(['missing', 'invalid', 'unexpected', 'valid'])('private capture admission boundary: %s', async mode => {
  let worker;
  class FakeWorker extends EventEmitter {
    constructor() { super(); worker = this; this.terminate = jest.fn(async () => 0); this.postMessage = jest.fn(); }
  }
  const result = computeAutomaticSourcePair(snapshot(), null);
  if (mode !== 'unexpected') result.plan = [];
  if (mode !== 'missing') result.captureAdmission = mode === 'invalid' ? [{ private: 'PRIVATE' }] : [];
  const promise = runAutomaticSourcePairThread(snapshot(), null, undefined, { WorkerClass: FakeWorker, includePlan: mode !== 'unexpected' });
  const assertion = mode === 'valid' ? expect(promise).resolves.toMatchObject({ plan: [], captureAdmission: [] })
    : expect(promise).rejects.toThrow('automatic_source_pair_worker_unavailable');
  acknowledgeTransfer(worker);
  worker.emit('message', { result });
  await assertion;
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});
