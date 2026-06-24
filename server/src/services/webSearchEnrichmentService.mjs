/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { webSearchProviderRouter as defaultRouter } from './webSearchProviderRouter.mjs';

export const WEB_SEARCH_ENRICHMENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export class WebSearchEnrichmentService {
  constructor({
    router = defaultRouter,
    cacheTtlMs = WEB_SEARCH_ENRICHMENT_CACHE_TTL_MS,
  } = {}) {
    this.router = router;
    this.cacheTtlMs = cacheTtlMs;
  }

  async hasAvailableProvider() {
    try {
      await this.router.selectRoute();
      return true;
    } catch {
      return false;
    }
  }

  async search(request, {
    cacheTtlMs = this.cacheTtlMs,
    bypassCache = false,
    cacheMetadata = {},
  } = {}) {
    return this.router.search(request, {
      cacheTtlMs,
      bypassCache,
      cacheMetadata: {
        executionSurface: 'web_search_enrichment',
        ...cacheMetadata,
      },
    });
  }
}

export const webSearchEnrichmentService = new WebSearchEnrichmentService();
