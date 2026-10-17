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
