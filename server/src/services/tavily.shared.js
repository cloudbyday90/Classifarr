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

const axios = require('axios');

class TavilyService {
  constructor() {
    this.baseUrl = 'https://api.tavily.com';
  }

  /**
   * Test connection to Tavily API
   */
  async testConnection(apiKey) {
    try {
      const _response = await axios.post(`${this.baseUrl}/search`, {
        api_key: apiKey,
        query: 'test',
        max_results: 1
      });
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  }

  /**
   * Check API health including SSL certificate status
   * @param {string} apiKey - Tavily API key
   * @returns {object} Health status with ssl_error boolean, api_reachable, and message
   */
  async checkHealth(apiKey) {
    try {
      if (!apiKey) {
        return {
          healthy: false,
          ssl_error: false,
          api_reachable: false,
          message: 'Tavily API key not configured'
        };
      }

      const _response = await axios.post(`${this.baseUrl}/search`, {
        api_key: apiKey,
        query: 'health check',
        max_results: 1
      }, {
        timeout: 10000
      });

      return {
        healthy: true,
        ssl_error: false,
        api_reachable: true,
        message: 'Tavily API is healthy'
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
          message: error.response.data?.error || `API error: ${error.response.status}`
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
   * Search for media information
   * @param {string} query - Search query (e.g., "Squid Game IMDB parents guide")
   * @param {object} options - Search options
   */
  async search(query, options = {}) {
    const {
      apiKey,
      searchDepth = 'basic',
      maxResults = 5,
      includeDomains = ['imdb.com', 'rottentomatoes.com'],
      excludeDomains = []
    } = options;

    if (!apiKey) {
      throw new Error('Tavily API key is required');
    }

    try {
      const response = await axios.post(`${this.baseUrl}/search`, {
        api_key: apiKey,
        query,
        search_depth: searchDepth,
        max_results: maxResults,
        include_domains: includeDomains,
        exclude_domains: excludeDomains,
        include_answer: true,
        include_raw_content: false
      });

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred';
      const thrownError = new Error(`Tavily search failed: ${errorMessage}`);
      thrownError.status = error.response?.status || null;
      throw thrownError;
    }
  }

  /**
   * Search IMDB for media details
   */
  async searchIMDB(title, year, mediaType, options) {
    const query = `${title} ${year} ${mediaType} site:imdb.com`;
    return this.search(query, {
      ...options,
      includeDomains: ['imdb.com'],
      maxResults: 3
    });
  }

  /**
   * Get IMDB parents guide / content advisory
   */
  async getContentAdvisory(title, year, options) {
    const query = `${title} ${year} IMDB parents guide content advisory`;
    return this.search(query, {
      ...options,
      includeDomains: ['imdb.com'],
      maxResults: 2
    });
  }

  /**
   * Search for anime-specific information
   */
  async searchAnimeInfo(title, options) {
    const query = `${title} anime MyAnimeList`;
    return this.search(query, {
      ...options,
      includeDomains: ['myanimelist.net', 'anilist.co', 'anidb.net'],
      maxResults: 3
    });
  }

  /**
   * Get aggregated rating/review info
   */
  async getReviewInfo(title, year, mediaType, options) {
    const query = `${title} ${year} ${mediaType} reviews ratings`;
    return this.search(query, {
      ...options,
      includeDomains: ['rottentomatoes.com', 'metacritic.com', 'letterboxd.com'],
      maxResults: 3
    });
  }

  /**
   * Extract structured data from Tavily results for AI consumption
   */
  formatForAI(tavilyResults) {
    if (!tavilyResults || !tavilyResults.results) {
      return 'No additional information found.';
    }

    let formatted = 'Web Search Results:\n\n';

    for (const result of tavilyResults.results) {
      formatted += `Source: ${result.url}\n`;
      formatted += `Title: ${result.title}\n`;
      formatted += `Content: ${result.content}\n\n`;
    }

    if (tavilyResults.answer) {
      formatted += `\nSummary: ${tavilyResults.answer}\n`;
    }

    return formatted;
  }
}

module.exports = new TavilyService();
