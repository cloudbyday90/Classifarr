/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0-or-later */
import { restoredReference, restoredArrReference } from './backupRestoreReferences.mjs';

const connectionColumns = ['name', 'url', 'api_key', 'protocol', 'host', 'port',
  'base_path', 'verify_ssl', 'timeout', 'is_active', 'media_server_id', 'quality_profile_id'];

async function restoreArrConfigs(client, configs, table, allowedColumns, serverIdMap) {
  const idMap = new Map();
  for (const config of configs || []) {
    const data = { ...config };
    if (data.media_server_id != null) data.media_server_id = restoredReference(serverIdMap,
      data.media_server_id, `${table}.media_server_id`);
    const keys = Object.keys(data).filter(key => allowedColumns.includes(key));
    if (keys.length === 0) continue;
    const result = await client.query(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      keys.map(key => data[key]),
    );
    if (config.id != null) idMap.set(config.id, result.rows[0].id);
  }
  return idMap;
}

export function restoreRadarrConfigs(client, configs, serverIdMap = new Map()) {
  return restoreArrConfigs(client, configs, 'radarr_config', [...connectionColumns, 'minimum_availability'], serverIdMap);
}

export function restoreSonarrConfigs(client, configs, serverIdMap = new Map()) {
  return restoreArrConfigs(client, configs, 'sonarr_config', [...connectionColumns, 'monitor', 'series_type'], serverIdMap);
}

export async function restoreLabelPresets(client, presets) {
  const idMap = new Map();
  for (const preset of presets || []) {
    const inserted = await client.query(
      `INSERT INTO label_presets (category, name, display_name, description, media_type, tmdb_match_field, tmdb_match_values)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (category, name) DO NOTHING RETURNING id`,
      [preset.category, preset.name, preset.display_name, preset.description,
        preset.media_type, preset.tmdb_match_field, preset.tmdb_match_values],
    );
    const row = inserted.rows[0] || (await client.query(
      'SELECT id FROM label_presets WHERE category = $1 AND name = $2', [preset.category, preset.name],
    )).rows[0];
    if (preset.id != null) {
      // Missing conflict rows fail closed rather than producing an undefined map.
      const checked = restoredReference(new Map([[preset.id, row?.id]]), preset.id, 'labelPresets.id');
      idMap.set(preset.id, checked);
    }
  }
  return idMap;
}

export async function restoreLibraryArrMappings(client, rows, libraryIdMap, arrIdMaps) {
  // Older exports omitted this section. Do not retain a stale fallback for a
  // library whose direct configuration is being restored from another snapshot.
  if (libraryIdMap.size) await client.query(
    'DELETE FROM library_arr_mappings WHERE library_id = ANY($1::integer[])', [[...libraryIdMap.values()]],
  );
  for (const row of rows || []) {
    await client.query(
      `INSERT INTO library_arr_mappings
       (library_id, arr_type, arr_config_id, arr_root_folder_id, arr_root_folder_path,
        quality_profile_id, plex_path_prefix, arr_path_prefix, classifarr_path_prefix)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [restoredReference(libraryIdMap, row.library_id, 'libraryArrMappings.library_id'), row.arr_type,
        restoredArrReference(row, 'arr_config_id', arrIdMaps, 'libraryArrMappings'), row.arr_root_folder_id,
        row.arr_root_folder_path, row.quality_profile_id, row.plex_path_prefix,
        row.arr_path_prefix, row.classifarr_path_prefix],
    );
  }
}
