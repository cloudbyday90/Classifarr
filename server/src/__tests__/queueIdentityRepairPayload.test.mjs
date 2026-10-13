/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { planRequestIdentityRepair } from '../services/queueIdentityRepairPayload.mjs';
import { normalizeRequestIdentity } from '../services/requestIdentityNormalization.mjs';

const candidate = { tmdbId: 99, mediaType: 'tv' };
const replace = payload => planRequestIdentityRepair(payload, 42, candidate, 'receipt').payload;
const base = { media_type: 'tv', tmdb_id: 42, imdb_id: 'tt123', tvdb_id: 7 };

test.each(['tmdb_id', 'tmdbId'])('repairs root and nested %s without inserting other aliases', key => {
  for (const location of ['root', 'media']) for (const value of [42, '00042', '\t42\uFEFF']) {
    const body = { mediaType: 'TV', [key]: value, imdbId: 'tt123' };
    const input = location === 'root' ? body : { media: body };
    const before = structuredClone(input);
    const result = replace(input);
    expect(input).toEqual(before);
    expect(result).toEqual({ ...(location === 'root'
      ? { ...body, [key]: typeof value === 'string' ? '99' : 99 }
      : { media: { ...body, [key]: typeof value === 'string' ? '99' : 99 } }), identity_repair: 'receipt' });
    expect(normalizeRequestIdentity(result)).toMatchObject({ tmdbId: 99, mediaType: 'tv', reason: null });
  }
});

test.each(['TMDB', 'tmdbId', ' TMDB ID ', 'TMDB_ID', 'tmdb-id'])('repairs exact legacy label %s and preserves other entries', name => {
  const input = { media_type: 'tv', extra: [{ name, value: '42' }, { name: 'IMDb', value: 'tt123' },
    { seasonNumber: 1, episodeNumber: 2 }, { season_number: 2, episode_number: 3 }] };
  expect(replace(input)).toEqual({ ...input, identity_repair: 'receipt',
    extra: [{ name, value: '99' }, ...input.extra.slice(1)] });
  expect(input.extra[0].value).toBe('42');
});

test('updates every declaration together, preserving nulls, external IDs and request context', () => {
  const input = { ...base, tmdbId: '42', title: 'Original', requested_seasons: [1],
    media: { tmdbId: 42, tmdb_id: '42', mediaType: 'tv', imdbId: null, year: 2020 },
    extra: [{ name: 'TMDB', value: 42 }, { name: 'tmdb_id', value: null }] };
  const result = replace(input);
  expect(result).toEqual({ ...input, tmdb_id: 99, tmdbId: '99', identity_repair: 'receipt',
    media: { ...input.media, tmdbId: 99, tmdb_id: '99' },
    extra: [{ name: 'TMDB', value: 99 }, { name: 'tmdb_id', value: null }] });
  expect(normalizeRequestIdentity(result)).toEqual({ ...normalizeRequestIdentity(input), tmdbId: 99 });
  expect(replace({ media_type: 'tv', tmdb_id: null, tmdbId: 42, media: null, extra: null }))
    .toEqual({ media_type: 'tv', tmdb_id: null, tmdbId: 99, media: null, extra: null, identity_repair: 'receipt' });
});

test.each([null, [], {}, { ...base, tmdbId: 43 }, { ...base, mediaType: 'movie' },
  { ...base, imdbId: 'tt456' }, { ...base, tmdb_id: 'invalid' }, { ...base, result: {} },
  { ...base, media: { overview: 'cached' } }, { ...base, identity_repair: 'old' },
  { ...base, extra: [{ name: 'TMDB URL', value: 42 }] },
  { ...base, extra: [{ name: 'TMDB', value: 42, metadata: {} }] },
  { ...base, extra: [{ name: 'unreviewed', value: 42 }] },
  { ...base, extra: [{ seasonNumber: 1, tmdbId: 7 }] },
  { ...base, extra: Array(65).fill({ name: 'TMDB', value: 42 }) },
  { ...base, title: 'x'.repeat(65536) },
])('refuses malformed, conflicting or unsupported request %#', input => {
  const before = structuredClone(input);
  expect(() => replace(input)).toThrow();
  expect(input).toEqual(before);
});

test.each([{ tmdbId: 42, mediaType: 'tv' }, { tmdbId: 99, mediaType: 'movie' },
  { tmdbId: 0, mediaType: 'tv' }, { tmdbId: '99', mediaType: 'tv' }, { tmdbId: 2147483648, mediaType: 'tv' }, null])
('requires a different server-owned typed replacement %#', replacement => {
  expect(() => planRequestIdentityRepair(base, 42, replacement, 'receipt')).toThrow();
});

test('old identity must still agree; frozen input remains unchanged', () => {
  expect(() => planRequestIdentityRepair(base, 43, candidate, 'receipt')).toThrow();
  const input = Object.freeze({ media: Object.freeze({ tmdbId: 42, mediaType: 'tv' }) });
  expect(replace(input).media.tmdbId).toBe(99);
});

test('plan contains only present TMDb paths, never arbitrary request paths', () => {
  expect(planRequestIdentityRepair({ ...base, media: { tmdbId: '42', tmdb_id: null },
    extra: [{ name: 'TMDB', value: 42 }, { seasonNumber: 1 }] }, 42, candidate, 'receipt').patches)
    .toEqual([{ path: ['tmdb_id'], value: 99 }, { path: ['media', 'tmdbId'], value: '99' },
      { path: ['extra', '0', 'value'], value: 99 }]);
});
