/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach } from '@jest/globals';
import { SourceEnumerationError } from '../services/sourceEnumerationError.mjs';
const httpGet = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({ httpGet }));
const { plexService } = await import('../services/mediaServers/plex.mjs');
const { createEmbyLikeService } = await import('../services/mediaServers/shared/createEmbyLikeService.mjs');
const services = [plexService, createEmbyLikeService({ displayName: 'Emby' }), createEmbyLikeService({ displayName: 'Jellyfin' })];
beforeEach(() => httpGet.mockReset());

test.each(services)('missing media type cannot impersonate an intentionally ignored audio item', async service => {
  for (const type of [undefined, null, '', ' ', {}, 1]) {
    httpGet.mockResolvedValue({ data: service === plexService
      ? { MediaContainer: { totalSize: 1, Metadata: [{ ratingKey: 'film', type }] } }
      : { TotalRecordCount: 1, Items: [{ Id: 'film', Type: type }] } });
    await expect(service.getLibraryPage('http://synthetic.invalid', 'private-token', 'library')).rejects.toThrow('missing_media_type');
  }
});

test.each(services)('preserves typed failures for both endpoints and never turns outages into empty collections', async service => {
  for (const method of ['getLibraryPage', 'getCollectionPage']) {
    httpGet.mockResolvedValue({ data: {} });
    await expect(service[method]('http://synthetic.invalid', 'private-token', 'library')).rejects.toBeInstanceOf(SourceEnumerationError);
    httpGet.mockRejectedValue(new Error('synthetic outage'));
    await expect(service[method]('http://synthetic.invalid', 'private-token', 'library')).rejects.toThrow('synthetic outage');
  }
});
test('Plex returns page evidence separately from normalized unsupported metadata', async () => {
  httpGet.mockResolvedValue({ data: { MediaContainer: { offset: 7, size: 2, totalSize: 10,
    Metadata: [{ ratingKey: 'audio', type: 'track', title: 'Do not retain' }, { ratingKey: 'film', type: 'movie', title: 'Film' }] } } });
  const page = await plexService.getLibraryPage('http://synthetic.invalid', 'private-token', 'library', { offset: 7, limit: 3 });
  expect(page).toMatchObject({ offset: 7, total: 10, keys: ['audio', 'film'] });
  expect(page.items[0]).toEqual({ media_type: null, total: 10 });
  expect(page.items[1]).toMatchObject({ external_id: 'film', media_type: 'movie' });
  expect(httpGet.mock.calls[0][1].headers).toMatchObject({ 'X-Plex-Container-Start': 7, 'X-Plex-Container-Size': 3 });
});
test.each(services)('requests collection pagination and preserves source totals', async service => {
  httpGet.mockResolvedValue({ data: service === plexService
    ? { MediaContainer: { offset: 2, size: 1, totalSize: 3, Metadata: [{ ratingKey: 'set', title: 'Set' }] } }
    : { StartIndex: 2, TotalRecordCount: 3, Items: [{ Id: 'set', Name: 'Set' }] } });
  const page = await service.getCollectionPage('http://synthetic.invalid', 'private-token', 'library', { offset: 2, limit: 4 });
  expect(page).toMatchObject({ offset: 2, total: 3, keys: ['set'], items: [{ external_id: 'set', name: 'Set' }] });
  expect(httpGet.mock.calls[0][1].params).toMatchObject(service === plexService
    ? { 'X-Plex-Container-Start': 2, 'X-Plex-Container-Size': 4 }
    : { StartIndex: 2, Limit: 4, EnableTotalRecordCount: true });
});
