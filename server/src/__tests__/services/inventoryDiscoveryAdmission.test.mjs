/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { assessDiscoveryMemory, readDiscoveryMemory } from '../../services/discoveryMemoryBudget.mjs';
import { createInventoryDiscoveryAdmission, DiscoveryDeferredError, INVENTORY_DISCOVERY_LOCK } from '../../services/inventoryDiscoveryAdmission.mjs';

const MIB = 1024 * 1024;
const memory = (available = 1536 * MIB) => ({ available, constrained: 2048 * MIB, total: 16384 * MIB });
const lease = async (_key, callback) => { await callback({}); return true; };
afterEach(() => jest.useRealTimers());

test('uses shared available memory, bounded reserve, and conservative starting headroom', () => {
  expect(assessDiscoveryMemory(memory(1024 * MIB), true)).toMatchObject({ allowed: true, reserve: 256 * MIB });
  expect(assessDiscoveryMemory(memory(1024 * MIB - 1), true).allowed).toBe(false);
  expect(assessDiscoveryMemory(memory(256 * MIB)).allowed).toBe(true);
  expect(assessDiscoveryMemory(memory(256 * MIB - 1)).allowed).toBe(false);
  expect(assessDiscoveryMemory({ available: 500 * MIB, constrained: 0, total: 1024 * MIB })).toMatchObject({ reserve: 128 * MIB });
  expect(assessDiscoveryMemory({ available: 1000 * MIB, constrained: 0, total: 32768 * MIB })).toMatchObject({ reserve: 512 * MIB });
  expect(assessDiscoveryMemory({ available: 1000 * MIB, constrained: Number.MAX_VALUE, total: 1024 * MIB })).toMatchObject({ reserve: 128 * MIB });
  expect(assessDiscoveryMemory({ available: 4096 * MIB, constrained: MIB, total: 1024 * MIB }).allowed).toBe(false);
  expect(readDiscoveryMemory()).toEqual({ available: expect.any(Number), constrained: expect.any(Number), total: expect.any(Number) });
});

test.each([null, {}, memory(NaN), memory(-1), memory(Infinity), { ...memory(), constrained: -1 }, { ...memory(), total: 0 }])(
  'invalid memory telemetry fails closed: %j', value => {
    expect(assessDiscoveryMemory(value)).toEqual({ allowed: false, reason: 'memory_unknown' });
  });

test('locks before checking memory and never starts a callback on contention or low/unknown memory', async () => {
  const callback = jest.fn(), readMemory = jest.fn(() => memory()), lock = jest.fn(async () => false);
  const run = createInventoryDiscoveryAdmission({ withSessionAdvisoryLock: lock, readMemory });
  await expect(run(callback)).rejects.toMatchObject({ reason: 'busy' });
  expect(readMemory).not.toHaveBeenCalled(); expect(callback).not.toHaveBeenCalled();
  lock.mockImplementation(lease); readMemory.mockReturnValueOnce(memory(100));
  await expect(run(callback)).rejects.toMatchObject({ reason: 'memory_pressure' });
  readMemory.mockImplementationOnce(() => { throw new Error('PRIVATE host'); });
  await expect(run(callback)).rejects.toMatchObject({ reason: 'memory_unknown', message: 'inventory_discovery_deferred' });
  expect(callback).not.toHaveBeenCalled();
  expect(lock).toHaveBeenLastCalledWith(INVENTORY_DISCOVERY_LOCK, expect.any(Function));
  expect(new DiscoveryDeferredError('PRIVATE').reason).toBe('memory_unknown');
});

test('monitor aborts, keeps ownership until settled, removes timers and recovers without manual reset', async () => {
  jest.useFakeTimers();
  let current = memory(), complete, ownedSignal, released = false;
  const run = createInventoryDiscoveryAdmission({ readMemory: () => current,
    withSessionAdvisoryLock: async (key, callback) => { try { return await lease(key, callback); } finally { released = true; } } });
  const pending = run(signal => { ownedSignal = signal; return new Promise(resolve => { complete = resolve; }); });
  const rejected = expect(pending).rejects.toMatchObject({ reason: 'memory_pressure' });
  current = memory(128 * MIB); await jest.advanceTimersByTimeAsync(250);
  expect(ownedSignal.aborted).toBe(true); expect(released).toBe(false);
  await expect(run(jest.fn())).rejects.toMatchObject({ reason: 'busy' });
  complete('must not publish'); await rejected;
  expect(released).toBe(true); expect(jest.getTimerCount()).toBe(0);
  current = memory(); expect(await run(async () => 'recovered')).toBe('recovered');
  expect(jest.getTimerCount()).toBe(0);
});

test('explicit checkpoint and final check reject late pressure, even when callback swallows cancellation', async () => {
  let current = memory();
  const run = createInventoryDiscoveryAdmission({ withSessionAdvisoryLock: lease, readMemory: () => current });
  await expect(run(async (_signal, checkpoint) => { current = memory(0); checkpoint(); })).rejects.toMatchObject({ reason: 'memory_pressure' });
  current = memory();
  await expect(run(async () => { current = memory(0); return 'late'; })).rejects.toMatchObject({ reason: 'memory_pressure' });
});

test('caller/lease loss cancel admitted work, exceptions release ownership, no orphan monitor', async () => {
  jest.useFakeTimers();
  const caller = new AbortController(), lost = new AbortController(), callback = jest.fn();
  const run = createInventoryDiscoveryAdmission({ readMemory: memory,
    withSessionAdvisoryLock: async (_key, fn) => { await fn({ signal: lost.signal }); return true; } });
  caller.abort(new Error('caller cancelled'));
  await expect(run(callback, { signal: caller.signal })).rejects.toThrow('caller cancelled');
  expect(callback).not.toHaveBeenCalled();
  await expect(run(async () => { throw new Error('operation failed'); })).rejects.toThrow('operation failed');
  const pending = run(async signal => { lost.abort(new Error('lease lost')); expect(signal.aborted).toBe(true); return 'late'; });
  await expect(pending).rejects.toThrow('lease lost');
  expect(jest.getTimerCount()).toBe(0);
});
