-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Optional archive coordinator schema v1. Explicit setup only; no application auto-migration.
BEGIN;
CREATE SCHEMA gateway_archive;
REVOKE ALL ON SCHEMA gateway_archive FROM PUBLIC;
CREATE TABLE gateway_archive.job (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK ((uuid_extract_version(id)=7) IS TRUE),
  ledger_id uuid NOT NULL CHECK ((uuid_extract_version(ledger_id)=7) IS TRUE),
  provider_hash text NOT NULL CHECK (provider_hash ~ '^[a-f0-9]{64}$'),
  policy_hash text NOT NULL CHECK (policy_hash ~ '^[a-f0-9]{64}$'),
  revision text NOT NULL CHECK (revision ~ '^[a-f0-9]{64}$'),
  attempt integer NOT NULL CHECK (attempt BETWEEN 1 AND 3),
  status text NOT NULL CHECK (status IN ('exporting','awaiting_verification','verified','failed','interrupted','retiring','retired')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  retry_after timestamptz,
  manifest_sha256 text CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  manifest jsonb,
  receipt jsonb,
  reason text CHECK (reason IN ('export_failed','export_interrupted','source_changed','verification_failed','cancelled')),
  UNIQUE(ledger_id,provider_hash,revision,attempt),
  CHECK ((manifest IS NULL) = (manifest_sha256 IS NULL)),
  CHECK (status NOT IN ('awaiting_verification','verified','retiring','retired') OR manifest IS NOT NULL),
  CHECK (status NOT IN ('verified','retiring','retired') OR receipt IS NOT NULL)
);
CREATE UNIQUE INDEX archive_one_pending ON gateway_archive.job ((true))
  WHERE status IN ('exporting','awaiting_verification','interrupted','retiring');
CREATE INDEX archive_revision_attempts ON gateway_archive.job(ledger_id,provider_hash,revision,attempt DESC);
REVOKE ALL ON gateway_archive.job FROM PUBLIC;
COMMIT;
