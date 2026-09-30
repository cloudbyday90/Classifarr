/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { createOllamaReadinessBackfill } from '../../services/ollamaReadinessBackfill.mjs';
import { registerOllamaReadinessBackfillSchedule } from '../../services/ollamaReadinessBackfillScheduler.mjs';
import { readInventoryBackgroundReadiness } from '../../services/inventoryBackgroundReadiness.mjs';
import { buildSchedulerExecutionReceipt } from '../../services/schedulerExecutionReceipt.mjs';

function fixture(extra = {}) {
  const configuration = { primary_provider: 'ollama', ollama_host: 'saved-host', ollama_model: 'saved-model',
    configuration_revision: 2, ollama_verification_capability_checked_at: null };
  const controller = new AbortController(), release = jest.fn(), events = [];
  const client = { preflightConnection: jest.fn(async () => ({ success: true,
    models: [{ name: 'saved-model', digest: 'a'.repeat(64) }] })),
  generate: jest.fn(async () => '{"status":"ready","contract":"candidate-bound-verification"}') };
  const options = {
    database: { withSessionAdvisoryLock: jest.fn(async (_key, fn) => { await fn({ signal: controller.signal }); return true; }),
      withTransaction: jest.fn(async fn => { events.push('transaction'); return fn({ query: jest.fn() }); }) },
    load: jest.fn(async () => configuration), readiness: jest.fn(async () => 'ready'),
    admission: { tryAcquire: jest.fn(() => ({ allowed: true, release })) },
    createClient: jest.fn(() => client), persist: jest.fn(async ({ outcome }) => {
      configuration.ollama_verification_capability_checked_at = outcome.checkedAt;
      return configuration;
    }), history: jest.fn(), logger: { warn: jest.fn() }, ...extra,
  };
  const worker = createOllamaReadinessBackfill(options);
  return { worker, configuration, controller, release, client, events, options };
}

test('legacy config runs the real fixed probe once, saves only missing evidence and stays done after restart', async () => {
  const f = fixture();
  expect(await f.worker.run()).toEqual({ status: 'completed', readiness: 'verification_ready' });
  expect(f.options.readiness).toHaveBeenCalledWith(f.options.database, { requireRag: false });
  expect(f.options.createClient).toHaveBeenCalledWith({ configuration: f.configuration });
  expect(f.client.preflightConnection).toHaveBeenCalledWith(expect.objectContaining({ connectivityTimeoutMs: 5000 }));
  expect(f.client.generate).toHaveBeenCalledWith(expect.any(String), 'saved-model', 0,
    expect.objectContaining({ timeoutMs: 60000, think: false, format: expect.any(Object) }));
  expect(f.options.persist).toHaveBeenCalledWith(expect.objectContaining({ onlyIfNeverChecked: true,
    outcome: expect.objectContaining({ modelDigest: 'a'.repeat(64) }) }));
  expect(await createOllamaReadinessBackfill(f.options).run()).toEqual({ status: 'deferred', reason: 'already_checked' });
  expect(f.client.generate).toHaveBeenCalledTimes(1); expect(f.release).toHaveBeenCalledTimes(1);
});

test.each([null, {}, { primary_provider: 'openai' }, { primary_provider: 'ollama', ollama_host: '', ollama_model: 'm' },
  { primary_provider: 'ollama', ollama_host: 'h', ollama_model: ' ' },
  { primary_provider: 'ollama', ollama_verification_capability_checked_at: '2020-01-01' }])('ineligible saved config stays inert: %j', async configuration => {
  const f = fixture({ load: jest.fn(async () => configuration) });
  expect((await f.worker.run()).status).toBe('deferred');
  expect(f.options.readiness).not.toHaveBeenCalled(); expect(f.options.createClient).not.toHaveBeenCalled();
});

test.each(['waiting_for_libraries', 'waiting_for_inventory', 'ingesting', 'backfilling', 'unavailable'])('waits without model calls while %s', async state => {
  const f = fixture({ readiness: jest.fn(async () => state) });
  expect(await f.worker.run()).toEqual({ status: 'deferred', reason: state });
  expect(f.options.database.withSessionAdvisoryLock).not.toHaveBeenCalled();
  expect(f.options.createClient).not.toHaveBeenCalled();
  f.options.readiness.mockResolvedValue('ready');
  expect((await f.worker.run()).status).toBe('completed');
});

test.each(['busy', 'memory_pressure', 'memory_unknown'])('resource admission defers %s', async reason => {
  const f = fixture({ admission: { tryAcquire: () => ({ allowed: false, reason }) } });
  expect(await f.worker.run()).toEqual({ status: 'deferred', reason });
  expect(f.options.createClient).not.toHaveBeenCalled();
});

test('lock contention and one-connection pools do not start remote work', async () => {
  const f = fixture(); f.options.database.withSessionAdvisoryLock.mockResolvedValue(false);
  expect(await f.worker.run()).toEqual({ status: 'deferred', reason: 'busy' });
  expect(f.release).toHaveBeenCalledTimes(1);
  f.options.database.pool = { options: { max: 1 } };
  expect(await f.worker.run()).toEqual({ status: 'deferred', reason: 'database_capacity' });
  expect(f.options.createClient).not.toHaveBeenCalled();
});

test('rereads eligibility and readiness under session ownership', async () => {
  const f = fixture();
  f.options.load.mockResolvedValueOnce(f.configuration).mockResolvedValueOnce({ primary_provider: 'openai' });
  expect((await f.worker.run()).reason).toBe('not_applicable');
  f.options.readiness.mockResolvedValueOnce('ready').mockResolvedValueOnce('ingesting');
  expect((await f.worker.run()).reason).toBe('ingesting');
  expect(f.options.createClient).not.toHaveBeenCalled(); expect(f.release).toHaveBeenCalledTimes(2);
});

