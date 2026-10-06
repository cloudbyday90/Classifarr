/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { setImmediate } from 'node:timers/promises';

const cgroup = { version: 1, memoryBytes: 100, limitBytes: 2 * 1024 ** 3, memoryLimitHits: 0,
  oomKill: 0, underOom: 0, cpuUsec: 0, throttledUsec: 0, pids: 1, cpuPeriods: 0,
  cpuThrottledPeriods: 0, pidsLimitHits: 0, cpuQuotaUsec: 200000, cpuPeriodUsec: 100000, pidsLimit: 128 };
const actual = await import('../../scripts/resourceStudyMetrics.mjs');
jest.unstable_mockModule('../../scripts/resourceStudyMetrics.mjs', () => ({ ...actual, readStudyCgroup: async () => cgroup }));
let resolveObservation;
const observe = jest.fn(() => new Promise(resolve => { resolveObservation = resolve; }));
jest.unstable_mockModule('../../scripts/comparisonMemoryStudy/residentMemory.mjs', () => ({ readComparisonResidentMemory: observe }));
const { createComparisonMemoryMetrics } = await import('../../scripts/comparisonMemoryStudy/metrics.mjs');

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
