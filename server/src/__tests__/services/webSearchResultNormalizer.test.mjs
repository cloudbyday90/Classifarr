/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  clampWebSearchResultCount,
  decodeBasicHtmlEntities,
  formatNormalizedWebSearchForAI,
  formatWebSearchResponseForAI,
  normalizeWebSearchProviderKey,
  normalizeWebSearchPublishedAt,
  normalizeWebSearchRank,
  normalizeWebSearchResults,
  normalizeWebSearchScore,
  normalizeWebSearchUrl,
  sanitizeWebSearchText,
  truncateWebSearchText,
} from '../../services/webSearchResultNormalizer.mjs';

describe('webSearchResultNormalizer', () => {
  test('clamps result counts to a bounded provider-safe range', () => {
    expect(clampWebSearchResultCount(0)).toBe(1);
    expect(clampWebSearchResultCount(3)).toBe(3);
    expect(clampWebSearchResultCount(500)).toBe(20);
    expect(clampWebSearchResultCount('not-a-number')).toBe(5);
  });

  test('normalizes provider keys to a strict trace-safe token', () => {
    expect(normalizeWebSearchProviderKey('Tavily')).toBe('tavily');
    expect(normalizeWebSearchProviderKey('brave-search')).toBe('brave-search');
    expect(normalizeWebSearchProviderKey('bad provider!')).toBe('unknown');
  });

  test('drops non-http URLs and extracts source domains', () => {
    expect(normalizeWebSearchUrl('https://www.imdb.com/title/tt123')).toEqual({
      url: 'https://www.imdb.com/title/tt123',
      sourceDomain: 'imdb.com',
    });
    expect(normalizeWebSearchUrl('javascript:alert(1)')).toEqual({ url: null, sourceDomain: null });
    expect(normalizeWebSearchUrl('not a url')).toEqual({ url: null, sourceDomain: null });
  });

  test('truncates and collapses provider text before prompt formatting', () => {
    expect(truncateWebSearchText(' one\n\n two   three ', 20)).toBe('one two three');
    expect(truncateWebSearchText('abcdef', 4)).toBe('abc…');
  });

  test('strips HTML tags, control characters, zero-width characters, and common entities', () => {
    expect(decodeBasicHtmlEntities('Fish &amp; Chips &#x1F37F; &#65;')).toBe('Fish & Chips 🍿 A');
    expect(sanitizeWebSearchText('<b>Family&nbsp;Movie</b>\u0000\u200B<script>alert(1)</script>')).toBe('Family Movie');
  });

  test('normalizes ranks, scores, and dates into stable shapes', () => {
    expect(normalizeWebSearchRank('0', 4)).toBe(4);
    expect(normalizeWebSearchRank('200', 4)).toBe(20);
    expect(normalizeWebSearchScore('0.74')).toBe(0.74);
    expect(normalizeWebSearchScore('74')).toBe(0.74);
    expect(normalizeWebSearchScore('-1')).toBeNull();
    expect(normalizeWebSearchPublishedAt('2026-06-13')).toBe('2026-06-13T00:00:00.000Z');
    expect(normalizeWebSearchPublishedAt('2 days ago')).toBeNull();
  });

  test('normalizes Tavily-style results into provider-neutral evidence', () => {
    const normalized = normalizeWebSearchResults({
      provider: 'tavily',
      query: 'movie parents guide',
      rawResponse: {
        answer: 'summary',
        results: [
          null,
          { url: 'https://www.imdb.com/title/tt123', title: '<b>IMDb</b>', content: 'Parents&nbsp;guide content', score: 0.8, date: '2026-06-13' },
          { url: 'file:///etc/passwd', title: 'bad', content: 'bad' },
        ],
      },
    });

    expect(normalized.provider).toBe('tavily');
    expect(normalized.answer).toBe('summary');
    expect(normalized.results).toEqual([
      expect.objectContaining({
        title: 'IMDb',
        url: 'https://www.imdb.com/title/tt123',
        snippet: 'Parents guide content',
        rank: 2,
        score: 0.8,
        publishedAt: '2026-06-13T00:00:00.000Z',
        sourceDomain: 'imdb.com',
      }),
    ]);
    expect(normalized.warnings).toEqual([
      { code: 'dropped_non_object_result', count: 1 },
      { code: 'dropped_invalid_url', count: 1 },
    ]);
  });

  test('normalizes Serper-style organic results', () => {
    const normalized = normalizeWebSearchResults({
      provider: 'serper',
      rawResponse: {
        organic: [
          { link: 'https://example.com/a', title: 'A', snippet: 'Alpha', position: 3 },
        ],
      },
    });

    expect(normalized.results[0]).toEqual(expect.objectContaining({
      url: 'https://example.com/a',
      rank: 3,
      snippet: 'Alpha',
      sourceDomain: 'example.com',
    }));
  });

  test('normalizes Brave-style web results and records malformed-field warnings', () => {
    const normalized = normalizeWebSearchResults({
      provider: 'brave',
      rawResponse: {
        web: {
          results: [
            {
              url: 'https://search.example/result',
              title: 'Result',
              description: 'Useful result',
              rank: 'bad',
              score: 500,
              age: '3 hours ago',
            },
            {
              url: 'https://empty.example',
              title: '',
              description: '',
            },
          ],
        },
      },
    });

    expect(normalized.results).toEqual([
      expect.objectContaining({
        url: 'https://search.example/result',
        rank: 1,
        score: null,
        publishedAt: null,
        sourceDomain: 'search.example',
      }),
    ]);
    expect(normalized.warnings).toEqual([
      { code: 'normalized_invalid_rank', count: 1 },
      { code: 'dropped_invalid_score', count: 1 },
      { code: 'dropped_invalid_date', count: 1 },
      { code: 'dropped_empty_result', count: 1 },
    ]);
  });

  test('formats normalized evidence for AI with provider traceability and bounds', () => {
    const formatted = formatNormalizedWebSearchForAI({
      provider: 'tavily',
      answer: 'answer text',
      results: [
        {
          url: 'https://example.com',
          title: 'Example',
          snippet: 'A'.repeat(20),
        },
      ],
    }, { maxSnippetChars: 8 });

    expect(formatted).toContain('Web Search Results (tavily):');
    expect(formatted).toContain('Source: https://example.com');
    expect(formatted).toContain('Content: AAAAAAA…');
    expect(formatted).toContain('Summary: answer text');
  });

  test('formats normalized evidence without leaking HTML tags into prompts', () => {
    const formatted = formatWebSearchResponseForAI({
      answer: '<i>safe&nbsp;summary</i>',
      results: [
        { url: 'https://example.com', title: '<b>Example</b>', content: '<script>alert(1)</script> Useful&nbsp;text' },
      ],
    }, { provider: 'tavily' });

    expect(formatted).toContain('Title: Example');
    expect(formatted).toContain('Content: Useful text');
    expect(formatted).toContain('Summary: safe summary');
    expect(formatted).not.toContain('<script>');
    expect(formatted).not.toContain('&nbsp;');
  });

  test('formats raw provider responses through the normalizer', () => {
    const formatted = formatWebSearchResponseForAI({
      results: [
        { url: 'https://example.com', title: 'Example', content: 'Content' },
      ],
    }, { provider: 'tavily' });

    expect(formatted).toContain('Web Search Results (tavily):');
    expect(formatted).toContain('Content: Content');
  });

  test('returns the existing empty-results fallback when nothing usable remains', () => {
    const formatted = formatWebSearchResponseForAI({
      results: [
        { url: 'javascript:alert(1)', title: 'bad', content: 'bad' },
      ],
    }, { provider: 'tavily' });

    expect(formatted).toBe('No additional information found.');
  });
});
