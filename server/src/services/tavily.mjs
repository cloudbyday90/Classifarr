/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { httpPost } from '../utils/httpClient.mjs';

class TavilyService {
  constructor() {
    this.baseUrl = 'https://api.tavily.com';
  }

  async testConnection(apiKey) {
    try {
      const _response = await httpPost(`${this.baseUrl}/search`, {
        api_key: apiKey,
        query: 'test',
        max_results: 1,
      });
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  }

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

      const _response = await httpPost(`${this.baseUrl}/search`, {
        api_key: apiKey,
        query: 'health check',
        max_results: 1,
      }, { timeout: 10000 });

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
      const response = await httpPost(`${this.baseUrl}/search`, {
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

  async searchIMDB(title, year, mediaType, options) {
    const query = `${title} ${year} ${mediaType} site:imdb.com`;
    return this.search(query, {
      ...options,
      includeDomains: ['imdb.com'],
      maxResults: 3
    });
  }

  async getContentAdvisory(title, year, options) {
    const query = `${title} ${year} IMDB parents guide content advisory`;
    return this.search(query, {
      ...options,
      includeDomains: ['imdb.com'],
      maxResults: 2
    });
  }

  async searchAnimeInfo(title, options) {
    const query = `${title} anime MyAnimeList`;
    return this.search(query, {
      ...options,
      includeDomains: ['myanimelist.net', 'anilist.co', 'anidb.net'],
      maxResults: 3
    });
  }

  async getReviewInfo(title, year, mediaType, options) {
    const query = `${title} ${year} ${mediaType} reviews ratings`;
    return this.search(query, {
      ...options,
      includeDomains: ['rottentomatoes.com', 'metacritic.com', 'letterboxd.com'],
      maxResults: 3
    });
  }

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

export const tavilyService = new TavilyService();
