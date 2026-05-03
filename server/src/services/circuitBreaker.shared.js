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

const STATES = {
	CLOSED: 'CLOSED',
	OPEN: 'OPEN',
	HALF_OPEN: 'HALF_OPEN'
};

class CircuitBreaker {
	constructor(options = {}) {
		this.name = options.name || null;
		this._logger = options.logger || createLogger(this.name ? `CircuitBreaker:${this.name}` : 'CircuitBreaker');

		this.failureThreshold = options.failureThreshold || 5;
		this.recoveryTimeout = options.recoveryTimeout || 60000;
		this.halfOpenMaxAttempts = options.halfOpenMaxAttempts || 3;

		this.state = STATES.CLOSED;
		this.failureCount = 0;
		this.successCount = 0;
		this.halfOpenAttempts = 0;
		this.lastFailureTime = null;
		this.lastStateChange = Date.now();
		this._isTransitioning = false;

		this.metrics = {
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			rejectedRequests: 0,
			stateChanges: []
		};

		this.stateHistory = [{
			state: STATES.CLOSED,
			timestamp: Date.now(),
			reason: 'initialized'
		}];
	}

	isAllowed() {
		this.metrics.totalRequests++;

		if (this.state === STATES.CLOSED) {
			return true;
		}

		if (this.state === STATES.OPEN) {
			const timeSinceFailure = Date.now() - this.lastFailureTime;

			if (timeSinceFailure >= this.recoveryTimeout && !this._isTransitioning) {
				this._isTransitioning = true;
				try {
					this.transitionTo(STATES.HALF_OPEN, 'recovery timeout elapsed');
					return true;
				} finally {
					this._isTransitioning = false;
				}
			}

			this.metrics.rejectedRequests++;
			return false;
		}

		if (this.state === STATES.HALF_OPEN) {
			if (this.halfOpenAttempts < this.halfOpenMaxAttempts) {
				this.halfOpenAttempts++;
				return true;
			}

			this.metrics.rejectedRequests++;
			return false;
		}

		return false;
	}

	recordSuccess() {
		this.metrics.successfulRequests++;
		this.successCount++;

		if (this.state === STATES.HALF_OPEN) {
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
			this.failureCount = 0;
		}
	}

	recordFailure(error) {
		this.metrics.failedRequests++;
		this.failureCount++;
		this.lastFailureTime = Date.now();

		this._logger.debug('Circuit breaker recorded failure', {
			state: this.state,
			failureCount: this.failureCount,
			threshold: this.failureThreshold,
			error: error.message
		}, { skipDbPersist: true });

		if (this.state === STATES.HALF_OPEN && !this._isTransitioning) {
			this._isTransitioning = true;
			try {
				this.transitionTo(STATES.OPEN, 'recovery attempt failed');
				this.successCount = 0;
				this.halfOpenAttempts = 0;
			} finally {
				this._isTransitioning = false;
			}
		} else if (this.state === STATES.CLOSED && !this._isTransitioning) {
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

	reset() {
		this._logger.info('Circuit breaker manually reset', null, { skipDbPersist: true });
		this.failureCount = 0;
		this.successCount = 0;
		this.halfOpenAttempts = 0;
		this.lastFailureTime = null;

		if (this.state !== STATES.CLOSED) {
			this.transitionTo(STATES.CLOSED, 'manual reset');
		}
	}

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

		if (this.stateHistory.length > 100) {
			this.stateHistory.shift();
		}

		if (this.metrics.stateChanges.length > 100) {
			this.metrics.stateChanges.shift();
		}

		this._logger.info('Circuit breaker state changed', {
			from: oldState,
			to: newState,
			reason
		}, { skipDbPersist: true });
	}

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

	getStateHistory(limit = 20) {
		return this.stateHistory.slice(-limit);
	}

	getMetrics() {
		return {
			...this.metrics,
			currentState: this.state,
			failureCount: this.failureCount,
			successCount: this.successCount
		};
	}

	async run(fn) {
		if (!this.isAllowed()) {
			const err = new Error('Circuit breaker is OPEN — request rejected');
			err.code = 'CIRCUIT_OPEN';
			throw err;
		}
		try {
			const result = await fn();
			this.recordSuccess();
			return result;
		} catch (err) {
			if (err.name !== 'AbortError') {
				this.recordFailure(err);
			}
			throw err;
		}
	}
}

module.exports = CircuitBreaker;
module.exports.STATES = STATES;
