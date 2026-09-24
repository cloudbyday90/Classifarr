/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourceEvidenceAnchor, summarizeLibrarySourceEvidence } from '../services/librarySourceEvidenceAdapter.mjs';

test('source anchors remain scoped to the library and server, not provider IDs', () => {
  const item = { media_server_id: 2, external_id: 'abc', media_type: 'movie' };
  expect(sourceEvidenceAnchor(item, 7)).toEqual({ scope: 'source_item', libraryId: 7,
    mediaServerId: 2, mediaType: 'movie', externalId: 'abc' });
  expect(sourceEvidenceAnchor(item, 8)).not.toEqual(sourceEvidenceAnchor(item, 7));
  expect(sourceEvidenceAnchor({ ...item, media_server_id: null }, 7)).toBeNull();
  expect(sourceEvidenceAnchor({ ...item, external_id: '🎞'.repeat(100) }, 7)).not.toBeNull();
  expect(sourceEvidenceAnchor({ ...item, external_id: '🎞'.repeat(101) }, 7)).toBeNull();
});

test('provider-neutral description counts retain missing-TMDB items without authorizing a join', () => {
  const rows = [
    { media_server_id: 2, external_id: 'abc', media_type: 'movie', tmdb_id: null,
      imdb_id: 'tt1234567', overview: 'A privately stored description', source_conflict: false },
    { media_server_id: 3, external_id: 'abc', media_type: 'movie', tmdb_id: 42,
      tvdb_id: 21, overview: 'A privately stored description', source_conflict: false },
    { media_server_id: 2, external_id: 'conflict', media_type: 'movie', tmdb_id: null,
      overview: 'Conflicted description', source_conflict: true },
    { media_server_id: null, external_id: 'orphan', media_type: 'movie',
      overview: 'Unanchored description', source_conflict: false },
    { media_server_id: 2, external_id: 'tv', media_type: 'tv', overview: 'TV description' },
  ];
  expect(summarizeLibrarySourceEvidence(rows, 7, 'movie')).toEqual({ statusId: 'measured',
    typeMatchedItemCount: 4, anchoredItemCount: 3, conflictBlockedItemCount: 1,
    eligibleItemCount: 2, describedItemCount: 2, missingDescriptionItemCount: 0,
    describedWithoutTmdbItemCount: 1, alternateProviderObservedItemCount: 2 });
  expect(() => summarizeLibrarySourceEvidence([rows[0], rows[0]], 7, 'movie'))
    .toThrow('Duplicate source evidence anchor');
});

test('invalid provider IDs and empty descriptions do not become evidence', () => {
  expect(summarizeLibrarySourceEvidence([{ media_server_id: 1, external_id: 'a',
    media_type: 'music', tmdb_id: null, imdb_id: 'not-imdb', tvdb_id: -1,
    overview: '\n\t', source_conflict: false }], 4, 'music')).toMatchObject({
    eligibleItemCount: 1, describedItemCount: 0, missingDescriptionItemCount: 1,
    alternateProviderObservedItemCount: 0 });
});
