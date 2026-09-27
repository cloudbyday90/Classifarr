/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach } from '@jest/globals';
import { preflightSourceEnumeration } from '../services/sourceEnumerationPreflight.mjs';
const httpGet = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({ httpGet }));
const { plexService } = await import('../services/mediaServers/plex.mjs');
const { createEmbyLikeService } = await import('../services/mediaServers/shared/createEmbyLikeService.mjs');
const providers = [
  ['plex', plexService], ['emby', createEmbyLikeService({ displayName: 'Emby' })],
  ['jellyfin', createEmbyLikeService({ displayName: 'Jellyfin' })],
];
beforeEach(() => httpGet.mockReset());

test.each(providers)('%s canaries use the actual adapter envelopes for movie, TV, empty and optional-total responses', async (type, service) => {
  for (const kind of ['movie', 'tv', 'empty', 'missing_total', 'ignored_offset', 'headers']) {
    httpGet.mockImplementation(async (url, { params }) => {
      const offset = params.StartIndex ?? params['X-Plex-Container-Start'];
      const collections = params.IncludeItemTypes === 'BoxSet' || url.endsWith('/collections');
      const total = collections || kind === 'empty' ? 0 : 3;
      const id = kind === 'ignored_offset' ? 'item-0' : `item-${offset}`;
      if (type === 'plex') return { data: { MediaContainer: {
        ...(kind === 'headers' ? {} : { offset }),
        ...(kind === 'missing_total' || kind === 'headers' ? {} : { totalSize: total }), size: total ? 1 : 0,
        ...(total ? { Metadata: [{ ratingKey: id, type: kind === 'tv' ? 'show' : 'movie' }] } : {}),
      } }, headers: kind === 'headers' ? { 'X-Plex-Container-Total-Size': String(total), 'X-Plex-Container-Start': String(offset) } : {} };
      return { data: { StartIndex: offset, ...(kind === 'missing_total' ? {} : { TotalRecordCount: total }),
        Items: total ? [{ Id: id, Type: kind === 'tv' ? 'Series' : 'Movie' }] : [] } };
    });
    const args = { service, url: 'http://synthetic.invalid', apiKey: 'private-token', libraryKey: 'library',
      owner: { assertSource: async () => {} }, batchSize: 100 };
    if (kind === 'missing_total' || kind === 'ignored_offset') {
      await expect(preflightSourceEnumeration(args)).rejects.toMatchObject({ detail: {
        reason: kind === 'missing_total' ? 'unknown_source_total' : 'repeated_source_key', phase: 'media',
      } });
    } else {
      const result = await preflightSourceEnumeration(args);
      expect(result.media).toHaveLength(kind === 'empty' ? 1 : 2);
      expect(result.collections).toHaveLength(1);
      expect(result.collections[0]).toMatchObject({ total: 0, items: [] });
    }
  }
});
