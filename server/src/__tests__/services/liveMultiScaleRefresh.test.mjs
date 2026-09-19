/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createLiveMultiScaleRefresh } from '../../services/liveMultiScaleRefresh.mjs';
import { liveFixture } from '../fixtures/liveMultiScaleFixture.mjs';

function setup(extra = {}) {
  const value = liveFixture(); let time = 1_000_000, revision = 0;
  const handle = { retrieve: jest.fn(async () => ({ purpose: 'retrieval_context_only', candidates: [1, 2].map(id => ({ id, evidence: [] })) })) };
  const build = jest.fn(async () => ({ handle, cacheable: true, weight: 1000 }));
  const readState = jest.fn(async () => value.state);
  const repository = { read: jest.fn(async () => value.snapshot) };
  const embedder = { ...value.identity, inspect: jest.fn(async () => value.identity) };
  const worker = createLiveMultiScaleRefresh({ repository, readState, build, createEmbedder: () => embedder,
    now: () => time, getRevision: () => revision, random: () => 0, ...extra });
  return { ...value, worker, handle, build, repository, embedder, readState,
    advance: delta => { time += delta; }, setTime: val => { time = val; }, revise: () => { revision++; } };
}

test('cold requests cannot fit, warm requests reuse context, unchanged refresh revalidates without rebuilding', async () => {
  const v = setup();
  expect(await v.worker.retrieve(v.input)).toBeNull(); expect(v.build).not.toHaveBeenCalled();
  expect(await v.worker.run()).toEqual({ status: 'ready' });
  expect(await v.worker.retrieve(v.input)).toEqual(new Map([[1, []], [2, []]]));
  expect(await v.worker.run()).toEqual({ status: 'not_due' });
  v.advance(300000);
  expect(await v.worker.run()).toEqual({ status: 'revalidated' });
  expect(v.build).toHaveBeenCalledTimes(1);
  v.advance(600000); expect(await v.worker.retrieve(v.input)).toBeNull();
  expect(await v.worker.run()).toEqual({ status: 'ready' }); expect(v.build).toHaveBeenCalledTimes(2);
});

test('live SWR copies only a new fit, not verification or unchanged revalidation', async () => {
  const v = setup(), vector = v.snapshot.vectors.values().next().value, original = [...vector];
  let copies = 0;
  vector[Symbol.iterator] = function* () { copies++; yield* original; };
  expect(await v.worker.run()).toEqual({ status: 'ready' });
  expect(copies).toBe(1);
  expect(v.build.mock.calls[0][0].training.vectors.values().next().value).not.toBe(vector);
  v.advance(300000);
  expect(await v.worker.run()).toEqual({ status: 'revalidated' });
  expect(copies).toBe(1);
  vector[0] = NaN; v.advance(300000);
  expect(await v.worker.run()).toEqual({ status: 'unavailable' });
  expect(await v.worker.retrieve(v.input)).toBeNull(); expect(v.build).toHaveBeenCalledTimes(1);
});

test('failed discovery serves raw/broad but retries after backoff; transport failure clears and self-recovers', async () => {
  const v = setup();
  v.build.mockResolvedValueOnce({ handle: v.handle, cacheable: false, weight: 1000 });
  expect(await v.worker.run()).toEqual({ status: 'degraded' });
  expect(await v.worker.retrieve(v.input)).not.toBeNull();
  expect(await v.worker.run()).toEqual({ status: 'not_due' });
  v.advance(60000); expect(await v.worker.run()).toEqual({ status: 'ready' });
  expect(v.build).toHaveBeenCalledTimes(2);
  v.advance(300000); v.repository.read.mockRejectedValueOnce(new Error('PRIVATE endpoint'));
  expect(await v.worker.run()).toEqual({ status: 'unavailable' });
  expect(await v.worker.retrieve(v.input)).toBeNull();
  v.advance(59999); expect(await v.worker.run()).toEqual({ status: 'not_due' });
  v.advance(1); expect(await v.worker.run()).toEqual({ status: 'ready' });
});

