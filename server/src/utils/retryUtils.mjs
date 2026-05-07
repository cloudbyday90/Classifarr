/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Retry utilities for handling transient errors with exponential backoff
 */

/**
 * Calculate exponential backoff delay with jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {Object} options - Backoff options
 * @param {number} options.baseDelay - Base delay in milliseconds (default: 1000)
 * @param {number} options.multiplier - Backoff multiplier (default: 2)
 * @param {number} options.jitter - Jitter factor 0-1 (default: 0.3)
 * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 60000)
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoff(attempt, options = {}) {
	const {
		baseDelay = 1000,
		multiplier = 2,
		jitter = 0.3,
		maxDelay = 60000
	} = options;

	const exponentialDelay = baseDelay * Math.pow(multiplier, attempt);
	const jitterRange = exponentialDelay * jitter;
	const jitteredDelay = exponentialDelay + (Math.random() * 2 - 1) * jitterRange;
	const clampedDelay = Math.max(0, jitteredDelay);

	return Math.min(clampedDelay, maxDelay);
}

/**
 * Parse Retry-After header
 * Supports both delay-seconds and HTTP-date formats
 * @param {string} header - Retry-After header value
 * @returns {number|null} Delay in milliseconds, or null if invalid
 */
export function parseRetryAfter(header) {
	if (!header) {
		return null;
	}

	const delaySeconds = parseInt(header, 10);
	if (!isNaN(delaySeconds) && delaySeconds > 0) {
		return delaySeconds * 1000;
	}

	try {
		const date = new Date(header);
		if (!isNaN(date.getTime())) {
			const delay = date.getTime() - Date.now();
			return delay > 0 ? delay : null;
		}
	} catch (_error) {
		// Invalid date format.
	}

	return null;
}

/**
 * Check if an error is retryable (transient)
 * @param {Error} error - Error object
 * @returns {boolean} True if error is retryable
 */
export function isRetryableError(error) {
	if (error.code === 'ECONNRESET' ||
		error.code === 'ENOTFOUND' ||
		error.code === 'ETIMEDOUT' ||
		error.code === 'ECONNREFUSED') {
		return true;
	}

	if (error.response) {
		const status = error.response.status;

		if (status === 429) {
			return true;
		}

		if (status >= 500 && status < 600) {
			return true;
		}

		if (status === 408) {
			return true;
		}
	}

	if (error.message && (
		error.message.includes('timeout') ||
		error.message.includes('timed out') ||
		error.message.includes('ETIMEDOUT')
	)) {
		return true;
	}

	return false;
}

/**
 * Get retry delay for an error
 * Honors Retry-After header if present, otherwise calculates backoff
 * @param {Error} error - Error object
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {Object} options - Backoff options
 * @returns {number} Delay in milliseconds
 */
export function getRetryDelay(error, attempt, options = {}) {
	if (error.response && error.response.headers) {
		const retryAfter = error.response.headers['retry-after'];
		const delay = parseRetryAfter(retryAfter);

		if (delay !== null) {
			return delay;
		}
	}

	return calculateBackoff(attempt, options);
}

/**
 * Wrap an async function with retry logic
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in milliseconds (default: 1000)
 * @param {number} options.multiplier - Backoff multiplier (default: 2)
 * @param {number} options.jitter - Jitter factor 0-1 (default: 0.3)
 * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 60000)
 * @param {Function} options.onRetry - Callback on retry (error, attempt, delay)
 * @returns {Function} Wrapped function
 */
export function withRetry(fn, options = {}) {
	const {
		maxRetries = 3,
		onRetry = null
	} = options;

	return async function (...args) {
		let lastError;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await fn(...args);
			} catch (error) {
				lastError = error;

				if (!isRetryableError(error) || attempt === maxRetries) {
					throw error;
				}

				const delay = getRetryDelay(error, attempt, options);

				if (onRetry) {
					onRetry(error, attempt, delay);
				}

				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}

		throw lastError;
	};
}

const retryUtils = {
	calculateBackoff,
	parseRetryAfter,
	isRetryableError,
	getRetryDelay,
	withRetry
};

export default retryUtils;
