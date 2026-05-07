/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import axios from 'axios';
import * as db from '../config/database.mjs';
import * as runtimeSettings from '../config/runtimeSettings.mjs';
import { createLogger } from '../utils/logger.mjs';
import * as retryUtils from '../utils/retryUtils.mjs';

const logger = createLogger('OMDbService');

let lastRequestTime = 0;
let rateLimitLock = Promise.resolve();
const MIN_REQUEST_INTERVAL_MS = 1000;

function getAttemptTimeoutMs(attempt, omdbRuntime) {
	const scaledTimeout = Math.round(omdbRuntime.requestTimeoutMs * Math.pow(omdbRuntime.retryTimeoutMultiplier, attempt));
	return Math.min(omdbRuntime.maxRequestTimeoutMs, scaledTimeout);
}

function isCertificateError(error) {
	if (!error) {
		return false;
	}

	const message = (error.message || '').toLowerCase();
	return error.code === 'CERT_HAS_EXPIRED' ||
		error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
		error.code === 'CERT_NOT_YET_VALID' ||
		message.includes('certificate');
}

function getCertificateErrorSignature(error) {
	const code = error?.code || 'NO_CODE';
	const message = (error?.message || 'no_message').toLowerCase();
	return `${code}:${message}`;
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
			await new Promise(resolve => setTimeout(resolve, waitTime));
		}
		lastRequestTime = Date.now();
	} finally {
		releaseLock();
	}
}

export class OMDbLimitReachedError extends Error {
	constructor(message) {
		super(message);
		this.name = 'OMDbLimitReachedError';
	}
}

class OMDbService {
	constructor(deps = {}) {
		this.baseUrl = 'https://www.omdbapi.com';
		this.lastSslWarnAt = 0;
		this.lastSslWarnSignature = null;
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
		try {
			const result = await db.query('SELECT * FROM omdb_config WHERE is_active = true LIMIT 1');
			const config = result.rows[0];

			if (!config || !config.api_key) {
				return { available: false, used: 0, limit: 0, reason: 'OMDb API key not configured' };
			}

			const today = new Date().toLocaleDateString('en-CA');
			const lastReset = config.last_reset_date
				? (typeof config.last_reset_date === 'string'
					? config.last_reset_date.split('T')[0]
					: new Date(config.last_reset_date).toLocaleDateString('en-CA'))
				: null;

			let requestsToday = config.requests_today || 0;

			if (lastReset !== today) {
				requestsToday = 0;
			}

			const limit = config.daily_limit || 1000;
			const available = requestsToday < limit;

			return { available, used: requestsToday, limit };
		} catch (error) {
			return { available: false, used: 0, limit: 0, reason: error.message };
		}
	}

	async checkAndIncrementUsage() {
		try {
			const result = await db.query('SELECT * FROM omdb_config WHERE is_active = true LIMIT 1');
			const config = result.rows[0];

			if (!config || !config.api_key) {
				throw new Error('OMDb API key not configured');
			}

			const today = new Date().toLocaleDateString('en-CA');
			const lastReset = config.last_reset_date
				? (typeof config.last_reset_date === 'string'
					? config.last_reset_date.split('T')[0]
					: new Date(config.last_reset_date).toLocaleDateString('en-CA'))
				: null;

			let requestsToday = config.requests_today || 0;

			if (lastReset !== today) {
				logger.info('Resetting OMDb daily limit counter for new day', { today, lastReset });
				requestsToday = 0;
				await db.query('UPDATE omdb_config SET requests_today = 0, last_reset_date = CURRENT_DATE WHERE id = $1', [config.id]);
			}

			if (requestsToday >= config.daily_limit) {
				logger.warn('OMDb daily limit reached', { limit: config.daily_limit, used: requestsToday });
				throw new OMDbLimitReachedError(`OMDb daily limit of ${config.daily_limit} reached`);
			}

			return { apiKey: config.api_key, configId: config.id };
		} catch (error) {
			if (error.name === 'OMDbLimitReachedError') throw error;
			throw new Error(`Failed to check OMDb usage: ${error.message}`);
		}
	}

	async incrementUsageCounter(configId) {
		try {
			await db.query('UPDATE omdb_config SET requests_today = requests_today + 1 WHERE id = $1', [configId]);
			logger.debug('OMDb usage counter incremented', { configId });
		} catch (error) {
			logger.error('Failed to increment OMDb counter', { error: error.message });
		}
	}

