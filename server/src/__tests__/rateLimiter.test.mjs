/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { RateLimiter } from '../utils/rateLimiter.mjs';
import { jest } from '@jest/globals';

describe('rateLimiter', () => {
    test('execute runs immediately when tokens are available and decrements the bucket', async () => {
        const limiter = new RateLimiter({ maxRequests: 2, intervalMs: 1000 });

        const result = await limiter.execute(async () => 'ok');

        expect(result).toBe('ok');
        expect(limiter.tokens).toBe(1);
    });

    test('getStatus refills tokens based on elapsed time', () => {
        const limiter = new RateLimiter({ maxRequests: 4, intervalMs: 1000 });
        limiter.tokens = 0;
        limiter.lastRefill = Date.now() - 1000;

        const status = limiter.getStatus();

        expect(status.availableTokens).toBe(4);
        expect(status.maxTokens).toBe(4);
        expect(status.intervalMs).toBe(1000);
    });
});

test('cancels a waiting token without a retained timer, listener or later request', async () => {
    jest.useFakeTimers();
    try {
        const limiter = new RateLimiter({ maxRequests: 1, intervalMs: 1000 });
        await limiter.acquire();
        const controller = new AbortController(); const fn = jest.fn();
        const remove = jest.spyOn(controller.signal, 'removeEventListener');
        const pending = limiter.execute(fn, { signal: controller.signal });
        const rejected = expect(pending).rejects.toThrow('stopped');
        expect(jest.getTimerCount()).toBe(1);
        controller.abort(new Error('stopped'));
        await rejected;
        expect(jest.getTimerCount()).toBe(0);
        expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
        await jest.advanceTimersByTimeAsync(2000);
        expect(fn).not.toHaveBeenCalled();
        expect(limiter.getStatus().availableTokens).toBe(1);
    } finally { jest.restoreAllMocks(); jest.useRealTimers(); }
});

test('pre-cancelled admission does not consume tokens; cancellation after admission prevents execution', async () => {
    const limiter = new RateLimiter({ maxRequests: 2 }); const fn = jest.fn();
    await expect(limiter.execute(fn, { signal: AbortSignal.abort(new Error('before')) })).rejects.toThrow('before');
    expect(limiter.tokens).toBe(2);
    const controller = new AbortController();
    const pending = limiter.execute(fn, { signal: controller.signal });
    controller.abort(new Error('after'));
    await expect(pending).rejects.toThrow('after');
    expect(fn).not.toHaveBeenCalled();
});

test('uncancelled waiting acquisition still runs and removes its listener', async () => {
    jest.useFakeTimers();
    try {
        const limiter = new RateLimiter({ maxRequests: 1, intervalMs: 1000 });
        await limiter.acquire();
        const controller = new AbortController();
        const remove = jest.spyOn(controller.signal, 'removeEventListener');
        const pending = limiter.execute(() => 'done', { signal: controller.signal });
        await jest.advanceTimersByTimeAsync(1000);
        expect(await pending).toBe('done');
        expect(jest.getTimerCount()).toBe(0);
        expect(remove).toHaveBeenCalled();
        controller.abort();
        expect(limiter.tokens).toBe(0);
    } finally { jest.restoreAllMocks(); jest.useRealTimers(); }
});
