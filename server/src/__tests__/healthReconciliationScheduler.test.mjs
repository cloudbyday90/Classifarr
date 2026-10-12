/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createHealthReconciliationScheduler } from '../services/healthReconciliationScheduler.mjs';

beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test('start is idempotent, delays reads, and stop cancels the next cycle', async () => {
    const read = jest.fn().mockResolvedValue(undefined);
    const scheduler = createHealthReconciliationScheduler(read);
    scheduler.start(); scheduler.start();
    expect(jest.getTimerCount()).toBe(1);
    await jest.advanceTimersByTimeAsync(29999);
    expect(read).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(1);
    scheduler.stop(); scheduler.stop();
    await jest.advanceTimersByTimeAsync(60000);
    expect(read).toHaveBeenCalledTimes(1);
});

test('slow work, stop and restart never overlap admitted cycles', async () => {
    let resolve;
    const read = jest.fn(() => new Promise(yes => { resolve = yes; }));
    const scheduler = createHealthReconciliationScheduler(read);
    scheduler.start();
    await jest.advanceTimersByTimeAsync(30000);
    scheduler.stop(); scheduler.start();
    await jest.advanceTimersByTimeAsync(120000);
    expect(read).toHaveBeenCalledTimes(1);
    resolve();
    await jest.advanceTimersByTimeAsync(29999);
    expect(read).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    scheduler.stop(); resolve();
    await jest.advanceTimersByTimeAsync(60000);
    expect(jest.getTimerCount()).toBe(0);
});

test('unexpected failure is contained and uses normal delay, not an immediate retry', async () => {
    const read = jest.fn().mockRejectedValue(new Error('private fixture'));
    const scheduler = createHealthReconciliationScheduler(read);
    scheduler.start();
    await jest.advanceTimersByTimeAsync(60000);
    expect(read).toHaveBeenCalledTimes(2);
    scheduler.stop();
});