test('revision/config changes, busy state, expired or backwards clocks and shutdown prevent serving', async () => {
  for (const change of [v => v.revise(), v => v.advance(600000), v => v.setTime(0), v => v.setTime(NaN),
    v => v.worker.stop(), v => { v.input.request.contextConfigKey = 'changed'; }]) {
    const v = setup(); await v.worker.run(); change(v); expect(await v.worker.retrieve(v.input)).toBeNull();
  }
  const v = setup(); await v.worker.run(); v.revise();
  expect(await v.worker.run()).toEqual({ status: 'ready' });
  v.state.busy = true; expect(await v.worker.run()).toEqual({ status: 'yielded' });
  expect(await v.worker.retrieve(v.input)).toBeNull();
  v.state.rag_enabled = false; expect(await v.worker.run()).toEqual({ status: 'disabled' });
  v.state.rag_enabled = true; v.state.busy = false; expect(await v.worker.run()).toEqual({ status: 'ready' });
  v.worker.stop(); expect(await v.worker.run()).toEqual({ status: 'cancelled' });
  expect(await setup().worker.run({ signal: AbortSignal.abort() })).toEqual({ status: 'cancelled' });
});

test('publication requires unchanged source, configuration, model and revision after asynchronous fitting', async () => {
  for (const change of [v => v.revise(), v => { v.state.busy = true; },
    v => { v.state.ollama_host = '127.0.0.1'; },
    v => { v.snapshot.corpus.documents[0].libraryIds = [2]; },
    v => { v.snapshot.vectors.get(v.snapshot.corpus.documents[0].hash)[0] = 0.5; }]) {
    const v = setup(); v.build.mockImplementationOnce(async () => {
      change(v); return { handle: v.handle, cacheable: true, weight: 1000 };
    });
    expect(await v.worker.run()).toEqual({ status: 'invalidated' });
    expect(await v.worker.retrieve(v.input)).toBeNull();
  }
  const v = setup(); v.embedder.inspect.mockResolvedValueOnce(v.identity)
    .mockResolvedValueOnce({ ...v.identity, digest: 'b'.repeat(64) });
  expect(await v.worker.run()).toEqual({ status: 'unavailable' });
  expect(await v.worker.retrieve(v.input)).toBeNull();
});

test('overlap coalesces and shutdown cancels work and suppresses late publication', async () => {
  const v = setup(); let release;
  const started = new Promise(resolve => { v.build.mockImplementationOnce(async (_source, { signal }) => {
    resolve(); await new Promise(done => { release = done; }); signal.throwIfAborted();
  }); });
  const pending = v.worker.run(); await started;
  expect(await v.worker.run()).toEqual({ status: 'already_running' });
  v.worker.stop(); release();
  expect(await pending).toEqual({ status: 'cancelled' });
  expect(await v.worker.retrieve(v.input)).toBeNull();
});

test('capacity, incomplete inputs and invalid clocks fail closed without private error details', async () => {
  const v = setup(); v.build.mockResolvedValueOnce({ handle: v.handle, cacheable: true, weight: 300 * 1024 * 1024 });
  expect(await v.worker.run()).toEqual({ status: 'capacity' });
  expect(await v.worker.retrieve(v.input)).toBeNull();
  const partial = setup(); partial.snapshot.vectors.clear();
  expect(await partial.worker.run()).toEqual({ status: 'unavailable' }); expect(partial.build).not.toHaveBeenCalled();
  const bad = setup(); bad.setTime(NaN); expect(await bad.worker.run()).toEqual({ status: 'unavailable' });
  const disabled = setup(); disabled.state.ollama_host = 'https://example.com';
  expect(await disabled.worker.run()).toEqual({ status: 'disabled' });
});

test('retrieval exceptions and invalidation during retrieval preserve the baseline', async () => {
  const v = setup(); await v.worker.run();
  v.handle.retrieve.mockRejectedValueOnce(new Error('PRIVATE text'));
  expect(await v.worker.retrieve(v.input)).toBeNull();
  v.handle.retrieve.mockImplementationOnce(async () => { v.revise(); return { purpose: 'retrieval_context_only', candidates: [] }; });
  expect(await v.worker.retrieve(v.input)).toBeNull();
});
