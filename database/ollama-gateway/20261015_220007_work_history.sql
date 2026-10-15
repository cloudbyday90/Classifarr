-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- UTC migration: 2026-10-15 22:00:07. Standalone gateway database ONLY.
-- Back up and stop v6 first. Historical outcomes are intentionally not invented.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $$ BEGIN
  IF NOT pg_try_advisory_xact_lock(11435,1) THEN RAISE EXCEPTION 'gateway_must_be_stopped'; END IF;
END; $$;
LOCK TABLE ollama_gateway.admission IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF (SELECT count(*) FROM ollama_gateway.admission WHERE singleton AND version=6) <> 1 THEN
    RAISE EXCEPTION 'gateway_schema_version_invalid';
  END IF;
END; $$;
ALTER TABLE ollama_gateway.admission DROP CONSTRAINT admission_version_check;
UPDATE ollama_gateway.admission SET version=7 WHERE version=6;
ALTER TABLE ollama_gateway.admission ADD CONSTRAINT admission_version_check CHECK (version=7);
CREATE TABLE ollama_gateway.completion_receipt (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK ((uuid_extract_version(id)=7) IS TRUE),
  request_id uuid NOT NULL UNIQUE REFERENCES ollama_gateway.request_binding(request_id),
  outcome text NOT NULL,
  http_status integer,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((outcome='response_completed' AND http_status IS NOT NULL AND http_status=200)
    OR (outcome='provider_rejected' AND http_status IS NOT NULL AND http_status IN (400,401,403,404,429,503))
    OR (outcome IN ('not_dispatched','completion_observed') AND http_status IS NULL))
);
CREATE TRIGGER completion_receipt_append_only BEFORE UPDATE OR DELETE OR TRUNCATE
  ON ollama_gateway.completion_receipt FOR EACH STATEMENT EXECUTE FUNCTION ollama_gateway.reject_receipt_mutation();
REVOKE ALL ON ollama_gateway.completion_receipt FROM PUBLIC;
CREATE INDEX request_binding_history ON ollama_gateway.request_binding (installation,attempt DESC);
CREATE INDEX request_binding_task_history ON ollama_gateway.request_binding (installation,source_task_id,attempt DESC);
COMMIT;
