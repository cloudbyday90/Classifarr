/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { httpGet } from '../utils/httpClient.mjs';
import { clampWebSearchResultCount } from './webSearchResultNormalizer.mjs';
import {
  getWebSearchProviderOption,
  preserveWebSearchProviderError,
  requireWebSearchProviderApiKey,
  testWebSearchProviderConnection,
} from './webSearchProviderClientSupport.mjs';

export const BRAVE_API_BASE_URL = 'https://api.search.brave.com/res/v1/web/search';
export const BRAVE_DEFAULT_MAX_RESULTS = 5;

const COUNTRY_PATTERN = /^[A-Za-z]{2}$/;

function normalizeCountry(value) {
  const normalized = String(value || '').trim();
  return COUNTRY_PATTERN.test(normalized) ? normalized.toUpperCase() : null;
}

function normalizeSafeSearch(value) {
  return value === false ? 'off' : 'strict';
}

export function buildBraveRequestHeaders(apiKey) {
  return {
    Accept: 'application/json',
    'X-Subscription-Token': requireWebSearchProviderApiKey(apiKey, 'Brave Search'),
  };
}

export function buildBraveSearchParams(query, options = {}) {
  const country = normalizeCountry(getWebSearchProviderOption(options, 'country', null));
  return {
    q: String(query || '').trim(),
    count: clampWebSearchResultCount(
      getWebSearchProviderOption(options, 'maxResults', BRAVE_DEFAULT_MAX_RESULTS)
    ),
    safesearch: normalizeSafeSearch(getWebSearchProviderOption(options, 'safeSearch', true)),
    ...(country ? { country } : {}),
  };
}

export class BraveProviderClient {
  constructor({
    baseUrl = BRAVE_API_BASE_URL,
    httpGetFn = httpGet,
  } = {}) {
    this.baseUrl = baseUrl;
    this.httpGet = httpGetFn;
  }

  async testConnection(apiKey, options = {}) {
    return testWebSearchProviderConnection(
      () => this.search('Classifarr provider connectivity test', {
        ...options,
        apiKey,
        maxResults: 1,
      }),
      'Brave Search'
    );
  }

  async search(query, options = {}) {
    try {
      const response = await this.httpGet(this.baseUrl, {
        params: buildBraveSearchParams(query, options),
        headers: buildBraveRequestHeaders(getWebSearchProviderOption(options, 'apiKey', null)),
        timeout: getWebSearchProviderOption(options, 'timeout', 30_000),
      });
      return response.data;
    } catch (error) {
      throw preserveWebSearchProviderError(error, 'Brave Search request failed');
    }
  }
}

export const braveProviderClient = new BraveProviderClient();
