/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Observation only. Unknown catalog state is never permission to install. */
export async function readDatabaseProfilingStatus(database) {
  try {
    const { rows } = await database.query(`SELECT
      EXISTS (SELECT 1 FROM pg_catalog.pg_available_extensions WHERE name = 'pg_stat_statements') AS available,
      EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_stat_statements') AS installed,
      (SELECT setting FROM pg_catalog.pg_settings WHERE name = 'shared_preload_libraries') AS libraries`);
    const state = rows[0];
    if (typeof state?.available !== 'boolean' || typeof state.installed !== 'boolean'
      || typeof state.libraries !== 'string') return { active: false, reason: 'observation_unknown' };
    if (!state.available) return { active: false, reason: 'runtime_files_unavailable' };
    // Recognize the packaged preload name, never a substring or arbitrary path.
    const preloaded = state.libraries.split(',').some(name => /^\s*(?:pg_stat_statements|"pg_stat_statements")\s*$/.test(name));
    if (!preloaded) return { active: false, reason: 'not_preloaded' };
    return state.installed ? { active: true } : { active: false, reason: 'extension_missing' };
  } catch {
    return { active: false, reason: 'observation_unknown' };
  }
}