test.each(['unavailable', 'classification_only'])('records %s without blessing readiness or retrying on restart', async status => {
  const f = fixture();
  if (status === 'unavailable') f.client.preflightConnection.mockRejectedValue(new Error('private endpoint'));
  else f.client.generate.mockResolvedValue('private malformed output');
  expect(await f.worker.run()).toEqual({ status: 'completed', readiness: status });
  expect((await createOllamaReadinessBackfill(f.options).run()).reason).toBe('already_checked');
  expect(JSON.stringify(f.options.persist.mock.calls)).not.toContain('private');
});

test.each(['stop', 'lease'])('single flight joins transport and withholds publication after %s', async kind => {
  const f = fixture(); let finish, entered;
  const started = new Promise(resolve => { entered = resolve; });
  f.client.generate.mockImplementation(() => { entered(); return new Promise(resolve => { finish = resolve; }); });
  const first = f.worker.run(); expect(f.worker.run()).toBe(first); await started;
  if (kind === 'stop') f.worker.stop(); else f.controller.abort();
  expect(f.release).not.toHaveBeenCalled();
  finish('{"status":"ready","contract":"candidate-bound-verification"}');
  expect(await first).toEqual({ status: 'stopped' });
  expect(f.options.persist).not.toHaveBeenCalled(); expect(f.release).toHaveBeenCalledTimes(1);
  if (kind === 'stop') expect(await f.worker.run()).toEqual({ status: 'stopped' });
});

test('stopping during preflight prevents generation', async () => {
  const f = fixture();
  f.client.preflightConnection.mockImplementation(async () => { f.worker.stop(); return {
    success: true, models: [{ name: 'saved-model', digest: 'a'.repeat(64) }] }; });
  expect((await f.worker.run()).status).toBe('stopped');
  expect(f.client.generate).not.toHaveBeenCalled(); expect(f.options.persist).not.toHaveBeenCalled();
});

test('manual winner is not overwritten or double counted', async () => {
  const f = fixture({ persist: jest.fn(async () => null) });
  expect((await f.worker.run()).reason).toBe('already_checked'); expect(f.options.history).not.toHaveBeenCalled();
});

test('configuration race defers; persistence failure stays retryable and sanitized', async () => {
  const f = fixture();
  f.options.persist.mockRejectedValueOnce(Object.assign(new Error('private'), { code: 'ollama_verification_capability_configuration_changed' }));
  expect((await f.worker.run()).reason).toBe('configuration_changed');
  f.options.persist.mockRejectedValueOnce(new Error('private'));
  expect(await f.worker.run()).toEqual({ status: 'failed', reason: 'readiness_backfill_unavailable' });
  expect((await f.worker.run()).status).toBe('completed');
  expect(f.release).toHaveBeenCalledTimes(3);
});

test('history failure does not erase the saved verdict', async () => {
  const f = fixture({ history: jest.fn(async () => { throw new Error('private'); }) });
  expect((await f.worker.run()).status).toBe('completed');
  expect(f.options.logger.warn).toHaveBeenCalledWith('AI readiness history unavailable', { reason: 'history_unavailable' });
});

test('scheduler owns delay, non-overlap, replacement and fixed failure reporting', async () => {
  const old = { stop: jest.fn() }, worker = { run: jest.fn(async () => ({ status: 'deferred' })), stop: jest.fn() };
  const scheduler = { ollamaReadinessBackfillWorker: old, schedule: jest.fn(), scheduleInitial: jest.fn() };
  registerOllamaReadinessBackfillSchedule(scheduler, { worker });
  expect(old.stop).toHaveBeenCalledTimes(1); expect(scheduler.ollamaReadinessBackfillWorker).toBe(worker);
  const run = scheduler.schedule.mock.calls[0][2];
  expect(scheduler.schedule).toHaveBeenCalledWith('ollama-readiness-backfill', '*/5 * * * *', run, null, { noOverlap: true });
  expect(scheduler.scheduleInitial).toHaveBeenCalledWith('ollama-readiness-backfill', 120000, run);
  expect(buildSchedulerExecutionReceipt({ taskName: 'ollama-readiness-backfill', outcomeId: 'completed' }).taskClass).toBe('observation');
  expect((await run()).status).toBe('deferred');
  worker.run.mockResolvedValue({ status: 'failed', reason: 'private' });
  await expect(run()).rejects.toThrow('ollama_readiness_backfill_unavailable');
});

test('RAG-independent readiness keeps the same ingestion/backfill safety conditions', async () => {
  const query = jest.fn(async () => ({ rows: [{ readiness: 'ready' }] }));
  const database = { withTransaction: fn => fn({ query }) };
  expect(await readInventoryBackgroundReadiness(database)).toBe('ready');
  const normal = query.mock.calls[1][0];
  await readInventoryBackgroundReadiness(database, { requireRag: false });
  const capability = query.mock.calls[3][0];
  expect(normal).toContain('rag_enabled'); expect(capability).not.toContain('rag_enabled');
  expect(normal.replace("WHEN NOT EXISTS (SELECT 1 FROM ai_provider_config WHERE id=1 AND rag_enabled) THEN 'disabled'", '')).toBe(capability);
  await expect(readInventoryBackgroundReadiness(database, { requireRag: 'no' })).rejects.toThrow();
});
