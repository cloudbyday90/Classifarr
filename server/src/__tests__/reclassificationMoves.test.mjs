/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, test, expect } from '@jest/globals';
import { createReclassificationMoveAdapter } from '../services/reclassificationMoves.mjs';

let adapter, row, database, mappings, files, remote, service, prepareEvidence, verifyEvidence, fingerprint;
beforeEach(() => {
  row = { id: 1, library_id: 10, media_type: 'movie', tmdb_id: 123, title: 'Synthetic' };
  remote = { id: 2, tmdbId: 123, tvdbId: 456, path: '/old/item', qualityProfileId: 1 };
  database = { query: jest.fn(async sql => ({ rows: sql.includes('FROM libraries') ? [{ id: 10 }, { id: 20 }]
    : [{ id: 1, url: 'http://arr.invalid', api_key: 'secret' }] })) };
  mappings = { getLibraryMapping: jest.fn(async id => ({ arr_type: row.media_type === 'movie' ? 'radarr' : 'sonarr',
    arr_config_id: 1, arr_root_folder_path: id === 10 ? '/old' : '/new', quality_profile_id: 1 })) };
  files = { translatePath: jest.fn(async value => value), moveFolder: jest.fn().mockResolvedValue({ success: true }) };
  service = { getMovieByTmdbId: jest.fn(async () => ({ ...remote })), getSeriesByTvdbId: jest.fn(async () => ({ ...remote })),
    getMovieById: jest.fn(async () => ({ ...remote })), getSeriesById: jest.fn(async () => ({ ...remote })),
    updateMoviePath: jest.fn(async (_url, _key, _id, next) => { remote.path = next; }),
    updateSeriesPath: jest.fn(async (_url, _key, _id, next) => { remote.path = next; }),
    validatePathInRootFolder: jest.fn().mockResolvedValue({ isValid: true }) };
  prepareEvidence = jest.fn().mockResolvedValue('digest'); verifyEvidence = jest.fn();
  fingerprint = jest.fn().mockResolvedValue('digest');
  adapter = createReclassificationMoveAdapter({ database, mappings, files, radarr: service, sonarr: service,
    prepareEvidence, verifyEvidence, fingerprint });
});
test.each(['movie', 'tv'])('%s plans and verifies typed remote identity with explicit readback', async type => {
  row.media_type = type; row.metadata = { tvdb_id: 456 };
  const plan = await adapter.prepare(row, 20);
  expect(plan.providerId).toBe(type === 'movie' ? 123 : 456);
  expect(JSON.stringify(plan)).not.toContain('secret');
  await adapter.moveFiles(plan);
  await adapter.reconcile(plan);
  const update = type === 'movie' ? service.updateMoviePath : service.updateSeriesPath;
  expect(update).toHaveBeenCalledWith('http://arr.invalid', 'secret', 2, '/new/item', {
    moveFiles: false, qualityProfileId: 1, expectedPath: '/old/item', expectedProviderId: type === 'movie' ? 123 : 456 });
  expect(verifyEvidence).toHaveBeenCalledWith(plan, undefined);
  expect(files.moveFolder).toHaveBeenCalledTimes(1);
});
test('missing remote item is a failure before any filesystem action', async () => {
  remote = null;
  await expect(adapter.prepare(row, 20)).rejects.toMatchObject({ code: 'move_remote_missing' });
  expect(prepareEvidence).not.toHaveBeenCalled();
});
test('wrong provider ID cannot supply a move plan', async () => {
  remote.tmdbId = 999;
  await expect(adapter.prepare(row, 20)).rejects.toMatchObject({ code: 'move_remote_identity_changed' });
});
test('cross-instance moves are rejected', async () => {
  mappings.getLibraryMapping.mockResolvedValueOnce({ arr_type: 'radarr', arr_config_id: 2 })
    .mockResolvedValueOnce({ arr_type: 'radarr', arr_config_id: 1 });
  await expect(adapter.prepare(row, 20)).rejects.toMatchObject({ code: 'move_mapping_invalid' });
});
test('readback catches acknowledged but unapplied remote update', async () => {
  const plan = await adapter.prepare(row, 20);
  service.updateMoviePath.mockResolvedValue({ path: plan.newPath });
  await expect(adapter.reconcile(plan)).rejects.toThrow('unconfirmed');
});
test('lost response after remote commit is recovered without another PUT or file move', async () => {
  const plan = await adapter.prepare(row, 20);
  service.updateMoviePath.mockImplementationOnce(async () => { remote.path = plan.newPath; throw new Error('lost response'); });
  await expect(adapter.reconcile(plan)).rejects.toThrow('lost response');
  await adapter.reconcile(plan);
  expect(service.updateMoviePath).toHaveBeenCalledTimes(1);
  expect(files.moveFolder).not.toHaveBeenCalled();
});
test.each(['remote identity', 'remote path', 'path mapping', 'library mapping'])('%s drift prevents writes', async kind => {
  const plan = await adapter.prepare(row, 20);
  if (kind === 'remote identity') remote.id = 99;
  if (kind === 'remote path') remote.path = '/third/item';
  if (kind === 'path mapping') files.translatePath.mockResolvedValue('/changed/item');
  if (kind === 'library mapping') mappings.getLibraryMapping.mockResolvedValue({ arr_type: 'radarr', arr_config_id: 1, arr_root_folder_path: '/changed' });
  await expect(adapter.reconcile(plan)).rejects.toThrow();
  expect(service.updateMoviePath).not.toHaveBeenCalled();
});
test('path drift during slow content hashing is rechecked before PUT', async () => {
  const plan = await adapter.prepare(row, 20);
  verifyEvidence.mockImplementation(async () => { remote.path = '/third/item'; });
  await expect(adapter.reconcile(plan)).rejects.toMatchObject({ code: 'move_remote_path_changed' });
  expect(service.updateMoviePath).not.toHaveBeenCalled();
});
test('source deletion is fenced by content evidence and owner cancellation', async () => {
  const plan = await adapter.prepare(row, 20);
  const controller = new AbortController();
  await adapter.moveFiles(plan, { signal: controller.signal });
  const guard = files.moveFolder.mock.calls[0][2].beforeSourceDelete;
  await expect(guard()).resolves.toBeUndefined();
  fingerprint.mockResolvedValueOnce('changed');
  await expect(guard()).rejects.toMatchObject({ code: 'move_content_changed' });
  controller.abort(new Error('lost lock'));
  await expect(guard()).rejects.toThrow('lost lock');
  expect(files.moveFolder.mock.calls[0][2].preservePartialCopy).toBe(true);
});
test('credentials may rotate without invalidating a plan', async () => {
  const plan = await adapter.prepare(row, 20);
  database.query.mockImplementation(async sql => ({ rows: sql.includes('FROM libraries') ? [{ id: 10 }, { id: 20 }]
    : [{ id: 1, url: 'http://arr.invalid', api_key: 'rotated' }] }));
  await adapter.reconcile(plan);
  expect(service.updateMoviePath.mock.calls[0][1]).toBe('rotated');
});
