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
import { clampWebSearchResultCount } from './webSearchResultNormalizer.mjs';
import {
  getWebSearchProviderOption,
  preserveWebSearchProviderError,
  requireWebSearchProviderApiKey,
  testWebSearchProviderConnection,
} from './webSearchProviderClientSupport.mjs';

export const SERPER_API_BASE_URL = 'https://google.serper.dev/search';
export const SERPER_DEFAULT_MAX_RESULTS = 5;

function isAsciiLetter(value) {
  const code = value.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isLanguageSegment(value) {
  return value.length === 2 && [...value].every(isAsciiLetter);
}

function normalizeCountry(value) {
  const normalized = String(value || '').trim();
  return isLanguageSegment(normalized) ? normalized.toLowerCase() : null;
}

function normalizeLanguage(value) {
  const normalized = String(value || '').trim();
  const segments = normalized.split('-');
  return segments.length >= 1 && segments.length <= 2 && segments.every(isLanguageSegment)
    ? normalized.toLowerCase()
    : null;
}

export function buildSerperRequestHeaders(apiKey) {
  return {
    'X-API-KEY': requireWebSearchProviderApiKey(apiKey, 'Serper.dev'),
  };
}

export function buildSerperSearchPayload(query, options = {}) {
  const gl = normalizeCountry(getWebSearchProviderOption(options, 'gl', null));
  const hl = normalizeLanguage(getWebSearchProviderOption(options, 'hl', null));
  return {
    q: String(query || '').trim(),
    num: clampWebSearchResultCount(
      getWebSearchProviderOption(options, 'maxResults', SERPER_DEFAULT_MAX_RESULTS)
    ),
    // Preserve title/year queries rather than allowing provider autocorrection
    // to rewrite an exact media identity.
    autocorrect: false,
    ...(gl ? { gl } : {}),
    ...(hl ? { hl } : {}),
  };
}

export class SerperProviderClient {
  constructor({
    baseUrl = SERPER_API_BASE_URL,
    httpPostFn = httpPost,
  } = {}) {
    this.baseUrl = baseUrl;
    this.httpPost = httpPostFn;
  }

  async testConnection(apiKey, options = {}) {
    return testWebSearchProviderConnection(
      () => this.search('Classifarr provider connectivity test', {
        ...options,
        apiKey,
        maxResults: 1,
      }),
      'Serper.dev'
    );
  }

  async search(query, options = {}) {
    try {
      const response = await this.httpPost(
        this.baseUrl,
        buildSerperSearchPayload(query, options),
        {
          headers: buildSerperRequestHeaders(getWebSearchProviderOption(options, 'apiKey', null)),
          timeout: getWebSearchProviderOption(options, 'timeout', 30_000),
        }
      );
      return response.data;
    } catch (error) {
      throw preserveWebSearchProviderError(error, 'Serper.dev request failed');
    }
  }
}

export const serperProviderClient = new SerperProviderClient();
