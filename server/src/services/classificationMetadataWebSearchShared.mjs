/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function buildTavilySearchOptions(tavilyConfig = {}) {
  return {
    apiKey: tavilyConfig.api_key,
    searchDepth: tavilyConfig.search_depth || 'advanced',
    maxResults: tavilyConfig.max_results || 5,
    includeDomains: tavilyConfig.include_domains || ['imdb.com', 'rottentomatoes.com'],
    excludeDomains: tavilyConfig.exclude_domains || [],
  };
}

function buildWebSearchResult({ imdbResults, advisoryResults, animeResults = undefined }) {
  const result = {
    imdb: imdbResults,
    advisory: advisoryResults,
  };

  if (animeResults !== undefined) {
    result.anime = animeResults;
  }

  return result;
}

function isMonthlyQuotaDeferredStatus(status) {
  return status === 432;
}

export {
  buildTavilySearchOptions,
  buildWebSearchResult,
  isMonthlyQuotaDeferredStatus,
};
