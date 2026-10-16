-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Optional archive schema v2. Stop the coordinator; apply once as schema owner.
BEGIN;
DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(11435,2) OR EXISTS(SELECT 1 FROM gateway_archive.job WHERE status='retiring') THEN
    RAISE EXCEPTION 'gateway_archive_upgrade_blocked';
  END IF;
END $$;
CREATE TABLE gateway_archive.protection (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK ((uuid_extract_version(id)=7) IS TRUE),
  capacity_slot integer NOT NULL UNIQUE CHECK (capacity_slot BETWEEN 1 AND 1000),
  ledger_id uuid NOT NULL CHECK ((uuid_extract_version(ledger_id)=7) IS TRUE),
  provider_hash text NOT NULL CHECK (provider_hash ~ '^[a-f0-9]{64}$'),
  candidates_sha256 text NOT NULL CHECK (candidates_sha256 ~ '^[a-f0-9]{64}$'),
  first_archive_id uuid NOT NULL REFERENCES gateway_archive.job(id),
  second_archive_id uuid NOT NULL REFERENCES gateway_archive.job(id),
  first_manifest_sha256 text NOT NULL CHECK (first_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  second_manifest_sha256 text NOT NULL CHECK (second_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  minimum_recovery_days integer NOT NULL DEFAULT 30 CHECK (minimum_recovery_days=30),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ready_at timestamptz,
  CHECK (first_archive_id < second_archive_id),
  UNIQUE(ledger_id,provider_hash,candidates_sha256),
  UNIQUE(first_archive_id),
  UNIQUE(second_archive_id)
);
ALTER TABLE gateway_archive.job ADD COLUMN recovery_protection_id uuid REFERENCES gateway_archive.protection(id);
REVOKE ALL ON gateway_archive.protection FROM PUBLIC;

CREATE FUNCTION gateway_archive.guard_protection() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE first_job gateway_archive.job; second_job gateway_archive.job;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.ready_at IS NOT NULL OR NEW.ready_at IS NULL OR
        (to_jsonb(NEW)-'ready_at') IS DISTINCT FROM (to_jsonb(OLD)-'ready_at') THEN
      RAISE EXCEPTION 'gateway_archive_protection_immutable';
    END IF;
    NEW.ready_at := clock_timestamp();
    RETURN NEW;
  ELSIF TG_OP<>'INSERT' THEN
    RAISE EXCEPTION 'gateway_archive_protection_immutable';
  END IF;
  IF NOT pg_try_advisory_xact_lock(11435,3) THEN RAISE EXCEPTION 'gateway_archive_protection_busy'; END IF;
  SELECT candidate INTO NEW.capacity_slot FROM generate_series(1,1000) candidate
    WHERE NOT EXISTS(SELECT 1 FROM gateway_archive.protection p WHERE p.capacity_slot=candidate) ORDER BY candidate LIMIT 1;
  IF NEW.capacity_slot IS NULL THEN RAISE EXCEPTION 'gateway_archive_protection_capacity'; END IF;
  IF NEW.ready_at IS NOT NULL THEN RAISE EXCEPTION 'gateway_archive_protection_invalid'; END IF;
  SELECT * INTO first_job FROM gateway_archive.job WHERE id=NEW.first_archive_id FOR UPDATE;
  SELECT * INTO second_job FROM gateway_archive.job WHERE id=NEW.second_archive_id FOR UPDATE;
  IF (first_job.status='verified' AND second_job.status='verified'
      AND first_job.recovery_protection_id IS NULL AND second_job.recovery_protection_id IS NULL
      AND first_job.ledger_id=NEW.ledger_id AND second_job.ledger_id=NEW.ledger_id
      AND first_job.provider_hash=NEW.provider_hash AND second_job.provider_hash=NEW.provider_hash
      AND first_job.policy_hash=second_job.policy_hash
      AND first_job.manifest_sha256=NEW.first_manifest_sha256 AND second_job.manifest_sha256=NEW.second_manifest_sha256
      AND first_job.manifest->>'version'='4' AND second_job.manifest->>'version'='4'
      AND first_job.receipt->>'version'='2' AND second_job.receipt->>'version'='2'
      AND first_job.receipt->>'verified'='true' AND second_job.receipt->>'verified'='true'
      AND first_job.receipt->>'manifestSha256'=first_job.manifest_sha256
      AND second_job.receipt->>'manifestSha256'=second_job.manifest_sha256
      AND jsonb_array_length(first_job.manifest->'retention'->'entries') BETWEEN 1 AND 100
      AND first_job.manifest->'retention'->'entries'=second_job.manifest->'retention'->'entries') IS NOT TRUE THEN
    RAISE EXCEPTION 'gateway_archive_protection_invalid';
  END IF;
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END $$;
CREATE FUNCTION gateway_archive.fence_protected_jobs() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  UPDATE gateway_archive.job SET recovery_protection_id=NEW.id WHERE id IN (NEW.first_archive_id,NEW.second_archive_id);
  RETURN NEW;
END $$;
CREATE FUNCTION gateway_archive.guard_protected_job() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'gateway_archive_protection_immutable'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.recovery_protection_id IS NOT NULL THEN RAISE EXCEPTION 'gateway_archive_protection_invalid'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.recovery_protection_id IS NOT NULL THEN
    IF TG_OP='DELETE' OR NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'gateway_archive_protection_immutable'; END IF;
  ELSIF TG_OP='UPDATE' AND NEW.recovery_protection_id IS NOT NULL THEN
    IF (to_jsonb(NEW)-'recovery_protection_id') IS DISTINCT FROM (to_jsonb(OLD)-'recovery_protection_id')
        OR NOT EXISTS(SELECT 1 FROM gateway_archive.protection p WHERE p.id=NEW.recovery_protection_id
          AND OLD.id IN (p.first_archive_id,p.second_archive_id) AND OLD.status='verified') THEN
      RAISE EXCEPTION 'gateway_archive_protection_invalid';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER archive_protection_guard BEFORE INSERT OR UPDATE OR DELETE ON gateway_archive.protection
  FOR EACH ROW EXECUTE FUNCTION gateway_archive.guard_protection();
CREATE TRIGGER archive_protection_truncate_guard BEFORE TRUNCATE ON gateway_archive.protection
  FOR EACH STATEMENT EXECUTE FUNCTION gateway_archive.guard_protection();
CREATE TRIGGER archive_protection_fence AFTER INSERT ON gateway_archive.protection
  FOR EACH ROW EXECUTE FUNCTION gateway_archive.fence_protected_jobs();
CREATE TRIGGER archive_job_protection_guard BEFORE INSERT OR UPDATE OR DELETE ON gateway_archive.job
  FOR EACH ROW EXECUTE FUNCTION gateway_archive.guard_protected_job();
CREATE TRIGGER archive_job_truncate_guard BEFORE TRUNCATE ON gateway_archive.job
  FOR EACH STATEMENT EXECUTE FUNCTION gateway_archive.guard_protected_job();
REVOKE ALL ON FUNCTION gateway_archive.guard_protection(),gateway_archive.fence_protected_jobs(),
  gateway_archive.guard_protected_job() FROM PUBLIC;
COMMIT;
