/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as runtimeSettings from '../config/runtimeSettings.mjs';
import { metadataProviderIntegrityService } from './metadataProviderIntegrityService.mjs';
import * as retryUtils from '../utils/retryUtils.mjs';
import { getCertificateErrorSignature } from './omdbHealth.mjs';
import { OMDbLimitReachedError, hasRemainingQuota, checkAndIncrementUsage, incrementUsageCounter } from './omdbQuota.mjs';
import { testConnection, checkHealth } from './omdbHealth.mjs';
import { formatResponse, extractClassificationData } from './omdbResponse.mjs';
import { getByTitle, getByIMDBId, search, resetRateLimiterState } from './omdbLookup.mjs';

export { OMDbLimitReachedError };

class OMDbService {
	constructor(deps = {}) {
		this.baseUrl = 'https://www.omdbapi.com';
		this.lastSslWarnAt = 0;
		this.lastSslWarnSignature = null;
		this.metadataProviderIntegrityService = deps.metadataProviderIntegrityService || metadataProviderIntegrityService;
		this.retryUtils = deps.retryUtils || retryUtils;
	}

	async calculateRetryBackoff(attempt, options) {
		const { calculateBackoff } = this.retryUtils;
		return calculateBackoff(attempt, options);
	}

	shouldLogSslWarning(error) {
		const now = Date.now();
		const signature = getCertificateErrorSignature(error);
		const isSameSignature = signature === this.lastSslWarnSignature;
		const inThrottleWindow = (now - this.lastSslWarnAt) < runtimeSettings.getOmdbRuntimeConfig().sslWarnThrottleMs;

		if (isSameSignature && inThrottleWindow) {
			return false;
		}

		this.lastSslWarnAt = now;
		this.lastSslWarnSignature = signature;
		return true;
	}

	async hasRemainingQuota() {
		return hasRemainingQuota();
	}

	async checkAndIncrementUsage() {
		return checkAndIncrementUsage({
			metadataProviderIntegrityService: this.metadataProviderIntegrityService,
		});
	}

	async incrementUsageCounter(configId) {
		return incrementUsageCounter(configId);
	}

	async testConnection(apiKey) {
		return testConnection(this.baseUrl, apiKey);
	}

	async checkHealth(apiKey) {
		return checkHealth(this.baseUrl, apiKey);
	}

	async getByTitle(title, year, type, apiKey) {
		return getByTitle(title, year, type, apiKey, {
			checkAndIncrementUsage: () => this.checkAndIncrementUsage(),
			incrementUsageCounter: (id) => this.incrementUsageCounter(id),
			calculateRetryBackoff: (attempt, opts) => this.calculateRetryBackoff(attempt, opts),
			shouldLogSslWarning: (err) => this.shouldLogSslWarning(err),
			warnProviderRuntimeFailure: (opts) => this.metadataProviderIntegrityService.warnProviderRuntimeFailure(opts),
			baseUrl: this.baseUrl,
		});
	}

	async getByIMDBId(imdbId, apiKey) {
		return getByIMDBId(imdbId, apiKey, {
			checkAndIncrementUsage: () => this.checkAndIncrementUsage(),
			incrementUsageCounter: (id) => this.incrementUsageCounter(id),
			calculateRetryBackoff: (attempt, opts) => this.calculateRetryBackoff(attempt, opts),
			shouldLogSslWarning: (err) => this.shouldLogSslWarning(err),
			warnProviderRuntimeFailure: (opts) => this.metadataProviderIntegrityService.warnProviderRuntimeFailure(opts),
			baseUrl: this.baseUrl,
		});
	}

	async search(query, type, apiKey) {
		return search(query, type, apiKey, {
			checkAndIncrementUsage: () => this.checkAndIncrementUsage(),
			incrementUsageCounter: (id) => this.incrementUsageCounter(id),
			baseUrl: this.baseUrl,
		});
	}

	formatResponse(data) {
		return formatResponse(data);
	}

	extractClassificationData(omdbData) {
		return extractClassificationData(omdbData);
	}

	_resetRateLimiter() {
		resetRateLimiterState();
		this.lastSslWarnAt = 0;
		this.lastSslWarnSignature = null;
	}
}

export const omdbService = new OMDbService();
