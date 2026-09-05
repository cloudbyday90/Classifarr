/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createTmdbIdentityOrigin, decideSyncedIdentity, normalizeSourceProviderIds, sourceMetadata } from '../services/mediaSourceIdentity.mjs';
import { parsePlexGuids, parseProviderIds } from '../services/mediaServers/shared/providerIds.mjs';

const source = (patch = {}) => ({ media_server_id: 1, external_id: 'source-key', media_type: 'movie',
  title: 'A Title', year: 2001, tmdb_id: null, imdb_id: null, tvdb_id: null, ...patch });
const resolved = (patch = {}, method = 'queue_resolution') => {
  const row = source({ tmdb_id: 42, ...patch });
  row.metadata = { omdb: { data: { rated: 'PG' } }, inventory_tmdb: { version: 1, tmdb_id: 42 },
    tmdb_identity_origin: createTmdbIdentityOrigin(row, 42, method) };
  return row;
};

test.each(['queue_resolution', 'operator'])('retains attributable %s resolution on repeated omissions', method => {
  let row = resolved({}, method);
  for (let i = 0; i < 3; i++) {
    const decision = decideSyncedIdentity(row, source({ title: 'Ａ TITLE', metadata: { summary: 'new' } }));
    expect(decision).toMatchObject({ tmdbId: 42, preserveRating: true, metadata: { summary: 'new',
      omdb: row.metadata.omdb, inventory_tmdb: row.metadata.inventory_tmdb,
      tmdb_identity_origin: { method, source_anchor: { title: 'a title' } } } });
    row = { ...row, tmdb_id: decision.tmdbId, metadata: decision.metadata };
  }
});

test.each([
  { media_server_id: 2 }, { external_id: 'reused' }, { media_type: 'tv' },
  { title: 'Another work' }, { year: 2002 }, { year: null }, { tmdb_id: 99 },
])('invalidates old evidence after source identity changes: %j', patch => {
  const result = decideSyncedIdentity(resolved(), source({ ...patch, metadata: { summary: 'fresh' } }));
  expect(result).toEqual({ tmdbId: patch.tmdb_id ?? null, metadata: { summary: 'fresh' }, preserveRating: false });
});

test('preserves identities through library moves and source agreement', () => {
  const row = resolved({ library_id: 10 });
  expect(decideSyncedIdentity(row, source({ library_id: 11, tmdb_id: 42 })).metadata).toEqual(row.metadata);
});

test('external IDs provide continuity when year is unknown', () => {
  const row = resolved({ year: null, imdb_id: 'tt123', tvdb_id: 7 });
  expect(decideSyncedIdentity(row, source({ year: null, imdb_id: 'tt123' })).tmdbId).toBe(42);
  expect(decideSyncedIdentity(row, source({ year: null, tvdb_id: 7 })).tmdbId).toBe(42);
});

test.each(['year', 'imdb_id', 'tvdb_id'])('never forgets an added %s anchor through later omissions', field => {
  const values = { year: 2001, imdb_id: 'tt123', tvdb_id: 7 };
  const conflicts = { year: 2002, imdb_id: 'tt999', tvdb_id: 9 };
  let row = resolved({ year: null, imdb_id: 'tt123', [field]: null });
  // TVDB/IMDb additions use a shared year; year additions use the shared IMDb ID.
  if (field !== 'year') row = resolved({ [field]: null });
  let decision = decideSyncedIdentity(row, source({ ...row, tmdb_id: null, [field]: values[field] }));
  expect(decision.tmdbId).toBe(42);
  row = { ...row, [field]: values[field], tmdb_id: decision.tmdbId, metadata: decision.metadata };
  decision = decideSyncedIdentity(row, source({ ...row, tmdb_id: null, [field]: null }));
  expect(decision.tmdbId).toBe(42);
  row = { ...row, [field]: null, metadata: decision.metadata };
  expect(decideSyncedIdentity(row, source({ ...row, tmdb_id: null, [field]: conflicts[field] })).tmdbId).toBeNull();
});

