/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0-or-later */
import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { restoreAllTables } = await import('../../services/backupRestore.mjs');
const { readBackupConfiguration } = await import('../../services/backupExportCatalog.mjs');

async function seed(client) {
  const server = (await client.query(`INSERT INTO media_server (type, name, url, api_key)
    VALUES ('plex', 'Reference server', 'https://reference.invalid', 'synthetic') RETURNING id`)).rows[0].id;
  const label = (await client.query(`INSERT INTO label_presets (category, name, display_name)
    VALUES ('genre', 'reference-label', 'Reference label') RETURNING id`)).rows[0].id;
  for (const [type, mediaType, table] of [['radarr', 'movie', 'radarr_config'], ['sonarr', 'tv', 'sonarr_config']]) {
    const arr = (await client.query(`INSERT INTO ${table} (name, url, api_key, media_server_id, verify_ssl)
      VALUES ($1, $2, 'synthetic', $3, true) RETURNING id`, [type, `https://${type}.invalid`, server])).rows[0].id;
    const library = (await client.query(`INSERT INTO libraries
      (name, media_type, media_server_id, external_id, arr_type, arr_id, root_folder, quality_profile_id, radarr_settings, sonarr_settings)
      VALUES ($1, $2, $3, $2, $4, $5, '/provider/root', 87, '{"search_on_add":false}', '{"monitor":"future"}') RETURNING id`,
    [`Reference ${mediaType}`, mediaType, server, type, arr])).rows[0].id;
    const policy = (await client.query(`INSERT INTO library_policies (library_id, name, source_library_ids)
      VALUES ($1, $2, '["provider-library-42"]') RETURNING id`, [library, `Reference ${mediaType}`])).rows[0].id;
    const intent = (await client.query(`INSERT INTO policy_intents
      (policy_id, library_id, source, inference_state, validation_status)
      VALUES ($1, $2, 'native_intent', 'inferred', 'valid') RETURNING id`, [policy, library])).rows[0].id;
    await client.query(`INSERT INTO policy_intent_routing_targets
      (intent_id, library_id, arr_type, arr_config_id, arr_root_folder_id, arr_root_folder_path, quality_profile_id)
      VALUES ($1, $2, $3, $4, 67, '/provider/root', 87)`, [intent, library, type, arr]);
    await client.query(`INSERT INTO library_arr_mappings
      (library_id, arr_type, arr_config_id, arr_root_folder_id, arr_root_folder_path, quality_profile_id)
      VALUES ($1, $2, $3, 67, '/provider/root', 87)`, [library, type, arr]);
    await client.query(`INSERT INTO auto_learned_preferences (library_id, policy_id, preference_type, preference_value)
      VALUES ($1, $2, 'genre', 'Action')`, [library, policy]);
    await client.query(`INSERT INTO library_labels (library_id, label_preset_id, rule_type)
      VALUES ($1, $2, 'include')`, [library, label]);
  }
  return readBackupConfiguration(client);
}

async function assertDestinations(client, backup) {
  const rows = (await client.query(`
    SELECT l.id, l.media_type, l.arr_id, l.arr_type, l.root_folder, l.quality_profile_id,
      l.radarr_settings, l.sonarr_settings, p.id AS policy_id, p.source_library_ids,
      a.url, a.media_server_id, s.id AS server_id, s.url AS server_url,
      m.arr_config_id AS fallback_id, m.arr_root_folder_id AS fallback_folder,
      t.arr_config_id AS target_id, t.arr_root_folder_id AS target_folder,
      t.quality_profile_id AS target_quality, f.policy_id AS preference_policy_id,
      lp.id AS label_id, lp.name AS label_name
    FROM libraries l JOIN library_policies p ON p.library_id = l.id
    JOIN media_server s ON s.id = l.media_server_id
    JOIN (SELECT 'radarr' AS type, id, url, media_server_id FROM radarr_config
          UNION ALL SELECT 'sonarr', id, url, media_server_id FROM sonarr_config) a
      ON a.id = l.arr_id AND a.type = l.arr_type
    JOIN library_arr_mappings m ON m.library_id = l.id
    JOIN policy_intents i ON i.policy_id = p.id AND i.active
    JOIN policy_intent_routing_targets t ON t.intent_id = i.id AND t.library_id = l.id
    JOIN auto_learned_preferences f ON f.library_id = l.id
    JOIN library_labels ll ON ll.library_id = l.id
    JOIN label_presets lp ON lp.id = ll.label_preset_id
    WHERE l.name IN ('Reference movie', 'Reference tv') ORDER BY l.media_type
  `)).rows;
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    const source = backup.data.libraries.find(library => library.media_type === row.media_type && library.name.startsWith('Reference'));
    expect(row.id).not.toBe(source.id);
    expect(row.arr_id).not.toBe(source.arr_id);
    expect(row.server_id).not.toBe(source.media_server_id);
    expect(row.media_server_id).toBe(row.server_id);
    expect(row.server_url).toBe('https://reference.invalid');
    expect(row.url).toBe(`https://${row.arr_type}.invalid`);
    expect(row.fallback_id).toBe(row.arr_id);
    expect(row.target_id).toBe(row.arr_id);
    expect(row.fallback_folder).toBe(67);
    expect(row.target_folder).toBe(67);
    expect(row.target_quality).toBe(87);
    expect(row.quality_profile_id).toBe(87);
    expect(row.root_folder).toBe('/provider/root');
    expect(row.radarr_settings).toEqual({ search_on_add: false });
    expect(row.sonarr_settings).toEqual({ monitor: 'future' });
    expect(row.preference_policy_id).toBe(row.policy_id);
    expect(row.source_library_ids).toEqual(['provider-library-42']);
    expect(row.label_name).toBe('reference-label');
    expect(row.label_id).not.toBe(backup.data.labelPresets.find(label => label.name === row.label_name).id);
  }
}

