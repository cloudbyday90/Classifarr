/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { syncMediaServerLibraries } from '../services/mediaServerLibrarySync.mjs';

function harness(discoveryResult) {
  const calls = [];
  const server = { id: 1, type: 'plex', url: 'http://source', api_key: 'private' };
  const client = { query: jest.fn(async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT * FROM media_server')) return { rows: [server] };
    if (sql.includes('SELECT id, external_id, name')) return { rows: [] };
    return { rows: [], rowCount: 0 };
  }) };
  const db = { withTransaction: jest.fn(fn => fn(client)) };
  const service = { getLibraries: jest.fn().mockResolvedValue([]),
    getDiscoveryLibraries: jest.fn().mockImplementation(discoveryResult) };
  const mediaSyncService = { syncLibrary: jest.fn() };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { calls, db, service, mediaSyncService, logger };
}

test('music sections are persisted only to discovery, never policies or content sync', async () => {
  const fixture = harness(async () => [{ external_id: '31', name: 'Music', media_type: 'music' }]);
  const result = await syncMediaServerLibraries({ db: fixture.db,
    getMediaServerServiceByType: () => fixture.service,
    mediaSyncService: fixture.mediaSyncService, logger: fixture.logger });
  expect(result).toEqual([]);
  expect(fixture.db.withTransaction).toHaveBeenCalledTimes(2);
  expect(fixture.calls.some(call => call.sql.includes('INSERT INTO media_source_discovery_libraries'))).toBe(true);
  expect(fixture.calls.some(call => call.sql.includes('INSERT INTO libraries'))).toBe(false);
  expect(fixture.calls.some(call => call.sql.includes('INSERT INTO library_policies'))).toBe(false);
  expect(fixture.mediaSyncService.syncLibrary).not.toHaveBeenCalled();
});

test('music discovery failure retains previous snapshot and does not fail routing sync', async () => {
  const fixture = harness(async () => { throw new Error('token might be in a source error'); });
  await expect(syncMediaServerLibraries({ db: fixture.db,
    getMediaServerServiceByType: () => fixture.service,
    mediaSyncService: fixture.mediaSyncService, logger: fixture.logger })).resolves.toEqual([]);
  expect(fixture.db.withTransaction).toHaveBeenCalledTimes(1);
  expect(fixture.logger.warn).toHaveBeenCalledWith(expect.stringContaining('previous snapshot retained'),
    { errorType: 'Error' });
  expect(JSON.stringify(fixture.logger.warn.mock.calls)).not.toContain('token might');
});
