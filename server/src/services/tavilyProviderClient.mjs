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
import { ServiceUnavailableError } from '../utils/appError.mjs';
import { clampWebSearchResultCount } from './webSearchResultNormalizer.mjs';

export const TAVILY_PROVIDER_KEY = 'tavily';
export const TAVILY_API_BASE_URL = 'https://api.tavily.com';
export const TAVILY_DEFAULT_SEARCH_DEPTH = 'basic';
export const TAVILY_DEFAULT_MAX_RESULTS = 5;
export const TAVILY_DEFAULT_INCLUDE_DOMAINS = Object.freeze([
  'imdb.com',
  'rottentomatoes.com',
]);

const TAVILY_SEARCH_DEPTHS = new Set([
  'advanced',
  'basic',
  'fast',
  'ultra-fast',
]);

function toDomainArray(value, fallback = []) {
  if (!Array.isArray(value)) return [...fallback];
  return value
    .map((domain) => String(domain || '').trim())
    .filter(Boolean);
}

function normalizeSearchDepth(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return TAVILY_SEARCH_DEPTHS.has(normalized)
    ? normalized
    : TAVILY_DEFAULT_SEARCH_DEPTH;
}

function getProviderConfig(options = {}) {
  return options.config && typeof options.config === 'object'
    ? options.config
    : {};
}

function getOption(options, key, fallback) {
  const providerConfig = getProviderConfig(options);
  return options[key] ?? providerConfig[key] ?? fallback;
}

function extractErrorMessage(error, fallback = 'Unknown error occurred') {
  return error?.response?.data?.error
    || error?.response?.data?.message
    || error?.cause?.response?.data?.error
    || error?.cause?.message
    || error?.message
    || fallback;
}

export function buildTavilyRequestHeaders(apiKey, options = {}) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
  };

  const projectId = getOption(options, 'projectId', null);
  if (projectId) {
    headers['X-Project-ID'] = String(projectId);
  }

  return headers;
}

export function buildTavilySearchPayload(query, options = {}) {
  const includeDomains = toDomainArray(
    getOption(options, 'includeDomains', TAVILY_DEFAULT_INCLUDE_DOMAINS),
    TAVILY_DEFAULT_INCLUDE_DOMAINS
  );
  const excludeDomains = toDomainArray(getOption(options, 'excludeDomains', []));

  return {
    query,
    search_depth: normalizeSearchDepth(getOption(options, 'searchDepth', TAVILY_DEFAULT_SEARCH_DEPTH)),
    max_results: clampWebSearchResultCount(getOption(options, 'maxResults', TAVILY_DEFAULT_MAX_RESULTS)),
    include_domains: includeDomains,
    exclude_domains: excludeDomains,
    include_answer: getOption(options, 'includeAnswer', true) !== false,
    include_raw_content: getOption(options, 'includeRawContent', false) === true,
  };
}

function preserveProviderError(error, prefix) {
  const errorMessage = extractErrorMessage(error);
  const thrownError = new Error(`${prefix}: ${errorMessage}`);
  thrownError.status = error?.response?.status ?? error?.status ?? null;
  thrownError.statusCode = thrownError.status;
  thrownError.response = error?.response ?? null;
  thrownError.code = error?.code ?? null;
  thrownError.cause = error;
  return thrownError;
}

export class TavilyProviderClient {
  constructor({
    baseUrl = TAVILY_API_BASE_URL,
    httpPostFn = httpPost,
  } = {}) {
    this.baseUrl = baseUrl;
    this.httpPost = httpPostFn;
  }

  async testConnection(apiKey, options = {}) {
    try {
      await this.search('test', {
        ...options,
        apiKey,
        maxResults: 1,
        includeDomains: [],
        excludeDomains: [],
        includeAnswer: false,
      });
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return {
        success: false,
        error: extractErrorMessage(error, error.message),
      };
    }
  }

  async checkHealth(apiKey, options = {}) {
    try {
      if (!apiKey) {
        return {
          healthy: false,
          ssl_error: false,
          api_reachable: false,
          message: 'Tavily API key not configured',
        };
      }

      await this.search('health check', {
        ...options,
        apiKey,
        maxResults: 1,
        includeDomains: [],
        excludeDomains: [],
        includeAnswer: false,
        timeout: getOption(options, 'timeout', 10000),
      });

      return {
        healthy: true,
        ssl_error: false,
        api_reachable: true,
        message: 'Tavily API is healthy',
      };
    } catch (error) {
      const isCertError = error.code === 'CERT_HAS_EXPIRED'
        || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
        || error.code === 'CERT_NOT_YET_VALID'
        || (error.message && error.message.includes('certificate'));

      if (isCertError) {
        return {
          healthy: false,
          ssl_error: true,
          api_reachable: false,
          message: `SSL certificate issue: ${error.message}`,
        };
      }

      const isNetworkError = error.code === 'ECONNREFUSED'
        || error.code === 'ENOTFOUND'
        || error.code === 'ETIMEDOUT';

      if (isNetworkError) {
        return {
          healthy: false,
          ssl_error: false,
          api_reachable: false,
          message: `Network error: ${error.message}`,
        };
      }

      if (error.response) {
        return {
          healthy: false,
          ssl_error: false,
          api_reachable: true,
          message: extractErrorMessage(error, `API error: ${error.response.status}`),
        };
      }

      return {
        healthy: false,
        ssl_error: false,
        api_reachable: false,
        message: error.message,
      };
    }
  }

  async search(query, options = {}) {
    const apiKey = getOption(options, 'apiKey', null);
    if (!apiKey) {
      throw new ServiceUnavailableError('Tavily API key is required');
    }

    try {
      const response = await this.httpPost(
        `${this.baseUrl}/search`,
        buildTavilySearchPayload(query, options),
        {
          headers: buildTavilyRequestHeaders(apiKey, options),
          timeout: getOption(options, 'timeout', 30000),
        }
      );

      return response.data;
    } catch (error) {
      throw preserveProviderError(error, 'Tavily search failed');
    }
  }
}

export const tavilyProviderClient = new TavilyProviderClient();
