-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- UTC migration: 2026-10-14 12:14:41. Standalone gateway database ONLY.
-- Explicit initialization, never an automatic application migration.
-- Deliberately not repeatable: an existing or uncertain ledger must not be reset.
BEGIN;
CREATE SCHEMA ollama_gateway;
REVOKE ALL ON SCHEMA ollama_gateway FROM PUBLIC;
CREATE TABLE ollama_gateway.admission (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK (uuid_extract_version(id) = 7),
  singleton boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton),
  version integer NOT NULL CHECK (version = 1),
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
INSERT INTO ollama_gateway.admission(version) VALUES (1);
REVOKE ALL ON ollama_gateway.admission FROM PUBLIC;
COMMIT;
