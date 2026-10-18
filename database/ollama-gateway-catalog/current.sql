-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Optional retention registry. Explicit installation only, with maintenance stopped.
BEGIN;
DO $$ BEGIN
  IF NOT pg_try_advisory_xact_lock(11435,2) OR NOT pg_try_advisory_xact_lock(11435,4)
      OR to_regclass('gateway_archive.protection') IS NULL
      OR EXISTS(SELECT 1 FROM gateway_archive.job WHERE status='retiring') THEN
    RAISE EXCEPTION 'gateway_catalog_install_blocked';
  END IF;
END $$;
CREATE SCHEMA gateway_catalog;
REVOKE ALL ON SCHEMA gateway_catalog FROM PUBLIC;
CREATE TABLE gateway_catalog.snapshot (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK ((uuid_extract_version(id)=7) IS TRUE),
  archive_id uuid NOT NULL UNIQUE CHECK ((uuid_extract_version(archive_id)=7) IS TRUE),
  ledger_id uuid NOT NULL CHECK ((uuid_extract_version(ledger_id)=7) IS TRUE),
  provider_hash text NOT NULL CHECK (provider_hash ~ '^[a-f0-9]{64}$'),
  policy_hash text NOT NULL CHECK (policy_hash ~ '^[a-f0-9]{64}$'),
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  manifest jsonb NOT NULL CHECK (octet_length(manifest::text)<=65536),
  verification jsonb NOT NULL CHECK (octet_length(verification::text)<=4096),
  dependency_count integer NOT NULL CHECK (dependency_count BETWEEN 0 AND 40000),
  status text NOT NULL DEFAULT 'retained' CHECK (status IN ('retained','retiring','retired')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  retired_at timestamptz,
  registration_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
  CHECK ((status='retired')=(retired_at IS NOT NULL))
);
CREATE UNIQUE INDEX catalog_one_retiring ON gateway_catalog.snapshot ((true)) WHERE status='retiring';
CREATE TABLE gateway_catalog.dependency (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK ((uuid_extract_version(id)=7) IS TRUE),
  snapshot_id uuid NOT NULL REFERENCES gateway_catalog.snapshot(id),
  archive_id uuid NOT NULL REFERENCES gateway_archive.job(id),
  kind text NOT NULL CHECK (kind IN ('dump','manifest','receipt','protection')),
  bytes bigint NOT NULL CHECK (bytes BETWEEN 1 AND 268435456),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  UNIQUE(snapshot_id,archive_id,kind)
);
CREATE INDEX catalog_dependency_archive ON gateway_catalog.dependency(archive_id,snapshot_id);
REVOKE ALL ON ALL TABLES IN SCHEMA gateway_catalog FROM PUBLIC;

CREATE FUNCTION gateway_catalog.require_lock() RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()
      AND classid=11435 AND objid=4 AND objsubid=2 AND granted) THEN
    RAISE EXCEPTION 'gateway_catalog_lock_required' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('synchronous_commit','on',true);
