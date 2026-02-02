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

        logger.warn('OMDb circuit breaker blocked request', logMeta);
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
