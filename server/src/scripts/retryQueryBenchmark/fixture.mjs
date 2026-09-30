/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { requireRetryBenchmarkSchema } from './schema.mjs';

export const RETRY_BENCHMARK_SCENARIOS = Object.freeze([
  'empty', 'all_waiting', 'ready_tail', 'mixed', 'credential_rotation', 'credentials_rejected', 'legacy_cooldown', 'terminal_history',
]);
export const RETRY_BENCHMARK_TYPES = Object.freeze(['omdb', 'web_search', 'tavily']);
const OLD_GENERATION = '00000000-0000-4000-8000-000000000001';
const NEW_GENERATION = '00000000-0000-4000-8000-000000000002';

export async function seedRetryBenchmark(db, scenario, size) {
  if (!RETRY_BENCHMARK_SCENARIOS.includes(scenario) || !Number.isSafeInteger(size) || size < 300 || size > 300000) {
    throw new RangeError('Invalid retry benchmark scenario or size');
  }
  await requireRetryBenchmarkSchema(db);
  if (scenario === 'empty') return 0;
  await db.query(`INSERT INTO libraries(id,media_server_id,external_id,name,media_type,is_active)
    SELECT id,1,id::text,'Synthetic library '||id,CASE WHEN id%2=0 THEN 'tv' ELSE 'movie' END,id<>12
    FROM generate_series(1,12) id;
    INSERT INTO omdb_config(id,api_key,credential_generation) VALUES(1,'synthetic-only','${NEW_GENERATION}');
    INSERT INTO web_search_provider_config(id,provider_key,display_name,is_enabled,api_key,credential_generation)
    VALUES(1,'tavily','Synthetic provider',true,'synthetic-only','${NEW_GENERATION}')`);
  const count = size;
  await db.query(`INSERT INTO media_server_items(id,media_server_id,library_id,external_id,title,media_type,tmdb_id,metadata)
    SELECT id,1,1+(id%12),id::text,'Synthetic item',
      CASE WHEN $2='mixed' AND id%17=0 THEN 'track' WHEN id%2=0 THEN 'movie' ELSE 'tv' END,id,
      CASE WHEN $2='mixed' AND id%19=0 THEN '{"omdb":{}}'::jsonb ELSE '{}'::jsonb END
    FROM generate_series(1,$1::integer) id`, [count, scenario]);
  await db.query(`INSERT INTO enrichment_retry_queue(id,media_item_id,enrichment_type,status,priority,created_at,
      next_attempt_at,attempts,reason,last_attempt_at,retry_wait_context,retry_wait_until)
    SELECT id,id,(ARRAY['omdb','web_search','tavily'])[1+(id%3)],
      CASE WHEN $2='terminal_history' AND id<=($1*0.95) THEN 'completed' ELSE 'pending' END,5,
      '2026-01-01'::timestamptz + id*interval '1 second',
      CASE WHEN $2 IN ('all_waiting','credential_rotation') OR ($2='ready_tail' AND id<=($1*0.99))
        OR ($2='mixed' AND id%5<>0) THEN statement_timestamp()+interval '1 day'
        ELSE statement_timestamp()-interval '1 day' END,
      CASE WHEN $2='mixed' AND id%23=0 THEN 3 ELSE 0 END,
      CASE WHEN $2='mixed' AND id%29=0 THEN 'tavily_monthly_quota_deferred' ELSE NULL END,
      statement_timestamp(),
      CASE WHEN $2='credential_rotation' THEN jsonb_build_array(jsonb_build_object(
        'providerKey',CASE WHEN id%3=0 THEN 'omdb' ELSE 'tavily' END,
        'source',CASE WHEN id%3=0 THEN 'omdb' ELSE 'web_search' END,'id',1,'generation','${OLD_GENERATION}')) ELSE NULL END,
      CASE WHEN $2='credential_rotation' THEN statement_timestamp()+interval '1 day' ELSE NULL END
    FROM generate_series(1,$1::integer) id`, [count, scenario]);
  if (scenario === 'mixed') {
    await db.query(`INSERT INTO media_source_observations(library_id,media_server_id,external_id,identity_issue,generation)
      SELECT library_id,media_server_id,external_id,'conflicting_provider_ids',1 FROM media_server_items WHERE id%13=0`);
  }
  if (scenario === 'credentials_rejected') {
    await db.query('UPDATE omdb_config SET credential_rejected_at=statement_timestamp(); UPDATE web_search_provider_config SET credential_rejected_at=statement_timestamp()');
  }
  if (scenario === 'legacy_cooldown') {
    await db.query(`INSERT INTO enrichment_retry_cooldowns VALUES
      ('omdb',statement_timestamp()+interval '1 day','Synthetic wait'),
      ('web_search',statement_timestamp()+interval '1 day','Synthetic wait')`);
  }
  // Manual statistics are essential: no production autovacuum or background jobs are started.
  for (const table of ['enrichment_retry_queue', 'media_server_items', 'media_source_observations',
    'libraries', 'omdb_config', 'tavily_config', 'web_search_provider_config', 'enrichment_retry_cooldowns']) {
    await db.query(`ANALYZE retry_query_benchmark.${table}`);
  }
  return count;
}

/** Independent fixture oracle: not derived from the production SQL under measurement. */
export function expectedRetryIds(scenario, size, type, after = 0, limit = 50) {
  if (['empty', 'all_waiting', 'credentials_rejected', 'legacy_cooldown'].includes(scenario)) return [];
  const result = [];
  for (let id = after + 1; id <= size && result.length < limit; id++) {
    if (RETRY_BENCHMARK_TYPES[id%3] !== type || id%12 === 11) continue;
    if (scenario === 'ready_tail' && id <= size*0.99) continue;
    if (scenario === 'terminal_history' && id <= size*0.95) continue;
    if (scenario === 'mixed' && (id%5 !== 0 || [13,17,19,23].some(n => id%n === 0) || (type === 'tavily' && id%29 === 0))) continue;
    result.push(id);
  }
  return result;
}

export function expectedRetryReadinessIds(scenario, size, type) {
  const result = [];
  if (scenario === 'empty') return result;
  for (let id = 1; id <= size && result.length < 51; id++) {
    if (RETRY_BENCHMARK_TYPES[id%3] === type && (scenario !== 'terminal_history' || id > size*0.95)) result.push(id);
  }
  return result;
}
