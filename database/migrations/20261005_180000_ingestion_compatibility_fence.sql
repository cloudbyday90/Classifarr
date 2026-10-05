-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Runs atomically in the migration runner. Drain old DML before activating the fence.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.media_server_items, public.media_server_sync_status,
  public.media_source_capture_state, public.library_ingestion_state,
  public.media_source_observations, public.media_server_collections IN ACCESS EXCLUSIVE MODE;

-- Constant defaults preserve pre-cutover provenance without rewriting inventory.
ALTER TABLE public.media_server_sync_status ADD COLUMN ingestion_protocol smallint NOT NULL DEFAULT 0
  CHECK (ingestion_protocol IN (0,1));
ALTER TABLE public.media_source_capture_state ADD COLUMN ingestion_protocol smallint NOT NULL DEFAULT 0
  CHECK (ingestion_protocol IN (0,1));

CREATE FUNCTION public.enforce_ingestion_compatibility() RETURNS trigger
  LANGUAGE plpgsql SET search_path = pg_catalog AS $function$
BEGIN
  IF current_setting('classifarr.ingestion_protocol', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'ingestion_writer_upgrade_required',
      HINT = 'This database requires a protocol-aware Classifarr writer. Upgrade the writer; do not bypass the fence.';
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND TG_TABLE_NAME IN ('media_server_sync_status','media_source_capture_state') THEN
    NEW.ingestion_protocol := 1;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$function$;
COMMENT ON FUNCTION public.enforce_ingestion_compatibility() IS
  'Rejects unmodified pre-protocol writers, including late writes. Not isolation from a database owner or superuser.';

CREATE TRIGGER ingestion_compatibility_rows BEFORE INSERT OR UPDATE OR DELETE ON public.media_server_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ingestion_compatibility();
CREATE TRIGGER ingestion_compatibility_truncate BEFORE TRUNCATE ON public.media_server_items
  FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_ingestion_compatibility();
CREATE TRIGGER ingestion_compatibility_rows BEFORE INSERT OR UPDATE OR DELETE ON public.media_server_sync_status
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ingestion_compatibility();
CREATE TRIGGER ingestion_compatibility_truncate BEFORE TRUNCATE ON public.media_server_sync_status
  FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_ingestion_compatibility();
CREATE TRIGGER ingestion_compatibility_rows BEFORE INSERT OR UPDATE OR DELETE ON public.media_source_capture_state
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ingestion_compatibility();
CREATE TRIGGER ingestion_compatibility_truncate BEFORE TRUNCATE ON public.media_source_capture_state
  FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_ingestion_compatibility();
CREATE TRIGGER ingestion_compatibility_rows BEFORE INSERT OR UPDATE OR DELETE ON public.library_ingestion_state
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ingestion_compatibility();
CREATE TRIGGER ingestion_compatibility_truncate BEFORE TRUNCATE ON public.library_ingestion_state
  FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_ingestion_compatibility();
CREATE TRIGGER ingestion_compatibility_rows BEFORE INSERT OR UPDATE OR DELETE ON public.media_source_observations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ingestion_compatibility();
CREATE TRIGGER ingestion_compatibility_truncate BEFORE TRUNCATE ON public.media_source_observations
  FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_ingestion_compatibility();
CREATE TRIGGER ingestion_compatibility_rows BEFORE INSERT OR UPDATE OR DELETE ON public.media_server_collections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ingestion_compatibility();
CREATE TRIGGER ingestion_compatibility_truncate BEFORE TRUNCATE ON public.media_server_collections
  FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_ingestion_compatibility();

ALTER TABLE public.media_server_items ENABLE ALWAYS TRIGGER ingestion_compatibility_rows;
ALTER TABLE public.media_server_items ENABLE ALWAYS TRIGGER ingestion_compatibility_truncate;
ALTER TABLE public.media_server_sync_status ENABLE ALWAYS TRIGGER ingestion_compatibility_rows;
ALTER TABLE public.media_server_sync_status ENABLE ALWAYS TRIGGER ingestion_compatibility_truncate;
ALTER TABLE public.media_source_capture_state ENABLE ALWAYS TRIGGER ingestion_compatibility_rows;
ALTER TABLE public.media_source_capture_state ENABLE ALWAYS TRIGGER ingestion_compatibility_truncate;
ALTER TABLE public.library_ingestion_state ENABLE ALWAYS TRIGGER ingestion_compatibility_rows;
ALTER TABLE public.library_ingestion_state ENABLE ALWAYS TRIGGER ingestion_compatibility_truncate;
ALTER TABLE public.media_source_observations ENABLE ALWAYS TRIGGER ingestion_compatibility_rows;
ALTER TABLE public.media_source_observations ENABLE ALWAYS TRIGGER ingestion_compatibility_truncate;
ALTER TABLE public.media_server_collections ENABLE ALWAYS TRIGGER ingestion_compatibility_rows;
ALTER TABLE public.media_server_collections ENABLE ALWAYS TRIGGER ingestion_compatibility_truncate;

CREATE INDEX idx_ingestion_compatibility_history ON public.audit_log ((metadata->>'libraryId'),id DESC)
  WHERE action='library_ingestion_compatibility_recovered' AND user_id IS NULL AND metadata->>'moreBatches'='false';