test.each([
  undefined, null, { version: 2 }, { method: 'source' }, { tmdb_id: 99 }, { tmdb_id: '42' },
  { media_type: 'tv' }, { source_anchor: {} }, { source_anchor: source({ year: 2002 }) },
])('cannot retain an ID using absent or inconsistent provenance: %j', override => {
  const row = resolved();
  row.metadata.tmdb_identity_origin = override == null ? override : { ...row.metadata.tmdb_identity_origin, ...override };
  expect(decideSyncedIdentity(row, source()).tmdbId).toBeNull();
});

test('checks newly conflicting stored identifiers against the original proof', () => {
  const row = resolved({ imdb_id: 'tt123' });
  row.imdb_id = 'tt999';
  expect(decideSyncedIdentity(row, source({ imdb_id: 'tt999' })).tmdbId).toBeNull();
});

test('source metadata cannot forge provenance, resolution or TMDb observations', () => {
  const incoming = source({ metadata: resolved().metadata });
  expect(decideSyncedIdentity(null, incoming).tmdbId).toBeNull();
  expect(sourceMetadata(incoming.metadata)).toEqual({ omdb: incoming.metadata.omdb });
  expect(incoming.metadata.tmdb_identity_origin).toBeDefined();
  for (const value of [null, undefined, [], 'invalid']) expect(sourceMetadata(value)).toEqual({});
});

test.each([
  null, {}, source({ media_server_id: 0 }), source({ external_id: '' }), source({ external_id: 'x'.repeat(501) }),
  source({ media_type: 'person' }), source({ title: null }), source({ title: 'x'.repeat(501) }),
  source({ year: '2001bad' }), source({ year: 10000 }), source({ imdb_id: 'bad' }),
])('cannot record an invalid source anchor: %j', row => {
  expect(createTmdbIdentityOrigin(row, 42, 'operator')).toBeNull();
});

test('requires a valid typed ID and supported resolution activity', () => {
  expect(createTmdbIdentityOrigin(source(), 0, 'operator')).toBeNull();
  expect(createTmdbIdentityOrigin(source(), 42, 'source')).toBeNull();
});

test.each(['42garbage', '1.5', '1e3', '-1', 0, -1, 2147483648, {}, [], true, ' '])(
  'rejects malformed explicit numeric IDs instead of converting them to omission: %j', value => {
    expect(normalizeSourceProviderIds({ tmdb_id: value })).toBeNull();
    expect(parseProviderIds({ Tmdb: value })).toMatchObject({ provider_identity_invalid: true });
  });

test('normalizes whole provider IDs and distinguishes malformed structures', () => {
  expect(parseProviderIds({ Tmdb: ' 042 ', Imdb: ' TT0123 ', Tvdb: '12' }))
    .toEqual({ tmdb_id: 42, imdb_id: 'tt0123', tvdb_id: 12 });
  expect(parseProviderIds()).toEqual({ tmdb_id: null, imdb_id: null, tvdb_id: null });
  expect(parsePlexGuids()).toEqual(parseProviderIds());
  for (const value of [null, [], 'bad']) expect(parseProviderIds(value).provider_identity_invalid).toBe(true);
  expect(parsePlexGuids(null).provider_identity_invalid).toBe(true);
  expect(parseProviderIds({ Imdb: 'tt123suffix' }).provider_identity_invalid).toBe(true);
});

test.each(['tmdb', 'tvdb', 'imdb'])('Plex rejects conflicting %s declarations but accepts identical duplicates', provider => {
  const first = provider === 'imdb' ? 'tt123' : '123';
  const second = provider === 'imdb' ? 'tt456' : '456';
  const guid = id => ({ id: `${provider}://${id}` });
  expect(parsePlexGuids([guid(first), guid(second)]).provider_identity_invalid).toBe(true);
  expect(parsePlexGuids([guid(first), guid(first)]).provider_identity_invalid).toBeUndefined();
  expect(parsePlexGuids([guid('')]).provider_identity_invalid).toBe(true);
  expect(parsePlexGuids([guid(`${first}oops`)]).provider_identity_invalid).toBe(true);
  expect(parsePlexGuids([{}, null, { id: 'plex://movie/local' }, guid(first)])[`${provider}_id`])
    .toBe(provider === 'imdb' ? first : 123);
});
