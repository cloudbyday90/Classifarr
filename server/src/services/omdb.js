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
const { createLogger } = require('../utils/logger');

const logger = createLogger('OMDbService');

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
        try {
            const params = {
                apikey: apiKey,
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
                return this.formatResponse(response.data);
            } else {
                logger.debug('OMDb not found', { title, error: response.data.Error });
                return null;
            }
        } catch (error) {
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
        try {
            logger.debug('OMDb lookup by IMDB ID', { imdbId });

            const response = await axios.get(this.baseUrl, {
                params: {
                    apikey: apiKey,
                    i: imdbId,
                    plot: 'short'
                }
            });

            if (response.data.Response === 'True') {
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
        try {
            const response = await axios.get(this.baseUrl, {
                params: {
                    apikey: apiKey,
                    s: query,
                    type: type === 'tv' ? 'series' : type
                }
            });

            if (response.data.Response === 'True') {
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
