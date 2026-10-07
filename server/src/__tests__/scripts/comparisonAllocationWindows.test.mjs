/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test, afterEach } from '@jest/globals';
import { hasSubscribers } from 'node:diagnostics_channel';
import { VECTOR_READ_CHANNEL, observeInventoryVectorBatch } from '../../services/inventoryVectorReadDiagnostics.mjs';
import { createComparisonAllocationWindows } from '../../scripts/comparisonMemoryStudy/allocationWindows.mjs';
import { createComparisonStudyPhases } from '../../scripts/comparisonMemoryStudy/phases.mjs';

afterEach(() => expect(hasSubscribers(VECTOR_READ_CHANNEL)).toBe(false));

function fixture(options = {}) {
  let time = 10, timeout;
  const sessions = [];
  const createSession = jest.fn(() => {
    const session = { connect: jest.fn(), disconnect: jest.fn(), post: jest.fn(async method =>
      method === 'HeapProfiler.stopSampling' ? { profile: { samples: [], head: {
        callFrame: { url: 'private-secret', functionName: 'password' }, selfSize: 10, children: [],
      } } } : {}) };
    sessions.push(session); return session;
  });
  const windows = createComparisonAllocationWindows({ enabled: true, context: () => ({ worker: 'comparison', attempt: 2 }),
    now: () => time++, memory: () => ({ heapUsed: 100, rss: 200 }), createSession,
    setTimer: callback => { timeout = callback; return { unref() {} }; }, clearTimer: jest.fn(), ...options });
  return { windows, sessions, createSession, expire: () => timeout() };
}

test('default disabled runs work without an inspector, context lookup or receipt', async () => {
  const f = fixture({ enabled: false, context: () => { throw new Error('unexpected'); } });
  expect(await f.windows.run('comparison_verification', async () => 42)).toBe(42);
  expect(f.windows.read()).toBeNull(); expect(f.createSession).not.toHaveBeenCalled();
});

test('bounded windows preserve result and emit only fixed numeric summaries', async () => {
  const f = fixture();
  expect(await f.windows.run('comparison_verification', async () => 42)).toBe(42);
  const report = f.windows.read();
  expect(report.windows).toHaveLength(1);
  expect(report.windows[0]).toMatchObject({ phase: 'comparison_verification', worker: 'comparison', attempt: 2,
    startMs: 10, endMs: 11, heapStart: 100, heapEnd: 100, rssStart: 200, rssEnd: 200,
    profile: { sampledEstimatedBytes: 10, components: { other: 10 } } });
  expect(JSON.stringify(report)).not.toMatch(/private|secret|password/);
  expect(f.sessions[0].post.mock.calls.map(call => call[0])).toEqual(['HeapProfiler.startSampling', 'HeapProfiler.stopSampling']);
  expect(f.sessions[0].disconnect).toHaveBeenCalledTimes(1);
});

test('window captures real counters and invalid observation cannot produce a successful receipt', async () => {
  const f = fixture();
  await f.windows.run('comparison_verification', async () => observeInventoryVectorBatch('read', [{ embedding: '[1]' }], 1));
  expect(f.windows.read().version).toBe(2);
  expect(f.windows.read().windows[0].vectorReads.owned.read).toEqual({ batches: 1, rows: 1, components: 1, encodedChars: 3 });
  const invalid = fixture();
  await expect(invalid.windows.run('comparison_verification', async () => observeInventoryVectorBatch('read', null, 1)))
    .rejects.toThrow('comparison_allocation_failed');
  expect(() => invalid.windows.read()).toThrow('comparison_allocation_failed');
});

test('overlap fails evidence without queuing or opening another session', async () => {
  const f = fixture(), finish = await f.windows.begin('build_control');
  await expect(f.windows.begin('community_build')).rejects.toThrow('comparison_allocation_failed');
  await expect(finish()).rejects.toThrow('comparison_allocation_failed');
  expect(f.createSession).toHaveBeenCalledTimes(1);
  expect(f.sessions[0].disconnect).toHaveBeenCalledTimes(1);
  expect(() => f.windows.read()).toThrow('comparison_allocation_failed');
});

