/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { setTimeout as sleepFor } from 'node:timers/promises';
import { httpGet } from '../utils/httpClient.mjs';
import * as runtimeSettings from '../config/runtimeSettings.mjs';
import { createLogger } from '../utils/logger.mjs';
import { isCertificateError } from './omdbHealth.mjs';
import { formatResponse } from './omdbResponse.mjs';
import { OMDbLimitReachedError } from './omdbQuota.mjs';

const logger = createLogger('OMDbService');

let lastRequestTime = 0;
let rateLimitLock = Promise.resolve();
const MIN_REQUEST_INTERVAL_MS = 1000;

function getAttemptTimeoutMs(attempt, omdbRuntime) {
	const scaledTimeout = Math.round(omdbRuntime.requestTimeoutMs * Math.pow(omdbRuntime.retryTimeoutMultiplier, attempt));
	return Math.min(omdbRuntime.maxRequestTimeoutMs, scaledTimeout);
}

async function enforceRateLimit() {
	const previousLock = rateLimitLock;
	let releaseLock;
	rateLimitLock = new Promise((resolve) => {
		releaseLock = resolve;
	});

	await previousLock.catch(() => {}); // swallow-error: racing away a stale lock promise — if the previous request failed that's already been handled

	try {
		const now = Date.now();
		const elapsed = now - lastRequestTime;
		if (elapsed < MIN_REQUEST_INTERVAL_MS) {
			const waitTime = MIN_REQUEST_INTERVAL_MS - elapsed;
			logger.debug('OMDb rate limit: waiting before request', { waitMs: waitTime });
			await sleepFor(waitTime);
		}
		lastRequestTime = Date.now();
	} finally {
		releaseLock();
	}
}

export function resetRateLimiterState() {
	lastRequestTime = 0;
	rateLimitLock = Promise.resolve();
}

