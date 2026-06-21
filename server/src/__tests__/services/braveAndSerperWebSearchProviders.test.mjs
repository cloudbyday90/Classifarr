/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import { createBraveWebSearchProvider } from '../../services/braveWebSearchProvider.mjs';
import { createSerperWebSearchProvider } from '../../services/serperWebSearchProvider.mjs';
import { validateWebSearchProvider } from '../../services/webSearchProviderContract.mjs';

const request = {
  purpose: 'classification',
  query: 'Mulan 1998 parents guide',
  options: {
    maxResults: 2,
    domains: ['imdb.com'],
  },
};

describe('Brave and Serper web search providers', () => {
  test('normalizes and domain-filters Brave results through the common contract', async () => {
    const client = {
      testConnection: jest.fn(),
      search: jest.fn().mockResolvedValue({
        web: {
          results: [
            { url: 'https://www.imdb.com/title/tt0120762', title: 'Mulan', description: 'Guide' },
            { url: 'https://example.com/mulan', title: 'Untrusted domain', description: 'Ignore' },
          ],
        },
      }),
    };
    const provider = createBraveWebSearchProvider({ braveClient: client });

    expect(validateWebSearchProvider(provider)).toEqual(provider);
    const response = await provider.search(request, {
      apiKey: 'brave-key',
      config: { country: 'us' },
    });

    expect(client.search).toHaveBeenCalledWith('Mulan 1998 parents guide', expect.objectContaining({
      apiKey: 'brave-key',
      country: 'us',
      maxResults: 20,
    }));
    expect(response.results).toEqual([
      expect.objectContaining({ sourceDomain: 'imdb.com', snippet: 'Guide' }),
    ]);
    expect(response.warnings).toEqual([{ code: 'dropped_domain_mismatch', count: 1 }]);
  });

  test('normalizes and domain-filters Serper results through the common contract', async () => {
    const client = {
      testConnection: jest.fn().mockResolvedValue({ success: true }),
      search: jest.fn().mockResolvedValue({
        organic: [
          { link: 'https://www.imdb.com/title/tt0120762', title: 'Mulan', snippet: 'Guide' },
          { link: 'https://example.com/mulan', title: 'Untrusted domain', snippet: 'Ignore' },
        ],
      }),
    };
    const provider = createSerperWebSearchProvider({ serperClient: client });

    expect(validateWebSearchProvider(provider)).toEqual(provider);
    await expect(provider.testConnection({ apiKey: 'serper-key' })).resolves.toEqual({ success: true });
    const response = await provider.search(request, {
      apiKey: 'serper-key',
      config: { gl: 'us', hl: 'en' },
    });

    expect(client.search).toHaveBeenCalledWith('Mulan 1998 parents guide', expect.objectContaining({
      apiKey: 'serper-key',
      gl: 'us',
      hl: 'en',
      maxResults: 20,
    }));
    expect(response.results).toEqual([
      expect.objectContaining({ sourceDomain: 'imdb.com', snippet: 'Guide' }),
    ]);
    expect(response.warnings).toEqual([{ code: 'dropped_domain_mismatch', count: 1 }]);
    expect(provider.capabilities.safeSearch).toBe(false);
  });
});
