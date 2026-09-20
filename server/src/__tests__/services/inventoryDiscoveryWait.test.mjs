/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { waitForInventoryDiscovery } from '../../services/inventoryDiscoveryWait.mjs';
import { DiscoveryDeferredError } from '../../services/inventoryDiscoveryAdmission.mjs';

function clock() {
  let time = 0;
  return { now: () => time, random: () => 0, sleep: jest.fn(async ms => { time += ms; }) };
}
test('immediate admission preserves callback arguments and result', async () => {
  const callback = jest.fn((...args) => args);
  expect(await waitForInventoryDiscovery(fn => fn('signal', 'checkpoint'), callback)).toEqual(['signal', 'checkpoint']);
  expect(callback).toHaveBeenCalledTimes(1);
});
test.each(['busy', 'memory_pressure'])('temporary %s admission self-recovers without replaying work', async reason => {
  const callback = jest.fn(() => 'complete'), timer = clock(), progress = jest.fn();
  const admit = jest.fn().mockRejectedValueOnce(new DiscoveryDeferredError(reason)).mockRejectedValueOnce(new DiscoveryDeferredError(reason))
    .mockImplementation(fn => fn());
  expect(await waitForInventoryDiscovery(admit, callback, { waitMs: 30_000, onProgress: progress }, timer)).toBe('complete');
  expect(callback).toHaveBeenCalledTimes(1); expect(timer.sleep.mock.calls.map(call => call[0])).toEqual([5000, 10000]);
  expect(progress.mock.calls[0][0]).toEqual({ stage: 'discovery_wait', reason, attempt: 1, retryInMs: 5000 });
});
test('deadline expires without starting work, with capped exponential backoff', async () => {
  const callback = jest.fn(), timer = clock(), error = new DiscoveryDeferredError('busy');
  const admit = jest.fn().mockRejectedValue(error);
  await expect(waitForInventoryDiscovery(admit, callback, { waitMs: 100_000 }, timer)).rejects.toBe(error);
  expect(timer.sleep.mock.calls.map(call => call[0])).toEqual([5000, 10000, 20000, 30000, 30000, 5000]);
  expect(callback).not.toHaveBeenCalled(); expect(admit).toHaveBeenCalledTimes(6);
});
test.each([undefined, 0])('default/zero waiting preserves immediate deferral (%s)', async waitMs => {
  const error = new DiscoveryDeferredError('busy'), timer = clock();
  await expect(waitForInventoryDiscovery(() => Promise.reject(error), jest.fn(), { waitMs }, timer)).rejects.toBe(error);
  expect(timer.sleep).not.toHaveBeenCalled();
});
test.each([new Error('provider'), new DiscoveryDeferredError('memory_pressure')])('never retries after callback entry (%s)', async error => {
  const timer = clock(), callback = jest.fn(() => { throw error; }), admit = jest.fn(fn => fn());
  await expect(waitForInventoryDiscovery(admit, callback, { waitMs: 300_000 }, timer)).rejects.toBe(error);
  expect(callback).toHaveBeenCalledTimes(1); expect(admit).toHaveBeenCalledTimes(1); expect(timer.sleep).not.toHaveBeenCalled();
});
test('non-admission failures are not retried', async () => {
  const timer = clock();
  await expect(waitForInventoryDiscovery(() => Promise.reject(new Error('database')), jest.fn(), { waitMs: 5000 }, timer)).rejects.toThrow('database');
  expect(timer.sleep).not.toHaveBeenCalled();
});
test('cancellation before admission starts no work', async () => {
  const admit = jest.fn();
  await expect(waitForInventoryDiscovery(admit, jest.fn(), { signal: AbortSignal.abort() })).rejects.toThrow();
  expect(admit).not.toHaveBeenCalled();
});
test('real timer cancellation exits the wait promptly without a second attempt', async () => {
  const controller = new AbortController(), admit = jest.fn().mockRejectedValue(new DiscoveryDeferredError('busy'));
  await expect(waitForInventoryDiscovery(admit, jest.fn(), { signal: controller.signal, waitMs: 300_000,
    onProgress: () => queueMicrotask(() => controller.abort()) })).rejects.toThrow();
  expect(admit).toHaveBeenCalledTimes(1);
});
test.each([-1, 300001, 1.5, NaN, '5000'])('rejects invalid wait %s before admission', async waitMs => {
  const admit = jest.fn();
  await expect(waitForInventoryDiscovery(admit, jest.fn(), { waitMs })).rejects.toThrow('inventory_discovery_wait_invalid');
  expect(admit).not.toHaveBeenCalled();
});
test.each([NaN, -1])('rejects invalid monotonic clock (%s)', async next => {
  const now = jest.fn().mockReturnValueOnce(0).mockReturnValue(next);
  await expect(waitForInventoryDiscovery(jest.fn(), jest.fn(), {}, { ...clock(), now })).rejects.toThrow('clock_invalid');
});
test.each([NaN, -1, 2])('bounds injected jitter (%s)', async jitter => {
  const timer = { ...clock(), random: () => jitter }, admit = jest.fn().mockRejectedValueOnce(new DiscoveryDeferredError('busy')).mockImplementation(fn => fn());
  await waitForInventoryDiscovery(admit, () => true, { waitMs: 30_000 }, timer);
  expect(timer.sleep.mock.calls[0][0]).toBe(jitter === 2 ? 6250 : 5000);
});
