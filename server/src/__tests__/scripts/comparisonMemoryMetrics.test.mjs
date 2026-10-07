/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { setImmediate } from 'node:timers/promises';
import { EventEmitter } from 'node:events';

const cgroup = { version: 1, memoryBytes: 100, limitBytes: 2 * 1024 ** 3, memoryLimitHits: 0,
  oomKill: 0, underOom: 0, cpuUsec: 0, throttledUsec: 0, pids: 1, cpuPeriods: 0,
  cpuThrottledPeriods: 0, pidsLimitHits: 0, cpuQuotaUsec: 200000, cpuPeriodUsec: 100000, pidsLimit: 128 };
const actual = await import('../../scripts/resourceStudyMetrics.mjs');
jest.unstable_mockModule('../../scripts/resourceStudyMetrics.mjs', () => ({ ...actual, readStudyCgroup: async () => cgroup }));
let resolveObservation;
const observe = jest.fn(() => new Promise(resolve => { resolveObservation = resolve; }));
jest.unstable_mockModule('../../scripts/comparisonMemoryStudy/residentMemory.mjs', () => ({ readComparisonResidentMemory: observe }));
const gc = jest.fn(async () => ({ status: 'observed', scope: 'main_thread_major_gc_event',
  windowStartMs: 0, windowEndMs: 0, waitBudgetMs: 300000, event: { startMs: 0, durationMs: 0, kind: 4, flags: 0 } }));
jest.unstable_mockModule('../../scripts/comparisonMemoryStudy/naturalMajorGc.mjs', () => ({ observeNaturalMajorGc: gc, POST_STOP_GC_WAIT_MS: 300000 }));
const { createComparisonMemoryMetrics } = await import('../../scripts/comparisonMemoryStudy/metrics.mjs');
beforeEach(() => {
  observe.mockReset().mockImplementation(() => new Promise(resolve => { resolveObservation = resolve; }));
  gc.mockClear();
});

test('synchronous boundaries emit only main-thread/process memory without a proc walk', async () => {
  const records = [], metrics = createComparisonMemoryMetrics({ emit: row => records.push(row) });
  const before = observe.mock.calls.length;
  try {
    expect(metrics.markSync('recovery_shadow_prepare_start')).toBeUndefined();
    expect(records[0]).toMatchObject({ phase: 'recovery_shadow_prepare_start', mainThreadOnly: true });
    for (const key of ['rss', 'heapUsed', 'mainHeapPhysicalBytes']) expect(records[0][key]).toBeGreaterThan(0);
    for (const key of ['containerBytes', 'workerHeapUsed', 'resident']) expect(records[0]).not.toHaveProperty(key);
    expect(observe.mock.calls.length).toBe(before);
  } finally { await metrics.close(); }
});

test('post-stop observation refuses active workers; after exit it samples only twice and holds no referents', async () => {
  const metrics = createComparisonMemoryMetrics({ emit: () => {} }), worker = new EventEmitter();
  worker.threadId = 123;
  const target = {};
  metrics.track('comparisonHandle', target);
  try {
    process.emit('worker', worker);
    await expect(metrics.observePostStopGc()).rejects.toThrow('comparison_gc_not_quiescent');
    expect(gc).not.toHaveBeenCalled();
    worker.emit('exit');
    observe.mockResolvedValue({ status: 'partial', cgroupVersion: 1 });
    const result = await metrics.observePostStopGc();
    expect(result.before.alive.comparisonHandle).toBe(1);
    expect(result.after.alive.comparisonHandle).toBe(1);
    expect(result.before.createdWorkers).toBe(1); expect(result.after.activeWorkers).toBe(0);
    expect(gc).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain('ref');
  } finally { await metrics.close(); }
});

test('concurrent marks share one proc walk, retain their labels and await it on close', async () => {
  const records = [], listeners = process.listenerCount('worker');
  const metrics = createComparisonMemoryMetrics({ emit: value => records.push(value) });
  const resident = { status: 'partial', cgroupVersion: 1 };
  try {
    await metrics.start(); expect(observe).not.toHaveBeenCalled();
    const first = metrics.mark('first'), second = metrics.mark('second');
    await setImmediate(); expect(observe).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(1); expect(records).toEqual([]);
    let closed = false;
    const closing = metrics.close().then(() => { closed = true; });
    await setImmediate(); expect(closed).toBe(false);
    resolveObservation(resident);
    await Promise.all([first, second, closing]);
    expect(records.map(row => row.phase)).toEqual(['first', 'second', 'summary']);
    expect(records[0].resident).toBe(records[1].resident);
    expect(records[0].mainHeapPhysicalBytes).toBeGreaterThan(0);
    expect(records[0].workerHeapPhysicalBytes).toBe(0);
    expect(process.listenerCount('worker')).toBe(listeners);
  } finally { resolveObservation?.(resident); await metrics.close(); }
});
