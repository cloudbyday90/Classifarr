/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { RateLimiter } from '../utils/rateLimiter.mjs';

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