END $$;
CREATE FUNCTION gateway_catalog.guard_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  PERFORM gateway_catalog.require_lock();
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'retained' OR (SELECT count(*) FROM gateway_catalog.snapshot)>=10000
        OR (SELECT COALESCE(sum(dependency_count),0) FROM gateway_catalog.snapshot)+NEW.dependency_count>120000
        OR (SELECT count(*) FROM gateway_catalog.snapshot WHERE status<>'retired')>=3
        OR EXISTS(SELECT 1 FROM gateway_catalog.snapshot WHERE status='retiring'
          OR ledger_id<>NEW.ledger_id OR provider_hash<>NEW.provider_hash OR policy_hash<>NEW.policy_hash)
        OR NEW.manifest->>'version' IS DISTINCT FROM '5'
        OR NEW.manifest->>'archiveId' IS DISTINCT FROM NEW.archive_id::text
        OR NEW.manifest->'report'->>'ledgerId' IS DISTINCT FROM NEW.ledger_id::text
        OR NEW.manifest->'report'->>'providerHash' IS DISTINCT FROM NEW.provider_hash
        OR NEW.manifest->>'policyHash' IS DISTINCT FROM NEW.policy_hash
        OR NEW.manifest->'catalog'->'dependencies'->>'count' IS DISTINCT FROM NEW.dependency_count::text
        OR NEW.verification->>'manifestSha256' IS DISTINCT FROM NEW.manifest_sha256
        OR NEW.verification->>'archiveId' IS DISTINCT FROM NEW.archive_id::text
        OR NEW.verification->>'kind' IS DISTINCT FROM 'catalog_verification'
        OR NEW.verification->>'version' IS DISTINCT FROM '1'
        OR NEW.verification->>'dumpSha256' IS DISTINCT FROM NEW.manifest->'dump'->>'sha256'
        OR NEW.verification->>'rowsRestored' IS DISTINCT FROM 'true'
        OR NEW.verification->>'dependenciesAvailable' IS DISTINCT FROM 'true'
        OR NEW.verification->>'runtimeEnabled' IS DISTINCT FROM 'false'
        OR NEW.verification->>'purgeAuthorized' IS DISTINCT FROM 'false' THEN
      RAISE EXCEPTION 'gateway_catalog_registration_invalid';
    END IF;
    NEW.created_at := clock_timestamp(); NEW.registration_xid := pg_current_xact_id(); RETURN NEW;
  END IF;
  IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'gateway_catalog_history_immutable'; END IF;
  IF (to_jsonb(NEW)-'status'-'retired_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'retired_at')
      OR NOT (OLD.status='retained' AND NEW.status='retiring' OR OLD.status='retiring' AND NEW.status='retired')
      OR (SELECT count(*) FROM gateway_catalog.snapshot s WHERE s.status='retained'
        AND s.ledger_id=OLD.ledger_id AND s.provider_hash=OLD.provider_hash AND s.policy_hash=OLD.policy_hash
        AND (s.manifest->'report'->>'capturedAt')::timestamptz>=(OLD.manifest->'report'->>'capturedAt')::timestamptz
        AND (s.manifest->'report'->>'attempts')::bigint>=(OLD.manifest->'report'->>'attempts')::bigint
        AND (s.created_at,s.id)>(OLD.created_at,OLD.id))<2 THEN
    RAISE EXCEPTION 'gateway_catalog_rotation_blocked';
  END IF;
  NEW.retired_at := CASE WHEN NEW.status='retired' THEN clock_timestamp() ELSE NULL END;
  RETURN NEW;
END $$;
CREATE FUNCTION gateway_catalog.guard_dependency() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  PERFORM gateway_catalog.require_lock();
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'gateway_catalog_history_immutable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM gateway_catalog.snapshot s JOIN gateway_archive.job j ON j.id=NEW.archive_id
      WHERE s.id=NEW.snapshot_id AND s.registration_xid=pg_current_xact_id() AND s.status='retained'
        AND j.status='verified' AND j.manifest->>'version' IN ('3','4')
        AND j.ledger_id=s.ledger_id AND j.provider_hash=s.provider_hash
        AND (NEW.kind<>'manifest' OR NEW.sha256=j.manifest_sha256)) THEN
    RAISE EXCEPTION 'gateway_catalog_dependency';
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION gateway_catalog.check_complete() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF (SELECT count(*) FROM gateway_catalog.dependency WHERE snapshot_id=NEW.id)<>NEW.dependency_count THEN
    RAISE EXCEPTION 'gateway_catalog_registration_incomplete';
  END IF;
  RETURN NULL;
