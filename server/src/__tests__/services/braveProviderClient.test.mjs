/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  BraveProviderClient,
  buildBraveRequestHeaders,
  buildBraveSearchParams,
} from '../../services/braveProviderClient.mjs';

describe('braveProviderClient', () => {
  test('builds token headers and bounded safe-search parameters', () => {
    expect(buildBraveRequestHeaders('brave-key')).toEqual({
      Accept: 'application/json',
      'X-Subscription-Token': 'brave-key',
    });
    expect(buildBraveSearchParams('Mulan 1998 parents guide', {
      maxResults: 99,
      country: 'ca',
      safeSearch: true,
    })).toEqual({
      q: 'Mulan 1998 parents guide',
      count: 20,
      country: 'CA',
      safesearch: 'strict',
    });
    expect(buildBraveSearchParams('test', { country: 'invalid!', safeSearch: false }))
      .toEqual(expect.objectContaining({ safesearch: 'off' }));
  });

  test('uses GET and preserves rate-limit response data for the error taxonomy', async () => {
    const httpGetFn = jest.fn().mockRejectedValue({
      response: {
        status: 429,
        headers: { 'retry-after': '30' },
        data: { message: 'Too many requests' },
      },
    });
    const client = new BraveProviderClient({ httpGetFn });

    await expect(client.search('test', { apiKey: 'brave-key', maxResults: 2 }))
      .rejects.toMatchObject({
        message: 'Brave Search request failed: Too many requests',
        status: 429,
        response: expect.objectContaining({ status: 429 }),
      });
    expect(httpGetFn).toHaveBeenCalledWith(
      'https://api.search.brave.com/res/v1/web/search',
      expect.objectContaining({
        params: expect.objectContaining({ q: 'test', count: 2 }),
        headers: expect.objectContaining({ 'X-Subscription-Token': 'brave-key' }),
      })
    );
  });

  test('returns a bounded test result without throwing provider credentials into the response', async () => {
    const httpGetFn = jest.fn().mockResolvedValue({ data: { web: { results: [] } } });
    const client = new BraveProviderClient({ httpGetFn });

    await expect(client.testConnection('brave-key')).resolves.toEqual({
      success: true,
      message: 'Connection successful',
    });
  });
});
