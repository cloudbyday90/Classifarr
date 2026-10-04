/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { routingCases } from './httpRoutingState.mjs';

export async function queuedRoutingData(db, mode) {
  if (mode === 'seed') {
    assert.equal((await db.query("SELECT count(*)::int AS n FROM task_queue WHERE source='isolation-queued-routing'")).rows[0].n, 0);
    // The real queue currently requires an AI provider even for deterministic policy.
    // Configure a synthetic cloud selection, but no generation call is expected/allowed.
    await db.query(`UPDATE ai_provider_config SET primary_provider='openai',api_key='synthetic-routing',
      api_endpoint='http://127.0.0.1:21401/unused-generation',model='fixture' WHERE id=1`);
    await db.query('UPDATE library_policies SET enabled=false');
    for (const item of routingCases) {
      const { rows: [library] } = await db.query(`INSERT INTO libraries
        (external_id,name,media_type,arr_type,arr_id,root_folder,quality_profile_id,radarr_settings,sonarr_settings)
        SELECT $1,'Queued ' || name,media_type,arr_type,arr_id,root_folder,quality_profile_id,radarr_settings,sonarr_settings
        FROM libraries WHERE external_id=$2 RETURNING id,arr_id`,
      [`isolation-queued-${item.type}`, `isolation-http-${item.type}`]);
      assert(library, 'queued_fixture_library_missing');
      // Fixed provider names from routingCases, never user-supplied identifiers.
      await db.query(`UPDATE ${item.arr}_config SET is_active=true WHERE id=$1`, [library.arr_id]);
      const { rows: [policy] } = await db.query(`INSERT INTO library_policies
        (library_id,name,enabled,auto_classify_threshold,prompt_threshold,trust_patterns,trust_rag,trust_history,
         preset_weight,profile_weight,pattern_weight,rag_weight,history_weight)
        VALUES($1,'Queued routing',true,85,60,false,false,false,1,0,0,0,0) RETURNING id`, [library.id]);
      await db.query(`INSERT INTO policy_presets(policy_id,preset_id,weight)
        SELECT $1,id,2 FROM content_presets WHERE key=$2`, [policy.id, `isolation_http_${item.type}`]);
      await db.query(`INSERT INTO task_queue(task_type,payload,status,source,next_retry_at)
        VALUES('classification',$1,'pending','isolation-queued-routing',NOW()+INTERVAL '1 day')`,
      [JSON.stringify({ media_type: item.type, tmdb_id: item.tmdbId, tvdb_id: item.type === 'tv' ? 920002 : undefined,
        title: `Queued ${item.title}`, year: 2026, overview: 'Synthetic deterministic policy fixture.',
        genres: ['Action'], keywords: ['chase'] })]);
    }
  } else if (/^(release|expire)-(movie|tv)$/.test(mode)) {
    const [operation, type] = mode.split('-');
    const clause = operation === 'release'
      ? "SET next_retry_at=NOW() WHERE status='pending' AND routing_classification_id IS NULL"
      : "SET started_at=NOW()-INTERVAL '11 minutes',visible_at=NOW()-INTERVAL '1 second' WHERE status='processing' AND claim_token IS NOT NULL AND routing_classification_id IS NOT NULL";
    // Fixed clauses only. Deadline advancement is fixture-only, after the app has exited.
    const result = await db.query(`UPDATE task_queue ${clause}
      AND source='isolation-queued-routing' AND payload->>'media_type'=$1 RETURNING id`, [type]);
    assert.equal(result.rowCount, 1, 'queued_fixture_transition_failed');
  } else if (mode === 'disable') {
    await db.query("UPDATE ai_provider_config SET primary_provider='none',api_key=NULL,api_endpoint=NULL,model=NULL WHERE id=1");
    for (const item of routingCases) await db.query(`UPDATE ${item.arr}_config SET is_active=false
      WHERE id IN (SELECT arr_id FROM libraries WHERE external_id=$1)`, [`isolation-queued-${item.type}`]);
  } else assert.equal(mode, 'read');

  const { rows } = await db.query(`SELECT t.id::text,t.status,t.claim_token::text,t.attempts,
    t.payload->>'media_type' AS media_type,t.payload->'result' AS result,t.routing_classification_id::text,
    ch.status AS history_status,ch.method,ch.metadata->'classification_details' AS details,
    (SELECT count(*)::int FROM classification_history h JOIN libraries l ON l.id=h.library_id
      WHERE l.external_id='isolation-queued-' || (t.payload->>'media_type')) AS history_count
    FROM task_queue t LEFT JOIN classification_history ch ON ch.id=t.routing_classification_id
    WHERE t.source='isolation-queued-routing' ORDER BY t.payload->>'media_type' LIMIT 3`);
  assert.equal(rows.length, 2, 'queued_fixture_tasks_missing');
  return rows;
}
