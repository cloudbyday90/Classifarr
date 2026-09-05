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
import { httpGet } from '../utils/httpClient.mjs';
import { ServiceUnavailableError } from '../utils/appError.mjs';
import * as db from '../config/database.mjs';
import { rateLimiters } from '../utils/rateLimiter.mjs';
import { findTmdbIdentityByExternalId, searchTmdbIdentityCandidates } from './tmdbIdentitySearch.mjs';
import {
    classifyHealthError,
    mapSearchResults,
    handleTmdbProviderFailure
} from './tmdbHelpers.mjs';

class TMDBService {
  constructor(deps = {}) {
    this.baseUrl = 'https://api.themoviedb.org/3';
    this.apiKey = null;
    this.rateLimiters = deps.rateLimiters || rateLimiters;
  }

  async executeRateLimited(fn) {
    return this.rateLimiters.tmdb.execute(fn);
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

      const response = await httpGet(`${this.baseUrl}/configuration`, {
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

      const response = await httpGet(`${this.baseUrl}/configuration`, {
        params: { api_key: key },
        timeout: 10000,
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
      return classifyHealthError(error);
    }
  }

  async findByExternalId(externalId, source) {
    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        return { movie_results: [], tv_results: [] };
      }

      const response = await this.executeRateLimited(() =>
        httpGet(`${this.baseUrl}/find/${externalId}`, {
          params: {
            api_key: apiKey,
            external_source: source
          },
          timeout: 10000,
        })
      );

      return response.data;
    } catch (error) {
      handleTmdbProviderFailure(error, {
        category: 'external_id_lookup_failed',
        messageSuffix: 'find by external ID failed; returning empty result set',
        idMetadata: { source, externalId },
        dedupeFields: [source],
      });
      return { movie_results: [], tv_results: [] };
    }
  }

  async findIdentityByExternalId(externalId, source) {
    return findTmdbIdentityByExternalId(externalId, source, {
      baseUrl: this.baseUrl, httpGet,
      getApiKey: () => this.getApiKey(),
      executeRateLimited: (fn) => this.executeRateLimited(fn),
    });
  }

  async getMovieDetails(tmdbId) {
    try {
      const apiKey = await this.getApiKey();
      const response = await this.executeRateLimited(() =>
        httpGet(`${this.baseUrl}/movie/${tmdbId}`, {
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
        httpGet(`${this.baseUrl}/tv/${tmdbId}`, {
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
        httpGet(`${this.baseUrl}/${endpoint}/${tmdbId}/external_ids`, {
          params: { api_key: apiKey },
          timeout: 10000,
        })
      );
      return response.data;
    } catch (error) {
      handleTmdbProviderFailure(error, {
        category: 'external_ids_fetch_failed',
        messageSuffix: 'external IDs fetch failed; returning empty identifier set',
        idMetadata: { tmdbId, mediaType },
        dedupeFields: [mediaType],
      });
      return {};
    }
  }

  async getKeywords(tmdbId, mediaType) {
    try {
      const apiKey = await this.getApiKey();
      const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
      const response = await this.executeRateLimited(() =>
        httpGet(`${this.baseUrl}/${endpoint}/${tmdbId}/keywords`, {
          params: { api_key: apiKey },
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
          httpGet(`${this.baseUrl}/movie/${tmdbId}/releases`, {
            params: { api_key: apiKey },
          })
        );
        const usRelease = response.data.countries.find(c => c.iso_3166_1 === 'US');
        return usRelease?.certification || 'NR';
      } else {
        const response = await this.executeRateLimited(() =>
          httpGet(`${this.baseUrl}/tv/${tmdbId}/content_ratings`, {
            params: { api_key: apiKey },
          })
        );
        const usRating = response.data.results.find(r => r.iso_3166_1 === 'US');
        return usRating?.rating || 'NR';
      }
    } catch (error) {
      handleTmdbProviderFailure(error, {
        category: 'certification_fetch_failed',
        messageSuffix: 'certification fetch failed; using NR fallback',
        idMetadata: { tmdbId, mediaType },
        dedupeFields: [mediaType],
      });
      return 'NR';
    }
  }

  async searchIdentityCandidates(title, mediaType, year) {
    return searchTmdbIdentityCandidates(title, mediaType, year, {
      baseUrl: this.baseUrl, httpGet,
      getApiKey: () => this.getApiKey(),
      executeRateLimited: (fn) => this.executeRateLimited(fn),
    });
  }

  async search(query, mediaType = 'multi') {
    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        throw new ServiceUnavailableError('TMDB API key not configured');
      }

      const endpoint = mediaType === 'multi' ? 'search/multi'
        : mediaType === 'movie' ? 'search/movie'
          : 'search/tv';

      const response = await this.executeRateLimited(() =>
        httpGet(`${this.baseUrl}/${endpoint}`, {
          params: {
            api_key: apiKey,
            query: query,
            page: 1,
            include_adult: false,
          },
          timeout: 10000,
        })
      );

      return mapSearchResults(response.data.results, mediaType);
    } catch (error) {
      throw new Error(`TMDB search failed: ${error.message}`);
    }
  }
}

export const tmdbService = new TMDBService();