describe('real PostgreSQL restore reference recovery', () => {
  let client;
  beforeEach(async () => {
    client = await getPool().connect();
    await client.query('BEGIN');
  });
  afterEach(async () => {
    await client.query('ROLLBACK');
    client.release();
  });

  it.each(['merge', 'replace'])('remaps movie/TV destinations and labels in %s, even with old IDs occupied', async mode => {
    const backup = await seed(client);
    expect(backup.data.libraryArrMappings).toHaveLength(2);
    expect(backup.meta.libraryArrMappingsCount).toBe(2);
    // Old IDs remain valid but now identify unrelated destination records.
    await client.query("UPDATE media_server SET url = 'https://unrelated.invalid' WHERE name = 'Reference server'");
    await client.query("UPDATE libraries SET name = 'Unrelated ' || media_type WHERE name LIKE 'Reference %'");
    await client.query("UPDATE radarr_config SET url = 'https://unrelated-radarr.invalid'");
    await client.query("UPDATE sonarr_config SET url = 'https://unrelated-sonarr.invalid'");
    await client.query("UPDATE label_presets SET name = 'unrelated-label' WHERE name = 'reference-label'");
    // Exact uniqueness-key reuse also must map to the new destination ID.
    await client.query(`INSERT INTO label_presets (category, name, display_name)
      VALUES ('genre', 'reference-label', 'Existing label')`);
    await restoreAllTables(client, backup, mode);
    await assertDestinations(client, backup);
    if (mode === 'merge') {
      // Replay must replace, not append, native destinations and fallback rows.
      await restoreAllTables(client, backup, mode);
      await assertDestinations(client, backup);
      expect((await client.query("SELECT COUNT(*)::int AS count FROM library_arr_mappings")).rows[0].count).toBe(4);
    }
  });

  it('clears stale merge destinations for old files that omit routing data', async () => {
    const backup = await seed(client);
    delete backup.data.libraryArrMappings;
    delete backup.data.policyIntentRoutingTargets;
    for (const library of backup.data.libraries) {
      for (const field of ['arr_id', 'arr_type', 'root_folder', 'quality_profile_id', 'radarr_settings', 'sonarr_settings']) delete library[field];
    }
    await restoreAllTables(client, backup, 'merge');
    const libraries = (await client.query("SELECT arr_id, arr_type FROM libraries WHERE name LIKE 'Reference %'")).rows;
    expect(libraries).toEqual([{ arr_id: null, arr_type: null }, { arr_id: null, arr_type: null }]);
    expect((await client.query('SELECT COUNT(*)::int AS count FROM library_arr_mappings')).rows[0].count).toBe(0);
    expect((await client.query('SELECT COUNT(*)::int AS count FROM policy_intent_routing_targets')).rows[0].count).toBe(0);
  });

  it('rejects missing referenced parents without modifying replace-mode configuration', async () => {
    const backup = await seed(client);
    backup.data.radarrConfigs = [];
    await expect(restoreAllTables(client, backup, 'replace')).rejects.toThrow('arr_id');
    expect((await client.query("SELECT COUNT(*)::int AS count FROM libraries WHERE name LIKE 'Reference %'")).rows[0].count).toBe(2);
    expect((await client.query('SELECT COUNT(*)::int AS count FROM library_arr_mappings')).rows[0].count).toBe(2);
  });

  it('rolls back a late constraint failure after routing writes', async () => {
    const backup = await seed(client);
    await client.query('SAVEPOINT restore_attempt');
    backup.data.labelPresets.push({ id: 999999, category: 'invalid-category', name: 'bad', display_name: 'Bad' });
    await expect(restoreAllTables(client, backup, 'replace')).rejects.toMatchObject({ code: '23514' });
    await client.query('ROLLBACK TO SAVEPOINT restore_attempt');
    const after = await readBackupConfiguration(client);
    expect(after.data.libraries).toEqual(backup.data.libraries);
    expect(after.data.radarrConfigs).toEqual(backup.data.radarrConfigs);
    expect(after.data.libraryArrMappings).toEqual(backup.data.libraryArrMappings);
  });

  it('keeps completed history but removes destinations of retained libraries absent from a replace backup', async () => {
    const backup = await seed(client);
    const library = backup.data.libraries.find(row => row.name === 'Reference movie');
    await client.query(`INSERT INTO classification_history (title, media_type, library_id, status)
      VALUES ('Historical movie', 'movie', $1, 'completed')`, [library.id]);
    await restoreAllTables(client, { data: {} }, 'replace');
    expect((await client.query('SELECT arr_id, arr_type FROM libraries WHERE id = $1', [library.id])).rows)
      .toEqual([{ arr_id: null, arr_type: null }]);
    expect((await client.query('SELECT library_id FROM classification_history WHERE library_id = $1', [library.id])).rows)
      .toEqual([{ library_id: library.id }]);
    expect((await client.query('SELECT COUNT(*)::int AS count FROM library_arr_mappings')).rows[0].count).toBe(0);
  });
});