async function executeLookupWithRetry({ buildParams, logLabel, sourceLabel, lookupValue }, deps) {
	const {
		checkAndIncrementUsage,
		incrementUsageCounter,
		calculateRetryBackoff,
		shouldLogSslWarning,
		warnProviderRuntimeFailure,
		baseUrl,
	} = deps;

	let configId = null;
	const omdbRuntime = runtimeSettings.getOmdbRuntimeConfig();
	const maxRetries = omdbRuntime.maxRetries;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		const requestTimeoutMs = getAttemptTimeoutMs(attempt, omdbRuntime);
		try {
			const { apiKey: validApiKey, configId: id } = await checkAndIncrementUsage();
			configId = id;

			const params = buildParams(validApiKey);

			logger.debug(`OMDb lookup by ${logLabel}`, { [logLabel]: lookupValue, attempt: attempt + 1 });

			await enforceRateLimit();

			const response = await httpGet(baseUrl, {
				params,
				timeout: requestTimeoutMs,
			});

			if (response.data.Response === 'True') {
				await incrementUsageCounter(configId);
				return formatResponse(response.data);
			}

			logger.debug('OMDb not found', { [logLabel]: lookupValue, error: response.data.Error });
			return null;
		} catch (error) {
			const status = error.response?.status;
			const msg = (error.message || '').toLowerCase();
			const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
			const isTransientNetworkError = isTimeout ||
				error.code === 'ECONNRESET' ||
				error.code === 'EAI_AGAIN' ||
				error.code === 'ENOTFOUND' ||
				error.code === 'ECONNREFUSED' ||
				msg.includes('socket hang up');
			const isCloudflareError = status === 429 || status === 502 || status === 503 || status === 504 ||
				(status >= 520 && status <= 527) || status === 530;

			if ((isTransientNetworkError || isCloudflareError) && attempt < maxRetries - 1) {
				const isCloudflare = isCloudflareError;
				const delay = isCloudflare
					? await calculateRetryBackoff(attempt, { baseDelay: 3000, multiplier: 2, maxDelay: 15000 })
					: await calculateRetryBackoff(attempt, { baseDelay: 1000, multiplier: 2, maxDelay: 10000 });

				logger.warn(`OMDb API transient error, retrying`, {
					[logLabel]: lookupValue,
					attempt: attempt + 1,
					maxRetries,
					status,
					code: error.code,
					message: error.message,
					timeoutMs: requestTimeoutMs,
					baseTimeoutMs: omdbRuntime.requestTimeoutMs,
					delayMs: delay,
					isCloudflare
				}, { error, skipDbPersist: true });

				await sleepFor(delay);
				continue;
			}

			if (status === 401) {
				logger.error('OMDb API Unauthorized (401)', { error: error.message }, { error });
				throw new OMDbLimitReachedError('OMDb API Unauthorized: Check API Key or Limits');
			}

			if (isTransientNetworkError || isCloudflareError) {
				warnProviderRuntimeFailure({
					provider: 'omdb',
					category: 'unavailable_after_retries',
					message: `OMDb API unavailable after retries${sourceLabel ? ` (${sourceLabel})` : ''}`,
					metadata: {
						source: logLabel,
						[logLabel]: lookupValue,
						maxRetries,
						status,
						code: error.code || null,
						message: error.message,
						timeoutMs: requestTimeoutMs,
						baseTimeoutMs: omdbRuntime.requestTimeoutMs
					},
					dedupeSignature: `${status || 'NO_STATUS'}:${error.code || 'NO_CODE'}:${(error.message || '').toLowerCase()}`,
				});
				throw error;
			}

			const isCertError = isCertificateError(error);
			if (isCertError) {
				error.isOmdbSslCertError = true;
				if (shouldLogSslWarning(error)) {
					logger.warn(`OMDb SSL certificate issue${sourceLabel ? ` (${sourceLabel})` : ''}`, {
						[logLabel]: lookupValue,
						error: error.message
					}, { error });
				} else {
					logger.debug(`OMDb SSL certificate warning suppressed${sourceLabel ? ` (${sourceLabel})` : ''}`, {
						[logLabel]: lookupValue,
						code: error.code
					});
				}
				throw error;
			}

			logger.error('OMDb API error', { [logLabel]: lookupValue, error: error.message }, { error });
			throw error;
		}
	}
}

export async function getByTitle(title, year, type, _apiKey, deps) {
	return executeLookupWithRetry(
		{
			buildParams: (apiKey) => {
				const params = {
					apikey: apiKey,
					t: title,
					type: type === 'tv' ? 'series' : type,
					plot: 'short'
				};
				if (year) params.y = year;
				return params;
			},
			logLabel: 'title',
			sourceLabel: null,
			lookupValue: title,
		},
		deps
	);
}

export async function getByIMDBId(imdbId, _apiKey, deps) {
	return executeLookupWithRetry(
		{
			buildParams: (apiKey) => ({
				apikey: apiKey,
				i: imdbId,
				plot: 'short',
			}),
			logLabel: 'imdbId',
			sourceLabel: 'IMDB ID',
			lookupValue: imdbId,
		},
		deps
	);
}

export async function search(query, type, _apiKey, deps) {
	const { checkAndIncrementUsage, incrementUsageCounter, baseUrl } = deps;
	let configId = null;
	try {
		await enforceRateLimit();

		const { apiKey: validApiKey, configId: id } = await checkAndIncrementUsage();
		configId = id;

		const response = await httpGet(baseUrl, {
			params: {
				apikey: validApiKey,
				s: query,
				type: type === 'tv' ? 'series' : type,
			},
		});

		if (response.data.Response === 'True') {
			await incrementUsageCounter(configId);
			return response.data.Search.map(item => ({
				title: item.Title,
				year: item.Year,
				imdbId: item.imdbID,
				type: item.Type,
				poster: item.Poster !== 'N/A' ? item.Poster : null
			}));
		}

		return [];
	} catch (error) {
		logger.error('OMDb search error', { query, error: error.message });
		return [];
	}
}
