-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- UTC migration: 2026-10-15 11:37:26. Standalone gateway database ONLY.
-- Back up and stop the gateway first; apply after v5, then use v6 binaries.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $$ BEGIN
  IF NOT pg_try_advisory_xact_lock(11435,1) THEN RAISE EXCEPTION 'gateway_must_be_stopped'; END IF;
END; $$;
LOCK TABLE ollama_gateway.admission IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF (SELECT count(*) FROM ollama_gateway.admission WHERE singleton AND version=5) <> 1 THEN
    RAISE EXCEPTION 'gateway_schema_version_invalid';
  END IF;
END; $$;
ALTER TABLE ollama_gateway.admission DROP CONSTRAINT admission_version_check;
UPDATE ollama_gateway.admission SET version=6 WHERE version=5;
ALTER TABLE ollama_gateway.admission ADD CONSTRAINT admission_version_check CHECK (version=6);
ALTER TABLE ollama_gateway.request_binding
  ADD COLUMN source_kind text,
  ADD COLUMN source_task_id text,
  ADD COLUMN source_task_type text,
  ADD COLUMN source_attempt integer,
  ADD CONSTRAINT request_binding_task_source CHECK (
    num_nonnulls(source_kind,source_task_id,source_task_type,source_attempt)=0
    OR (num_nonnulls(source_kind,source_task_id,source_task_type,source_attempt)=4
      AND work_version IS NOT NULL AND work_version=1 AND source_kind='queue_task'
      AND source_task_id ~ '^[1-9][0-9]{0,18}$'
      AND (length(source_task_id)<19 OR source_task_id COLLATE "C" <= '9223372036854775807')
      AND source_task_type IN ('classification','metadata_enrichment','rating_normalization','rebuild_hnsw_index')
      AND source_attempt>=0));
COMMIT;