	async testConnection(apiKey) {
		try {
			const response = await axios.get(this.baseUrl, {
				params: {
					apikey: apiKey,
					t: 'The Matrix',
					y: 1999
				}
			});

			if (response.data.Response === 'True') {
				return { success: true, message: 'OMDb connection successful', data: response.data };
			}

			return { success: false, error: response.data.Error || 'Unknown error' };
		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	async checkHealth(apiKey) {
		try {
			const response = await axios.get(this.baseUrl, {
				params: {
					apikey: apiKey,
					t: 'Test'
				},
				timeout: 10000
			});

			if (response.data.Response === 'True' || response.data.Response === 'False') {
				return {
					healthy: true,
					ssl_error: false,
					api_reachable: true,
					message: 'OMDb API is healthy'
				};
			}

			return {
				healthy: false,
				ssl_error: false,
				api_reachable: true,
				message: 'Unexpected API response format'
			};
		} catch (error) {
			const isCertError = isCertificateError(error);

			if (isCertError) {
				return {
					healthy: false,
					ssl_error: true,
					api_reachable: false,
					message: `SSL certificate issue: ${error.message}. OMDb enrichment will be skipped until the certificate is renewed.`
				};
			}

			const msg = (error.message || '').toLowerCase();
			const isNetworkError = error.code === 'ECONNREFUSED' ||
				error.code === 'ENOTFOUND' ||
				error.code === 'ETIMEDOUT' ||
				error.code === 'ECONNRESET' ||
				error.code === 'EAI_AGAIN' ||
				msg.includes('socket hang up');

			if (isNetworkError) {
				return {
					healthy: false,
					ssl_error: false,
					api_reachable: false,
					message: `Network error: ${error.message}`
				};
			}

			return {
				healthy: false,
				ssl_error: false,
				api_reachable: false,
				message: error.message
			};
		}
	}

	async getByTitle(title, year, type = 'movie', _apiKey) {
		let configId = null;
		const omdbRuntime = runtimeSettings.getOmdbRuntimeConfig();
		const maxRetries = omdbRuntime.maxRetries;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			const requestTimeoutMs = getAttemptTimeoutMs(attempt, omdbRuntime);
			try {
				const { apiKey: validApiKey, configId: id } = await this.checkAndIncrementUsage();
				configId = id;

				const params = {
					apikey: validApiKey,
					t: title,
					type: type === 'tv' ? 'series' : type,
					plot: 'short'
				};

				if (year) {
					params.y = year;
				}

				logger.debug('OMDb lookup by title', { title, year, type, attempt: attempt + 1 });

				await enforceRateLimit();

				const response = await axios.get(this.baseUrl, {
					params,
					timeout: requestTimeoutMs,
				});

				if (response.data.Response === 'True') {
					await this.incrementUsageCounter(configId);
					return this.formatResponse(response.data);
				}

				logger.debug('OMDb not found', { title, error: response.data.Error });
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
						? await this.calculateRetryBackoff(attempt, { baseDelay: 3000, multiplier: 2, maxDelay: 15000 })
						: await this.calculateRetryBackoff(attempt, { baseDelay: 1000, multiplier: 2, maxDelay: 10000 });

					logger.warn('OMDb API transient error, retrying', {
						title,
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

					await new Promise(resolve => setTimeout(resolve, delay));
					continue;
				}

				if (status === 401) {
					logger.error('OMDb API Unauthorized (401)', { error: error.message }, { error });
					throw new OMDbLimitReachedError('OMDb API Unauthorized: Check API Key or Limits');
				}

				if (isTransientNetworkError || isCloudflareError) {
					logger.warn('OMDb API unavailable after retries', {
						title,
						maxRetries,
						status,
						code: error.code,
						message: error.message,
						timeoutMs: requestTimeoutMs,
						baseTimeoutMs: omdbRuntime.requestTimeoutMs
					}, { error, skipDbPersist: true });
					throw error;
				}

				const isCertError = isCertificateError(error);
				if (isCertError) {
					error.isOmdbSslCertError = true;
					if (this.shouldLogSslWarning(error)) {
						logger.warn('OMDb SSL certificate issue', {
							title,
							error: error.message
						}, { error });
					} else {
						logger.debug('OMDb SSL certificate warning suppressed', {
							title,
							code: error.code
						});
					}
					throw error;
				}

				logger.error('OMDb API error', { title, error: error.message }, { error });
				throw error;
			}
		}
	}

	async getByIMDBId(imdbId, _apiKey) {
		let configId = null;
		const omdbRuntime = runtimeSettings.getOmdbRuntimeConfig();
		const maxRetries = omdbRuntime.maxRetries;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			const requestTimeoutMs = getAttemptTimeoutMs(attempt, omdbRuntime);
			try {
				logger.debug('OMDb lookup by IMDB ID', { imdbId, attempt: attempt + 1 });

				await enforceRateLimit();

				const { apiKey: validApiKey, configId: id } = await this.checkAndIncrementUsage();
				configId = id;

				const response = await axios.get(this.baseUrl, {
					params: {
						apikey: validApiKey,
						i: imdbId,
						plot: 'short'
					},
					timeout: requestTimeoutMs
				});

				if (response.data.Response === 'True') {
					await this.incrementUsageCounter(configId);
					return this.formatResponse(response.data);
				}

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
						? await this.calculateRetryBackoff(attempt, { baseDelay: 3000, multiplier: 2, maxDelay: 15000 })
						: await this.calculateRetryBackoff(attempt, { baseDelay: 1000, multiplier: 2, maxDelay: 10000 });

					logger.warn('OMDb API transient error (IMDB ID), retrying', {
						imdbId,
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

					await new Promise(resolve => setTimeout(resolve, delay));
					continue;
				}

				if (status === 401) {
					logger.error('OMDb API Unauthorized (401)', { error: error.message }, { error });
					throw new OMDbLimitReachedError('OMDb API Unauthorized: Check API Key or Limits');
				}

				if (isTransientNetworkError || isCloudflareError) {
					logger.warn('OMDb API unavailable after retries (IMDB ID)', {
						imdbId,
						maxRetries,
						status,
						code: error.code,
						message: error.message,
						timeoutMs: requestTimeoutMs,
						baseTimeoutMs: omdbRuntime.requestTimeoutMs
					}, { error, skipDbPersist: true });
					throw error;
				}

				const isCertError = isCertificateError(error);
				if (isCertError) {
					error.isOmdbSslCertError = true;
					if (this.shouldLogSslWarning(error)) {
						logger.warn('OMDb SSL certificate issue (IMDB ID)', {
							imdbId,
							error: error.message
						}, { error });
					} else {
						logger.debug('OMDb SSL certificate warning suppressed (IMDB ID)', {
							imdbId,
							code: error.code
						});
					}
					throw error;
				}

				logger.error('OMDb API error', { imdbId, error: error.message }, { error });
				throw error;
			}
		}
	}

	async search(query, type, _apiKey) {
		let configId = null;
		try {
			await enforceRateLimit();

			const { apiKey: validApiKey, configId: id } = await this.checkAndIncrementUsage();
			configId = id;

			const response = await axios.get(this.baseUrl, {
				params: {
					apikey: validApiKey,
					s: query,
					type: type === 'tv' ? 'series' : type
				}
			});

			if (response.data.Response === 'True') {
				await this.incrementUsageCounter(configId);
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

	formatResponse(data) {
		return {
			title: data.Title,
			year: data.Year,
			rated: data.Rated,
			released: data.Released,
			runtime: data.Runtime,
			genre: data.Genre,
			director: data.Director,
			writer: data.Writer,
			actors: data.Actors,
			plot: data.Plot,
			language: data.Language,
			country: data.Country,
			awards: data.Awards,
			poster: data.Poster !== 'N/A' ? data.Poster : null,
			ratings: data.Ratings?.map(r => ({
				source: r.Source,
				value: r.Value
			})) || [],
			metascore: data.Metascore !== 'N/A' ? parseInt(data.Metascore) : null,
			imdbRating: data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null,
			imdbVotes: data.imdbVotes !== 'N/A' ? parseInt(data.imdbVotes.replace(/,/g, '')) : null,
			imdbId: data.imdbID,
			type: data.Type,
			boxOffice: data.BoxOffice !== 'N/A' ? data.BoxOffice : null,
			production: data.Production !== 'N/A' ? data.Production : null,
			totalSeasons: data.totalSeasons ? parseInt(data.totalSeasons) : null
		};
	}

	extractClassificationData(omdbData) {
		if (!omdbData) return null;

		const genres = omdbData.genre?.split(', ') || [];

		return {
			contentRating: omdbData.rated,
			genres,
			isAnimation: genres.includes('Animation'),
			isDocumentary: genres.includes('Documentary'),
			isComedy: genres.includes('Comedy'),
			isHorror: genres.includes('Horror'),
			isFamily: genres.includes('Family'),
			isKids: ['G', 'TV-G', 'TV-Y', 'TV-Y7'].includes(omdbData.rated),
			isAdult: ['R', 'NC-17', 'TV-MA'].includes(omdbData.rated),
			imdbRating: omdbData.imdbRating,
			awards: omdbData.awards,
			type: omdbData.type
		};
	}

	_resetRateLimiter() {
		lastRequestTime = 0;
		rateLimitLock = Promise.resolve();
		this.lastSslWarnAt = 0;
		this.lastSslWarnSignature = null;
	}
}

const omdbService = new OMDbService();

export default omdbService;
