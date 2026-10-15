-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Fresh standalone gateway schema, version 4. Never apply to an existing database.
-- Explicit initialization, never an automatic application migration.
-- Deliberately not repeatable: an existing or uncertain ledger must not be reset.
BEGIN;
CREATE SCHEMA ollama_gateway;
REVOKE ALL ON SCHEMA ollama_gateway FROM PUBLIC;
CREATE TABLE ollama_gateway.admission (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK (uuid_extract_version(id) = 7),
  singleton boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton),
  version integer NOT NULL CHECK (version = 4),
  provider_hash text CHECK (provider_hash ~ '^[a-f0-9]{64}$'),
  owner_id uuid CHECK (uuid_extract_version(owner_id) = 7),
  active_request uuid CHECK (uuid_extract_version(active_request) = 7),
  installation text,
  started_at timestamptz,
  attempts bigint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  completed_at timestamptz,
  cooldown_until timestamptz,
  CHECK ((active_request IS NULL AND installation IS NULL AND started_at IS NULL)
    OR (active_request IS NOT NULL AND installation IS NOT NULL AND started_at IS NOT NULL))
);
INSERT INTO ollama_gateway.admission(version) VALUES (4);
REVOKE ALL ON ollama_gateway.admission FROM PUBLIC;
CREATE TABLE ollama_gateway.recovery_receipt (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK (uuid_extract_version(id) = 7),
  ledger_id uuid NOT NULL REFERENCES ollama_gateway.admission(id),
  action text NOT NULL CHECK (action IN ('acknowledge-stop','resume')),
  evidence_kind text NOT NULL DEFAULT 'administrator_attested' CHECK (evidence_kind = 'administrator_attested'),
  contract_version integer NOT NULL DEFAULT 1 CHECK (contract_version = 1),
  provider_hash text NOT NULL CHECK (provider_hash ~ '^[a-f0-9]{64}$'),
  owner_id uuid NOT NULL CHECK (uuid_extract_version(owner_id) = 7),
  request_id uuid NOT NULL CHECK (uuid_extract_version(request_id) = 7),
  installation text NOT NULL,
  started_at timestamptz NOT NULL,
  attempts bigint NOT NULL CHECK (attempts > 0),
  cooldown_until timestamptz,
  operator_ref text NOT NULL CHECK (operator_ref ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$'),
  evidence_ref text NOT NULL CHECK (evidence_ref ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$'),
  observed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  stop_receipt_id uuid UNIQUE REFERENCES ollama_gateway.recovery_receipt(id),
  CHECK ((action = 'acknowledge-stop' AND stop_receipt_id IS NULL)
    OR (action = 'resume' AND stop_receipt_id IS NOT NULL))
);
CREATE UNIQUE INDEX recovery_one_stop_per_request ON ollama_gateway.recovery_receipt(request_id)
  WHERE action = 'acknowledge-stop';
ALTER TABLE ollama_gateway.admission ADD COLUMN maintenance_receipt uuid
  REFERENCES ollama_gateway.recovery_receipt(id);
ALTER TABLE ollama_gateway.admission ADD COLUMN last_recovery_receipt uuid
  REFERENCES ollama_gateway.recovery_receipt(id);
ALTER TABLE ollama_gateway.admission ADD CONSTRAINT recovery_hold_no_active
  CHECK (maintenance_receipt IS NULL OR active_request IS NULL);
CREATE FUNCTION ollama_gateway.reject_receipt_mutation() RETURNS trigger
  LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'gateway_receipt_append_only' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION ollama_gateway.reject_receipt_mutation() FROM PUBLIC;
CREATE TRIGGER recovery_receipt_append_only BEFORE UPDATE OR DELETE OR TRUNCATE
  ON ollama_gateway.recovery_receipt FOR EACH STATEMENT
  EXECUTE FUNCTION ollama_gateway.reject_receipt_mutation();
REVOKE ALL ON ollama_gateway.recovery_receipt FROM PUBLIC;
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
