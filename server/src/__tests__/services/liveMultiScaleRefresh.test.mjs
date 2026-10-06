/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createLiveMultiScaleRefresh } from '../../services/liveMultiScaleRefresh.mjs';
import { liveFixture } from '../fixtures/liveMultiScaleFixture.mjs';
import { discoveryAdmissionFixture as createInventoryDiscoveryAdmission } from '../helpers/discoveryAdmissionFixture.mjs';

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

test('memory deferral precedes snapshot/provider work and retries automatically after backoff', async () => {
  let available = 0;
  const withAdmission = createInventoryDiscoveryAdmission({
    withSessionAdvisoryLock: async (_key, callback) => { await callback({}); return true; },
    readMemory: () => ({ available, constrained: 2 ** 31, total: 2 ** 34 }),
  });
  const v = setup({ withAdmission });
  expect(await v.worker.run()).toEqual({ status: 'deferred', reason: 'memory_pressure' });
  expect(v.repository.read).not.toHaveBeenCalled(); expect(v.embedder.inspect).not.toHaveBeenCalled();
  expect(await v.worker.run()).toEqual({ status: 'not_due' });
  available = 2 ** 31; v.advance(60000);
  expect(await v.worker.run()).toEqual({ status: 'ready' });
  expect(await v.worker.retrieve(v.input)).not.toBeNull();
  v.advance(300000); available = 0;
  expect(await v.worker.run()).toEqual({ status: 'deferred', reason: 'memory_pressure' });
  expect(await v.worker.retrieve(v.input)).toBeNull();
});

test('pressure before publication rejects the result without retaining the profile', async () => {
  let available = 2 ** 31;
  const withAdmission = createInventoryDiscoveryAdmission({
    withSessionAdvisoryLock: async (_key, callback) => { await callback({}); return true; },
    readMemory: () => ({ available, constrained: 2 ** 31, total: 2 ** 34 }),
  });
  const v = setup({ withAdmission });
  v.build.mockImplementationOnce(async () => { available = 0; return { handle: v.handle, cacheable: true, weight: 1000 }; });
  expect(await v.worker.run()).toEqual({ status: 'deferred', reason: 'memory_pressure' });
  expect(await v.worker.retrieve(v.input)).toBeNull();
});

test('contention retains valid SWR context until its existing TTL expires', async () => {
  let busy = false;
  const withAdmission = createInventoryDiscoveryAdmission({
    withSessionAdvisoryLock: async (_key, callback) => { if (busy) return false; await callback({}); return true; },
    readMemory: () => ({ available: 2 ** 31, constrained: 2 ** 31, total: 2 ** 34 }),
  });
  const v = setup({ withAdmission });
  expect(await v.worker.run()).toEqual({ status: 'ready' });
  v.advance(300000); busy = true;
  expect(await v.worker.run()).toEqual({ status: 'deferred', reason: 'busy' });
  expect(await v.worker.retrieve(v.input)).not.toBeNull();
  v.advance(300001); expect(await v.worker.retrieve(v.input)).toBeNull();
});

test('cold requests cannot fit, warm requests reuse context, unchanged refresh revalidates without rebuilding', async () => {
  const v = setup();
  expect(await v.worker.retrieve(v.input)).toBeNull(); expect(v.build).not.toHaveBeenCalled();
  expect(await v.worker.run()).toEqual({ status: 'ready' });
  expect(v.repository.read).toHaveBeenNthCalledWith(1, v.identity, { requireCompleteVectors: true, signal: expect.any(AbortSignal) });
  expect(v.repository.read).toHaveBeenNthCalledWith(2, v.identity, { requireCompleteVectors: true, signal: v.repository.read.mock.calls[0][1].signal });
  expect(await v.worker.retrieve(v.input)).toEqual(new Map([[1, []], [2, []]]));
  expect(await v.worker.run()).toEqual({ status: 'not_due' });
  v.advance(300000);
  expect(await v.worker.run()).toEqual({ status: 'revalidated' });
  expect(v.build).toHaveBeenCalledTimes(1);
  v.advance(600000); expect(await v.worker.retrieve(v.input)).toBeNull();
  expect(await v.worker.run()).toEqual({ status: 'ready' }); expect(v.build).toHaveBeenCalledTimes(2);
});

test.each([1, 2])('cache preflight refusal at read %s withholds publication and preserves bounded retry', async readNumber => {
  const v = setup(), coverage = { eligibleDescriptions: 12, cachedDescriptions: 11, missingDescriptions: 1 };
  if (readNumber === 2) v.repository.read.mockResolvedValueOnce(v.snapshot);
  v.repository.read.mockRejectedValueOnce(Object.assign(new Error('multi_scale_complete_cache_required'), { coverage }));
  expect(await v.worker.run()).toEqual({ status: 'unavailable', failure: {
    stage: readNumber === 1 ? 'snapshot_read' : 'snapshot_verify', code: 'cached_vectors_incomplete', coverage,
  } });
  expect(v.build).toHaveBeenCalledTimes(readNumber - 1);
  expect(await v.worker.retrieve(v.input)).toBeNull();
  expect(await v.worker.run()).toEqual({ status: 'not_due' });
  v.advance(60000);
  expect(await v.worker.run()).toEqual({ status: 'ready' });
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
  expect(await v.worker.run()).toEqual({ status: 'unavailable', failure: { stage: 'source_validation', code: 'cached_vector_invalid' } });
  expect(await v.worker.retrieve(v.input)).toBeNull(); expect(v.build).toHaveBeenCalledTimes(1);
});

