/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { braveProviderClient as defaultBraveClient } from './braveProviderClient.mjs';
import {
  validateWebSearchRequest,
  validateWebSearchResponse,
} from './webSearchProviderContract.mjs';
import { toWebSearchProviderError } from './webSearchProviderErrorTaxonomy.mjs';
import { filterWebSearchResponseByDomains } from './webSearchProviderResponseFilter.mjs';
import {
  clampWebSearchResultCount,
  normalizeWebSearchResults,
} from './webSearchResultNormalizer.mjs';

function getProviderConfig(config = {}) {
  return config.config && typeof config.config === 'object'
    ? config.config
    : {};
}

function getConfigValue(config, key, fallback) {
  const providerConfig = getProviderConfig(config);
  return config[key] ?? providerConfig[key] ?? fallback;
}

export function createBraveWebSearchProvider({ braveClient = defaultBraveClient } = {}) {
  return {
    contractVersion: 1,
    providerKey: 'brave',
    displayName: 'Brave Search',
    capabilities: {
      generalSearch: true,
      answerSummary: false,
      siteSearch: true,
      safeSearch: true,
    },

    async testConnection(config = {}) {
      return braveClient.testConnection(config.apiKey, getProviderConfig(config));
    },

    async search(request, config = {}) {
      const validatedRequest = validateWebSearchRequest(request);
      const options = validatedRequest.options || {};
      const domains = Array.isArray(options.domains) ? options.domains : [];
      const maxResults = clampWebSearchResultCount(options.maxResults);

      try {
        const rawResponse = await braveClient.search(validatedRequest.query, {
          apiKey: config.apiKey,
          config: getProviderConfig(config),
          maxResults: domains.length > 0 ? 20 : maxResults,
          safeSearch: options.safeSearch,
          country: getConfigValue(config, 'country', null),
        });
        const normalized = normalizeWebSearchResults({
          provider: 'brave',
          query: validatedRequest.query,
          rawResponse,
          maxResults: domains.length > 0 ? 20 : maxResults,
        });

        return validateWebSearchResponse(filterWebSearchResponseByDomains(
          normalized,
          domains,
          { maxResults }
        ));
      } catch (error) {
        throw toWebSearchProviderError(error, {
          provider: 'brave',
          operation: 'search',
        });
      }
    },
  };
}

export const braveWebSearchProvider = createBraveWebSearchProvider();
