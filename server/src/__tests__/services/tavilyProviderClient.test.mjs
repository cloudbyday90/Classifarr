/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  TavilyProviderClient,
  buildTavilyRequestHeaders,
  buildTavilySearchPayload,
} from '../../services/tavilyProviderClient.mjs';

describe('tavilyProviderClient', () => {
  test('builds bearer auth headers without putting secrets in the body', () => {
    const headers = buildTavilyRequestHeaders('tvly-test', {
      projectId: 'classifarr-prod',
    });
    const payload = buildTavilySearchPayload('Mulan 1998 parents guide', {
      maxResults: 100,
    });

    expect(headers).toEqual({
      Authorization: 'Bearer tvly-test',
      'X-Project-ID': 'classifarr-prod',
    });
    expect(payload).toEqual(expect.objectContaining({
      query: 'Mulan 1998 parents guide',
      search_depth: 'basic',
      max_results: 20,
      include_answer: true,
      include_raw_content: false,
    }));
    expect(payload).not.toHaveProperty('api_key');
  });

  test('accepts provider-neutral nested config values', () => {
    const payload = buildTavilySearchPayload('test', {
      config: {
        searchDepth: 'advanced',
        maxResults: 7,
        includeDomains: ['imdb.com'],
        excludeDomains: ['example.com'],
        includeRawContent: true,
      },
    });

    expect(payload).toEqual(expect.objectContaining({
      search_depth: 'advanced',
      max_results: 7,
      include_domains: ['imdb.com'],
      exclude_domains: ['example.com'],
      include_raw_content: true,
    }));
  });

  test('executes search with bounded payload and metadata-preserving errors', async () => {
    const httpPostFn = jest.fn().mockRejectedValue({
      response: {
        status: 429,
        headers: { 'retry-after': '30' },
        data: { error: 'Too many requests' },
      },
    });
    const client = new TavilyProviderClient({ httpPostFn });

    await expect(client.search('test', {
      apiKey: 'tvly-test',
      maxResults: 2,
    })).rejects.toMatchObject({
      message: 'Tavily search failed: Too many requests',
      status: 429,
      statusCode: 429,
      response: expect.objectContaining({
        status: 429,
      }),
    });

    expect(httpPostFn).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        query: 'test',
        max_results: 2,
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer tvly-test',
        }),
      })
    );
  });

  test('checks health without requiring legacy api_key request bodies', async () => {
    const httpPostFn = jest.fn().mockResolvedValue({ data: { results: [] } });
    const client = new TavilyProviderClient({ httpPostFn });

    const result = await client.checkHealth('tvly-test');

    expect(result).toEqual(expect.objectContaining({
      healthy: true,
      api_reachable: true,
    }));
    expect(httpPostFn.mock.calls[0][1]).not.toHaveProperty('api_key');
    expect(httpPostFn.mock.calls[0][2]).toEqual(expect.objectContaining({
      timeout: 10000,
    }));
  });
});
