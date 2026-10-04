-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Disposable candidate only. The installer sets a restricted NOLOGIN owner.
CREATE TABLE ingestion_fence_rehearsal.cutover (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  owner_role name,
  writer_role name,
  legacy_role name
);
INSERT INTO ingestion_fence_rehearsal.cutover(singleton,enabled) VALUES (true, false);
CREATE TABLE ingestion_fence_rehearsal.bindings (
  library_id integer PRIMARY KEY REFERENCES public.libraries(id),
  run_id uuid NOT NULL,
  backend_pid integer NOT NULL,
  backend_start timestamptz NOT NULL,
  login name NOT NULL,
  source_revision text NOT NULL,
  library_revision text NOT NULL
);
CREATE TABLE ingestion_fence_rehearsal.seen (
  library_id integer NOT NULL,
  run_id uuid NOT NULL,
  external_id text NOT NULL,
  PRIMARY KEY(library_id,run_id,external_id)
);
CREATE TABLE ingestion_fence_rehearsal.receipts (
  library_id integer NOT NULL,
  run_id uuid PRIMARY KEY,
  retired_syncs integer NOT NULL,
  retired_captures integer NOT NULL,
  verification text NOT NULL CHECK (verification='isolated_database_cutover'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION ingestion_fence_rehearsal.assert_lock(lib integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF lib IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_locks WHERE locktype='advisory' AND granted AND mode='ExclusiveLock'
      AND classid=1297307982::oid AND objid=lib::oid AND objsubid=2
      AND pid=pg_backend_pid() AND database=(SELECT oid FROM pg_database WHERE datname=current_database())
  ) THEN RAISE EXCEPTION 'ingestion_fence_lock_required' USING ERRCODE='55000'; END IF;
END $$;

CREATE FUNCTION ingestion_fence_rehearsal.assert_run(lib integer, token uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  PERFORM ingestion_fence_rehearsal.assert_authority();
  PERFORM ingestion_fence_rehearsal.assert_lock(lib);
  IF NOT EXISTS (
    SELECT 1 FROM ingestion_fence_rehearsal.bindings b
      JOIN public.library_ingestion_state s ON s.library_id=b.library_id AND s.run_id=b.run_id
      JOIN public.libraries l ON l.id=b.library_id
      JOIN public.media_server m ON m.id=l.media_server_id
      JOIN pg_catalog.pg_stat_activity a ON a.pid=b.backend_pid AND a.backend_start=b.backend_start
    WHERE b.library_id=lib AND b.run_id=token AND b.backend_pid=pg_backend_pid()
      AND b.login=session_user AND s.phase='running'
      AND l.xmin::text=b.library_revision AND m.xmin::text=b.source_revision
      AND l.is_active AND m.is_active AND l.archived_at IS NULL
  ) THEN RAISE EXCEPTION 'ingestion_fence_stale_run' USING ERRCODE='55000'; END IF;
END $$;

CREATE FUNCTION ingestion_fence_rehearsal.begin_run(lib integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE token uuid := gen_random_uuid(); source_rev text; library_rev text;
  retired_syncs integer; retired_captures integer;
BEGIN
  PERFORM ingestion_fence_rehearsal.assert_authority();
  PERFORM ingestion_fence_rehearsal.assert_lock(lib);
  SELECT l.xmin::text,m.xmin::text INTO library_rev,source_rev
    FROM public.libraries l JOIN public.media_server m ON m.id=l.media_server_id
    WHERE l.id=lib AND l.is_active AND l.archived_at IS NULL AND m.is_active
      AND l.media_type IN ('movie','tv') AND m.type IN ('plex','emby','jellyfin')
      AND length(btrim(m.url))>0 AND length(btrim(m.api_key))>0
    FOR SHARE OF l,m;
  IF NOT FOUND THEN RAISE EXCEPTION 'ingestion_fence_source_not_ready' USING ERRCODE='55000'; END IF;
  IF (SELECT count(*) FROM public.media_server_sync_status WHERE library_id=lib AND status IN ('pending','running'))>1000 THEN
    RAISE EXCEPTION 'ingestion_fence_marker_budget' USING ERRCODE='54000';
  END IF;
  UPDATE public.media_server_sync_status SET status='failed',completed_at=clock_timestamp(),
    error_message='Isolated database-fencing rehearsal; full replay required'
    WHERE library_id=lib AND status IN ('pending','running');
  GET DIAGNOSTICS retired_syncs=ROW_COUNT;
  UPDATE public.media_source_capture_state SET phase='failed',completed_at=clock_timestamp()
    WHERE library_id=lib AND phase='collecting';
  GET DIAGNOSTICS retired_captures=ROW_COUNT;
  INSERT INTO public.library_ingestion_state(library_id,run_id,phase,retry_after)
    VALUES (lib,token,'running',clock_timestamp()+interval '1 minute')
    ON CONFLICT(library_id) DO UPDATE SET run_id=EXCLUDED.run_id,phase='running',
      sync_status_id=NULL,capture_generation=NULL,items_processed=0,pages_processed=0,
      items_total=NULL,retry_after=EXCLUDED.retry_after,updated_at=clock_timestamp();
  INSERT INTO ingestion_fence_rehearsal.bindings
    SELECT lib,token,pg_backend_pid(),backend_start,session_user,source_rev,library_rev
    FROM pg_catalog.pg_stat_activity WHERE pid=pg_backend_pid()
    ON CONFLICT(library_id) DO UPDATE SET run_id=EXCLUDED.run_id,backend_pid=EXCLUDED.backend_pid,
      backend_start=EXCLUDED.backend_start,login=EXCLUDED.login,source_revision=EXCLUDED.source_revision,
      library_revision=EXCLUDED.library_revision;
  DELETE FROM ingestion_fence_rehearsal.seen WHERE library_id=lib;
  INSERT INTO ingestion_fence_rehearsal.receipts VALUES
    (lib,token,retired_syncs,retired_captures,'isolated_database_cutover',clock_timestamp());
  RETURN token;
END $$;

CREATE FUNCTION ingestion_fence_rehearsal.finish_run(lib integer, token uuid, expected integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.libraries l JOIN public.media_server m ON m.id=l.media_server_id
    WHERE l.id=lib FOR SHARE OF l,m;
  PERFORM ingestion_fence_rehearsal.assert_run(lib,token);
  IF expected IS NULL OR expected<0 OR expected>1000 OR expected<>(
    SELECT count(*) FROM ingestion_fence_rehearsal.seen WHERE library_id=lib AND run_id=token
  ) THEN RAISE EXCEPTION 'ingestion_fence_incomplete' USING ERRCODE='55000'; END IF;
  -- No pruning capability in this candidate. Full production finalization is a separate contract.
  UPDATE public.library_ingestion_state SET phase='complete',items_processed=expected,
    items_total=expected,retry_after=NULL,updated_at=clock_timestamp() WHERE library_id=lib AND run_id=token;
  DELETE FROM ingestion_fence_rehearsal.bindings WHERE library_id=lib AND run_id=token;
END $$;
