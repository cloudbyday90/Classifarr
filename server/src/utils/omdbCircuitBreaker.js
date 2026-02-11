/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const CircuitBreaker = require('../services/circuitBreaker');
const { createLogger } = require('./logger');

const logger = createLogger('OMDbCircuitBreaker');
const BLOCK_WARN_THROTTLE_MS = 60000;
const blockedWarnState = new Map();

function shouldEmitBlockedWarn(code) {
    const now = Date.now();
    const current = blockedWarnState.get(code) || { lastWarnAt: 0, suppressed: 0 };
    const elapsed = now - current.lastWarnAt;

    if (elapsed >= BLOCK_WARN_THROTTLE_MS) {
        blockedWarnState.set(code, {
            lastWarnAt: now,
            suppressed: 0
        });
        return {
            emit: true,
            suppressed: current.suppressed
        };
    }

    blockedWarnState.set(code, {
        lastWarnAt: current.lastWarnAt,
        suppressed: current.suppressed + 1
    });

    return {
        emit: false,
        suppressed: current.suppressed + 1
    };
}

/**
 * Circuit breaker for OMDb API
 * Configuration:
 * - Failure threshold: 3 consecutive failures
 * - Success threshold: 2 successful requests to close from HALF_OPEN
 * - Timeout: 30 seconds cool-off period
 * - Only trips on network errors: ECONNABORTED, ETIMEDOUT, ECONNREFUSED
 */
const omdbCircuitBreaker = new CircuitBreaker({
    failureThreshold: 3,
    recoveryTimeout: 30000, // 30 seconds
    halfOpenMaxAttempts: 2
});

/**
 * Check if an error should trip the circuit breaker
 * Only network errors should trip the breaker
 * @param {Error} error - The error to check
 * @returns {boolean} True if error should trip the breaker
 */
function shouldTripBreaker(error) {
    const networkErrorCodes = ['ECONNABORTED', 'ETIMEDOUT', 'ECONNREFUSED'];
    return networkErrorCodes.includes(error.code);
}

/**
 * Execute a function with circuit breaker protection
 * @param {Function} fn - Async function to execute
 * @returns {Promise} Result of the function
 * @throws {Error} If circuit is open or function fails
 */
async function execute(fn) {
    // Check if circuit allows the request
    if (!omdbCircuitBreaker.isAllowed()) {
        const status = omdbCircuitBreaker.getStatus();
        
        let error;
        let logMeta = {
            state: status.state,
            failureCount: status.failureCount
        };

        if (status.state === 'OPEN') {
            error = new Error('OMDb circuit breaker is OPEN');
            error.code = 'CIRCUIT_BREAKER_OPEN';
            // For OPEN state, next attempt is based on last failure time and recovery timeout
            error.nextAttempt = status.lastFailureTime + omdbCircuitBreaker.recoveryTimeout;
            logMeta.nextAttempt = new Date(error.nextAttempt).toISOString();
        } else if (status.state === 'HALF_OPEN') {
            // In HALF_OPEN, denial may be due to halfOpenMaxAttempts being exceeded (throttling)
            error = new Error('OMDb circuit breaker is HALF_OPEN and maximum concurrent attempts have been reached');
            error.code = 'CIRCUIT_BREAKER_HALF_OPEN_THROTTLED';
            // Do not derive nextAttempt from lastFailureTime in HALF_OPEN throttling scenario
            error.nextAttempt = null;
        } else {
            // Fallback for any other non-allowed state
            error = new Error('OMDb circuit breaker is not allowing requests');
            error.code = 'CIRCUIT_BREAKER_REJECTED';
            error.nextAttempt = null;
        }

        if (error.code === 'CIRCUIT_BREAKER_HALF_OPEN_THROTTLED') {
            // HALF_OPEN throttling is expected backpressure while recovery probes are in-flight.
            // Keep this out of WARN/DB logs to avoid noisy incident spam.
            logger.debug('OMDb circuit breaker HALF_OPEN throttled request', logMeta);
        } else {
            const decision = shouldEmitBlockedWarn(error.code);
            if (decision.emit) {
                logger.warn('OMDb circuit breaker blocked request', {
                    ...logMeta,
                    ...(decision.suppressed > 0 ? { suppressedSinceLastWarn: decision.suppressed } : {})
                });
            } else {
                logger.debug('OMDb circuit breaker blocked request (warn suppressed)', {
                    ...logMeta,
                    suppressedSinceLastWarn: decision.suppressed
                });
            }
        }

        throw error;
    }

    try {
        const result = await fn();
        omdbCircuitBreaker.recordSuccess();
        return result;
    } catch (error) {
        // Only record failure for network errors
        if (shouldTripBreaker(error)) {
            omdbCircuitBreaker.recordFailure(error);
        }
        throw error;
    }
}

/**
 * Get current circuit breaker status
 * @returns {Object} Circuit breaker status
 */
function getStatus() {
    const status = omdbCircuitBreaker.getStatus();
    return {
        state: status.state,
        failureCount: status.failureCount,
        successCount: status.successCount,
        nextAttempt: status.lastFailureTime ? status.lastFailureTime + omdbCircuitBreaker.recoveryTimeout : null,
        metrics: status.metrics,
        config: status.config
    };
}

/**
 * Reset the circuit breaker
 */
function reset() {
    logger.info('Resetting OMDb circuit breaker');
    omdbCircuitBreaker.reset();
}

module.exports = {
    execute,
    getStatus,
    reset,
    shouldTripBreaker
};
