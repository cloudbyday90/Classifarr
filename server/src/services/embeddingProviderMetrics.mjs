/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

export const COLD_MODEL_IDLE_THRESHOLD = 5 * 60 * 1000;

export function createInitialMetrics() {
    return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        retryAttempts: 0,
        totalLatency: 0,
        lastRequestTime: null,
        errorHistory: [],
        retryHistory: []
    };
}

export function isModelCold(metrics, threshold = COLD_MODEL_IDLE_THRESHOLD) {
    if (!metrics.lastRequestTime) {
        return true;
    }

    const idleTime = Date.now() - metrics.lastRequestTime;
    return idleTime > threshold;
}

export function getAdaptiveTimeout(config, metrics, threshold) {
    const warmupTimeout = config.warmup_timeout || 120000;
    const requestTimeout = config.request_timeout || 30000;
    return isModelCold(metrics, threshold) ? warmupTimeout : requestTimeout;
}

export function recordError(metrics, error, latency, retryable) {
    const errorRecord = {
        timestamp: Date.now(),
        message: error.message,
        code: error.response?.status || error.code,
        latency,
        retryable
    };

    metrics.errorHistory.push(errorRecord);
    if (metrics.errorHistory.length > 100) {
        metrics.errorHistory.shift();
    }
}

export function recordRetry(metrics, attempt, error, delay, retryAfter) {
    const retryRecord = {
        timestamp: Date.now(),
        attempt,
        error: error.message,
        backoffDelay: delay,
        retryAfter: retryAfter || null
    };

    metrics.retryHistory.push(retryRecord);
    metrics.retryAttempts++;

    if (metrics.retryHistory.length > 100) {
        metrics.retryHistory.shift();
    }
}

export function getMetricsSnapshot(metrics, cold, circuitBreakerStatus) {
    const avgLatency = metrics.totalRequests > 0
        ? metrics.totalLatency / metrics.totalRequests
        : 0;

    return {
        totalRequests: metrics.totalRequests,
        successfulRequests: metrics.successfulRequests,
        failedRequests: metrics.failedRequests,
        retryAttempts: metrics.retryAttempts,
        avgLatency: Math.round(avgLatency),
        lastRequestTime: metrics.lastRequestTime,
        isModelCold: cold,
        errorHistory: metrics.errorHistory.slice(-100),
        retryHistory: metrics.retryHistory.slice(-100),
        circuitBreaker: circuitBreakerStatus
    };
}
