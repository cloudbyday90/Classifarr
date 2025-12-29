/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * Simple rate limiter for external API calls (TMDb, OMDb, Tavily)
 * Uses a token bucket algorithm for smooth rate limiting
 */
class RateLimiter {
    constructor(options = {}) {
        this.maxRequests = options.maxRequests || 40; // Default: TMDb limit
        this.intervalMs = options.intervalMs || 10000; // Default: 10 seconds
        this.tokens = this.maxRequests;
        this.lastRefill = Date.now();
        this.queue = [];
        this.processing = false;
    }

    /**
     * Refill tokens based on elapsed time
     */
    refillTokens() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const refillAmount = Math.floor((elapsed / this.intervalMs) * this.maxRequests);

        if (refillAmount > 0) {
            this.tokens = Math.min(this.maxRequests, this.tokens + refillAmount);
            this.lastRefill = now;
        }
    }

    /**
     * Wait for a token to become available
     * @returns {Promise<void>}
     */
    async acquire() {
        return new Promise((resolve) => {
            const tryAcquire = () => {
                this.refillTokens();

                if (this.tokens > 0) {
                    this.tokens--;
                    resolve();
                } else {
                    // Calculate wait time until next token
                    const waitTime = Math.ceil(this.intervalMs / this.maxRequests);
                    setTimeout(tryAcquire, waitTime);
                }
            };

            tryAcquire();
        });
    }

    /**
     * Execute a function with rate limiting
     * @param {Function} fn - Async function to execute
     * @returns {Promise} - Result of the function
     */
    async execute(fn) {
        await this.acquire();
        return fn();
    }

    /**
     * Get current status
     */
    getStatus() {
        this.refillTokens();
        return {
            availableTokens: this.tokens,
            maxTokens: this.maxRequests,
            intervalMs: this.intervalMs,
        };
    }
}

// Pre-configured rate limiters for different APIs
const rateLimiters = {
    // TMDb: 40 requests per 10 seconds
    tmdb: new RateLimiter({ maxRequests: 40, intervalMs: 10000 }),

    // OMDb: 1000 per day (~42 per hour, ~1 per minute to be safe)
    // Being conservative to avoid hitting daily limit
    omdb: new RateLimiter({ maxRequests: 10, intervalMs: 10000 }),

    // Tavily: Depends on plan, default to conservative
    tavily: new RateLimiter({ maxRequests: 20, intervalMs: 10000 }),
};

module.exports = {
    RateLimiter,
    rateLimiters,
};
