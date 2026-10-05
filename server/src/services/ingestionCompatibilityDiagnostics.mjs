/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Read-only, bounded catalog facts. Missing history is not proof a migration failed.
export const INGESTION_COMPATIBILITY_DIAGNOSTICS_SQL = `(SELECT jsonb_build_object(
  'migration','20261005_180000_ingestion_compatibility_fence.sql',
  'migrationRecorded',EXISTS(SELECT 1 FROM schema_migrations WHERE filename='20261005_180000_ingestion_compatibility_fence.sql'),
  'protocolReady',current_setting('classifarr.ingestion_protocol',true) IS NOT DISTINCT FROM '1',
  'checks',COALESCE(jsonb_agg(jsonb_build_object('table',checks.table_name,'trigger',checks.trigger_name,'status',checks.status)
    ORDER BY checks.table_name,checks.trigger_name) FILTER (WHERE checks.status<>'ready'),'[]'::jsonb))
  FROM (SELECT expected.table_name,expected.trigger_name,CASE
    WHEN t.oid IS NULL THEN 'missing'
    WHEN t.tgfoid IS DISTINCT FROM to_regprocedure('public.enforce_ingestion_compatibility()')
      OR t.tgtype<>expected.trigger_type OR t.tgisinternal THEN 'definition_mismatch'
    WHEN t.tgenabled<>'A' THEN 'not_always_enabled'
    ELSE 'ready' END AS status
    FROM (SELECT table_name,trigger_name,trigger_type FROM
      unnest(ARRAY['media_server_items','media_server_sync_status','media_source_capture_state',
        'library_ingestion_state','media_source_observations','media_server_collections']) AS names(table_name)
      CROSS JOIN (VALUES ('ingestion_compatibility_rows',31),('ingestion_compatibility_truncate',34)) AS gates(trigger_name,trigger_type)) expected
    LEFT JOIN pg_trigger t ON t.tgrelid=to_regclass('public.'||expected.table_name) AND t.tgname=expected.trigger_name
  ) checks)`;
