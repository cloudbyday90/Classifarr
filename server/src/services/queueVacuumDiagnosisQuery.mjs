/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// One fixed aggregate: identifiers are used for scoping, never returned.
export const QUEUE_VACUUM_DIAGNOSIS_SQL = `WITH queue_diagnostic_scope AS (
  SELECT oid AS database_oid, to_regclass('public.task_queue') AS queue_oid
  FROM pg_catalog.pg_database WHERE datname = current_database()
), activity AS (
  SELECT count(*) FILTER (WHERE backend_xid IS NOT NULL OR backend_xmin IS NOT NULL)::text AS retaining_transactions,
    count(*) FILTER (WHERE xact_start <= statement_timestamp() - INTERVAL '1 hour')::text AS old_transactions,
    count(*) FILTER (WHERE state = 'disabled')::text AS tracking_disabled_sessions
  FROM pg_catalog.pg_stat_activity, queue_diagnostic_scope
  WHERE datid = database_oid AND pid <> pg_backend_pid()
    AND (backend_xid IS NOT NULL OR backend_xmin IS NOT NULL OR state = 'disabled')
), prepared AS (
  SELECT count(*)::text AS old_prepared_transactions FROM pg_catalog.pg_prepared_xacts
  WHERE database = current_database() AND prepared <= statement_timestamp() - INTERVAL '1 hour'
), slots AS (
  SELECT count(*)::text AS replication_horizons
  FROM pg_catalog.pg_replication_slots, queue_diagnostic_scope
  WHERE (datoid = database_oid OR slot_type = 'physical') AND xmin IS NOT NULL
), locks AS (
  SELECT count(*) FILTER (WHERE granted AND mode IN ('ShareUpdateExclusiveLock', 'ShareLock',
    'ShareRowExclusiveLock', 'ExclusiveLock', 'AccessExclusiveLock'))::text AS conflicting_locks,
    count(*) FILTER (WHERE NOT granted)::text AS waiting_locks
  FROM pg_catalog.pg_locks, queue_diagnostic_scope
  WHERE database = database_oid AND relation = queue_oid AND locktype = 'relation'
    AND (pid IS NULL OR pid <> pg_backend_pid())
), vacuum AS (
  SELECT count(*)::text AS active_vacuums
  FROM pg_catalog.pg_stat_progress_vacuum, queue_diagnostic_scope
  WHERE datid = database_oid AND relid = queue_oid
)
SELECT queue_oid IS NOT NULL AS queue_present,
  current_setting('track_activities')::boolean
    AND pg_has_role(current_user, 'pg_read_all_stats', 'USAGE') AS full_activity_visibility,
  activity.retaining_transactions, activity.old_transactions, activity.tracking_disabled_sessions,
  prepared.old_prepared_transactions, slots.replication_horizons,
  locks.conflicting_locks, locks.waiting_locks, vacuum.active_vacuums
FROM queue_diagnostic_scope CROSS JOIN activity CROSS JOIN prepared CROSS JOIN slots
  CROSS JOIN locks CROSS JOIN vacuum`;
