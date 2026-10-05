/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Fixed catalog predicate shared by status reads and transaction-locked recovery.
// An observation grants no authority; recovery also requires the library lock.
export const INGESTION_COMPATIBILITY_FENCE_SQL = `(current_setting('classifarr.ingestion_protocol',true)='1' AND
  (SELECT count(*)=12 FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgenabled='A'
    AND t.tgfoid=to_regprocedure('public.enforce_ingestion_compatibility()')
    AND ((t.tgname='ingestion_compatibility_rows' AND t.tgtype=31)
      OR (t.tgname='ingestion_compatibility_truncate' AND t.tgtype=34))
    AND t.tgrelid=ANY(ARRAY['public.media_server_items'::regclass,'public.media_server_sync_status'::regclass,
      'public.media_source_capture_state'::regclass,'public.library_ingestion_state'::regclass,
      'public.media_source_observations'::regclass,'public.media_server_collections'::regclass])))`;
