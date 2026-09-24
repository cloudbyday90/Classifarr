/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { payloadMediaType } from '../services/mediaIdentityValues.mjs';
import { createLoggerModuleMock } from './helpers/mockFactory.mjs';

const httpGet = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({ httpGet }));
jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);
const { plexService } = await import('../services/mediaServers/plex.mjs');
const { embyService } = await import('../services/mediaServers/emby.mjs');
const { jellyfinService } = await import('../services/mediaServers/jellyfin.mjs');

beforeEach(() => httpGet.mockReset());

test('Plex discards audio metadata while preserving source page positions', async () => {
  const types = ['artist', 'album', 'track', 'clip', 'episode', undefined];
  httpGet.mockResolvedValue({ data: { MediaContainer: { totalSize: 8, Metadata: [
    ...types.map(type => ({ type, ratingKey: 'audio', title: 'Private audio title', Guid: [{ id: 'tmdb://7' }] })),
    { type: 'movie', ratingKey: 'film', title: 'Music documentary' },
    { type: 'show', ratingKey: 'series', title: 'A musical TV series' },
  ] } } });
  const rows = await plexService.getLibraryItems('http://source', 'token', 'library');
  expect(rows).toHaveLength(8);
  expect(rows.slice(0, types.length)).toEqual(types.map(() => ({ media_type: null, total: 8 })));
  expect(rows.slice(types.length)).toEqual([
    expect.objectContaining({ external_id: 'film', media_type: 'movie', title: 'Music documentary' }),
    expect.objectContaining({ external_id: 'series', media_type: 'tv' }),
  ]);
});

test.each([['Emby', embyService], ['Jellyfin', jellyfinService]])(
  '%s ignores unexpected audio even when the provider disregards IncludeItemTypes', async (_name, service) => {
    const types = ['Audio', 'MusicAlbum', 'MusicArtist', 'MusicVideo', 'Episode', undefined];
    httpGet.mockResolvedValue({ data: { TotalRecordCount: 8, Items: [
      ...types.map(Type => ({ Type, Id: 'audio', Name: 'Private audio title', ProviderIds: { Tmdb: '7' } })),
      { Type: 'Movie', Id: 'film', Name: 'Music documentary' },
      { Type: 'Series', Id: 'series' },
    ] } });
    const rows = await service.getLibraryItems('http://source', 'token', 'library');
    expect(httpGet).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      params: expect.objectContaining({ IncludeItemTypes: 'Movie,Series' }),
    }));
    expect(rows).toHaveLength(8);
    expect(rows.slice(0, types.length)).toEqual(types.map(() => ({ media_type: null, total: 8 })));
    expect(rows.slice(types.length)).toEqual([
      expect.objectContaining({ external_id: 'film', media_type: 'movie', title: 'Music documentary' }),
      expect.objectContaining({ external_id: 'series', media_type: 'tv' }),
    ]);
  });

test.each([
  {}, { media: { media_type: 'music' } }, { media: { mediaType: 'Audio' } },
  { media_type: 'album' }, { mediaType: 'track' },
  { media: { media_type: 'movie', mediaType: 'music' } },
  { media: { media_type: 'tv' }, media_type: 'music' },
])('rejects missing, unsupported, or conflicting payload types: %j', payload => {
  expect(payloadMediaType(payload)).toBeNull();
});

test('accepts consistent movie/TV declarations in both existing field conventions', () => {
  expect(payloadMediaType({ media: { mediaType: ' TV ' }, media_type: 'tv' })).toBe('tv');
  expect(payloadMediaType({ mediaType: 'movie' })).toBe('movie');
});
