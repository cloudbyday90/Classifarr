-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- UTC migration: 2026-10-15 10:49:32. Standalone gateway database ONLY.
-- Back up and stop the gateway first; apply after v4, then use v5 binaries.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $$ BEGIN
  IF NOT pg_try_advisory_xact_lock(11435,1) THEN RAISE EXCEPTION 'gateway_must_be_stopped'; END IF;
END; $$;
LOCK TABLE ollama_gateway.admission IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF (SELECT count(*) FROM ollama_gateway.admission WHERE singleton AND version=4) <> 1 THEN
    RAISE EXCEPTION 'gateway_schema_version_invalid';
  END IF;
END; $$;
ALTER TABLE ollama_gateway.admission DROP CONSTRAINT admission_version_check;
UPDATE ollama_gateway.admission SET version=5 WHERE version=4;
ALTER TABLE ollama_gateway.admission ADD CONSTRAINT admission_version_check CHECK (version=5);
CREATE TABLE ollama_gateway.upstream_peer_observation (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK ((uuid_extract_version(id)=7) IS TRUE),
  binding_id uuid NOT NULL UNIQUE REFERENCES ollama_gateway.request_binding(id),
  public_key_sha256 text NOT NULL CHECK (length(public_key_sha256)=64 AND public_key_sha256 ~ '^[a-f0-9]{64}$'),
  certificate_sha256 text NOT NULL CHECK (length(certificate_sha256)=64 AND certificate_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER upstream_peer_observation_append_only BEFORE UPDATE OR DELETE OR TRUNCATE
  ON ollama_gateway.upstream_peer_observation FOR EACH STATEMENT EXECUTE FUNCTION ollama_gateway.reject_receipt_mutation();
REVOKE ALL ON ollama_gateway.upstream_peer_observation FROM PUBLIC;
ALTER TABLE ollama_gateway.request_binding
  ADD COLUMN work_version integer,
  ADD COLUMN operation text,
  ADD COLUMN model text,
  ADD COLUMN work_fingerprint text CHECK (length(work_fingerprint)=64 AND work_fingerprint ~ '^[a-f0-9]{64}$'),
  ADD COLUMN fingerprint_key_id text CHECK (length(fingerprint_key_id)=64 AND fingerprint_key_id ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT request_binding_work_context CHECK (
    (work_version IS NULL AND num_nonnulls(operation,model,work_fingerprint,fingerprint_key_id)=0)
    OR (work_version IS NOT NULL AND work_version=1 AND operation IS NOT NULL AND model IS NOT NULL
      AND operation IN ('/api/generate','/api/embed') AND length(model) BETWEEN 1 AND 200
      AND model ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:/-]*$'
      AND ((work_fingerprint IS NULL AND fingerprint_key_id IS NULL)
        OR (work_fingerprint IS NOT NULL AND fingerprint_key_id IS NOT NULL))));
COMMIT;
