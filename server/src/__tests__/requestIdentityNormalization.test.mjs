/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeRequestIdentity, requireRequestIdentity } from '../services/requestIdentityNormalization.mjs';
import { parseOverseerrPayload } from '../services/classificationMetadataServiceShared.mjs';
import { parsePayload } from '../services/webhookServiceShared.mjs';

test.each([
  { tmdb_id: 42, media_type: 'tv', imdb_id: 'tt123', tvdb_id: 7 },
  { tmdbId: '042', mediaType: ' TV ', imdbId: 'tt123', tvdbId: '07' },
  { media: { tmdbId: '42', mediaType: 'tv', imdbId: 'tt123', tvdbId: 7 } },
  { media: { tmdb_id: 42, media_type: 'tv', imdb_id: 'tt123', tvdb_id: 7 } },
  { media_type: 'tv', extra: [{ name: 'TMDB ID', value: '42' }, { name: 'IMDb', value: 'tt123' }, { name: 'tvdb_id', value: 7 }] },
])('all intake readers agree on supported aliases: %j', payload => {
  const before = JSON.stringify(payload);
  expect(normalizeRequestIdentity(payload)).toMatchObject({ mediaType: 'tv', tmdbId: 42, imdbId: 'tt123', tvdbId: 7, reason: null, externalReason: null });
  expect(parseOverseerrPayload(payload)).toMatchObject({ media_type: 'tv', tmdbId: 42, existingMetadata: { tvdb_id: 7 } });
  expect(parsePayload(payload)).toMatchObject({ media_type: 'tv', tmdb_id: 42, imdb_id: 'tt123', tvdb_id: 7 });
  expect(JSON.stringify(payload)).toBe(before);
});

test.each([true, [], {}, '4e1', '42.0', '', 0, -1, 2147483648, '1'.repeat(100)])('malformed declaration %j cannot hide behind a valid alias', value => {
  const payload = { tmdb_id: 42, media_type: 'movie', media: { tmdbId: value } };
  expect(normalizeRequestIdentity(payload).reason).toBe('request_identity_invalid');
  expect(() => parseOverseerrPayload(payload)).toThrow('Request identity');
});

test.each([
  { tmdb_id: 42, tmdbId: 43 },
  { tmdb_id: 42, media: { tmdb_id: 43 } },
  { tmdb_id: 42, extra: [{ name: 'tmdbId', value: 43 }] },
  { media_type: 'movie', media: { mediaType: 'tv' } },
])('conflicts never select the first declaration: %j', payload => {
  expect(normalizeRequestIdentity(payload).reason).toBe('request_identity_conflict');
  expect(() => requireRequestIdentity(payload)).toThrow('Request identity');
});

test('null IDs are absent; supported duplicate values agree without rewriting inputs', () => {
  expect(normalizeRequestIdentity({ tmdb_id: null, tmdbId: '00042', media: { tmdbId: 42 } }).tmdbId).toBe(42);
  expect(normalizeRequestIdentity({ title: 'Only a title' })).toMatchObject({ tmdbId: null, reason: null });
});

test.each([null, [], 'private', { media: [] }, { extra: {} }, { extra: Array(65).fill({ name: 'TMDB', value: 42 }) },
  { extra: [{ name: 'x'.repeat(65), value: 'private' }] }, { extra: [{ name: 'TMDB URL', value: 'private' }] },
  { extra: [null] }, { extra: [{ name: 'TMDB ID' }] }])('invalid structure is bounded and does not expose values', payload => {
  expect(normalizeRequestIdentity(payload).reason).toBe('request_identity_invalid');
  expect(() => requireRequestIdentity(payload)).toThrow('Request identity');
  try { requireRequestIdentity(payload); } catch (error) { expect(error.message).not.toContain('private'); }
});

test('external conflicts and invalid IDs block evidence and intake', () => {
  for (const [payload, reason] of [
    [{ imdb_id: 'tt123', media: { imdbId: 'tt456' } }, 'conflicting_external_ids'],
    [{ media_type: 'tv', tvdb_id: 7, media: { tvdbId: 'bad' } }, 'invalid_external_id'],
  ]) {
    expect(normalizeRequestIdentity(payload).externalReason).toBe(reason);
    expect(() => requireRequestIdentity(payload)).toThrow('Request identity');
  }
  expect(normalizeRequestIdentity({ media_type: 'movie', tvdb_id: 'unused' })).toMatchObject({ tvdbId: null, externalReason: null });
});

test('an invalid media type cannot hide behind a supported declaration', () => {
  expect(normalizeRequestIdentity({ media_type: 'movie', media: { mediaType: null } }).reason).toBe('request_identity_invalid');
});
