/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const { createLogger } = require('../utils/logger');

const logger = createLogger('CircuitBreaker');

/**
 * Circuit breaker states
 */
const STATES = {
    CLOSED: 'CLOSED',       // Normal operation
    OPEN: 'OPEN',           // Blocking requests
    HALF_OPEN: 'HALF_OPEN'  // Testing recovery
};

/**
 * Circuit Breaker pattern implementation
 * Prevents cascading failures by tracking errors and temporarily blocking requests
 * 
 * Note: This implementation is designed for single-process usage. In a distributed 
 * or multi-threaded environment, the state transitions may have race conditions.
 * For production use with high concurrency, consider using a distributed circuit 
 * breaker implementation with atomic operations.
 */
class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.recoveryTimeout = options.recoveryTimeout || 60000; // 60 seconds
        this.halfOpenMaxAttempts = options.halfOpenMaxAttempts || 3;

        this.state = STATES.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenAttempts = 0;
        this.lastFailureTime = null;
        this.lastStateChange = Date.now();
        
        // Simple mutex flag to prevent concurrent state modifications
        this._isTransitioning = false;
        
        // Metrics tracking
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            rejectedRequests: 0,
            stateChanges: []
        };

        // State history
        this.stateHistory = [{
            state: STATES.CLOSED,
            timestamp: Date.now(),
            reason: 'initialized'
        }];
    }

    /**
     * Check if a request is allowed
     * @returns {boolean} True if request should proceed
     */
    isAllowed() {
        this.metrics.totalRequests++;

        // CLOSED state - allow all requests
        if (this.state === STATES.CLOSED) {
            return true;
        }

        // OPEN state - check if recovery timeout has passed
        if (this.state === STATES.OPEN) {
            const timeSinceFailure = Date.now() - this.lastFailureTime;
            
            // Use mutex to prevent race condition during state transition
            if (timeSinceFailure >= this.recoveryTimeout && !this._isTransitioning) {
                this._isTransitioning = true;
                try {
                    // Transition to HALF_OPEN for recovery testing
                    this.transitionTo(STATES.HALF_OPEN, 'recovery timeout elapsed');
                    return true;
                } finally {
                    this._isTransitioning = false;
                }
            }

            // Still in timeout period - reject
            this.metrics.rejectedRequests++;
            return false;
        }

        // HALF_OPEN state - allow limited attempts
        if (this.state === STATES.HALF_OPEN) {
            if (this.halfOpenAttempts < this.halfOpenMaxAttempts) {
                this.halfOpenAttempts++;
                return true;
            }

            // Max attempts reached - reject
            this.metrics.rejectedRequests++;
            return false;
        }

        return false;
    }

    /**
     * Record a successful request
     * Note: In high-concurrency scenarios, counter increments may have race conditions.
     * This is acceptable for metrics tracking but may cause slight inaccuracies.
     */
    recordSuccess() {
        this.metrics.successfulRequests++;
        this.successCount++;

        if (this.state === STATES.HALF_OPEN) {
            // Enough successes - recover to CLOSED
            if (this.successCount >= this.halfOpenMaxAttempts && !this._isTransitioning) {
                this._isTransitioning = true;
                try {
                    this.transitionTo(STATES.CLOSED, 'recovery successful');
                    this.reset();
                } finally {
                    this._isTransitioning = false;
                }
            }
        } else if (this.state === STATES.CLOSED) {
            // Reset failure count on success
            this.failureCount = 0;
        }
    }

    /**
     * Record a failed request
     * @param {Error} error - The error that occurred
     * Note: In high-concurrency scenarios, counter increments and threshold checks
     * may have race conditions. This could cause multiple concurrent failures to 
     * trigger state transitions. The mutex helps but doesn't completely eliminate
     * the race in a truly concurrent environment.
     */
    recordFailure(error) {
        this.metrics.failedRequests++;
        this.failureCount++;
        this.lastFailureTime = Date.now();

        logger.warn('Circuit breaker recorded failure', {
            state: this.state,
            failureCount: this.failureCount,
            threshold: this.failureThreshold,
            error: error.message
        }, { error });

        if (this.state === STATES.HALF_OPEN && !this._isTransitioning) {
            // Failed during recovery - go back to OPEN
            this._isTransitioning = true;
            try {
                this.transitionTo(STATES.OPEN, 'recovery attempt failed');
                this.successCount = 0;
                this.halfOpenAttempts = 0;
            } finally {
                this._isTransitioning = false;
            }
        } else if (this.state === STATES.CLOSED && !this._isTransitioning) {
            // Check if threshold exceeded
            if (this.failureCount >= this.failureThreshold) {
                this._isTransitioning = true;
                try {
                    this.transitionTo(STATES.OPEN, `failure threshold (${this.failureThreshold}) exceeded`);
                } finally {
                    this._isTransitioning = false;
                }
            }
        }
    }

    /**
     * Manually reset the circuit breaker
     */
    reset() {
        logger.info('Circuit breaker manually reset');
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenAttempts = 0;
        this.lastFailureTime = null;
        
        if (this.state !== STATES.CLOSED) {
            this.transitionTo(STATES.CLOSED, 'manual reset');
        }
    }

    /**
     * Transition to a new state
     * @param {string} newState - The new state
     * @param {string} reason - Reason for transition
     */
    transitionTo(newState, reason) {
        const oldState = this.state;
        this.state = newState;
        this.lastStateChange = Date.now();

        const change = {
            from: oldState,
            to: newState,
            timestamp: Date.now(),
            reason
        };

        this.stateHistory.push(change);
        this.metrics.stateChanges.push(change);

        // Keep history limited
        if (this.stateHistory.length > 100) {
            this.stateHistory.shift();
        }

        logger.info('Circuit breaker state changed', {
            from: oldState,
            to: newState,
            reason
        });
    }

    /**
     * Get current status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
            lastStateChange: this.lastStateChange,
            metrics: {
                totalRequests: this.metrics.totalRequests,
                successfulRequests: this.metrics.successfulRequests,
                failedRequests: this.metrics.failedRequests,
                rejectedRequests: this.metrics.rejectedRequests
            },
            config: {
                failureThreshold: this.failureThreshold,
                recoveryTimeout: this.recoveryTimeout,
                halfOpenMaxAttempts: this.halfOpenMaxAttempts
            }
        };
    }

    /**
     * Get state history
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} State history
     */
    getStateHistory(limit = 20) {
        return this.stateHistory.slice(-limit);
    }

    /**
     * Get metrics
     * @returns {Object} Metrics data
     */
    getMetrics() {
        return {
            ...this.metrics,
            currentState: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount
        };
    }
}

module.exports = CircuitBreaker;
module.exports.STATES = STATES;