END $$;
CREATE FUNCTION gateway_catalog.guard_inference_archive() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  PERFORM gateway_catalog.require_lock();
  IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'gateway_catalog_dependency'; END IF;
  IF EXISTS(SELECT 1 FROM gateway_catalog.dependency d JOIN gateway_catalog.snapshot s ON s.id=d.snapshot_id
      WHERE d.archive_id=OLD.id AND s.status IN ('retained','retiring'))
      AND (TG_OP='DELETE' OR NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'gateway_catalog_dependency';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER catalog_snapshot_guard BEFORE INSERT OR UPDATE OR DELETE ON gateway_catalog.snapshot
  FOR EACH ROW EXECUTE FUNCTION gateway_catalog.guard_snapshot();
CREATE TRIGGER catalog_snapshot_truncate BEFORE TRUNCATE ON gateway_catalog.snapshot
  FOR EACH STATEMENT EXECUTE FUNCTION gateway_catalog.guard_snapshot();
CREATE CONSTRAINT TRIGGER catalog_snapshot_complete AFTER INSERT ON gateway_catalog.snapshot
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION gateway_catalog.check_complete();
CREATE TRIGGER catalog_dependency_guard BEFORE INSERT OR UPDATE OR DELETE ON gateway_catalog.dependency
  FOR EACH ROW EXECUTE FUNCTION gateway_catalog.guard_dependency();
CREATE TRIGGER catalog_dependency_truncate BEFORE TRUNCATE ON gateway_catalog.dependency
  FOR EACH STATEMENT EXECUTE FUNCTION gateway_catalog.guard_dependency();
CREATE TRIGGER archive_catalog_guard BEFORE UPDATE OR DELETE ON gateway_archive.job
  FOR EACH ROW EXECUTE FUNCTION gateway_catalog.guard_inference_archive();
CREATE TRIGGER archive_catalog_truncate BEFORE TRUNCATE ON gateway_archive.job
  FOR EACH STATEMENT EXECUTE FUNCTION gateway_catalog.guard_inference_archive();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gateway_catalog FROM PUBLIC;
COMMIT;
-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Optional catalog v2. Stop maintenance workers before applying; no application auto-migration.
BEGIN;
DO $$ BEGIN
  IF NOT pg_try_advisory_xact_lock(11435,2) OR NOT pg_try_advisory_xact_lock(11435,4)
    OR EXISTS(SELECT 1 FROM gateway_archive.job WHERE status IN ('exporting','awaiting_verification','interrupted','retiring')) THEN
    RAISE EXCEPTION 'gateway_catalog_upgrade_blocked';
  END IF;
END $$;
CREATE TABLE gateway_catalog.job (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK ((uuid_extract_version(id)=7) IS TRUE),
  ledger_id uuid NOT NULL CHECK ((uuid_extract_version(ledger_id)=7) IS TRUE),
  provider_hash text NOT NULL CHECK (provider_hash ~ '^[a-f0-9]{64}$'),
  policy_hash text NOT NULL CHECK (policy_hash ~ '^[a-f0-9]{64}$'),
  revision text NOT NULL CHECK (revision ~ '^[a-f0-9]{64}$'),
  compatible_revisions text[] NOT NULL CHECK (cardinality(compatible_revisions) BETWEEN 1 AND 128),
  semantic_sha256 text NOT NULL CHECK (semantic_sha256 ~ '^[a-f0-9]{64}$'),
  attempt integer NOT NULL CHECK (attempt BETWEEN 1 AND 3),
  status text NOT NULL CHECK (status IN ('exporting','awaiting_verification','verified','failed','interrupted')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  retry_after timestamptz,
  manifest_sha256 text CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  manifest jsonb CHECK (octet_length(manifest::text)<=65536),
  receipt jsonb CHECK (octet_length(receipt::text)<=4096),
  reason text CHECK (reason IN ('export_failed','export_interrupted','source_changed','verification_failed','cancelled')),
  CHECK ((manifest IS NULL)=(manifest_sha256 IS NULL)),
  CHECK (status NOT IN ('awaiting_verification','verified') OR manifest IS NOT NULL),
  CHECK (status<>'verified' OR receipt IS NOT NULL),
  UNIQUE(ledger_id,provider_hash,revision,attempt)
);
CREATE UNIQUE INDEX catalog_one_pending ON gateway_catalog.job ((true))
  WHERE status IN ('exporting','awaiting_verification','interrupted');
REVOKE ALL ON gateway_catalog.job FROM PUBLIC;

CREATE FUNCTION gateway_catalog.guard_job() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE used integer;
BEGIN
  PERFORM gateway_catalog.require_lock();
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'exporting' OR NEW.manifest IS NOT NULL OR NEW.receipt IS NOT NULL
      OR NEW.completed_at IS NOT NULL OR NEW.retry_after IS NOT NULL OR NEW.reason IS NOT NULL
      OR NOT (NEW.revision=ANY(NEW.compatible_revisions))
      OR EXISTS(SELECT 1 FROM unnest(NEW.compatible_revisions) r WHERE r IS NULL OR r !~ '^[a-f0-9]{64}$')
      OR (SELECT count(*) FROM gateway_catalog.job)>=10000
      OR EXISTS(SELECT 1 FROM gateway_archive.job WHERE status IN ('exporting','awaiting_verification','interrupted','retiring'))
      OR EXISTS(SELECT 1 FROM gateway_catalog.job WHERE status IN ('exporting','awaiting_verification','interrupted'))
      OR EXISTS(SELECT 1 FROM gateway_catalog.job WHERE ledger_id<>NEW.ledger_id OR provider_hash<>NEW.provider_hash OR policy_hash<>NEW.policy_hash)
      OR EXISTS(SELECT 1 FROM gateway_archive.job WHERE ledger_id<>NEW.ledger_id OR provider_hash<>NEW.provider_hash OR policy_hash<>NEW.policy_hash)
      OR EXISTS(SELECT 1 FROM gateway_archive.job WHERE id=NEW.id) THEN
      RAISE EXCEPTION 'gateway_catalog_admission_blocked';
    END IF;
    SELECT greatest(count(*)::int,coalesce(max(attempt),0)) INTO used FROM (
      SELECT attempt,retry_after FROM gateway_archive.job WHERE revision=ANY(NEW.compatible_revisions)
      UNION ALL SELECT attempt,retry_after FROM gateway_catalog.job
        WHERE compatible_revisions && NEW.compatible_revisions
    ) prior;
    IF NEW.attempt<>used+1 OR used>=3 OR EXISTS(
      SELECT 1 FROM gateway_archive.job WHERE revision=ANY(NEW.compatible_revisions) AND retry_after>clock_timestamp()
      UNION ALL SELECT 1 FROM gateway_catalog.job WHERE compatible_revisions && NEW.compatible_revisions AND retry_after>clock_timestamp()
    ) THEN RAISE EXCEPTION 'gateway_catalog_budget_blocked'; END IF;
    NEW.created_at:=clock_timestamp(); RETURN NEW;
  END IF;
  IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'gateway_catalog_history_immutable'; END IF;
  IF (to_jsonb(NEW)-'status'-'manifest_sha256'-'manifest'-'receipt'-'completed_at'-'retry_after'-'reason')
    IS DISTINCT FROM (to_jsonb(OLD)-'status'-'manifest_sha256'-'manifest'-'receipt'-'completed_at'-'retry_after'-'reason') THEN
    RAISE EXCEPTION 'gateway_catalog_job_fence';
  END IF;
  IF OLD.status='exporting' AND NEW.status='awaiting_verification' THEN
    IF NEW.manifest->>'version' IS DISTINCT FROM '6' OR NEW.manifest->>'archiveId' IS DISTINCT FROM OLD.id::text
      OR NEW.manifest->>'revision' IS DISTINCT FROM OLD.revision
      OR NEW.manifest->>'policyHash' IS DISTINCT FROM OLD.policy_hash OR NEW.manifest->'report'->>'ledgerId' IS DISTINCT FROM OLD.ledger_id::text
      OR NEW.manifest->'report'->>'providerHash' IS DISTINCT FROM OLD.provider_hash
      OR NEW.manifest->'catalog'->>'semanticSha256' IS DISTINCT FROM OLD.semantic_sha256
      OR NEW.receipt IS NOT NULL OR NEW.completed_at IS NOT NULL OR NEW.retry_after IS NOT NULL OR NEW.reason IS NOT NULL THEN
      RAISE EXCEPTION 'gateway_catalog_job_fence';
    END IF;
  ELSIF OLD.status='awaiting_verification' AND NEW.status='verified' THEN
    IF NOT EXISTS(SELECT 1 FROM gateway_catalog.snapshot s WHERE s.archive_id=OLD.id AND s.status='retained'
      AND s.manifest_sha256=OLD.manifest_sha256 AND s.verification=NEW.receipt)
      OR NEW.manifest IS DISTINCT FROM OLD.manifest OR NEW.manifest_sha256 IS DISTINCT FROM OLD.manifest_sha256
      OR NEW.retry_after IS NOT NULL OR NEW.reason IS NOT NULL THEN RAISE EXCEPTION 'gateway_catalog_job_fence'; END IF;
    NEW.completed_at:=clock_timestamp();
  ELSIF OLD.status IN ('exporting','awaiting_verification') AND NEW.status='failed' THEN
    IF NEW.reason IS NULL OR NEW.reason NOT IN ('export_failed','source_changed','verification_failed','cancelled')
      OR EXISTS(SELECT 1 FROM gateway_catalog.snapshot WHERE archive_id=OLD.id)
      OR NEW.manifest IS DISTINCT FROM OLD.manifest OR NEW.manifest_sha256 IS DISTINCT FROM OLD.manifest_sha256
      OR NEW.receipt IS NOT NULL THEN RAISE EXCEPTION 'gateway_catalog_job_fence'; END IF;
    NEW.completed_at:=clock_timestamp();
    NEW.retry_after:=clock_timestamp()+CASE WHEN OLD.attempt=1 THEN interval '5 minutes' ELSE interval '30 minutes' END;
  ELSIF OLD.status='exporting' AND NEW.status='interrupted' THEN
    IF NEW.manifest IS DISTINCT FROM OLD.manifest OR NEW.manifest_sha256 IS DISTINCT FROM OLD.manifest_sha256
      OR NEW.receipt IS NOT NULL OR NEW.completed_at IS NOT NULL OR NEW.retry_after IS NOT NULL
      OR NEW.reason IS DISTINCT FROM 'export_interrupted' THEN RAISE EXCEPTION 'gateway_catalog_job_fence'; END IF;
  ELSE RAISE EXCEPTION 'gateway_catalog_job_fence';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER catalog_job_guard BEFORE INSERT OR UPDATE OR DELETE ON gateway_catalog.job
  FOR EACH ROW EXECUTE FUNCTION gateway_catalog.guard_job();
CREATE TRIGGER catalog_job_truncate BEFORE TRUNCATE ON gateway_catalog.job
  FOR EACH STATEMENT EXECUTE FUNCTION gateway_catalog.guard_job();

CREATE OR REPLACE FUNCTION gateway_catalog.guard_inference_archive() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  PERFORM gateway_catalog.require_lock();
  IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'gateway_catalog_dependency'; END IF;
  IF EXISTS(SELECT 1 FROM gateway_catalog.job WHERE status IN ('exporting','awaiting_verification','interrupted')) THEN
    RAISE EXCEPTION 'gateway_catalog_capture_pending';
  END IF;
  IF TG_OP='INSERT' THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM gateway_catalog.dependency d JOIN gateway_catalog.snapshot s ON s.id=d.snapshot_id
    WHERE d.archive_id=OLD.id AND s.status IN ('retained','retiring')) AND (TG_OP='DELETE' OR NEW IS DISTINCT FROM OLD) THEN
    -- Existing archive protection triggers independently verify the complete promotion.
    IF TG_OP<>'UPDATE' OR OLD.status<>'verified' OR OLD.recovery_protection_id IS NOT NULL OR NEW.recovery_protection_id IS NULL
      OR (to_jsonb(NEW)-'recovery_protection_id') IS DISTINCT FROM (to_jsonb(OLD)-'recovery_protection_id')
      OR NOT EXISTS(SELECT 1 FROM gateway_archive.protection p WHERE p.id=NEW.recovery_protection_id
        AND OLD.id IN (p.first_archive_id,p.second_archive_id)) THEN RAISE EXCEPTION 'gateway_catalog_dependency'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER archive_catalog_admission BEFORE INSERT ON gateway_archive.job
  FOR EACH ROW EXECUTE FUNCTION gateway_catalog.guard_inference_archive();
CREATE OR REPLACE FUNCTION gateway_catalog.guard_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  PERFORM gateway_catalog.require_lock();
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'retained' OR (SELECT count(*) FROM gateway_catalog.snapshot)>=10000
        OR (SELECT COALESCE(sum(dependency_count),0) FROM gateway_catalog.snapshot)+NEW.dependency_count>120000
        OR (SELECT count(*) FROM gateway_catalog.snapshot WHERE status<>'retired')>=3
        OR EXISTS(SELECT 1 FROM gateway_catalog.snapshot WHERE status='retiring'
          OR ledger_id<>NEW.ledger_id OR provider_hash<>NEW.provider_hash OR policy_hash<>NEW.policy_hash)
        OR (NEW.manifest->>'version' IN ('5','6')) IS NOT TRUE
        OR NEW.manifest->>'archiveId' IS DISTINCT FROM NEW.archive_id::text
        OR NEW.manifest->'report'->>'ledgerId' IS DISTINCT FROM NEW.ledger_id::text
        OR NEW.manifest->'report'->>'providerHash' IS DISTINCT FROM NEW.provider_hash
        OR NEW.manifest->>'policyHash' IS DISTINCT FROM NEW.policy_hash
        OR NEW.manifest->'catalog'->'dependencies'->>'count' IS DISTINCT FROM NEW.dependency_count::text
        OR NEW.verification->>'manifestSha256' IS DISTINCT FROM NEW.manifest_sha256
        OR NEW.verification->>'archiveId' IS DISTINCT FROM NEW.archive_id::text
        OR NEW.verification->>'kind' IS DISTINCT FROM 'catalog_verification'
        OR NEW.verification->>'version' IS DISTINCT FROM '1'
        OR NEW.verification->>'dumpSha256' IS DISTINCT FROM NEW.manifest->'dump'->>'sha256'
        OR NEW.verification->>'rowsRestored' IS DISTINCT FROM 'true'
        OR NEW.verification->>'dependenciesAvailable' IS DISTINCT FROM 'true'
        OR NEW.verification->>'runtimeEnabled' IS DISTINCT FROM 'false'
        OR NEW.verification->>'purgeAuthorized' IS DISTINCT FROM 'false' THEN
      RAISE EXCEPTION 'gateway_catalog_registration_invalid';
    END IF;
    NEW.created_at := clock_timestamp(); NEW.registration_xid := pg_current_xact_id(); RETURN NEW;
  END IF;
  IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'gateway_catalog_history_immutable'; END IF;
  IF (to_jsonb(NEW)-'status'-'retired_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'retired_at')
      OR NOT (OLD.status='retained' AND NEW.status='retiring' OR OLD.status='retiring' AND NEW.status='retired')
      OR (SELECT count(*) FROM gateway_catalog.snapshot s WHERE s.status='retained'
        AND s.ledger_id=OLD.ledger_id AND s.provider_hash=OLD.provider_hash AND s.policy_hash=OLD.policy_hash
        AND (s.manifest->'report'->>'capturedAt')::timestamptz>=(OLD.manifest->'report'->>'capturedAt')::timestamptz
        AND (s.manifest->'report'->>'attempts')::bigint>=(OLD.manifest->'report'->>'attempts')::bigint
        AND (s.created_at,s.id)>(OLD.created_at,OLD.id))<2 THEN
    RAISE EXCEPTION 'gateway_catalog_rotation_blocked';
  END IF;
  NEW.retired_at := CASE WHEN NEW.status='retired' THEN clock_timestamp() ELSE NULL END;
  RETURN NEW;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gateway_catalog FROM PUBLIC;
COMMIT;
-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Optional catalog v3. Stop maintenance before this explicit upgrade; never auto-apply to app databases.
BEGIN;
DO $$ BEGIN
  IF NOT pg_try_advisory_xact_lock(11435,2) OR NOT pg_try_advisory_xact_lock(11435,4)
    OR EXISTS(SELECT 1 FROM gateway_catalog.job WHERE status IN ('exporting','awaiting_verification','interrupted'))
    OR EXISTS(SELECT 1 FROM gateway_archive.job WHERE status IN ('exporting','awaiting_verification','interrupted','retiring')) THEN
    RAISE EXCEPTION 'gateway_catalog_upgrade_blocked';
  END IF;
END $$;
CREATE FUNCTION gateway_catalog.capture_format() RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT 3 $$;
REVOKE ALL ON FUNCTION gateway_catalog.capture_format() FROM PUBLIC;
CREATE OR REPLACE FUNCTION gateway_catalog.guard_job() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog SET timezone='UTC' AS $$
DECLARE used integer;
BEGIN
  PERFORM gateway_catalog.require_lock();
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'exporting' OR NEW.manifest IS NOT NULL OR NEW.receipt IS NOT NULL
      OR NEW.completed_at IS NOT NULL OR NEW.retry_after IS NOT NULL OR NEW.reason IS NOT NULL
      OR NOT (NEW.revision=ANY(NEW.compatible_revisions))
      OR EXISTS(SELECT 1 FROM unnest(NEW.compatible_revisions) r WHERE r IS NULL OR r !~ '^[a-f0-9]{64}$')
      OR (SELECT count(*) FROM gateway_catalog.job)>=10000
      OR EXISTS(SELECT 1 FROM gateway_archive.job WHERE status IN ('exporting','awaiting_verification','interrupted','retiring'))
      OR EXISTS(SELECT 1 FROM gateway_catalog.job WHERE status IN ('exporting','awaiting_verification','interrupted'))
      OR EXISTS(SELECT 1 FROM gateway_catalog.job WHERE ledger_id<>NEW.ledger_id OR provider_hash<>NEW.provider_hash OR policy_hash<>NEW.policy_hash)
      OR EXISTS(SELECT 1 FROM gateway_archive.job WHERE ledger_id<>NEW.ledger_id OR provider_hash<>NEW.provider_hash OR policy_hash<>NEW.policy_hash)
      OR EXISTS(SELECT 1 FROM gateway_archive.job WHERE id=NEW.id) THEN
      RAISE EXCEPTION 'gateway_catalog_admission_blocked';
    END IF;
    SELECT greatest(count(*)::int,coalesce(max(attempt),0)) INTO used FROM (
      SELECT attempt,retry_after FROM gateway_archive.job WHERE revision=ANY(NEW.compatible_revisions)
      UNION ALL SELECT attempt,retry_after FROM gateway_catalog.job
        WHERE compatible_revisions && NEW.compatible_revisions
    ) prior;
    IF NEW.attempt<>used+1 OR used>=3 OR EXISTS(
      SELECT 1 FROM gateway_archive.job WHERE revision=ANY(NEW.compatible_revisions) AND retry_after>clock_timestamp()
      UNION ALL SELECT 1 FROM gateway_catalog.job WHERE compatible_revisions && NEW.compatible_revisions AND retry_after>clock_timestamp()
    ) THEN RAISE EXCEPTION 'gateway_catalog_budget_blocked'; END IF;
    NEW.created_at:=clock_timestamp(); RETURN NEW;
  END IF;
  IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'gateway_catalog_history_immutable'; END IF;
  IF (to_jsonb(NEW)-'status'-'manifest_sha256'-'manifest'-'receipt'-'completed_at'-'retry_after'-'reason')
    IS DISTINCT FROM (to_jsonb(OLD)-'status'-'manifest_sha256'-'manifest'-'receipt'-'completed_at'-'retry_after'-'reason') THEN
    RAISE EXCEPTION 'gateway_catalog_job_fence';
  END IF;
  IF OLD.status='exporting' AND NEW.status='awaiting_verification' THEN
    IF (NEW.manifest->>'version' IN ('6','7')) IS NOT TRUE OR NEW.manifest->>'archiveId' IS DISTINCT FROM OLD.id::text
      OR NEW.manifest->'catalog'->>'version' IS DISTINCT FROM (CASE NEW.manifest->>'version' WHEN '6' THEN '2' ELSE '3' END)
      OR NEW.manifest->>'revision' IS DISTINCT FROM OLD.revision
      OR NEW.manifest->>'policyHash' IS DISTINCT FROM OLD.policy_hash OR NEW.manifest->'report'->>'ledgerId' IS DISTINCT FROM OLD.ledger_id::text
      OR NEW.manifest->'report'->>'providerHash' IS DISTINCT FROM OLD.provider_hash
      OR NEW.manifest->'catalog'->>'semanticSha256' IS DISTINCT FROM OLD.semantic_sha256
      OR NEW.manifest->>'version'='7' AND (
        NEW.manifest->'catalog'->>'version' IS DISTINCT FROM '3'
        OR NEW.manifest->'catalog'->'admission'->>'version' IS DISTINCT FROM '1'
        OR octet_length(NEW.manifest->'catalog'->'admission'->>'row')>16384
        OR (NEW.manifest->'catalog'->'admission'->>'row')::jsonb IS DISTINCT FROM to_jsonb(OLD)
        OR NEW.manifest->'catalog'->'admission'->>'sha256' IS DISTINCT FROM
          encode(sha256(convert_to(NEW.manifest->'catalog'->'admission'->>'row','UTF8')),'hex'))
      OR NEW.receipt IS NOT NULL OR NEW.completed_at IS NOT NULL OR NEW.retry_after IS NOT NULL OR NEW.reason IS NOT NULL THEN
      RAISE EXCEPTION 'gateway_catalog_job_fence';
    END IF;
  ELSIF OLD.status='awaiting_verification' AND NEW.status='verified' THEN
    IF NOT EXISTS(SELECT 1 FROM gateway_catalog.snapshot s WHERE s.archive_id=OLD.id AND s.status='retained'
      AND s.manifest_sha256=OLD.manifest_sha256 AND s.verification=NEW.receipt)
      OR NEW.manifest IS DISTINCT FROM OLD.manifest OR NEW.manifest_sha256 IS DISTINCT FROM OLD.manifest_sha256
      OR NEW.retry_after IS NOT NULL OR NEW.reason IS NOT NULL THEN RAISE EXCEPTION 'gateway_catalog_job_fence'; END IF;
    NEW.completed_at:=clock_timestamp();
  ELSIF OLD.status IN ('exporting','awaiting_verification') AND NEW.status='failed' THEN
    IF NEW.reason IS NULL OR NEW.reason NOT IN ('export_failed','source_changed','verification_failed','cancelled')
      OR EXISTS(SELECT 1 FROM gateway_catalog.snapshot WHERE archive_id=OLD.id)
      OR NEW.manifest IS DISTINCT FROM OLD.manifest OR NEW.manifest_sha256 IS DISTINCT FROM OLD.manifest_sha256
      OR NEW.receipt IS NOT NULL THEN RAISE EXCEPTION 'gateway_catalog_job_fence'; END IF;
    NEW.completed_at:=clock_timestamp();
    NEW.retry_after:=clock_timestamp()+CASE WHEN OLD.attempt=1 THEN interval '5 minutes' ELSE interval '30 minutes' END;
  ELSIF OLD.status='exporting' AND NEW.status='interrupted' THEN
    IF NEW.manifest IS DISTINCT FROM OLD.manifest OR NEW.manifest_sha256 IS DISTINCT FROM OLD.manifest_sha256
      OR NEW.receipt IS NOT NULL OR NEW.completed_at IS NOT NULL OR NEW.retry_after IS NOT NULL
      OR NEW.reason IS DISTINCT FROM 'export_interrupted' THEN RAISE EXCEPTION 'gateway_catalog_job_fence'; END IF;
  ELSE RAISE EXCEPTION 'gateway_catalog_job_fence';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION gateway_catalog.guard_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  PERFORM gateway_catalog.require_lock();
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'retained' OR (SELECT count(*) FROM gateway_catalog.snapshot)>=10000
        OR (SELECT COALESCE(sum(dependency_count),0) FROM gateway_catalog.snapshot)+NEW.dependency_count>120000
        OR (SELECT count(*) FROM gateway_catalog.snapshot WHERE status<>'retired')>=3
        OR EXISTS(SELECT 1 FROM gateway_catalog.snapshot WHERE status='retiring'
          OR ledger_id<>NEW.ledger_id OR provider_hash<>NEW.provider_hash OR policy_hash<>NEW.policy_hash)
        OR (NEW.manifest->>'version' IN ('5','6','7')) IS NOT TRUE
        OR NEW.manifest->>'archiveId' IS DISTINCT FROM NEW.archive_id::text
        OR NEW.manifest->'report'->>'ledgerId' IS DISTINCT FROM NEW.ledger_id::text
        OR NEW.manifest->'report'->>'providerHash' IS DISTINCT FROM NEW.provider_hash
        OR NEW.manifest->>'policyHash' IS DISTINCT FROM NEW.policy_hash
        OR NEW.manifest->'catalog'->'dependencies'->>'count' IS DISTINCT FROM NEW.dependency_count::text
        OR NEW.verification->>'manifestSha256' IS DISTINCT FROM NEW.manifest_sha256
        OR NEW.verification->>'archiveId' IS DISTINCT FROM NEW.archive_id::text
        OR NEW.verification->>'kind' IS DISTINCT FROM 'catalog_verification'
        OR NEW.verification->>'version' IS DISTINCT FROM '1'
        OR NEW.verification->>'dumpSha256' IS DISTINCT FROM NEW.manifest->'dump'->>'sha256'
        OR NEW.verification->>'rowsRestored' IS DISTINCT FROM 'true'
        OR NEW.verification->>'dependenciesAvailable' IS DISTINCT FROM 'true'
        OR NEW.verification->>'runtimeEnabled' IS DISTINCT FROM 'false'
        OR NEW.verification->>'purgeAuthorized' IS DISTINCT FROM 'false' THEN
      RAISE EXCEPTION 'gateway_catalog_registration_invalid';
    END IF;
    NEW.created_at := clock_timestamp(); NEW.registration_xid := pg_current_xact_id(); RETURN NEW;
  END IF;
  IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'gateway_catalog_history_immutable'; END IF;
  IF (to_jsonb(NEW)-'status'-'retired_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'retired_at')
      OR NOT (OLD.status='retained' AND NEW.status='retiring' OR OLD.status='retiring' AND NEW.status='retired')
      OR (SELECT count(*) FROM gateway_catalog.snapshot s WHERE s.status='retained'
        AND s.ledger_id=OLD.ledger_id AND s.provider_hash=OLD.provider_hash AND s.policy_hash=OLD.policy_hash
        AND (s.manifest->'report'->>'capturedAt')::timestamptz>=(OLD.manifest->'report'->>'capturedAt')::timestamptz
        AND (s.manifest->'report'->>'attempts')::bigint>=(OLD.manifest->'report'->>'attempts')::bigint
        AND (s.created_at,s.id)>(OLD.created_at,OLD.id))<2 THEN
    RAISE EXCEPTION 'gateway_catalog_rotation_blocked';
  END IF;
  NEW.retired_at := CASE WHEN NEW.status='retired' THEN clock_timestamp() ELSE NULL END;
  RETURN NEW;
END $$;
COMMIT;
