/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readPlexLibraryCatalog, readEmbyLibraryCatalog, validateLibraryCatalog } from '../services/mediaServers/shared/libraryCatalog.mjs';
import { computeLibraryDiff } from '../services/mediaServerLibrarySync.mjs';
const film = { external_id: 'one', name: 'Any library name', media_type: 'movie' };
test.each([undefined, null, {}, [], { MediaContainer: {} }, { MediaContainer: { Directory: {} } },
  { MediaContainer: { size: 2, Directory: [] } }, { MediaContainer: { size: 0, totalSize: 1 } },
  { MediaContainer: { size: 0, offset: 1 } }])('Plex rejects ambiguous/incomplete catalog %j', input => {
  expect(() => readPlexLibraryCatalog(input)).toThrow('preserved');
});
test('Plex accepts affirmative empty and validates unsupported identities before filtering', () => {
  expect(readPlexLibraryCatalog({ MediaContainer: { size: 0 } })).toEqual([]);
  expect(readPlexLibraryCatalog({ MediaContainer: { Directory: [] } })).toEqual([]);
  expect(readPlexLibraryCatalog({ MediaContainer: { size: 2, Directory: [
    { key: 'movie', title: 'Music films', type: 'movie' }, { key: 'audio', title: 'Audio', type: 'artist' },
  ] } })).toEqual([{ external_id: 'movie', name: 'Music films', media_type: 'movie' }, { external_id: 'audio', name: 'Audio', media_type: null }]);
});
test.each([undefined, null, {}, { Items: [] }, [null], [{}], [{ ItemId: 'x', Name: 'Name', CollectionType: 123 }]])('Emby/Jellyfin reject malformed catalog %j', input => {
  expect(() => readEmbyLibraryCatalog(input)).toThrow('preserved');
});
test('virtual folders preserve unsupported keys without importing music or guessing missing types', () => {
  expect(readEmbyLibraryCatalog([])).toEqual([]);
  expect(readEmbyLibraryCatalog([{ ItemId: 'a', Name: 'A' }, { ItemId: 'b', Name: 'B', CollectionType: 'tvshows' }]))
    .toEqual([{ external_id: 'a', name: 'A', media_type: null }, { external_id: 'b', name: 'B', media_type: 'tv' }]);
});
test.each([undefined, null, {}, [null], [{}], [film, film], [{ ...film, external_id: '' }],
  [{ ...film, name: 'x'.repeat(256) }], [{ ...film, external_id: 'x'.repeat(101) }], [{ ...film, name: 'a\nb' }],
  [{ ...film, media_type: 'music' }], Array(1001).fill(film)])('normalized contract rejects malformed input %#', input => {
  expect(() => validateLibraryCatalog(input)).toThrow('preserved');
});
test('archive stays immutable when source returns; absence never authorizes deletion', () => {
  const archived = { ...film, id: 14, is_active: false, archived_at: '2026-09-27' };
  expect(computeLibraryDiff([{ ...film, name: 'Renamed' }], [archived])).toEqual({ toInsert: [], toUpdate: [], retained: [], unobserved: [] });
  expect(computeLibraryDiff([], [archived]).unobserved).toEqual([archived]);
});
