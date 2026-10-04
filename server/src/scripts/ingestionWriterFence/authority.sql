-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Candidate only: a persisted cutover flag is not continuing grant evidence.
CREATE FUNCTION ingestion_fence_rehearsal.assert_authority() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE registration record; writer_id oid; legacy_id oid; owner_id oid;
BEGIN
  SELECT * INTO registration FROM ingestion_fence_rehearsal.cutover WHERE singleton;
  IF registration.enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ingestion_fence_cutover_required' USING ERRCODE='55000';
  END IF;
  -- READ COMMITTED alone does not refresh transaction-cached activity views.
  PERFORM pg_catalog.pg_stat_clear_snapshot();
  SELECT oid INTO writer_id FROM pg_catalog.pg_roles WHERE rolname=registration.writer_role
    AND rolcanlogin AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls);
  SELECT oid INTO legacy_id FROM pg_catalog.pg_roles WHERE rolname=registration.legacy_role
    AND NOT (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls);
  SELECT oid INTO owner_id FROM pg_catalog.pg_roles WHERE rolname=registration.owner_role
    AND NOT (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls);
  IF writer_id IS NULL OR legacy_id IS NULL OR owner_id IS NULL
    OR writer_id=legacy_id OR writer_id=owner_id OR legacy_id=owner_id
    OR session_user<>registration.writer_role OR current_user<>registration.owner_role
    OR current_setting('transaction_isolation')<>'read committed'
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member IN (writer_id,legacy_id))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=owner_id
      AND roleid<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='pg_read_all_stats'))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity
      WHERE usename=registration.legacy_role AND datname=current_database()) THEN
    RAISE EXCEPTION 'ingestion_fence_authority_changed' USING ERRCODE='55000';
  END IF;

  -- Effective checks include PUBLIC grants and column-only writes. No dynamic SQL.
  IF EXISTS (
    SELECT 1 FROM unnest(ARRAY[writer_id,legacy_id]) AS roles(id)
    CROSS JOIN unnest(ARRAY[
      'public.media_server_items'::regclass,'public.media_server_sync_status'::regclass,
      'public.media_source_capture_state'::regclass,'public.library_ingestion_state'::regclass,
      'public.media_source_observations'::regclass,'public.media_server_collections'::regclass,
      'public.libraries'::regclass,'public.media_server'::regclass,
      'public.library_profile_inventory_state'::regclass,
      'ingestion_fence_rehearsal.cutover'::regclass,'ingestion_fence_rehearsal.bindings'::regclass,
      'ingestion_fence_rehearsal.seen'::regclass,'ingestion_fence_rehearsal.receipts'::regclass
    ]) AS relations(id)
    WHERE has_table_privilege(roles.id,relations.id,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_any_column_privilege(roles.id,relations.id,'INSERT,UPDATE,REFERENCES')
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid=relations.id AND relowner=roles.id)
  ) OR EXISTS (
    SELECT 1 FROM unnest(ARRAY[writer_id,legacy_id]) AS roles(id)
    WHERE has_database_privilege(roles.id,current_database(),'CREATE')
      OR has_schema_privilege(roles.id,'public','CREATE')
      OR has_schema_privilege(roles.id,'ingestion_fence_rehearsal','CREATE')
      OR has_sequence_privilege(roles.id,'public.media_server_items_id_seq','USAGE,UPDATE')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    WHERE c.relnamespace='ingestion_fence_rehearsal'::regnamespace AND c.relkind IN ('r','p','v','m','S')
      AND (c.relowner<>owner_id OR has_table_privilege(writer_id,c.oid,'SELECT')
        OR has_table_privilege(legacy_id,c.oid,'SELECT')
        OR has_any_column_privilege(writer_id,c.oid,'SELECT')
        OR has_any_column_privilege(legacy_id,c.oid,'SELECT'))
  ) THEN
    RAISE EXCEPTION 'ingestion_fence_authority_changed' USING ERRCODE='55000';
  END IF;

  -- Only these three public gateway signatures may be executed by the writer.
  -- A new ambient routine is unreviewed, even if its present body looks harmless.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.pronamespace IN ('public'::regnamespace,'ingestion_fence_rehearsal'::regnamespace)
      AND (has_function_privilege(legacy_id,p.oid,'EXECUTE')
        OR has_function_privilege('public',p.oid,'EXECUTE')
        OR (has_function_privilege(writer_id,p.oid,'EXECUTE') AND p.oid NOT IN (
          'ingestion_fence_rehearsal.begin_run(integer)'::regprocedure,
          'ingestion_fence_rehearsal.write_item(integer,uuid,text,text)'::regprocedure,
          'ingestion_fence_rehearsal.finish_run(integer,uuid,integer)'::regprocedure)))
  ) THEN
    RAISE EXCEPTION 'ingestion_fence_authority_changed' USING ERRCODE='55000';
  END IF;
END $$;
