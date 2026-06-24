/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import { QueueWebSearchEnrichmentService } from '../services/queueWebSearchEnrichmentService.mjs';

function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function createResponse(overrides = {}) {
  return {
    provider: 'brave',
    providerRequestId: 'request-1',
    answer: '',
    results: [],
    ...overrides,
  };
}

describe('QueueWebSearchEnrichmentService', () => {
  test('leaves enrichment unchanged when no router-backed provider is available', async () => {
    const webSearchEnrichmentService = {
      hasAvailableProvider: jest.fn().mockResolvedValue(false),
      search: jest.fn(),
    };
    const service = new QueueWebSearchEnrichmentService({
      logger: createLogger(),
      webSearchEnrichmentService,
    });
    const enrichmentData = { omdb: {} };

    await expect(service.enrich({ title: 'Movie', year: 2024 }, enrichmentData))
      .resolves.toBe(enrichmentData);
    expect(webSearchEnrichmentService.search).not.toHaveBeenCalled();
  });

  test('persists bounded provider-neutral advisory and holiday evidence', async () => {
    const webSearchEnrichmentService = {
      hasAvailableProvider: jest.fn().mockResolvedValue(true),
      search: jest.fn()
        .mockResolvedValueOnce({
          response: createResponse({
            answer: 'PG-13 for action violence',
            results: [{
              url: 'https://www.imdb.com/title/tt1234567/parentalguide',
              title: 'Parents guide',
              snippet: 'A'.repeat(1_200),
              sourceDomain: 'imdb.com',
              rank: 1,
            }],
          }),
        })
        .mockResolvedValueOnce({
          response: createResponse({
            answer: 'Holiday title',
            results: [{
              url: 'https://en.wikipedia.org/wiki/Example',
              title: 'Example',
              snippet: 'Seasonal viewing',
              sourceDomain: 'wikipedia.org',
              rank: 1,
            }],
          }),
        }),
    };
    const service = new QueueWebSearchEnrichmentService({
      logger: createLogger(),
      webSearchEnrichmentService,
    });

    const result = await service.enrich({
      title: 'Holiday Action Movie',
      year: 2024,
      original_language: 'en',
      genres: [],
    }, {});

    expect(result.web_search_advisory).toEqual(expect.objectContaining({
      provider: 'brave',
      answer: 'PG-13 for action violence',
      content: 'A'.repeat(1_000),
    }));
    expect(result.web_search_holiday).toEqual(expect.objectContaining({
      provider: 'brave',
      answer: 'Holiday title',
    }));
    expect(webSearchEnrichmentService.search).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ purpose: 'content_advisory' }),
      expect.any(Object));
    expect(webSearchEnrichmentService.search).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ purpose: 'holiday' }),
      expect.any(Object));
  });

  test('adds anime evidence only for anime-signaled media', async () => {
    const webSearchEnrichmentService = {
      hasAvailableProvider: jest.fn().mockResolvedValue(true),
      search: jest.fn()
        .mockResolvedValueOnce({ response: createResponse() })
        .mockResolvedValueOnce({ response: createResponse() })
        .mockResolvedValueOnce({
          response: createResponse({
            answer: 'Anime information',
            results: [{
              url: 'https://myanimelist.net/anime/20',
              title: 'Anime record',
              snippet: 'A'.repeat(600),
              sourceDomain: 'myanimelist.net',
              rank: 1,
            }],
          }),
        }),
    };
    const service = new QueueWebSearchEnrichmentService({
      logger: createLogger(),
      webSearchEnrichmentService,
    });

    const result = await service.enrich({
      title: 'Example Anime',
      year: 2024,
      original_language: 'ja',
      genres: ['Animation'],
    }, {});

    expect(result.web_search_anime).toEqual(expect.objectContaining({
      provider: 'brave',
      answer: 'Anime information',
    }));
    expect(result.web_search_anime.results[0].snippet).toHaveLength(500);
    expect(webSearchEnrichmentService.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ purpose: 'anime' }),
      expect.any(Object)
    );
  });

  test('continues after an individual provider-router request fails', async () => {
    const logger = createLogger();
    const webSearchEnrichmentService = {
      hasAvailableProvider: jest.fn().mockResolvedValue(true),
      search: jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('Quota exhausted'), { code: 'quota_exhausted' }))
        .mockResolvedValueOnce({ response: createResponse({ answer: 'Holiday title' }) }),
    };
    const service = new QueueWebSearchEnrichmentService({
      logger,
      webSearchEnrichmentService,
    });

    const result = await service.enrich({ title: 'Movie', year: 2024, genres: [] }, {});

    expect(result.web_search_advisory).toBeUndefined();
    expect(result.web_search_holiday).toEqual(expect.objectContaining({ answer: 'Holiday title' }));
    expect(logger.debug).toHaveBeenCalledWith(
      'Web search enrichment request failed',
      expect.objectContaining({ enrichment: 'advisory', code: 'quota_exhausted' })
    );
  });
});
