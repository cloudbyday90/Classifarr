-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- UTC migration: 2026-10-15 09:16:27. Standalone gateway database ONLY.
-- Stop the gateway, back up this database, apply after version 2, use version-3 binaries.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $$ BEGIN
  IF NOT pg_try_advisory_xact_lock(11435, 1) THEN
    RAISE EXCEPTION 'gateway_must_be_stopped';
  END IF;
END; $$;
LOCK TABLE ollama_gateway.admission IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF (SELECT count(*) FROM ollama_gateway.admission WHERE singleton AND version=2) <> 1 THEN
    RAISE EXCEPTION 'gateway_schema_version_invalid';
  END IF;
END; $$;
ALTER TABLE ollama_gateway.admission DROP CONSTRAINT admission_version_check;
UPDATE ollama_gateway.admission SET version=3 WHERE version=2;
ALTER TABLE ollama_gateway.admission ADD CONSTRAINT admission_version_check CHECK (version=3);
ALTER TABLE ollama_gateway.admission ADD COLUMN binding_count integer NOT NULL DEFAULT 0
  CHECK (binding_count BETWEEN 0 AND 100000);
CREATE TABLE ollama_gateway.request_binding (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK (uuid_extract_version(id) = 7),
  ledger_id uuid NOT NULL REFERENCES ollama_gateway.admission(id),
  request_id uuid NOT NULL UNIQUE CHECK (uuid_extract_version(request_id) = 7),
  owner_id uuid NOT NULL CHECK (uuid_extract_version(owner_id) = 7),
  provider_hash text NOT NULL CHECK (length(provider_hash)=64 AND provider_hash ~ '^[a-f0-9]{64}$'),
  installation text NOT NULL CHECK (length(installation) BETWEEN 1 AND 64),
  admitted_at timestamptz NOT NULL,
  attempt bigint NOT NULL CHECK (attempt > 0),
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('unbound','administrator_configured')),
  daemon_id_hash text CHECK (length(daemon_id_hash)=64 AND daemon_id_hash ~ '^[a-f0-9]{64}$'),
  container_id text CHECK (length(container_id)=64 AND container_id ~ '^[a-f0-9]{64}$'),
  image_id text CHECK (length(image_id)=71 AND image_id ~ '^sha256:[a-f0-9]{64}$'),
  provider_started_at text CHECK (length(provider_started_at) BETWEEN 20 AND 30
    AND provider_started_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,9})?Z$'
    AND provider_started_at::timestamptz > '0001-01-01'::timestamptz),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((evidence_kind='unbound' AND num_nonnulls(daemon_id_hash,container_id,image_id,provider_started_at)=0)
    OR (evidence_kind='administrator_configured' AND num_nonnulls(daemon_id_hash,container_id,image_id,provider_started_at)=4)),
  UNIQUE (ledger_id,attempt)
);
CREATE TRIGGER request_binding_append_only BEFORE UPDATE OR DELETE OR TRUNCATE
  ON ollama_gateway.request_binding FOR EACH STATEMENT
  EXECUTE FUNCTION ollama_gateway.reject_receipt_mutation();
REVOKE ALL ON ollama_gateway.request_binding FROM PUBLIC;
-- No backfilled declaration: a legacy active request remains explicitly unbound.
COMMIT;
