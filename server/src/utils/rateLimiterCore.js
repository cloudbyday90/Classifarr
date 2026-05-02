/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * Simple rate limiter for external API calls (TMDb, OMDb, Tavily).
 * Uses a token bucket algorithm for smooth rate limiting.
 */
class RateLimiter {
    constructor(options = {}) {
        this.maxRequests = options.maxRequests || 40;
        this.intervalMs = options.intervalMs || 10000;
        this.tokens = this.maxRequests;
        this.lastRefill = Date.now();
        this.queue = [];
        this.processing = false;
    }

    refillTokens() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const refillAmount = Math.floor((elapsed / this.intervalMs) * this.maxRequests);

        if (refillAmount > 0) {
            this.tokens = Math.min(this.maxRequests, this.tokens + refillAmount);
            this.lastRefill = now;
        }
    }

    async acquire() {
        return new Promise((resolve) => {
            const tryAcquire = () => {
                this.refillTokens();

                if (this.tokens > 0) {
                    this.tokens -= 1;
                    resolve();
                } else {
                    const waitTime = Math.ceil(this.intervalMs / this.maxRequests);
                    setTimeout(tryAcquire, waitTime);
                }
            };

            tryAcquire();
        });
    }

    async execute(fn) {
        await this.acquire();
        return fn();
    }

    getStatus() {
        this.refillTokens();
        return {
            availableTokens: this.tokens,
            maxTokens: this.maxRequests,
            intervalMs: this.intervalMs,
        };
    }
}

const rateLimiters = {
    tmdb: new RateLimiter({ maxRequests: 40, intervalMs: 10000 }),
    omdb: new RateLimiter({ maxRequests: 50, intervalMs: 10000 }),
    tavily: new RateLimiter({ maxRequests: 20, intervalMs: 10000 }),
};

const rateLimiterExports = {
    RateLimiter,
    rateLimiters,
};

module.exports = require('./rateLimiter.shared');
