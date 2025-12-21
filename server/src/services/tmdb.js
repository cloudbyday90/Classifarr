/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const axios = require('axios');
const db = require('../config/database');

class TMDBService {
  constructor() {
    this.baseUrl = 'https://api.themoviedb.org/3';
    this.apiKey = null;
  }

  async getApiKey() {
    if (this.apiKey) {
      return this.apiKey;
    }

    // Try to load from database
    const result = await db.query('SELECT api_key FROM tmdb_config WHERE is_active = true LIMIT 1');
    if (result.rows.length > 0) {
      this.apiKey = result.rows[0].api_key;
      return this.apiKey;
    }

    // Fall back to environment variable
    this.apiKey = process.env.TMDB_API_KEY;
    return this.apiKey;
  }

  async testConnection(apiKey = null) {
    try {
      const key = apiKey || await this.getApiKey();
      if (!key) {
        return { success: false, error: 'No API key provided' };
      }

      const response = await axios.get(`${this.baseUrl}/configuration`, {
        params: { api_key: key },
        timeout: 5000,
      });

      return {
        success: true,
        message: 'Connection successful',
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.status_message || error.message
      };
    }
  }

  async getMovieDetails(tmdbId) {
    try {
      const apiKey = await this.getApiKey();
      const response = await axios.get(`${this.baseUrl}/movie/${tmdbId}`, {
        params: {
          api_key: apiKey,
          append_to_response: 'keywords,releases,credits',
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch movie details: ${error.message}`);
    }
  }

  async getTVDetails(tmdbId) {
    try {
      const apiKey = await this.getApiKey();
      const response = await axios.get(`${this.baseUrl}/tv/${tmdbId}`, {
        params: {
          api_key: apiKey,
          append_to_response: 'keywords,content_ratings,credits',
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch TV details: ${error.message}`);
    }
  }

  async getKeywords(tmdbId, mediaType) {
    try {
      const apiKey = await this.getApiKey();
      const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
      const response = await axios.get(`${this.baseUrl}/${endpoint}/${tmdbId}/keywords`, {
        params: {
          api_key: apiKey,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch keywords: ${error.message}`);
    }
  }

  async getCertification(tmdbId, mediaType) {
    try {
      const apiKey = await this.getApiKey();
      if (mediaType === 'movie') {
        const response = await axios.get(`${this.baseUrl}/movie/${tmdbId}/releases`, {
          params: {
            api_key: apiKey,
          },
        });
        const usRelease = response.data.countries.find(c => c.iso_3166_1 === 'US');
        return usRelease?.certification || 'NR';
      } else {
        const response = await axios.get(`${this.baseUrl}/tv/${tmdbId}/content_ratings`, {
          params: {
            api_key: apiKey,
          },
        });
        const usRating = response.data.results.find(r => r.iso_3166_1 === 'US');
        return usRating?.rating || 'NR';
      }
    } catch (error) {
      console.error('Failed to fetch certification:', error.message);
      return 'NR';
    }
  }

  async search(query, mediaType = 'multi') {
    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        throw new Error('TMDB API key not configured');
      }

      const endpoint = mediaType === 'multi' ? 'search/multi'
        : mediaType === 'movie' ? 'search/movie'
          : 'search/tv';

      const response = await axios.get(`${this.baseUrl}/${endpoint}`, {
        params: {
          api_key: apiKey,
          query: query,
          page: 1,
          include_adult: false
        },
        timeout: 10000
      });

      // Filter and format results
      return response.data.results
        .filter(r => r.media_type === 'movie' || r.media_type === 'tv' || mediaType !== 'multi')
        .map(item => ({
          id: item.id,
          title: item.title || item.name,
          original_title: item.original_title || item.original_name,
          media_type: item.media_type || mediaType,
          year: (item.release_date || item.first_air_date || '').substring(0, 4),
          overview: item.overview,
          poster_path: item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : null,
          vote_average: item.vote_average
        }))
        .slice(0, 10); // Limit to 10 results
    } catch (error) {
      throw new Error(`TMDB search failed: ${error.message}`);
    }
  }
}

module.exports = new TMDBService();