test.each(['connect', 'start', 'stop', 'disconnect', 'profile', 'work', 'timeout'])('latched %s failure cannot be swallowed as a passed study', async fail => {
  const f = fixture();
  const originalCreate = f.createSession.getMockImplementation();
  f.createSession.mockImplementation(() => {
    const session = originalCreate(), post = session.post.getMockImplementation();
    if (fail === 'connect') session.connect.mockImplementation(() => { throw new Error('secret'); });
    if (fail === 'disconnect') session.disconnect.mockImplementation(() => { throw new Error('secret'); });
    session.post.mockImplementation(async method => {
      if ((fail === 'start' && method.endsWith('startSampling')) || (fail === 'stop' && method.endsWith('stopSampling'))) throw new Error('secret');
      if (fail === 'profile' && method.endsWith('stopSampling')) return { profile: null };
      return post(method);
    });
    return session;
  });
  await expect(f.windows.run('community_build', async () => {
    if (fail === 'work') throw new Error('work failed');
    if (fail === 'timeout') f.expire();
  })).rejects.toThrow();
  expect(f.sessions[0].disconnect).toHaveBeenCalled();
  expect(() => f.windows.read()).toThrow('comparison_allocation_failed');
});

test('missing/throwing context, invalid phase and an unfinished session cannot produce evidence', async () => {
  for (const context of [() => null, () => { throw new Error('secret'); }]) {
    const f = fixture({ context });
    await expect(f.windows.begin('community_build')).rejects.toThrow('comparison_allocation_failed');
    expect(() => f.windows.read()).toThrow('comparison_allocation_failed');
    expect(f.createSession).not.toHaveBeenCalled();
  }
  const invalid = fixture(); await expect(invalid.windows.begin('secret')).rejects.toThrow('comparison_allocation_failed');
  const f = fixture(), finish = await f.windows.begin('community_build');
  expect(() => f.windows.read()).toThrow('comparison_allocation_failed');
  await expect(finish()).rejects.toThrow('comparison_allocation_failed');
  expect(f.sessions[0].disconnect).toHaveBeenCalledTimes(1);
});

test('invalid identity and exhausted window count fail before connecting', async () => {
  const invalid = fixture({ context: () => ({ worker: 'secret', attempt: 2 }) });
  await expect(invalid.windows.begin('build_control')).rejects.toThrow();
  expect(invalid.createSession).not.toHaveBeenCalled();
  const f = fixture();
  for (let i = 0; i < 128; i++) await f.windows.run('comparison_verification', async () => {});
  await expect(f.windows.begin('comparison_verification')).rejects.toThrow();
  expect(f.createSession).toHaveBeenCalledTimes(128);
});

test('actual build boundaries exclude worker fitting and close control before community work', async () => {
  const events = [], metrics = { mark: async name => events.push(name), track() {} };
  const allocations = { begin: async name => { events.push(`start:${name}`); return async () => events.push(`end:${name}`); },
    run: async (name, work) => { events.push(`start:${name}`); const value = await work(); events.push(`end:${name}`); return value; } };
  const phases = createComparisonStudyPhases(metrics, 'recovery', { allocations,
    fit: async () => { events.push('fit'); return 42; }, discover: async () => { events.push('discover'); return { media: new Map() }; } });
  expect(await phases.fit()).toBe(42); await phases.discover(); await phases.close();
  expect(events).toEqual(['recovery_worker_fit', 'fit', 'recovery_control', 'start:build_control',
    'end:build_control', 'recovery_community', 'start:community_build', 'discover', 'end:community_build',
    'recovery_quality', 'start:build_quality', 'end:build_quality']);
});
