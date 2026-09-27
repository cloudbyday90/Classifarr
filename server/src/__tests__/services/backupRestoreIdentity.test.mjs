/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { jest } from '@jest/globals';
import { restoreMediaServers, restoreLibraries } from '../../services/backupRestoreTables.mjs';

describe('backup media-server relationship mapping', () => {
  it('maps exported server IDs to newly allocated IDs', async () => {
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 200 }] })
      .mockResolvedValueOnce({ rows: [{ id: 300 }] }) };
    const serverIdMap = await restoreMediaServers(client, [
      { id: 7, type: 'plex', name: 'Plex', url: 'http://plex.invalid', api_key: 'synthetic', is_active: true },
    ]);
    const library = { id: 8, name: 'Movies', media_type: 'movie', media_server_id: 7, external_id: '1' };
    const libraryIdMap = await restoreLibraries(client, [library], serverIdMap);
    expect([...serverIdMap]).toEqual([[7, 200]]);
    expect([...libraryIdMap]).toEqual([[8, 300]]);
    expect(client.query).toHaveBeenLastCalledWith(expect.stringContaining('INSERT INTO libraries'),
      ['Movies', 'movie', 200, '1', null, null, null, null, {}, {}]);
    expect(library.media_server_id).toBe(7);
  });

  it('rejects duplicate exported server IDs instead of silently choosing a destination', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 200 }] }) };
    await expect(restoreMediaServers(client, [{ id: 7 }, { id: 7 }]))
      .rejects.toThrow('duplicate media server IDs');
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it('maps an existing uniqueness-key match without overwriting credentials', async () => {
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 200 }] }) };
    const map = await restoreMediaServers(client, [{ id: 7, type: 'plex', url: 'http://plex.invalid' }]);
    expect(map.get(7)).toBe(200);
    expect(client.query.mock.calls[0][0]).toContain('DO NOTHING');
    expect(client.query).toHaveBeenLastCalledWith(expect.stringContaining('client_identifier IS NULL'),
      ['plex', 'http://plex.invalid']);
  });

  it('rejects a lost uniqueness-key match instead of storing an undefined destination', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await expect(restoreMediaServers(client, [{ id: 7, type: 'plex', url: 'http://plex.invalid' }]))
      .rejects.toThrow('could not be mapped');
  });

  it('does not reuse a missing server ID from the destination database', async () => {
    const client = { query: jest.fn() };
    await expect(restoreLibraries(client, [{ id: 8, media_server_id: 7 }], new Map()))
      .rejects.toThrow('libraries.media_server_id');
    expect(client.query).not.toHaveBeenCalled();
  });

  it('preserves nullable server links and empty legacy inputs', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 300 }] }) };
    expect(await restoreMediaServers(client, null)).toEqual(new Map());
    expect(await restoreLibraries(client, null)).toEqual(new Map());
    await restoreLibraries(client, [{ id: 8, name: 'Movies', media_type: 'movie', media_server_id: null }]);
    expect(client.query).toHaveBeenLastCalledWith(expect.any(String), ['Movies', 'movie', null, null, null, null, null, {}, {}]);
  });
});
