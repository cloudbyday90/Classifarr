/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// Fixed relation and projection: no queue payloads, query text or credentials.
const QUEUE_VACUUM_STATE_SQL = `
  SELECT c.oid::text AS relation_oid, clock_timestamp() AS sampled_at,
    c.relkind = 'r' AND c.relpersistence = 'p'
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_inherits i
        WHERE i.inhparent = c.oid OR i.inhrelid = c.oid) AS relation_supported,
    current_setting('autovacuum')::boolean AS autovacuum,
    current_setting('track_counts')::boolean AS track_counts,
    COALESCE((options.settings->>'autovacuum_enabled')::boolean, true) AS table_enabled,
    COALESCE(NULLIF((options.settings->>'autovacuum_vacuum_threshold')::float8, -1),
      current_setting('autovacuum_vacuum_threshold')::float8) AS vacuum_threshold,
    COALESCE(NULLIF((options.settings->>'autovacuum_vacuum_scale_factor')::float8, -1),
      current_setting('autovacuum_vacuum_scale_factor')::float8) AS vacuum_scale_factor,
    COALESCE(NULLIF((options.settings->>'autovacuum_analyze_scale_factor')::float8, -1),
      current_setting('autovacuum_analyze_scale_factor')::float8) AS analyze_scale_factor,
    s.relid IS NOT NULL AS statistics_available,
    s.n_live_tup::text, s.n_dead_tup::text, s.n_ins_since_vacuum::text,
    s.n_mod_since_analyze::text, s.vacuum_count::text, s.analyze_count::text,
    s.autovacuum_count::text, s.last_vacuum, s.last_autovacuum,
    s.last_analyze, s.last_autoanalyze, d.stats_reset,
    EXISTS (SELECT 1 FROM pg_catalog.pg_stat_progress_vacuum v
      WHERE v.datid = db.oid AND (v.relid = c.oid OR v.relid IS NULL)) AS vacuum_running,
    has_table_privilege(current_user, c.oid, 'MAINTAIN')
      OR pg_has_role(current_user, db.datdba, 'USAGE') AS can_maintain
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_database db ON db.datname = current_database()
  LEFT JOIN pg_catalog.pg_stat_database d ON d.datid = db.oid
  LEFT JOIN pg_catalog.pg_stat_all_tables s ON s.relid = c.oid
  CROSS JOIN LATERAL (SELECT jsonb_object_agg(option_name, option_value) AS settings
    FROM pg_catalog.pg_options_to_table(c.reloptions)) options
  WHERE n.nspname = 'public' AND c.relname = 'task_queue'
`;

export async function loadQueueVacuumState(query) {
  return (await query(QUEUE_VACUUM_STATE_SQL)).rows[0] ?? null;
}

const count = value => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};
const timestamp = value => {
  if (value === null || value === undefined) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

export async function inspectQueueVacuum({ database }) {
  const row = await loadQueueVacuumState((sql) => database.query(sql));
  if (!row) return { status: 'attention', reason: 'queue_relation_missing' };
  if (row.relation_supported !== true) return { status: 'attention', reason: 'queue_relation_unsupported' };
  const estimates = { liveRows: count(row.n_live_tup), deadRows: count(row.n_dead_tup),
    insertedSinceVacuum: count(row.n_ins_since_vacuum), modifiedSinceAnalyze: count(row.n_mod_since_analyze) };
  let reason = null;
  if (row.autovacuum !== true) reason = 'autovacuum_disabled';
  else if (row.table_enabled !== true) reason = 'queue_autovacuum_disabled';
  else if (row.track_counts !== true) reason = 'statistics_disabled';
  else if (row.statistics_available !== true || Object.values(estimates).includes(null)) reason = 'statistics_unavailable';
  return { status: reason ? 'attention' : 'autovacuum_enabled', reason, estimates,
    lastVacuum: timestamp(row.last_vacuum), lastAutovacuum: timestamp(row.last_autovacuum),
    lastAnalyze: timestamp(row.last_analyze), lastAutoanalyze: timestamp(row.last_autoanalyze),
    // Configuration, not a promise of health, completion, or immediate reclamation.
    vacuumThreshold: row.vacuum_threshold, vacuumScaleFactor: row.vacuum_scale_factor,
    analyzeScaleFactor: row.analyze_scale_factor };
}
