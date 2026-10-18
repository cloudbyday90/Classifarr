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
