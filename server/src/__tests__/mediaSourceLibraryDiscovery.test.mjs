/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { mediaLibraryCapability, isRoutingInventoryLibrary } from '../services/mediaLibraryCapabilityRegistry.mjs';
import { validateReadOnlySourceLibraries, refreshReadOnlySourceLibraries,
  readReadOnlySourceLibraries } from '../services/mediaSourceLibraryDiscovery.mjs';

const music = (overrides = {}) => ({ external_id: '31', name: 'Music', media_type: 'music', ...overrides });

test('capabilities separate read-only music discovery from movie/TV routing inventory', () => {
  expect(mediaLibraryCapability('music')).toMatchObject({ admission: 'source_discovery_only', itemKind: 'artist' });
  expect(mediaLibraryCapability('movie').admission).toBe('routing_inventory');
  expect(mediaLibraryCapability('tv').admission).toBe('routing_inventory');
  expect(mediaLibraryCapability('__proto__')).toBeNull();
  expect(isRoutingInventoryLibrary({ media_type: 'music' })).toBe(false);
});

test('source snapshot rejects ambiguous or malformed sections without truncation', () => {
  expect(validateReadOnlySourceLibraries([music()])).toEqual([music()]);
  for (const rows of [[music(), music()], [music({ media_type: 'movie' })],
    [music({ external_id: '' })], [music({ name: 'Bad\nname' })],
    Array.from({ length: 65 }, (_, index) => music({ external_id: String(index) }))]) {
    expect(() => validateReadOnlySourceLibraries(rows)).toThrow();
  }
});

test('complete read-only snapshot upserts current sections and marks absent ones without deleting', async () => {
  const client = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
  const db = { withTransaction: jest.fn(fn => fn(client)) };
  const service = { getDiscoveryLibraries: jest.fn().mockResolvedValue([music()]) };
  const server = { id: 2, url: 'http://source', api_key: 'secret' };
  await expect(refreshReadOnlySourceLibraries({ db, service, server })).resolves.toBe(1);
  expect(service.getDiscoveryLibraries).toHaveBeenCalledWith('http://source', 'secret');
  expect(client.query).toHaveBeenCalledTimes(3);
  expect(client.query.mock.calls[0][0]).toContain('ON CONFLICT');
  expect(client.query.mock.calls[0][1][1]).toBe(JSON.stringify([music()]));
  expect(client.query.mock.calls[1][0]).toContain('SET is_present=FALSE');
  expect(client.query.mock.calls[1][1]).toEqual([2, ['31']]);
  expect(client.query.mock.calls[2][1]).toEqual([2, 90]);
  expect(client.query.mock.calls.flat().join(' ')).not.toContain('DELETE FROM libraries');
});

test('failed or malformed source discovery preserves the previous snapshot', async () => {
  const db = { withTransaction: jest.fn() };
  const server = { id: 2, url: 'http://source', api_key: 'secret' };
  await expect(refreshReadOnlySourceLibraries({ db, server,
    service: { getDiscoveryLibraries: jest.fn().mockRejectedValue(new Error('offline')) } }))
    .rejects.toThrow('offline');
  await expect(refreshReadOnlySourceLibraries({ db, server,
    service: { getDiscoveryLibraries: jest.fn().mockResolvedValue([music({ name: '' })]) } }))
    .rejects.toThrow('Invalid source library');
  expect(db.withTransaction).not.toHaveBeenCalled();
});

test('admin read model excludes source IDs and credentials', async () => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [{ id: '7', name: 'Music',
    media_type: 'music', is_present: true, first_seen_at: '2026-09-24T10:00:00Z',
    last_seen_at: '2026-09-24T11:00:00Z', external_id: 'private', api_key: 'secret' }] }) };
  expect(await readReadOnlySourceLibraries(db)).toEqual({ version: 'source_library_discovery.v1',
    admission: 'read_only', truncated: false, libraries: [{ id: 7, name: 'Music', mediaType: 'music',
      isPresent: true, firstSeenAt: '2026-09-24T10:00:00Z', lastSeenAt: '2026-09-24T11:00:00Z' }] });
});
