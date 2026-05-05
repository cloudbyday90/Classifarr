/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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
import axios from 'axios';
import db from '../config/database.mjs';
import { createResolvedLoader, loadResolvedDependency } from './shared/resolvedLoader.mjs';
import { createLogger } from '../utils/logger.mjs';
import { rateLimiters } from '../utils/rateLimiter.mjs';

const logger = createLogger('tmdb');

class TMDBService {
  constructor() {
    this.baseUrl = 'https://api.themoviedb.org/3';
    this.apiKey = null;
    this.loadRateLimiters = createResolvedLoader({ rateLimiters });
  }

  async executeRateLimited(fn) {
    const { rateLimiters } = await loadResolvedDependency(this.loadRateLimiters);
    return rateLimiters.tmdb.execute(fn);
  }

  async getApiKey() {
    if (this.apiKey) {
      return this.apiKey;
    }

    const result = await db.query('SELECT api_key FROM tmdb_config WHERE is_active = true LIMIT 1');
    if (result.rows.length > 0) {
      this.apiKey = result.rows[0].api_key;
      return this.apiKey;
    }

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

  async checkHealth(apiKey = null) {
    try {
      const key = apiKey || await this.getApiKey();
      if (!key) {
        return {
          healthy: false,
          ssl_error: false,
          api_reachable: false,
          message: 'TMDB API key not configured'
        };
      }

      const response = await axios.get(`${this.baseUrl}/configuration`, {
        params: { api_key: key },
        timeout: 10000
      });

      if (response.status === 200) {
        return {
          healthy: true,
          ssl_error: false,
          api_reachable: true,
          message: 'TMDB API is healthy'
        };
      }

      return {
        healthy: false,
        ssl_error: false,
        api_reachable: true,
        message: 'Unexpected API response'
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
          message: `SSL certificate issue: ${error.message}`
        };
      }

      const isNetworkError = error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT';

      if (isNetworkError) {
        return {
          healthy: false,
          ssl_error: false,
          api_reachable: false,
          message: `Network error: ${error.message}`
        };
      }

      if (error.response) {
        return {
          healthy: false,
          ssl_error: false,
          api_reachable: true,
          message: error.response.data?.status_message || `API error: ${error.response.status}`
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

  async findByExternalId(externalId, source) {
    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        return { movie_results: [], tv_results: [] };
      }

      const response = await this.executeRateLimited(() =>
        axios.get(`${this.baseUrl}/find/${externalId}`, {
          params: {
            api_key: apiKey,
            external_source: source
          },
          timeout: 10000
        })
      );

      return response.data;
    } catch (error) {
      logger.error(`TMDB find by external ID failed: ${error.message}`);
      return { movie_results: [], tv_results: [] };
    }
  }

  async getMovieDetails(tmdbId) {
    try {
      const apiKey = await this.getApiKey();
      const response = await this.executeRateLimited(() =>
        axios.get(`${this.baseUrl}/movie/${tmdbId}`, {
          params: {
            api_key: apiKey,
            append_to_response: 'keywords,releases,credits',
          },
        })
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch movie details: ${error.message}`);
    }
  }

  async getTVDetails(tmdbId) {
    try {
      const apiKey = await this.getApiKey();
      const response = await this.executeRateLimited(() =>
        axios.get(`${this.baseUrl}/tv/${tmdbId}`, {
          params: {
            api_key: apiKey,
            append_to_response: 'keywords,content_ratings,credits',
          },
        })
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch TV details: ${error.message}`);
    }
  }

  async getExternalIds(tmdbId, mediaType) {
    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        return {};
      }

      const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
      const response = await this.executeRateLimited(() =>
        axios.get(`${this.baseUrl}/${endpoint}/${tmdbId}/external_ids`, {
          params: { api_key: apiKey },
          timeout: 10000
        })
      );
      return response.data;
    } catch (error) {
      logger.error(`TMDB external IDs fetch failed: ${error.message}`);
      return {};
    }
  }

  async getKeywords(tmdbId, mediaType) {
    try {
      const apiKey = await this.getApiKey();
      const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
      const response = await this.executeRateLimited(() =>
        axios.get(`${this.baseUrl}/${endpoint}/${tmdbId}/keywords`, {
          params: {
            api_key: apiKey,
          },
        })
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch keywords: ${error.message}`);
    }
  }

  async getCertification(tmdbId, mediaType) {
    try {
      const apiKey = await this.getApiKey();
      if (mediaType === 'movie') {
        const response = await this.executeRateLimited(() =>
          axios.get(`${this.baseUrl}/movie/${tmdbId}/releases`, {
            params: {
              api_key: apiKey,
            },
          })
        );
        const usRelease = response.data.countries.find(c => c.iso_3166_1 === 'US');
        return usRelease?.certification || 'NR';
      } else {
        const response = await this.executeRateLimited(() =>
          axios.get(`${this.baseUrl}/tv/${tmdbId}/content_ratings`, {
            params: {
              api_key: apiKey,
            },
          })
        );
        const usRating = response.data.results.find(r => r.iso_3166_1 === 'US');
        return usRating?.rating || 'NR';
      }
    } catch (error) {
      logger.error('Failed to fetch certification:', { error: error.message });
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

      const response = await this.executeRateLimited(() =>
        axios.get(`${this.baseUrl}/${endpoint}`, {
          params: {
            api_key: apiKey,
            query: query,
            page: 1,
            include_adult: false
          },
          timeout: 10000
        })
      );

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
        .slice(0, 10);
    } catch (error) {
      throw new Error(`TMDB search failed: ${error.message}`);
    }
  }
}

export default new TMDBService();
