/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import { buildTmdbTitleRequest, decideTmdbTitleMatch, normalizeIdentityTitle } from '../services/tmdbTitleMatch.mjs';

const request = (title = 'Example', type = 'movie', year = 2001) => buildTmdbTitleRequest(title, type, year);
const movie = (id = 42, title = 'Example', release_date = '2001-01-01') => ({ id, title, release_date });
const page = (results) => ({ page: 1, total_pages: results.length ? 1 : 0, total_results: results.length, results });
const decision = (results, input = request()) => decideTmdbTitleMatch(input, page(results));
const unresolved = (reason) => ({ tmdbId: null, reason });

describe('TMDb title identity decisions', () => {
  test('matches a unique exact title/year independently of provider order without mutation', () => {
    const rows = [movie(1, 'Other'), movie(), movie(3, 'Example', '2002-01-01')];
    const before = structuredClone(rows);
    for (const results of [rows, [...rows].reverse()]) {
      expect(decision(results)).toEqual({ tmdbId: 42, reason: 'exact_title_year_match' });
    }
    expect(rows).toEqual(before);
  });

  test('examines candidates past the display helper’s ten-result limit', () => {
    const rows = Array.from({ length: 11 }, (_, i) => movie(i + 1, i === 10 ? 'Example' : 'Other'));
    expect(decision(rows).tmdbId).toBe(11);
    rows[0].title = 'Example';
    expect(decision(rows)).toEqual(unresolved('ambiguous_title_year'));
    expect(decision([...rows].reverse())).toEqual(unresolved('ambiguous_title_year'));
  });

  test.each([
    [' Café  ÉTÉ ', 'Cafe\u0301\tE\u0301te\u0301'],
    ['Example', 'EXAMPLE'],
  ])('compares canonical Unicode, case and whitespace: %s', (input, candidate) => {
    expect(decision([movie(42, candidate)], request(input)).tmdbId).toBe(42);
  });

  test.each([
    ['Café', 'Cafe'], ['A-B', 'A B'], ['A', 'А'], ['Ⅳ', 'IV'], ['Straße', 'Strasse'],
  ])('does not equate accents, punctuation, scripts or compatibility characters: %s / %s', (input, candidate) => {
    expect(decision([movie(42, candidate)], request(input))).toEqual(unresolved('no_exact_title_year_match'));
  });

  test('accepts an original movie title without requiring its translated title to match', () => {
    expect(decision([{ ...movie(42, 'Translated'), original_title: 'Example' }]).tmdbId).toBe(42);
  });

  test('binds TV names and first-air dates to the requested type', () => {
    expect(decision([{ id: 42, name: 'Translated', original_name: 'Example', first_air_date: '2001-02-03' }], request('Example', 'tv')).tmdbId).toBe(42);
    expect(decision([movie()], request('Example', 'tv'))).toEqual(unresolved('invalid_response'));
  });

  test.each([
    { total_pages: 2 }, { total_results: 21 },
    { results: Array.from({ length: 21 }, (_, i) => movie(i + 1)), total_results: 21 },
  ])('refuses incomplete or oversized candidate sets: %j', (change) => {
    expect(decideTmdbTitleMatch(request(), { ...page([movie()]), ...change })).toEqual(unresolved('incomplete_results'));
  });

  test.each([
    null, [], {}, { page: 2 }, { page: '1' }, { total_results: '1' }, { total_results: -1 },
    { total_results: 1.5 }, { total_results: 0 }, { total_pages: 0 }, { total_pages: '1' },
    { results: null }, { total_pages: -1 },
  ])('refuses missing or contradictory response metadata: %j', (change) => {
    const response = change === null || Array.isArray(change) || Object.keys(change).length === 0
      ? change : { ...page([movie()]), ...change };
    expect(decideTmdbTitleMatch(request(), response)).toEqual(unresolved('invalid_response'));
  });

  test.each([0, 1])('allows a complete empty response with %i total pages', (total_pages) => {
    expect(decideTmdbTitleMatch(request(), { ...page([]), total_pages })).toEqual(unresolved('no_exact_title_year_match'));
  });

  test.each([
    { id: 0 }, { id: 'bad' }, { id: 2147483648 }, { media_type: 'tv' }, { media_type: null },
    { title: '' }, { title: null }, { title: 'X'.repeat(501) }, { original_title: null },
    { release_date: '' }, { release_date: '2001' }, { release_date: '2001-02-29' },
    { release_date: '2001-04-31' }, { release_date: '2001-13-01' },
  ])('rejects the whole batch when a candidate is malformed: %j', (change) => {
    expect(decision([movie(), { ...movie(43), ...change }])).toEqual(unresolved('invalid_response'));
  });

  test('rejects repeated IDs instead of silently treating a duplicate page as unique', () => {
    expect(decision([movie(), movie()])).toEqual(unresolved('invalid_response'));
  });

  test('accepts a valid leap date but requires the requested year', () => {
    expect(decision([movie(42, 'Example', '2024-02-29')], request('Example', 'movie', 2024)).tmdbId).toBe(42);
    expect(decision([movie(42, 'Example', '2024-02-29')])).toEqual(unresolved('no_exact_title_year_match'));
  });

  test('rebuilds the comparison key rather than trusting a supplied normalizedTitle', () => {
    expect(decision([movie()], { ...request('Other'), normalizedTitle: 'example' })).toEqual(unresolved('no_exact_title_year_match'));
  });
});

describe('TMDb title identity request validation', () => {
  test.each([undefined, null, '', '  ', '2001 extra', 0, 999, 10000, NaN, Infinity, 2001.5, true, {}])(
    'requires a known four-digit year: %j', (year) => {
      expect(buildTmdbTitleRequest('Example', 'movie', year)).toBeNull();
    });

  test('normalizes supported declarations without changing raw search punctuation', () => {
    expect(request('  Café-Test ', ' TV ', ' 2001 ')).toEqual({
      title: 'Café-Test', normalizedTitle: 'café-test', mediaType: 'tv', year: 2001,
    });
  });

  test.each([null, '', 42, {}, 'X'.repeat(501)])('rejects malformed titles: %j', (title) => {
    expect(normalizeIdentityTitle(title)).toBeNull();
    expect(request(title)).toBeNull();
  });

  test.each(['multi', 'person', undefined, null])('rejects unsupported media types: %j', (type) => {
    expect(buildTmdbTitleRequest('Example', type, 2001)).toBeNull();
  });
});
