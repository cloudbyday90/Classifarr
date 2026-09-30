-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE FUNCTION ingestion_fence_rehearsal.write_item(lib integer, token uuid, external text, item_title text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE source_id integer; item_type text;
BEGIN
  -- Revalidate and pin source rows for this short database-only statement.
  PERFORM 1 FROM public.libraries l JOIN public.media_server m ON m.id=l.media_server_id
    WHERE l.id=lib FOR SHARE OF l,m;
  PERFORM ingestion_fence_rehearsal.assert_run(lib,token);
  IF external IS NULL OR length(btrim(external))=0 OR length(external)>100
    OR item_title IS NULL OR length(btrim(item_title))=0 OR length(item_title)>500 THEN
    RAISE EXCEPTION 'ingestion_fence_payload_invalid' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(*) FROM ingestion_fence_rehearsal.seen WHERE library_id=lib AND run_id=token)>=1000
    AND NOT EXISTS (SELECT 1 FROM ingestion_fence_rehearsal.seen WHERE library_id=lib AND run_id=token AND external_id=external) THEN
    RAISE EXCEPTION 'ingestion_fence_budget_exceeded' USING ERRCODE='54000';
  END IF;
  SELECT media_server_id,media_type INTO source_id,item_type FROM public.libraries WHERE id=lib;
  INSERT INTO public.media_server_items(media_server_id,library_id,external_id,title,media_type)
    VALUES (source_id,lib,external,item_title,item_type)
    ON CONFLICT(media_server_id,external_id) DO UPDATE SET title=EXCLUDED.title,last_synced=clock_timestamp()
      WHERE public.media_server_items.library_id=lib AND public.media_server_items.media_type=item_type;
  IF NOT FOUND THEN RAISE EXCEPTION 'ingestion_fence_identity_conflict' USING ERRCODE='55000'; END IF;
  INSERT INTO ingestion_fence_rehearsal.seen VALUES (lib,token,external) ON CONFLICT DO NOTHING;
END $$;
