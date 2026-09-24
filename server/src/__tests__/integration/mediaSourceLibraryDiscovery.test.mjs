/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { refreshReadOnlySourceLibraries, readReadOnlySourceLibraries } from '../../services/mediaSourceLibraryDiscovery.mjs';

let client;
let db;
const server = { id: 1, url: 'http://source', api_key: 'private' };

beforeEach(async () => {
  client = await getPool().connect();
  await client.query(`CREATE TEMP TABLE media_server (id integer PRIMARY KEY, is_active boolean);
    CREATE TEMP TABLE media_source_discovery_libraries (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      media_server_id integer NOT NULL, external_id varchar(100) NOT NULL,
      name varchar(255) NOT NULL, media_type varchar(20) NOT NULL CHECK (media_type='music'),
      is_present boolean NOT NULL DEFAULT TRUE,
      first_seen_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(media_server_id, external_id));
    INSERT INTO media_server VALUES (1, TRUE);`);
  db = { query: (...args) => client.query(...args), withTransaction: async callback => {
    await client.query('BEGIN');
    try { const result = await callback(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  } };
});

afterEach(() => { client?.release(true); client = null; });

test('upsert, disappearance, and recovery remain separate from routing libraries', async () => {
  const discoveryService = { getDiscoveryLibraries: async () => [
    { external_id: '31', name: 'Music', media_type: 'music' }] };
  expect(await refreshReadOnlySourceLibraries({ db, server, service: discoveryService })).toBe(1);
  expect((await readReadOnlySourceLibraries(db)).libraries).toMatchObject([
    { name: 'Music', mediaType: 'music', isPresent: true }]);
  discoveryService.getDiscoveryLibraries = async () => [];
  await refreshReadOnlySourceLibraries({ db, server, service: discoveryService });
  expect((await readReadOnlySourceLibraries(db)).libraries[0].isPresent).toBe(false);
  discoveryService.getDiscoveryLibraries = async () => [
    { external_id: '31', name: 'Renamed Music', media_type: 'music' }];
  await refreshReadOnlySourceLibraries({ db, server, service: discoveryService });
  expect((await readReadOnlySourceLibraries(db)).libraries).toMatchObject([
    { name: 'Renamed Music', isPresent: true }]);
  expect((await client.query('SELECT COUNT(*)::integer AS count FROM media_source_discovery_libraries')).rows[0].count).toBe(1);
});

test('invalid snapshot does not mark prior sections missing', async () => {
  await refreshReadOnlySourceLibraries({ db, server, service: { getDiscoveryLibraries: async () => [
    { external_id: '31', name: 'Music', media_type: 'music' }] } });
  await expect(refreshReadOnlySourceLibraries({ db, server, service: {
    getDiscoveryLibraries: async () => [{ external_id: '31', name: '', media_type: 'music' }],
  } })).rejects.toThrow('Invalid source library');
  expect((await readReadOnlySourceLibraries(db)).libraries[0].isPresent).toBe(true);
});
