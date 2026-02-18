/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const axios = require('axios');
const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const { calculateBackoff } = require('../utils/retryUtils');

const logger = createLogger('OMDbService');

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1000;

async function enforceRateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
        const waitTime = MIN_REQUEST_INTERVAL_MS - elapsed;
        logger.debug('OMDb rate limit: waiting before request', { waitMs: waitTime });
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();
}

class OMDbLimitReachedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OMDbLimitReachedError';
    }
}

/**
 * OMDb API Service
 * Free tier: 1,000 requests/day
 * Docs: https://www.omdbapi.com/
 */
class OMDbService {
    constructor() {
        this.baseUrl = 'https://www.omdbapi.com';
    }

    /**
     * Check if OMDb has remaining daily quota (without incrementing)
     * @returns {Promise<{available: boolean, used: number, limit: number}>}
     */
    async hasRemainingQuota() {
        try {
            const result = await db.query('SELECT * FROM omdb_config WHERE is_active = true LIMIT 1');
            const config = result.rows[0];

            if (!config || !config.api_key) {
                return { available: false, used: 0, limit: 0, reason: 'OMDb API key not configured' };
            }

            const today = new Date().toISOString().split('T')[0];
            const lastReset = config.last_reset_date ? new Date(config.last_reset_date).toISOString().split('T')[0] : null;

            let requestsToday = config.requests_today || 0;

            // Reset if new day
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

    /**
     * Check daily usage and increment if within limit
     * @returns {Promise<string>} API Key
     * @throws {OMDbLimitReachedError} If limit reached
     */
    async checkAndIncrementUsage() {
        try {
            // Fetch active config (row-agnostic, supports any ID)
            const result = await db.query('SELECT * FROM omdb_config WHERE is_active = true LIMIT 1');
            const config = result.rows[0];

            if (!config || !config.api_key) {
                throw new Error('OMDb API key not configured');
            }

            const today = new Date().toISOString().split('T')[0];
            // Format existing date to YYYY-MM-DD for comparison
            const lastReset = config.last_reset_date ? new Date(config.last_reset_date).toISOString().split('T')[0] : null;

            let requestsToday = config.requests_today || 0;

            // Reset if new day
            if (lastReset !== today) {
                logger.info('Resetting OMDb daily limit counter for new day', { today, lastReset });
                requestsToday = 0;
                await db.query('UPDATE omdb_config SET requests_today = 0, last_reset_date = CURRENT_DATE WHERE id = $1', [config.id]);
            }

            if (requestsToday >= config.daily_limit) {
                logger.warn('OMDb daily limit reached', { limit: config.daily_limit, used: requestsToday });
                throw new OMDbLimitReachedError(`OMDb daily limit of ${config.daily_limit} reached`);
            }

            // Return config for use - increment will happen AFTER successful API call
            return { apiKey: config.api_key, configId: config.id };
        } catch (error) {
            if (error.name === 'OMDbLimitReachedError') throw error;
            throw new Error(`Failed to check OMDb usage: ${error.message}`);
        }
    }

    /**
     * Increment usage counter after successful API call
     */
    async incrementUsageCounter(configId) {
        try {
            await db.query('UPDATE omdb_config SET requests_today = requests_today + 1 WHERE id = $1', [configId]);
            logger.debug('OMDb usage counter incremented', { configId });
        } catch (error) {
            logger.error('Failed to increment OMDb counter', { error: error.message });
            // Don't throw - this shouldn't fail the request
        }
    }

    /**
     * Test API connection
     */
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
            } else {
                return { success: false, error: response.data.Error || 'Unknown error' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Check API health including SSL certificate status
     * @param {string} apiKey - OMDb API key
     * @returns {object} Health status with ssl_error boolean, api_reachable, and message
     */
    async checkHealth(apiKey) {
        try {
            const response = await axios.get(this.baseUrl, {
                params: {
                    apikey: apiKey,
                    t: 'Test'
                },
                timeout: 10000
            });

            // Check for API response errors
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
            const isCertError = error.code === 'CERT_HAS_EXPIRED' ||
                error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
                error.code === 'CERT_NOT_YET_VALID' ||
                (error.message && error.message.includes('certificate'));

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

    /**
     * Get movie/show by title and year
     * @param {string} title - Movie or TV show title
     * @param {number} year - Release year (optional but recommended)
     * @param {string} type - 'movie', 'series', or 'episode'
     * @param {string} apiKey - OMDb API key
     */
    async getByTitle(title, year, type = 'movie', apiKey) {
        let configId = null;
        const maxRetries = 2; // Total attempts = 1 initial + 1 retry

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Enforce rate limit managed by DB
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
                    timeout: 15000, // 15 second timeout
                });

                if (response.data.Response === 'True') {
                    // Increment counter only on successful response
                    await this.incrementUsageCounter(configId);
                    return this.formatResponse(response.data);
                } else {
                    logger.debug('OMDb not found', { title, error: response.data.Error });
                    return null;
                }
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
                const isCloudflareError = status === 522 || status === 524 || status === 502 || status === 503 || status === 520 || status === 521 || status === 523;

                // Retry on transient network errors or Cloudflare errors
                if ((isTransientNetworkError || isCloudflareError) && attempt < maxRetries - 1) {
                    const isCloudflare = isCloudflareError;
                    const delay = isCloudflare
                        ? calculateBackoff(attempt, { baseDelay: 3000, multiplier: 2, maxDelay: 15000 })
                        : calculateBackoff(attempt, { baseDelay: 1000, multiplier: 2, maxDelay: 10000 });

                    logger.warn('OMDb API transient error, retrying', {
                        title,
                        attempt: attempt + 1,
                        status,
                        code: error.code,
                        message: error.message,
                        delayMs: delay,
                        isCloudflare
                    }, { error });

                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                if (status === 401) {
                    logger.error('OMDb API Unauthorized (401)', { error: error.message }, { error });
                    throw new OMDbLimitReachedError('OMDb API Unauthorized: Check API Key or Limits');
                }

                // Throw network errors to trigger Tavily fallback
                if (isTransientNetworkError || isCloudflareError) {
                    logger.warn('OMDb API unavailable after retries', {
                        title,
                        status,
                        code: error.code,
                        message: error.message
                    }, { error });
                    throw error; // Throw to trigger fallback
                }

                // Handle SSL/certificate errors gracefully
                const isCertError = error.code === 'CERT_HAS_EXPIRED' ||
                    error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
                    error.message?.includes('certificate');
                if (isCertError) {
                    logger.warn('OMDb SSL certificate issue', {
                        title,
                        error: error.message
                    }, { error });
                    throw error; // Throw to trigger fallback
                }

                logger.error('OMDb API error', { title, error: error.message }, { error });
                throw error;
            }
        }
    }

    /**
     * Get by IMDB ID (more reliable if we have it)
     * @param {string} imdbId - IMDB ID (e.g., 'tt0133093')
     * @param {string} apiKey - OMDb API key
     */
    async getByIMDBId(imdbId, apiKey) {
        let configId = null;
        const maxRetries = 2; // Total attempts = 1 initial + 1 retry

        for (let attempt = 0; attempt < maxRetries; attempt++) {
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
                    timeout: 15000 // 15 second timeout
                });

                if (response.data.Response === 'True') {
                    // Increment counter only on successful response
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
                const isCloudflareError = status === 522 || status === 524 || status === 502 || status === 503 || status === 520 || status === 521 || status === 523;

                // Retry once on transient network errors or Cloudflare errors
                if ((isTransientNetworkError || isCloudflareError) && attempt < maxRetries - 1) {
                    const isCloudflare = isCloudflareError;
                    const delay = isCloudflare
                        ? calculateBackoff(attempt, { baseDelay: 3000, multiplier: 2, maxDelay: 15000 })
                        : calculateBackoff(attempt, { baseDelay: 1000, multiplier: 2, maxDelay: 10000 });

                    logger.warn('OMDb API transient error (IMDB ID), retrying', {
                        imdbId,
                        attempt: attempt + 1,
                        status,
                        code: error.code,
                        message: error.message,
                        delayMs: delay,
                        isCloudflare
                    }, { error });

                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                if (status === 401) {
                    logger.error('OMDb API Unauthorized (401)', { error: error.message }, { error });
                    throw new OMDbLimitReachedError('OMDb API Unauthorized: Check API Key or Limits');
                }

                // Throw network errors to trigger Tavily fallback
                if (isTransientNetworkError || isCloudflareError) {
                    logger.warn('OMDb API unavailable after retries (IMDB ID)', {
                        imdbId,
                        status,
                        code: error.code,
                        message: error.message
                    }, { error });
                    throw error;
                }

                // Handle SSL/certificate errors gracefully
                const isCertError = error.code === 'CERT_HAS_EXPIRED' ||
                    error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
                    error.message?.includes('certificate');
                if (isCertError) {
                    logger.warn('OMDb SSL certificate issue (IMDB ID)', {
                        imdbId,
                        error: error.message
                    }, { error });
                    throw error;
                }

                logger.error('OMDb API error', { imdbId, error: error.message }, { error });
                throw error;
            }
        }
    }

    /**
     * Search for movies/shows (returns multiple results)
     * @param {string} query - Search query
     * @param {string} type - 'movie', 'series', or 'episode'
     * @param {string} apiKey - OMDb API key
     */
    async search(query, type, apiKey) {
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
                // Increment counter only on successful response
                await this.incrementUsageCounter(configId);
                return response.data.Search.map(item => ({
                    title: item.Title,
                    year: item.Year,
                    imdbId: item.imdbID,
                    type: item.Type,
                    poster: item.Poster !== 'N/A' ? item.Poster : null
                }));
            } else {
                return [];
            }
        } catch (error) {
            logger.error('OMDb search error', { query, error: error.message });
            return [];
        }
    }

    /**
     * Format OMDb response into a structured object
     */
    formatResponse(data) {
        return {
            title: data.Title,
            year: data.Year,
            rated: data.Rated, // PG-13, R, TV-MA, etc.
            released: data.Released,
            runtime: data.Runtime,
            genre: data.Genre, // "Action, Sci-Fi"
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
            type: data.Type, // 'movie', 'series', 'episode'
            boxOffice: data.BoxOffice !== 'N/A' ? data.BoxOffice : null,
            production: data.Production !== 'N/A' ? data.Production : null,
            totalSeasons: data.totalSeasons ? parseInt(data.totalSeasons) : null
        };
    }

    /**
     * Extract classification-relevant data from OMDb response
     * Used for AI enrichment context
     */
    extractClassificationData(omdbData) {
        if (!omdbData) return null;

        const genres = omdbData.genre?.split(', ') || [];

        return {
            contentRating: omdbData.rated,
            genres: genres,
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
    }
}

module.exports = new OMDbService();
