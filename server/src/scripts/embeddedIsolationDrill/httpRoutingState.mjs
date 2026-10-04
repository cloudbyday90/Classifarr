/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';

export const routingCases = Object.freeze([
  { type: 'movie', arr: 'radarr', tmdbId: 910001, title: 'Isolated HTTP movie', root: '/movies' },
  { type: 'tv', arr: 'sonarr', tmdbId: 910002, title: 'Isolated HTTP series', root: '/tv' },
]);

export async function seedHttpRouting(database) {
  const { rows: [state] } = await database.query(`SELECT
    (SELECT count(*)::int FROM users) AS users,
    (SELECT count(*)::int FROM radarr_config) AS radarr,
    (SELECT count(*)::int FROM sonarr_config) AS sonarr,
    (SELECT count(*)::int FROM tmdb_config) AS tmdb`);
  assert.deepEqual(state, { users: 0, radarr: 0, sonarr: 0, tmdb: 0 }, 'routing_fixture_requires_empty_providers');
  await database.query("INSERT INTO tmdb_config(api_key,is_active) VALUES('synthetic-routing',true)");
  for (const item of routingCases) {
    // Identifiers come only from the fixed two-case fixture, never user input.
    const { rows: [config] } = await database.query(`INSERT INTO ${item.arr}_config(name,url,api_key,is_active)
      VALUES('Isolation routing',$1,'synthetic-routing',true) RETURNING id`, [`http://127.0.0.1:21401/${item.arr}`]);
    const { rows: [library] } = await database.query(`INSERT INTO libraries
      (external_id,name,media_type,arr_type,arr_id,root_folder,quality_profile_id,radarr_settings,sonarr_settings)
      VALUES($1,$2,$3,$4,$5,$6,1,$7,$7) RETURNING id`,
    [`isolation-http-${item.type}`, item.title, item.type, item.arr, config.id, item.root,
      JSON.stringify({ root_folder_path: item.root, quality_profile_id: 1, search_on_add: false })]);
    const { rows: [preset] } = await database.query(`INSERT INTO content_presets(key,name,signals,is_system)
      VALUES($1,'Isolation routing',$2,false) RETURNING id`, [`isolation_http_${item.type}`,
      JSON.stringify({ genres: { require_all: ['Action'], weight: 2 }, keywords: { require_any: ['chase'], weight: 1 } })]);
    const { rows: [policy] } = await database.query(`INSERT INTO library_policies
      (library_id,name,enabled,auto_classify_threshold,prompt_threshold,trust_patterns,trust_rag,trust_history,
       preset_weight,profile_weight,pattern_weight,rag_weight,history_weight)
      VALUES($1,'Isolation routing',true,85,60,false,false,false,1,0,0,0,0) RETURNING id`, [library.id]);
    await database.query('INSERT INTO policy_presets(policy_id,preset_id,weight) VALUES($1,$2,2)', [policy.id, preset.id]);
  }
}

export async function readHttpRouting(database, { completed = true } = {}) {
  const { rows } = await database.query(`SELECT ch.id::text,ch.tmdb_id,ch.media_type,ch.title,ch.method,ch.status,
    l.external_id,ch.metadata->'classification_details'->>'routing' AS routing,
    ch.metadata->>'isolation_http_verified' AS verified
    FROM classification_history ch JOIN libraries l ON l.id=ch.library_id
    WHERE l.external_id = ANY($1::text[]) ORDER BY ch.media_type,ch.id LIMIT 3`,
  [routingCases.map(item => `isolation-http-${item.type}`)]);
  assert(rows.length <= 2, 'routing_fixture_duplicate_history');
  if (rows.length < 2 || rows.some(row => row.routing === null)) return null;
  if (completed && rows.some(row => row.verified !== 'true')) return null;
  rows.forEach((row, index) => {
    const item = routingCases[index];
    assert.match(row.id, /^[1-9]\d*$/);
    assert.deepEqual({ ...row, id: undefined, verified: undefined }, { id: undefined, verified: undefined, tmdb_id: item.tmdbId,
      media_type: item.type, title: item.title, method: 'policy_auto', status: 'routed',
      external_id: `isolation-http-${item.type}`, routing: 'routed' }, 'routing_fixture_incorrect_history');
  });
  return rows;
}

export async function waitForHttpRouting(database, { timeout = 30_000, now = Date.now, wait = sleep } = {}) {
  const deadline = now() + timeout;
  while (now() < deadline) {
    const rows = await readHttpRouting(database);
    if (rows) return rows;
    await wait(200);
  }
  throw new Error('routing_fixture_timeout');
}
