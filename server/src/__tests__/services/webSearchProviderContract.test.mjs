/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  WebSearchProviderContractError,
  assertWebSearchProvider,
  isValidWebSearchProvider,
  validateWebSearchProvider,
  validateWebSearchRequest,
  validateWebSearchResponse,
} from '../../services/webSearchProviderContract.mjs';
import { normalizeWebSearchResults } from '../../services/webSearchResultNormalizer.mjs';
import { createTavilyWebSearchProvider } from '../../services/tavilyWebSearchProvider.mjs';

function buildProvider(overrides = {}) {
  return {
    contractVersion: 1,
    providerKey: 'example',
    displayName: 'Example Search',
    capabilities: {
      generalSearch: true,
      answerSummary: true,
      siteSearch: true,
      safeSearch: true,
    },
    testConnection: jest.fn(),
    search: jest.fn(),
    ...overrides,
  };
}

describe('webSearchProviderContract', () => {
  test('validates a complete provider adapter contract', () => {
    const provider = buildProvider();

    expect(validateWebSearchProvider(provider)).toEqual(provider);
    expect(assertWebSearchProvider(provider)).toBe(provider);
    expect(isValidWebSearchProvider(provider)).toBe(true);
  });

  test('rejects provider contracts with unsafe keys or missing functions', () => {
    const provider = buildProvider({
      providerKey: 'Bad Provider!',
      search: 'not-a-function',
    });

    expect(() => validateWebSearchProvider(provider)).toThrow(WebSearchProviderContractError);

    try {
      validateWebSearchProvider(provider);
    } catch (error) {
      expect(error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'providerKey' }),
        expect.objectContaining({ path: 'search' }),
      ]));
    }
    expect(isValidWebSearchProvider(provider)).toBe(false);
  });

  test('rejects unexpected provider fields so adapter drift is explicit', () => {
    expect(() => validateWebSearchProvider(buildProvider({ rawClient: {} }))).toThrow(WebSearchProviderContractError);
  });

  test('validates and defaults bounded search requests', () => {
    const request = validateWebSearchRequest({
      query: 'Office Romance 2026 parents guide',
      options: {
        domains: ['imdb.com'],
      },
    });

    expect(request).toEqual({
      purpose: 'classification',
      query: 'Office Romance 2026 parents guide',
      media: {},
      options: {
        maxResults: 5,
        includeAnswer: true,
        safeSearch: true,
        domains: ['imdb.com'],
      },
      traceContext: {},
    });
  });

  test('rejects search requests that exceed shared provider bounds', () => {
    expect(() => validateWebSearchRequest({
      query: 'x',
      options: {
        maxResults: 100,
      },
    })).toThrow(WebSearchProviderContractError);
  });

  test('rejects malformed domains and trace IDs in requests', () => {
    expect(() => validateWebSearchRequest({
      query: 'x',
      options: {
        domains: ['javascript:alert(1)'],
      },
      traceContext: {
        correlationId: '<script>',
      },
    })).toThrow(WebSearchProviderContractError);
  });

  test('validates normalized provider responses', () => {
    const normalized = normalizeWebSearchResults({
      provider: 'tavily',
      query: 'test',
      rawResponse: {
        request_id: 'abc',
        answer: 'summary',
        results: [
          { url: 'https://example.com/a', title: 'A', content: 'Alpha', score: 0.7 },
        ],
      },
      providerRequestId: 'abc',
    });

    expect(validateWebSearchResponse(normalized)).toEqual(normalized);
  });

  test('rejects raw or unsafe response shapes before orchestration consumes them', () => {
    expect(() => validateWebSearchResponse({
      provider: 'tavily',
      results: [
        { url: 'javascript:alert(1)', title: '<script>alert(1)</script>' },
      ],
    })).toThrow(WebSearchProviderContractError);
  });

  test('validates Tavily provider wrapper and normalizes search output', async () => {
    const tavilyService = {
      testConnection: jest.fn().mockResolvedValue({ success: true }),
      search: jest.fn().mockResolvedValue({
        request_id: 'req-1',
        answer: 'Provider summary',
        results: [
          { url: 'https://example.com/result', title: 'Result', content: 'Useful text', score: 0.9 },
        ],
      }),
    };
    const provider = createTavilyWebSearchProvider({ tavilyService });

    expect(validateWebSearchProvider(provider)).toEqual(provider);

    const testResult = await provider.testConnection({ apiKey: 'key' });
    expect(testResult).toEqual({ success: true });
    expect(tavilyService.testConnection).toHaveBeenCalledWith('key');

    const response = await provider.search({
      purpose: 'classification',
      query: 'Office Romance 2026 parents guide',
      options: {
        maxResults: 2,
        domains: ['imdb.com'],
      },
    }, {
      apiKey: 'key',
      searchDepth: 'advanced',
    });

    expect(tavilyService.search).toHaveBeenCalledWith('Office Romance 2026 parents guide', {
      apiKey: 'key',
      searchDepth: 'advanced',
      maxResults: 2,
      includeDomains: ['imdb.com'],
    });
    expect(validateWebSearchResponse(response)).toEqual(response);
    expect(response).toEqual(expect.objectContaining({
      provider: 'tavily',
      providerRequestId: 'req-1',
      answer: 'Provider summary',
      results: [
        expect.objectContaining({
          url: 'https://example.com/result',
          snippet: 'Useful text',
          score: 0.9,
        }),
      ],
    }));
  });
});
