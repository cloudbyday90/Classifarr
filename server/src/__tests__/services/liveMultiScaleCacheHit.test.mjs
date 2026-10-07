/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createLiveMultiScaleRefresh } from '../../services/liveMultiScaleRefresh.mjs';
import { inspectUnseenMultiScaleSource } from '../../services/inventoryMultiScaleSource.mjs';
import { liveFixture } from '../fixtures/liveMultiScaleFixture.mjs';

function setup() {
  const value = liveFixture(); let time = 1_000_000, revision = 0;
  const handle = { retrieve: async () => ({ purpose: 'retrieval_context_only',
    candidates: [1, 2].map(id => ({ id, evidence: [] })) }) };
  const build = jest.fn(async () => ({ handle, cacheable: true, weight: 1000 }));
  // Keep the repository methods independent: a streamed read must not materialize a full read.
  const verify = () => {
    const { vectors: _vectors, ...metadata } = value.snapshot;
    return { ...metadata, key: inspectUnseenMultiScaleSource(value.snapshot, value.identity).key };
  };
  const repository = { read: jest.fn(async () => value.snapshot), readVerification: jest.fn(async () => verify()) };
  const readState = jest.fn(async () => value.state);
  const embedder = { ...value.identity, inspect: jest.fn(async () => value.identity) };
  const worker = createLiveMultiScaleRefresh({ repository, readState, build, createEmbedder: () => embedder,
    now: () => time, getRevision: () => revision, random: () => 0 });
  return { ...value, repository, worker, build, readState, embedder, verify,
    advance: delta => { time += delta; }, revise: () => { revision++; } };
}

async function warm(v) {
  expect(await v.worker.run()).toEqual({ status: 'ready' });
  expect(v.repository.read).toHaveBeenCalledTimes(1);
  expect(v.repository.readVerification).toHaveBeenCalledTimes(1);
  v.repository.read.mockClear(); v.repository.readVerification.mockClear(); v.build.mockClear();
  v.advance(300000);
}

test('unchanged warm refresh streams twice without materializing or fitting', async () => {
  const v = setup(); await warm(v);
  expect(await v.worker.run()).toEqual({ status: 'revalidated' });
  expect(v.repository.read).not.toHaveBeenCalled(); expect(v.build).not.toHaveBeenCalled();
  expect(v.repository.readVerification).toHaveBeenCalledTimes(2);
  expect(await v.worker.retrieve(v.input)).not.toBeNull();
});

test('warm fingerprint miss materializes and rebuilds, then verifies independently', async () => {
  const v = setup(); await warm(v);
  v.snapshot.vectors.values().next().value[0] += 0.125;
  expect(await v.worker.run()).toEqual({ status: 'ready' });
  expect(v.repository.read).toHaveBeenCalledTimes(1); expect(v.build).toHaveBeenCalledTimes(1);
  expect(v.repository.readVerification).toHaveBeenCalledTimes(2);
  const probeOrder = v.repository.readVerification.mock.invocationCallOrder;
  expect(probeOrder[0]).toBeLessThan(v.repository.read.mock.invocationCallOrder[0]);
  expect(probeOrder[1]).toBeGreaterThan(v.build.mock.invocationCallOrder[0]);
});

test.each(['expired', 'revision', 'degraded'])('%s cache does not add a warm probe', async mode => {
  const v = setup();
  if (mode === 'degraded') v.build.mockImplementationOnce(async () => ({ handle: {}, cacheable: false, weight: 1000 }));
  expect((await v.worker.run()).status).toBe(mode === 'degraded' ? 'degraded' : 'ready');
  v.repository.read.mockClear(); v.repository.readVerification.mockClear();
  v.advance(mode === 'expired' ? 600001 : 300000);
  if (mode === 'revision') v.revise();
  expect(await v.worker.run()).toEqual({ status: 'ready' });
  expect(v.repository.read).toHaveBeenCalledTimes(1);
  expect(v.repository.readVerification).toHaveBeenCalledTimes(1);
});

test('expiry during the probe falls back rather than reviving an expired model', async () => {
  const v = setup(); await warm(v);
  v.repository.readVerification.mockImplementationOnce(async () => { v.advance(300001); return v.verify(); });
  expect(await v.worker.run()).toEqual({ status: 'ready' });
  expect(v.repository.read).toHaveBeenCalledTimes(1); expect(v.build).toHaveBeenCalledTimes(1);
  expect(v.repository.readVerification).toHaveBeenCalledTimes(2);
});

