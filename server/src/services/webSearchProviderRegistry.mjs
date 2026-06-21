/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { braveWebSearchProvider } from './braveWebSearchProvider.mjs';
import { serperWebSearchProvider } from './serperWebSearchProvider.mjs';
import { tavilyWebSearchProvider } from './tavilyWebSearchProvider.mjs';
import { normalizeWebSearchProviderKey } from './webSearchResultNormalizer.mjs';

const BASE_CAPABILITIES = Object.freeze({
  generalSearch: true,
  answerSummary: false,
  siteSearch: true,
  safeSearch: true,
});

export const WEB_SEARCH_PROVIDER_METADATA = Object.freeze({
  tavily: Object.freeze({
    providerKey: 'tavily',
    displayName: 'Tavily',
    description: 'AI-oriented web search used for classification enrichment and content advisory lookups.',
    docsUrl: 'https://docs.tavily.com/documentation/api-reference/introduction',
    adapterAvailable: true,
    capabilities: tavilyWebSearchProvider.capabilities,
    configFields: ['searchDepth', 'maxResults', 'includeDomains', 'excludeDomains', 'projectId'],
  }),
  brave: Object.freeze({
    providerKey: 'brave',
    displayName: 'Brave Search',
    description: 'Independent web search API available for provider routing and quota spreading.',
    docsUrl: 'https://api-dashboard.search.brave.com/api-reference/web/search/get',
    adapterAvailable: true,
    capabilities: braveWebSearchProvider.capabilities,
    configFields: ['country', 'safeSearch'],
  }),
  serper: Object.freeze({
    providerKey: 'serper',
    displayName: 'Serper.dev',
    description: 'Google SERP API available for provider fallback and regional result coverage.',
    docsUrl: 'https://serper.dev/',
    adapterAvailable: true,
    capabilities: serperWebSearchProvider.capabilities,
    configFields: ['gl', 'hl'],
  }),
});

const WEB_SEARCH_PROVIDER_ADAPTERS = Object.freeze({
  tavily: tavilyWebSearchProvider,
  brave: braveWebSearchProvider,
  serper: serperWebSearchProvider,
});

export function getWebSearchProviderMetadata(providerKey) {
  const normalizedProviderKey = normalizeWebSearchProviderKey(providerKey);
  return WEB_SEARCH_PROVIDER_METADATA[normalizedProviderKey] || {
    providerKey: normalizedProviderKey,
    displayName: normalizedProviderKey,
    description: 'Custom web search provider.',
    docsUrl: null,
    adapterAvailable: false,
    capabilities: BASE_CAPABILITIES,
    configFields: [],
  };
}

export function getWebSearchProviderAdapter(providerKey) {
  return WEB_SEARCH_PROVIDER_ADAPTERS[normalizeWebSearchProviderKey(providerKey)] || null;
}

export function enrichWebSearchProviderConfig(config) {
  if (!config) return null;
  const metadata = getWebSearchProviderMetadata(config.providerKey);
  const adapter = getWebSearchProviderAdapter(config.providerKey);

  return {
    ...config,
    displayName: config.displayName || metadata.displayName,
    description: metadata.description,
    docsUrl: metadata.docsUrl,
    adapterAvailable: Boolean(adapter),
    capabilities: metadata.capabilities,
    configFields: metadata.configFields,
  };
}

export const webSearchProviderRegistry = Object.freeze({
  getMetadata: getWebSearchProviderMetadata,
  getAdapter: getWebSearchProviderAdapter,
  enrichConfig: enrichWebSearchProviderConfig,
});