test('a changed initial snapshot refuses fitting before candidate preparation', async () => {
  const v = setup();
  v.repository.read.mockResolvedValueOnce({ ...v.snapshot, state: { ...v.state, busy: true } });
  expect(await v.worker.run()).toEqual({ status: 'invalidated' });
  expect(v.build).not.toHaveBeenCalled();
  expect(v.repository.read).toHaveBeenCalledTimes(1);
  expect(await v.worker.retrieve(v.input)).toBeNull();
});

test('cancellation at the owned-copy boundary never starts a fit', async () => {
  const v = setup(), caller = new AbortController();
  const vector = v.snapshot.vectors.values().next().value, original = [...vector];
  vector[Symbol.iterator] = function* () { caller.abort(); yield* original; };
  expect(await v.worker.run({ signal: caller.signal })).toEqual({ status: 'cancelled' });
  expect(v.build).not.toHaveBeenCalled();
  expect(v.repository.read).toHaveBeenCalledTimes(1);
  expect(await v.worker.retrieve(v.input)).toBeNull();
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
  expect(await v.worker.run()).toEqual({ status: 'unavailable', failure: { stage: 'snapshot_read', code: 'unknown' } });
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
  expect(await v.worker.run()).toEqual({ status: 'unavailable', failure: { stage: 'provider_verify', code: 'provider_model_changed' } });
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
  expect(await partial.worker.run()).toEqual({ status: 'unavailable', failure: { stage: 'source_validation', code: 'cached_vectors_incomplete' } });
  expect(partial.build).not.toHaveBeenCalled();
  const bad = setup(); bad.setTime(NaN);
  expect(await bad.worker.run()).toEqual({ status: 'unavailable', failure: { stage: 'clock', code: 'clock_invalid' } });
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

test.each(['state_read', 'snapshot_read', 'snapshot_verify', 'state_verify', 'profile_build', 'provider_inspection'])(
  'reports the actual %s boundary, clears context and retains retry backoff', async stage => {
    const v = setup();
    await v.worker.run(); v.advance(300000);
    const error = Object.assign(new Error('PRIVATE database and provider details'), { code: '57014' });
    if (stage === 'state_read') v.readState.mockRejectedValueOnce(error);
    if (stage === 'snapshot_read') v.repository.read.mockRejectedValueOnce(error);
    if (stage === 'snapshot_verify') v.repository.read.mockResolvedValueOnce(v.snapshot).mockRejectedValueOnce(error);
    if (stage === 'state_verify') v.readState.mockResolvedValueOnce(v.state).mockRejectedValueOnce(error);
    if (stage === 'provider_inspection') v.embedder.inspect.mockRejectedValueOnce(error);
    if (stage === 'profile_build') {
      v.advance(300001); // Expire the cached build, preserving the normal cache contract.
      v.build.mockRejectedValueOnce(error);
    }
    const code = ['profile_build', 'provider_inspection'].includes(stage) ? 'unknown' : 'database_query_cancelled';
    expect(await v.worker.run()).toEqual({ status: 'unavailable', failure: { stage, code } });
    expect(await v.worker.retrieve(v.input)).toBeNull();
    expect(await v.worker.run()).toEqual({ status: 'not_due' });
    v.advance(60000);
    expect(await v.worker.run()).toEqual({ status: 'ready' });
  });

test('admission and publication errors retain distinct boundaries without publishing', async () => {
  const admission = setup({ withAdmission: async () => { throw Object.assign(new Error('PRIVATE'), { code: '55P03' }); } });
  expect(await admission.worker.run()).toEqual({ status: 'unavailable', failure: { stage: 'admission', code: 'database_lock_unavailable' } });
  expect(admission.embedder.inspect).not.toHaveBeenCalled();
  const publication = setup({ cache: { clear() {}, get() { return null; }, set() { throw new Error('PRIVATE'); } } });
  expect(await publication.worker.run()).toEqual({ status: 'unavailable', failure: { stage: 'publication', code: 'unknown' } });
  expect(await publication.worker.retrieve(publication.input)).toBeNull();
});

test('attempt deadline is distinct from caller cancellation, which takes precedence', async () => {
  for (const cancelled of [false, true]) {
    const deadline = new AbortController(), caller = new AbortController();
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    try {
      const v = setup();
      v.build.mockImplementationOnce(async (_source, { signal }) => {
        deadline.abort(new DOMException('PRIVATE', 'TimeoutError'));
        if (cancelled) caller.abort();
        signal.throwIfAborted();
      });
      expect(await v.worker.run({ signal: caller.signal })).toEqual(cancelled ? { status: 'cancelled' } : {
        status: 'unavailable', failure: { stage: 'profile_build', code: 'attempt_timeout' },
      });
      expect(timeout).toHaveBeenCalledWith(360000);
      expect(await v.worker.retrieve(v.input)).toBeNull();
    } finally { timeout.mockRestore(); }
  }
});
