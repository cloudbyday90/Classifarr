-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- UTC migration: 2026-10-15 09:57:21. Standalone gateway database ONLY.
-- Stop the gateway, back up this database; apply after v3 and use v4 binaries.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $$ BEGIN
  IF NOT pg_try_advisory_xact_lock(11435,1) THEN RAISE EXCEPTION 'gateway_must_be_stopped'; END IF;
END; $$;
LOCK TABLE ollama_gateway.admission IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF (SELECT count(*) FROM ollama_gateway.admission WHERE singleton AND version=3) <> 1 THEN
    RAISE EXCEPTION 'gateway_schema_version_invalid';
  END IF;
END; $$;
ALTER TABLE ollama_gateway.admission DROP CONSTRAINT admission_version_check;
UPDATE ollama_gateway.admission SET version=4 WHERE version=3;
ALTER TABLE ollama_gateway.admission ADD CONSTRAINT admission_version_check CHECK (version=4);
CREATE TABLE ollama_gateway.provider_stop_intent (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK (uuid_extract_version(id)=7),
  binding_id uuid NOT NULL UNIQUE REFERENCES ollama_gateway.request_binding(id),
  owner_id uuid NOT NULL CHECK (uuid_extract_version(owner_id)=7),
  attempts bigint NOT NULL CHECK (attempts>0),
  network_id text NOT NULL CHECK (length(network_id)=64 AND network_id ~ '^[a-f0-9]{64}$'),
  configuration_hash text NOT NULL CHECK (length(configuration_hash)=64 AND configuration_hash ~ '^[a-f0-9]{64}$'),
  network_hash text NOT NULL CHECK (length(network_hash)=64 AND network_hash ~ '^[a-f0-9]{64}$'),
  operator_ref text NOT NULL CHECK (length(operator_ref) BETWEEN 1 AND 64 AND operator_ref ~ '^[A-Za-z0-9][A-Za-z0-9_.-]*$'),
  evidence_ref text NOT NULL CHECK (length(evidence_ref) BETWEEN 1 AND 96 AND evidence_ref ~ '^[A-Za-z0-9][A-Za-z0-9_.-]*$'),
  reviewed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE ollama_gateway.provider_stop_observation (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK (uuid_extract_version(id)=7),
  intent_id uuid NOT NULL UNIQUE REFERENCES ollama_gateway.provider_stop_intent(id),
  finished_at text NOT NULL CHECK (length(finished_at) BETWEEN 20 AND 30
    AND finished_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,9})?Z$'
    AND finished_at::timestamptz > '0001-01-01'::timestamptz),
  exit_code integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER provider_stop_intent_append_only BEFORE UPDATE OR DELETE OR TRUNCATE
  ON ollama_gateway.provider_stop_intent FOR EACH STATEMENT EXECUTE FUNCTION ollama_gateway.reject_receipt_mutation();
CREATE TRIGGER provider_stop_observation_append_only BEFORE UPDATE OR DELETE OR TRUNCATE
  ON ollama_gateway.provider_stop_observation FOR EACH STATEMENT EXECUTE FUNCTION ollama_gateway.reject_receipt_mutation();
REVOKE ALL ON ollama_gateway.provider_stop_intent,ollama_gateway.provider_stop_observation FROM PUBLIC;
COMMIT;
