/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { filterWebSearchResponseByDomains } from '../../services/webSearchProviderResponseFilter.mjs';

describe('webSearchProviderResponseFilter', () => {
  test('keeps exact and subdomain matches while recording dropped-domain evidence', () => {
    const response = filterWebSearchResponseByDomains({
      results: [
        { sourceDomain: 'imdb.com', title: 'IMDb' },
        { sourceDomain: 'www.imdb.com', title: 'IMDb mobile' },
        { sourceDomain: 'example.com', title: 'Not allowed' },
      ],
      warnings: [],
    }, ['imdb.com'], { maxResults: 2 });

    expect(response.results).toEqual([
      expect.objectContaining({ title: 'IMDb' }),
      expect.objectContaining({ title: 'IMDb mobile' }),
    ]);
    expect(response.warnings).toEqual([
      { code: 'dropped_domain_mismatch', count: 1 },
    ]);
  });

  test('preserves bounded results when no domain filter is requested', () => {
    const response = filterWebSearchResponseByDomains({
      results: Array.from({ length: 6 }, (_, index) => ({ sourceDomain: 'example.com', rank: index + 1 })),
      warnings: [],
    }, [], { maxResults: 3 });

    expect(response.results).toHaveLength(3);
    expect(response.warnings).toEqual([]);
  });
});
