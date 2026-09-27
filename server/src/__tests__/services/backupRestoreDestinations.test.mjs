/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0-or-later */
import { jest } from '@jest/globals';
import { restoreRadarrConfigs, restoreSonarrConfigs, restoreLabelPresets, restoreLibraryArrMappings } from '../../services/backupRestoreDestinations.mjs';

describe('portable destination restoration', () => {
  it.each([
    [restoreRadarrConfigs, 'radarr_config', { minimum_availability: 'released' }],
    [restoreSonarrConfigs, 'sonarr_config', { monitor: 'future', series_type: 'standard' }],
  ])('maps connections and preserves current connection fields for %s', async (restore, table, extra) => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 900 }] }) };
    const data = { id: 5, name: 'arr', url: 'https://arr.invalid', api_key: 'synthetic',
      media_server_id: 1, verify_ssl: true, timeout: 30000, quality_profile_id: 4, ...extra,
      unexpected_column: 'not SQL', root_folder_path: 'obsolete' };
    const original = structuredClone(data);
    expect(await restore(client, [data], new Map([[1, 100]]))).toEqual(new Map([[5, 900]]));
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain(`INSERT INTO ${table}`);
    expect(sql).toContain('RETURNING id');
    expect(sql).not.toContain('unexpected_column');
    expect(sql).not.toContain('root_folder_path');
    expect(params).toEqual(['arr', 'https://arr.invalid', 'synthetic', 100, true, 30000, 4, ...Object.values(extra)]);
    expect(data).toEqual(original);
  });

  it('handles legacy missing arrays and absent source IDs', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 900 }] }) };
    expect(await restoreRadarrConfigs(client, null)).toEqual(new Map());
    expect(await restoreSonarrConfigs(client, [{}])).toEqual(new Map());
    expect(await restoreLabelPresets(client, null)).toEqual(new Map());
    expect(client.query).not.toHaveBeenCalled();
    expect(await restoreRadarrConfigs(client, [{ name: 'Legacy' }])).toEqual(new Map());
    expect(await restoreLabelPresets(client, [{ category: 'genre', name: 'Legacy' }])).toEqual(new Map());
  });

  it('maps an exact existing label preset without overwriting it', async () => {
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 700 }] }) };
    expect(await restoreLabelPresets(client, [{ id: 7, category: 'genre', name: 'action' }])).toEqual(new Map([[7, 700]]));
    expect(client.query).toHaveBeenLastCalledWith(expect.stringContaining('category = $1 AND name = $2'), ['genre', 'action']);
  });

  it('maps inserted presets and rejects a lost conflict row', async () => {
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 700 }] }).mockResolvedValue({ rows: [] }) };
    expect(await restoreLabelPresets(client, [{ id: 7 }])).toEqual(new Map([[7, 700]]));
    await expect(restoreLabelPresets(client, [{ id: 7 }])).rejects.toThrow('labelPresets.id');
  });

  it('replaces only restored libraries fallback mappings and leaves external IDs intact', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await restoreLibraryArrMappings(client, [{ library_id: 1, arr_type: 'sonarr', arr_config_id: 2,
      arr_root_folder_id: 9, arr_root_folder_path: '/tv', quality_profile_id: 8,
      plex_path_prefix: '/plex', arr_path_prefix: '/arr', classifarr_path_prefix: '/local' }],
    new Map([[1, 100]]), { sonarr: new Map([[2, 200]]) });
    expect(client.query).toHaveBeenNthCalledWith(1, expect.stringContaining('WHERE library_id = ANY'), [[100]]);
    expect(client.query).toHaveBeenLastCalledWith(expect.stringContaining('INSERT INTO library_arr_mappings'),
      [100, 'sonarr', 200, 9, '/tv', 8, '/plex', '/arr', '/local']);
    client.query.mockClear();
    await restoreLibraryArrMappings(client, undefined, new Map([[1, 100]]), {});
    expect(client.query).toHaveBeenCalledTimes(1);
    client.query.mockClear();
    await restoreLibraryArrMappings(client, undefined, new Map(), {});
    expect(client.query).not.toHaveBeenCalled();
  });
});
