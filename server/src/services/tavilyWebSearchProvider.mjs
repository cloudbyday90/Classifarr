/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { tavilyService as defaultTavilyService } from './tavily.mjs';
import {
  validateWebSearchRequest,
  validateWebSearchResponse,
} from './webSearchProviderContract.mjs';
import { toWebSearchProviderError } from './webSearchProviderErrorTaxonomy.mjs';
import { normalizeWebSearchResults } from './webSearchResultNormalizer.mjs';

export function createTavilyWebSearchProvider({
  tavilyService = defaultTavilyService,
} = {}) {
  return {
    contractVersion: 1,
    providerKey: 'tavily',
    displayName: 'Tavily',
    capabilities: {
      generalSearch: true,
      answerSummary: true,
      siteSearch: true,
      safeSearch: false,
    },

    async testConnection(config = {}) {
      return tavilyService.testConnection(config.apiKey);
    },

    async search(request, config = {}) {
      const validatedRequest = validateWebSearchRequest(request);
      const options = validatedRequest.options || {};
      const domains = Array.isArray(options.domains) ? options.domains : [];
      try {
        const rawResponse = await tavilyService.search(validatedRequest.query, {
          apiKey: config.apiKey,
          searchDepth: config.searchDepth || 'basic',
          maxResults: options.maxResults || 5,
          includeDomains: domains.length > 0
            ? domains
            : undefined,
        });

        return validateWebSearchResponse(normalizeWebSearchResults({
          provider: 'tavily',
          query: validatedRequest.query,
          rawResponse,
          maxResults: options.maxResults || 5,
          providerRequestId: rawResponse?.request_id || null,
        }));
      } catch (error) {
        throw toWebSearchProviderError(error, {
          provider: 'tavily',
          operation: 'search',
        });
      }
    },
  };
}

export const tavilyWebSearchProvider = createTavilyWebSearchProvider();
