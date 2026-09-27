/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';

let afterLibraryRead = null;
const facade = createIntegrationDatabaseModuleMock();
jest.unstable_mockModule('../../config/database.mjs', () => ({
  ...facade,
  withTransaction: fn => facade.withTransaction(client => fn({
    query: async (...args) => {
      const result = await client.query(...args);
      if (args[0] === 'SELECT * FROM libraries ORDER BY id' && afterLibraryRead) {
        await afterLibraryRead(client);
      }
      return result;
    },
  })),
}));
const { collectBackupSnapshot } = await import('../../services/backupSnapshot.mjs');
const { restoreAllTables } = await import('../../services/backupRestore.mjs');

describe('real PostgreSQL configuration snapshot and recovery canary', () => {
  let serverId;
  const libraryIds = [];
  beforeAll(async () => {
    const pool = getPool();
    ({ id: serverId } = (await pool.query(`
      INSERT INTO media_server (type, name, url, api_key)
      VALUES ('plex', 'Snapshot server', 'http://backup-fixture.invalid', 'synthetic') RETURNING id
    `)).rows[0]);
    for (const mediaType of ['movie', 'tv']) {
      const { id } = (await pool.query(`
        INSERT INTO libraries (media_server_id, name, media_type, external_id)
        VALUES ($1, $2, $3, $3) RETURNING id
      `, [serverId, `Snapshot ${mediaType}`, mediaType])).rows[0];
      libraryIds.push(id);
      await pool.query(`INSERT INTO library_policies (library_id, name, description)
        VALUES ($1, $2, 'generation-1')`, [id, `Snapshot ${mediaType}`]);
      await pool.query(`INSERT INTO learning_patterns
        (library_id, media_type, tmdb_id, pattern_type, pattern_data, confidence)
        VALUES ($1, $2, 900001, 'exact_match', '{"generation":1}', 90)`, [id, mediaType]);
      await pool.query(`INSERT INTO classification_evidence
        (library_id, media_type, tmdb_id, scope, provenance, evidence_data, confidence)
        VALUES ($1, $2, 900001, 'item_exact', 'human_confirmed', '{"generation":1}', 90)`, [id, mediaType]);
    }
  });

  afterEach(() => { afterLibraryRead = null; });

  it('keeps libraries, policies and both evidence sections coherent across a concurrent commit', async () => {
    afterLibraryRead = async () => {
      // The writer is a different real connection; no sleeps or mocked rows.
      await facade.withTransaction(async writer => {
        await writer.query("UPDATE libraries SET priority = 2 WHERE id = ANY($1)", [libraryIds]);
        await writer.query("UPDATE library_policies SET description = 'generation-2' WHERE library_id = ANY($1)", [libraryIds]);
        await writer.query("UPDATE learning_patterns SET pattern_data = '{\"generation\":2}' WHERE library_id = ANY($1)", [libraryIds]);
        await writer.query("UPDATE classification_evidence SET evidence_data = '{\"generation\":2}' WHERE library_id = ANY($1)", [libraryIds]);
      });
    };
    const backup = await collectBackupSnapshot();
    expect(backup.data.libraries.filter(row => libraryIds.includes(row.id)).map(row => row.priority)).toEqual([0, 0]);
    expect(backup.data.libraryPolicies.filter(row => libraryIds.includes(row.library_id)).map(row => row.description)).toEqual(['generation-1', 'generation-1']);
    expect(backup.data.learningPatterns.filter(row => libraryIds.includes(row.library_id)).map(row => row.pattern_data)).toEqual([{ generation: 1 }, { generation: 1 }]);
    expect(backup.data.classificationEvidence.filter(row => libraryIds.includes(row.library_id)).map(row => row.evidence_data)).toEqual([{ generation: 1 }, { generation: 1 }]);
    expect((await getPool().query('SELECT priority FROM libraries WHERE id = ANY($1) ORDER BY id', [libraryIds])).rows).toEqual([{ priority: 2 }, { priority: 2 }]);
  });

  it('enforces read-only mode and leaves the next connection usable after failure', async () => {
    afterLibraryRead = client => client.query('UPDATE libraries SET priority = 999 WHERE id = $1', [libraryIds[0]]);
    await expect(collectBackupSnapshot()).rejects.toMatchObject({ code: '25006' });
    afterLibraryRead = null;
    const backup = await collectBackupSnapshot({ includePatterns: false });
    expect(backup.data.libraries.find(row => row.id === libraryIds[0]).priority).not.toBe(999);
    expect(backup.data).not.toHaveProperty('learningPatterns');
  });

  it.each([
    ['merge', 'missing'], ['merge', 'occupied'], ['merge', 'existing'], ['replace', 'missing'],
  ])('round-trips movie/TV relationships in %s mode when old server ID is %s', async (mode, oldIdState) => {
    const backup = await collectBackupSnapshot();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      // Only this suite database is changed; rollback preserves its source fixture.
      await client.query('DELETE FROM libraries WHERE id = ANY($1)', [libraryIds]);
      if (oldIdState !== 'existing') await client.query('DELETE FROM media_server WHERE id = $1', [serverId]);
      if (oldIdState === 'occupied') {
        await client.query(`INSERT INTO media_server (id, type, name, url, api_key)
          VALUES ($1, 'jellyfin', 'Unrelated server', 'http://unrelated.invalid', 'synthetic')`, [serverId]);
      }
      await restoreAllTables(client, backup, mode);
      const restored = (await client.query(`
        SELECT l.id, l.media_type, s.id AS server_id, s.url, p.library_id AS policy_library_id,
               e.library_id AS evidence_library_id, e.media_type AS evidence_media_type,
               lp.library_id AS pattern_library_id, e.evidence_data
        FROM libraries l
        JOIN media_server s ON s.id = l.media_server_id
        JOIN library_policies p ON p.library_id = l.id
        JOIN classification_evidence e ON e.library_id = l.id
        JOIN learning_patterns lp ON lp.library_id = l.id
        WHERE l.name IN ('Snapshot movie', 'Snapshot tv') ORDER BY l.media_type
      `)).rows;
      expect(restored).toHaveLength(2);
      expect(restored.map(row => row.media_type)).toEqual(['movie', 'tv']);
      for (const row of restored) {
        expect(libraryIds).not.toContain(row.id);
        if (oldIdState === 'existing') expect(row.server_id).toBe(serverId);
        else expect(row.server_id).not.toBe(serverId);
        expect(row.url).toBe('http://backup-fixture.invalid');
        expect(row.policy_library_id).toBe(row.id);
        expect(row.evidence_library_id).toBe(row.id);
        expect(row.pattern_library_id).toBe(row.id);
        expect(row.evidence_media_type).toBe(row.media_type);
        expect(row.evidence_data).toEqual(backup.data.classificationEvidence.find(
          source => source.media_type === row.media_type && libraryIds.includes(source.library_id),
        ).evidence_data);
      }
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
