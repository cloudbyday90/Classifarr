/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildInvalidTavilySearchRequestResponse,
  buildMissingMetadataProviderApiKeyResponse,
  buildMissingOmdbConfigurationResponse,
  buildOmdbConfigMutationPayload,
  buildTavilyConfigMutationPayload,
  buildTavilySearchOptions,
  buildTmdbConfigMutationPayload,
} from '../routes/helpers/metadataProviderSettingsSupport.mjs';

describe('metadataProviderSettingsSupport', () => {
  test('builds shared metadata provider validation responses', () => {
    expect(buildMissingMetadataProviderApiKeyResponse()).toEqual({
      status: 400,
      body: { error: 'API key is required' },
    });
    expect(buildInvalidTavilySearchRequestResponse()).toEqual({
      status: 400,
      body: { error: 'API key and query are required' },
    });
    expect(buildMissingOmdbConfigurationResponse()).toEqual({
      status: 400,
      body: { error: 'OMDb not configured' },
    });
  });

  test('builds TMDB mutation payloads from partial updates', () => {
    expect(buildTmdbConfigMutationPayload({ api_key: '••••••••-masked' }, {
      api_key: 'stored-tmdb-key',
      language: 'fr-FR',
    })).toEqual({
      apiKey: 'stored-tmdb-key',
      language: 'fr-FR',
    });

    expect(buildTmdbConfigMutationPayload({ api_key: '' }, {
      api_key: 'stored-tmdb-key',
      language: 'fr-FR',
    })).toEqual({
      apiKey: '',
      language: 'fr-FR',
    });
  });

  test('builds Tavily mutation and search payloads from stored config', () => {
    expect(buildTavilyConfigMutationPayload({ api_key: '••••••••-masked' }, {
      api_key: 'stored-tavily-key',
      search_depth: 'basic',
      max_results: 9,
      include_domains: ['imdb.com'],
      exclude_domains: ['example.com'],
      is_active: false,
    })).toEqual({
      apiKey: 'stored-tavily-key',
      searchDepth: 'basic',
      maxResults: 9,
      includeDomains: ['imdb.com'],
      excludeDomains: ['example.com'],
      isActive: false,
    });

    expect(buildTavilySearchOptions('live-tavily-key', {
      search_depth: 'advanced',
      max_results: 7,
      include_domains: ['imdb.com', 'rottentomatoes.com'],
      exclude_domains: ['example.com'],
    })).toEqual({
      apiKey: 'live-tavily-key',
      searchDepth: 'advanced',
      maxResults: 7,
      includeDomains: ['imdb.com', 'rottentomatoes.com'],
      excludeDomains: ['example.com'],
    });
  });

  test('builds OMDb mutation payloads that preserve stored usage fields', () => {
    expect(buildOmdbConfigMutationPayload({ api_key: '••••••••-masked' }, {
      api_key: 'stored-omdb-key',
      is_active: false,
      daily_limit: 750,
      requests_today: 32,
      last_reset_date: '2026-03-21',
    })).toEqual({
      apiKey: 'stored-omdb-key',
      isActive: false,
      dailyLimit: 750,
      requestsToday: 32,
      lastResetDate: '2026-03-21',
    });
  });
});
