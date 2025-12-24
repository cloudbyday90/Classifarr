/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const axios = require('axios');
const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('OMDbService');

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
     * Get movie/show by title and year
     * @param {string} title - Movie or TV show title
     * @param {number} year - Release year (optional but recommended)
     * @param {string} type - 'movie', 'series', or 'episode'
     * @param {string} apiKey - OMDb API key
     */
    async getByTitle(title, year, type = 'movie', apiKey) {
        let configId = null;
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

            logger.debug('OMDb lookup by title', { title, year, type });

            const response = await axios.get(this.baseUrl, { params });

            if (response.data.Response === 'True') {
                // Increment counter only on successful response
                await this.incrementUsageCounter(configId);
                return this.formatResponse(response.data);
            } else {
                logger.debug('OMDb not found', { title, error: response.data.Error });
                return null;
            }
        } catch (error) {
            if (error.response?.status === 401) {
                logger.error('OMDb API Unauthorized (401)', { error: error.message });
                // Treat 401 as limit reached or invalid key
                throw new OMDbLimitReachedError('OMDb API Unauthorized: Check API Key or Limits');
            }
            logger.error('OMDb API error', { title, error: error.message });
            throw error;
        }
    }

    /**
     * Get by IMDB ID (more reliable if we have it)
     * @param {string} imdbId - IMDB ID (e.g., 'tt0133093')
     * @param {string} apiKey - OMDb API key
     */
    async getByIMDBId(imdbId, apiKey) {
        let configId = null;
        try {
            logger.debug('OMDb lookup by IMDB ID', { imdbId });

            const { apiKey: validApiKey, configId: id } = await this.checkAndIncrementUsage();
            configId = id;

            const response = await axios.get(this.baseUrl, {
                params: {
                    apikey: validApiKey,
                    i: imdbId,
                    plot: 'short'
                }
            });

            if (response.data.Response === 'True') {
                // Increment counter only on successful response
                await this.incrementUsageCounter(configId);
                return this.formatResponse(response.data);
            } else {
                return null;
            }
        } catch (error) {
            logger.error('OMDb API error', { imdbId, error: error.message });
            throw error;
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
}

module.exports = new OMDbService();
