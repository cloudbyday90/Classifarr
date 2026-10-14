-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- UTC migration: 2026-10-14 22:42:42. Standalone gateway database ONLY.
-- Stop the gateway, back up this database, apply once, then use version-2 binaries.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $$ BEGIN
  IF NOT pg_try_advisory_xact_lock(11435, 1) THEN
    RAISE EXCEPTION 'gateway_must_be_stopped';
  END IF;
END; $$;
LOCK TABLE ollama_gateway.admission IN ACCESS EXCLUSIVE MODE;
ALTER TABLE ollama_gateway.admission DROP CONSTRAINT admission_version_check;
UPDATE ollama_gateway.admission SET version=2 WHERE version=1;
ALTER TABLE ollama_gateway.admission ADD CONSTRAINT admission_version_check CHECK (version=2);
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
COMMIT;