test.each([1, 2])('verification failure at pass %i fails closed without fallback or private details', async pass => {
  const v = setup(); await warm(v);
  if (pass === 2) v.repository.readVerification.mockResolvedValueOnce(v.verify());
  v.repository.readVerification.mockRejectedValueOnce(Object.assign(new Error('PRIVATE vector details'), { code: '57014' }));
  expect(await v.worker.run()).toEqual({ status: 'unavailable', failure: {
    stage: pass === 1 ? 'snapshot_read' : 'snapshot_verify', code: 'database_query_cancelled',
  } });
  expect(v.repository.read).not.toHaveBeenCalled(); expect(v.build).not.toHaveBeenCalled();
  expect(await v.worker.retrieve(v.input)).toBeNull();
  expect(await v.worker.run()).toEqual({ status: 'not_due' });
});

test.each(['busy', 'config', 'revision'])('%s change during warm probe invalidates without fitting', async change => {
  const v = setup(); await warm(v);
  v.repository.readVerification.mockImplementationOnce(async () => {
    if (change === 'busy') v.state.busy = true;
    if (change === 'config') v.state.rag_enabled = false;
    if (change === 'revision') v.revise();
    return v.verify();
  });
  expect(await v.worker.run()).toEqual({ status: 'invalidated' });
  expect(v.repository.read).not.toHaveBeenCalled(); expect(v.build).not.toHaveBeenCalled();
  expect(v.repository.readVerification).toHaveBeenCalledTimes(1);
  expect(await v.worker.retrieve(v.input)).toBeNull();
});

test('a vector change between streamed passes invalidates the hit', async () => {
  const v = setup(); await warm(v);
  v.repository.readVerification.mockImplementationOnce(async () => {
    const first = v.verify(); v.snapshot.vectors.values().next().value[0] += 0.125; return first;
  });
  expect(await v.worker.run()).toEqual({ status: 'invalidated' });
  expect(v.repository.read).not.toHaveBeenCalled(); expect(v.build).not.toHaveBeenCalled();
  expect(v.repository.readVerification).toHaveBeenCalledTimes(2);
  expect(await v.worker.retrieve(v.input)).toBeNull();
});

test.each(['busy', 'config', 'revision'])('%s change after the probe still blocks warm publication', async change => {
  const v = setup(); await warm(v);
  v.repository.readVerification.mockResolvedValueOnce(v.verify()).mockImplementationOnce(async () => {
    if (change === 'busy') v.state.busy = true;
    if (change === 'config') v.state.rag_enabled = false;
    if (change === 'revision') v.revise();
    return v.verify();
  });
  expect(await v.worker.run()).toEqual({ status: 'invalidated' });
  expect(v.repository.read).not.toHaveBeenCalled(); expect(v.build).not.toHaveBeenCalled();
  expect(v.repository.readVerification).toHaveBeenCalledTimes(2);
  expect(await v.worker.retrieve(v.input)).toBeNull();
});

test('provider identity is rechecked after both warm reads', async () => {
  const v = setup(); await warm(v);
  v.embedder.inspect.mockResolvedValueOnce(v.identity).mockResolvedValueOnce({ ...v.identity, digest: 'b'.repeat(64) });
  expect(await v.worker.run()).toMatchObject({ status: 'unavailable', failure: { stage: 'provider_verify' } });
  expect(v.repository.read).not.toHaveBeenCalled(); expect(v.build).not.toHaveBeenCalled();
  expect(v.repository.readVerification).toHaveBeenCalledTimes(2);
  expect(await v.worker.retrieve(v.input)).toBeNull();
});

test.each(['caller', 'shutdown'])('%s cancellation during a warm probe suppresses late publication', async mode => {
  const v = setup(); await warm(v);
  const caller = new AbortController(); let release;
  const started = new Promise(resolve => {
    v.repository.readVerification.mockImplementationOnce(async () => {
      resolve(); await new Promise(done => { release = done; }); return v.verify();
    });
  });
  const pending = v.worker.run({ signal: caller.signal }); await started;
  expect(await v.worker.run()).toEqual({ status: 'already_running' });
  if (mode === 'caller') caller.abort(); else v.worker.stop();
  release(); expect(await pending).toEqual({ status: 'cancelled' });
  expect(v.repository.read).not.toHaveBeenCalled(); expect(v.build).not.toHaveBeenCalled();
  expect(v.repository.readVerification).toHaveBeenCalledTimes(1);
  expect(await v.worker.retrieve(v.input)).toBeNull();
});
