/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, jest, test } from '@jest/globals';
import { projectReviewCandidate, reviewBody, reviewInteger } from '../services/mediaIdentityReviewContract.mjs';
import { getTmdbIdentityDetails } from '../services/tmdbIdentitySearch.mjs';

describe('operator identity input and provider boundaries', () => {
  test.each([0, -1, 1.5, '01', '1/credits', '1\n', '', null, [], {}, true, 2147483648])('rejects ID %j', value => {
    expect(() => reviewInteger(value)).toThrow();
  });
  test('accepts database-sized positive IDs and exact request fields', () => {
    expect(reviewInteger('2147483647')).toBe(2147483647);
    expect(() => reviewBody({ confirmed: true, previewId: 'id', tmdbId: 3 }, ['confirmed', 'previewId'])).toThrow();
    expect(() => reviewBody({ confirmed: true }, ['confirmed', 'previewId'])).toThrow();
    expect(() => reviewBody(null, [])).toThrow();
  });
  test.each([null, [], {}, { id: 2, title: 'Movie' }, { id: 1, name: 'TV' },
    { id: 1, title: 'Movie', media_type: 'tv' }, { id: 1, title: ' ' }, { id: 1, title: 'x'.repeat(501) }])('rejects invalid details %j', data => {
    expect(() => projectReviewCandidate(data, 1, 'movie')).toThrow();
  });
  test('projects bounded typed evidence without leaking provider fields', () => {
    expect(projectReviewCandidate({ id: 3, name: ' TV ', first_air_date: '2026-01-01', secret: 'private', overview: 'x'.repeat(2000) }, 3, 'tv'))
      .toEqual({ tmdbId: 3, mediaType: 'tv', title: 'TV', originalTitle: null, releaseDate: '2026-01-01', overview: 'x'.repeat(1500) });
  });
  test('uses a fixed typed, timed and rate-limited request', async () => {
    const deps = { baseUrl: 'https://api.themoviedb.org/3', getApiKey: jest.fn().mockResolvedValue('test-key'),
      executeRateLimited: jest.fn(fn => fn()), httpGet: jest.fn().mockResolvedValue({ data: { id: 12, name: 'TV' } }) };
    await expect(getTmdbIdentityDetails('12', 'tv', deps)).resolves.toEqual({ id: 12, name: 'TV' });
    expect(deps.httpGet).toHaveBeenCalledWith('https://api.themoviedb.org/3/tv/12', { params: { api_key: 'test-key' }, timeout: 10000 });
    expect(deps.executeRateLimited).toHaveBeenCalledTimes(1);
    await expect(getTmdbIdentityDetails('../12', 'movie', deps)).rejects.toThrow();
    await expect(getTmdbIdentityDetails(12, 'person', deps)).resolves.toBeNull();
    deps.getApiKey.mockResolvedValue(null);
    await expect(getTmdbIdentityDetails(12, 'movie', deps)).rejects.toThrow('not configured');
    expect(deps.httpGet).toHaveBeenCalledTimes(1);
  });
});
