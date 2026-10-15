-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Fresh standalone gateway schema, version 7. Never apply to an existing database.
-- Explicit initialization, never an automatic application migration.
-- Deliberately not repeatable: an existing or uncertain ledger must not be reset.
BEGIN;
CREATE SCHEMA ollama_gateway;
REVOKE ALL ON SCHEMA ollama_gateway FROM PUBLIC;
CREATE TABLE ollama_gateway.admission (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK (uuid_extract_version(id) = 7),
  singleton boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton),
  version integer NOT NULL CHECK (version = 7),
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
INSERT INTO ollama_gateway.admission(version) VALUES (7);
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
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK ((uuid_extract_version(id)=7) IS TRUE),
  binding_id uuid NOT NULL UNIQUE REFERENCES ollama_gateway.request_binding(id),
  owner_id uuid NOT NULL CHECK ((uuid_extract_version(owner_id)=7) IS TRUE),
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
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK ((uuid_extract_version(id)=7) IS TRUE),
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
