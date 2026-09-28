/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import { jest } from '@jest/globals';
import { createQueueWorkerWakeup } from '../services/queueWorkerWakeup.mjs';

describe('coalesced queue wakeups', () => {
    it('retains and coalesces notifications before sleeping without allocating a timer', async () => {
        const wait = jest.fn().mockResolvedValue();
        const wakeup = createQueueWorkerWakeup({ wait });
        for (let i = 0; i < 10_000; i++) wakeup.notify();
        await wakeup.wait(1000);
        expect(wait).not.toHaveBeenCalled();
        wakeup.acknowledge();
        await wakeup.wait(1000);
        expect(wait).toHaveBeenCalledTimes(1);
    });

    it('cancels and settles the real Node timer on notification, then can wait again', async () => {
        const wakeup = createQueueWorkerWakeup();
        const sleeping = wakeup.wait(60_000);
        wakeup.notify();
        await sleeping;
        wakeup.acknowledge();
        await wakeup.wait(1);
    });

    it('preserves cooldown despite pending hints and bursts, but allows shutdown cancellation', async () => {
        const wakeup = createQueueWorkerWakeup();
        wakeup.notify();
        let settled = false;
        const sleeping = wakeup.wait(60_000, { interruptible: false }).then(() => { settled = true; });
        for (let i = 0; i < 10_000; i++) wakeup.notify();
        await new Promise(resolve => { setImmediate(resolve); });
        expect(settled).toBe(false);
        wakeup.cancel();
        await sleeping;
        expect(settled).toBe(true);
    });

    it('rejects concurrent waits without disturbing the existing sleeper', async () => {
        const wakeup = createQueueWorkerWakeup();
        const sleeping = wakeup.wait(60_000);
        await expect(wakeup.wait(10)).rejects.toThrow('queue_worker_wait_already_active');
        wakeup.cancel();
        await sleeping;
        wakeup.cancel(); // Idempotent; does not prevent a later wait.
        await wakeup.wait(1);
    });

    it.each(['Error', 'AbortError'])('propagates unexpected %s and cleans up', async name => {
        const error = Object.assign(new Error('timer_failed'), { name });
        const wait = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce();
        const wakeup = createQueueWorkerWakeup({ wait });
        await expect(wakeup.wait(1)).rejects.toBe(error);
        await wakeup.wait(1);
        expect(wait).toHaveBeenCalledTimes(2);
    });

    it('does not hide a non-abort failure when cancellation races with failure', async () => {
        let reject;
        const wakeup = createQueueWorkerWakeup({ wait: () => new Promise((_, fail) => { reject = fail; }) });
        const sleeping = wakeup.wait(1000);
        wakeup.cancel();
        reject(new Error('timer_failed'));
        await expect(sleeping).rejects.toThrow('timer_failed');
    });
});
