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
import { OMDbLimitReachedError, rejectOmdbCredential } from './omdbQuota.mjs';
import { isProviderCredentialRejection } from './providerCredentialRejection.mjs';
import { classifyOmdbResponse } from './omdbResponseClassifier.mjs';
import { OMDbProviderError, createOmdbProviderError } from './omdbProviderError.mjs';
import { OMDB_MAX_RESPONSE_BYTES } from './omdbRequestPolicy.mjs';
import { observeOmdbPacing } from './omdbPacingObservation.mjs';

const logger = createLogger('OMDbService');

function getAttemptTimeoutMs(attempt, omdbRuntime) {
	const scaledTimeout = Math.round(omdbRuntime.requestTimeoutMs * Math.pow(omdbRuntime.retryTimeoutMultiplier, attempt));
	return Math.min(omdbRuntime.maxRequestTimeoutMs, scaledTimeout);
}

async function executeLookupWithRetry({ buildParams, logLabel, sourceLabel, lookupValue }, deps) {
	const {
		checkAndIncrementUsage,
		calculateRetryBackoff,
		shouldLogSslWarning,
		warnProviderRuntimeFailure,
		baseUrl,
	} = deps;

	const omdbRuntime = runtimeSettings.getOmdbRuntimeConfig();
	const maxRetries = deps.queueOwned === true ? 1 : omdbRuntime.maxRetries;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		const requestTimeoutMs = getAttemptTimeoutMs(attempt, omdbRuntime);
		// Admission failures never enter provider retry handling. No DB lock spans HTTP.
		const { apiKey: validApiKey, credentialContext } = await checkAndIncrementUsage();
		try {
			const params = buildParams(validApiKey);

			logger.debug(`OMDb lookup by ${logLabel}`, { [logLabel]: lookupValue, attempt: attempt + 1 });

			const response = await httpGet(baseUrl, {
				params,
				timeout: requestTimeoutMs,
				maxResponseBytes: OMDB_MAX_RESPONSE_BYTES,
				redirect: 'error',
			});
			await observeOmdbPacing(response, credentialContext);

			const outcome = classifyOmdbResponse(response.data, response.status);
			if (outcome.kind === 'success') {
				return formatResponse(response.data);
			}
			if (outcome.kind !== 'not_found') throw createOmdbProviderError(outcome);
			logger.debug('OMDb not found', { [logLabel]: lookupValue });
			deps.onNotFound?.(credentialContext);
			return null;
		} catch (error) {
			const status = error.response?.status;
			const retryAfterSeconds = await observeOmdbPacing(error.response, credentialContext);
			if (error.response) {
				const outcome = classifyOmdbResponse(error.response.data, status);
				if (['authentication', 'quota_exhausted'].includes(outcome.kind) ||
					(status >= 400 && status < 500 && status !== 429)) {
					error = createOmdbProviderError(outcome);
				} else {
					// Retry diagnostics need the status, never an upstream body or request credential.
					error = new Error('OMDb HTTP request failed');
					error.response = { status };
					error.retryAfterSeconds = retryAfterSeconds;
				}
			}
			if (isProviderCredentialRejection(error) && credentialContext) {
				try { await (deps.rejectCredential ?? rejectOmdbCredential)(credentialContext); }
				catch { logger.warn('OMDb credential pause could not be persisted; retry work remains deferred'); }
			}
			if (error instanceof OMDbProviderError || error instanceof OMDbLimitReachedError ||
				error.code === 'HTTP_RESPONSE_TOO_LARGE') {
				logger.warn(error.message, { source: logLabel, status, code: error.code }, {
					dedupeKey: `omdb_response_${error.code || error.name}`, dedupeWindowMs: 30 * 60 * 1000,
				});
				throw error;
			}
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
	const { checkAndIncrementUsage, baseUrl } = deps;
	const { apiKey: validApiKey, credentialContext } = await checkAndIncrementUsage();
	try {
		const response = await httpGet(baseUrl, {
			maxResponseBytes: OMDB_MAX_RESPONSE_BYTES,
			redirect: 'error',
			timeout: runtimeSettings.getOmdbRuntimeConfig().requestTimeoutMs,
			params: {
				apikey: validApiKey,
				s: query,
				type: type === 'tv' ? 'series' : type,
			},
		});

		await observeOmdbPacing(response, credentialContext);
		const outcome = classifyOmdbResponse(response.data, response.status, 'search');
		if (outcome.kind === 'success') {
			return response.data.Search.map(item => ({
				title: item.Title,
				year: item.Year,
				imdbId: item.imdbID,
				type: item.Type,
				poster: item.Poster !== 'N/A' ? item.Poster : null
			}));
		}

		if (outcome.kind === 'not_found') return [];
		throw createOmdbProviderError(outcome);
	} catch (error) {
		const retryAfterSeconds = await observeOmdbPacing(error.response, credentialContext);
		if (error.response) {
			error = createOmdbProviderError(classifyOmdbResponse(error.response.data, error.response.status, 'search'));
			error.retryAfterSeconds = retryAfterSeconds;
		}
		if (isProviderCredentialRejection(error) && credentialContext) {
			try { await (deps.rejectCredential ?? rejectOmdbCredential)(credentialContext); }
			catch { logger.warn('OMDb credential pause could not be persisted; retry work remains deferred'); }
		}
		throw error;
	}
}
