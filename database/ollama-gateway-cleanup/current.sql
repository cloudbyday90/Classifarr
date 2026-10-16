-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Optional cleanup extension v1. Explicit installation only, with optional workers stopped.
BEGIN;
DO $$ BEGIN
  IF NOT pg_try_advisory_xact_lock(11435,1) OR NOT pg_try_advisory_xact_lock(11435,2)
      OR NOT pg_try_advisory_xact_lock(11435,4) OR NOT pg_try_advisory_xact_lock(11435,6)
      OR NOT EXISTS(SELECT 1 FROM ollama_gateway.admission WHERE version=7)
      OR to_regclass('gateway_archive.protection') IS NULL THEN
    RAISE EXCEPTION 'gateway_cleanup_install_blocked';
  END IF;
END $$;
CREATE ROLE classifarr_gateway_cleanup_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE SCHEMA gateway_cleanup AUTHORIZATION classifarr_gateway_cleanup_owner;
REVOKE ALL ON SCHEMA gateway_cleanup FROM PUBLIC;
-- A newer protected pair may cover the same batch after worker downtime. Cleanup attempts remain batch-scoped.
ALTER TABLE gateway_archive.protection DROP CONSTRAINT protection_ledger_id_provider_hash_candidates_sha256_key;
CREATE TABLE gateway_cleanup.operation (
  id uuid PRIMARY KEY DEFAULT uuidv7() CHECK ((uuid_extract_version(id)=7) IS TRUE),
  protection_id uuid NOT NULL UNIQUE REFERENCES gateway_archive.protection(id),
  ledger_id uuid NOT NULL CHECK ((uuid_extract_version(ledger_id)=7) IS TRUE),
  provider_hash text NOT NULL CHECK (provider_hash ~ '^[a-f0-9]{64}$'),
  candidates_sha256 text NOT NULL CHECK (candidates_sha256 ~ '^[a-f0-9]{64}$'),
  UNIQUE(ledger_id,provider_hash,candidates_sha256),
  attempt integer NOT NULL CHECK (attempt BETWEEN 1 AND 3),
  status text NOT NULL CHECK (status IN ('admitted','failed','completed')),
  last_attempt_at timestamptz NOT NULL,
  retry_after timestamptz,
  completed_at timestamptz,
  completed_xid xid8,
  confirmed_at timestamptz,
  deleted_bindings integer CHECK (deleted_bindings BETWEEN 1 AND 100),
  deleted_completions integer CHECK (deleted_completions BETWEEN 1 AND 100),
  deleted_peers integer CHECK (deleted_peers BETWEEN 0 AND 100),
  CHECK ((status='completed') = (num_nonnulls(completed_at,completed_xid,deleted_bindings,deleted_completions,deleted_peers)=5)),
  CHECK (status='completed' OR num_nonnulls(completed_at,completed_xid,deleted_bindings,deleted_completions,deleted_peers,confirmed_at)=0),
  CHECK (confirmed_at IS NULL OR confirmed_at >= completed_at)
);
ALTER TABLE gateway_cleanup.operation OWNER TO classifarr_gateway_cleanup_owner;
REVOKE ALL ON gateway_cleanup.operation FROM PUBLIC;

CREATE FUNCTION gateway_cleanup.require_worker() RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  PERFORM set_config('synchronous_commit','on',true);
  IF (SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()
      AND classid=11435 AND objid IN (4,6) AND objsubid=2 AND granted) <> 2 THEN
    RAISE EXCEPTION 'gateway_cleanup_lock_required' USING ERRCODE='42501';
  END IF;
END $$;
CREATE FUNCTION gateway_cleanup.guard_archive_write() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()
      AND classid=11435 AND objid=4 AND objsubid=2 AND granted) THEN
    RAISE EXCEPTION 'gateway_cleanup_maintenance_lock_required' USING ERRCODE='42501';
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER archive_cleanup_exclusion BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON gateway_archive.job
  FOR EACH STATEMENT EXECUTE FUNCTION gateway_cleanup.guard_archive_write();
CREATE TRIGGER protection_cleanup_exclusion BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON gateway_archive.protection
  FOR EACH STATEMENT EXECUTE FUNCTION gateway_cleanup.guard_archive_write();

CREATE FUNCTION gateway_cleanup.guard_history_delete() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF current_user <> 'classifarr_gateway_cleanup_owner' THEN
    RAISE EXCEPTION 'gateway_receipt_append_only' USING ERRCODE='42501';
  END IF;
  PERFORM gateway_cleanup.require_worker();
  RETURN NULL;
END $$;
DROP TRIGGER request_binding_append_only ON ollama_gateway.request_binding;
DROP TRIGGER completion_receipt_append_only ON ollama_gateway.completion_receipt;
DROP TRIGGER upstream_peer_observation_append_only ON ollama_gateway.upstream_peer_observation;
CREATE TRIGGER request_binding_append_only BEFORE UPDATE OR TRUNCATE ON ollama_gateway.request_binding
  FOR EACH STATEMENT EXECUTE FUNCTION ollama_gateway.reject_receipt_mutation();
CREATE TRIGGER completion_receipt_append_only BEFORE UPDATE OR TRUNCATE ON ollama_gateway.completion_receipt
  FOR EACH STATEMENT EXECUTE FUNCTION ollama_gateway.reject_receipt_mutation();
CREATE TRIGGER upstream_peer_observation_append_only BEFORE UPDATE OR TRUNCATE ON ollama_gateway.upstream_peer_observation
  FOR EACH STATEMENT EXECUTE FUNCTION ollama_gateway.reject_receipt_mutation();
CREATE TRIGGER request_binding_cleanup_delete BEFORE DELETE ON ollama_gateway.request_binding
  FOR EACH STATEMENT EXECUTE FUNCTION gateway_cleanup.guard_history_delete();
CREATE TRIGGER completion_receipt_cleanup_delete BEFORE DELETE ON ollama_gateway.completion_receipt
  FOR EACH STATEMENT EXECUTE FUNCTION gateway_cleanup.guard_history_delete();
CREATE TRIGGER upstream_peer_cleanup_delete BEFORE DELETE ON ollama_gateway.upstream_peer_observation
  FOR EACH STATEMENT EXECUTE FUNCTION gateway_cleanup.guard_history_delete();

GRANT USAGE ON SCHEMA ollama_gateway,gateway_archive TO classifarr_gateway_cleanup_owner;
GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway,gateway_archive TO classifarr_gateway_cleanup_owner;
GRANT DELETE ON ollama_gateway.request_binding,ollama_gateway.completion_receipt,ollama_gateway.upstream_peer_observation
  TO classifarr_gateway_cleanup_owner;
GRANT UPDATE(binding_count) ON ollama_gateway.admission TO classifarr_gateway_cleanup_owner;
GRANT UPDATE(id) ON ollama_gateway.request_binding TO classifarr_gateway_cleanup_owner;
-- SHARE locking lifecycle receipts requires UPDATE, but the unconditional UPDATE trigger still rejects every mutation.
GRANT UPDATE ON ollama_gateway.recovery_receipt TO classifarr_gateway_cleanup_owner;

CREATE FUNCTION gateway_cleanup.check_pair(target uuid) RETURNS gateway_archive.protection
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE hold gateway_archive.protection; newest uuid[]; first_job gateway_archive.job; second_job gateway_archive.job;
BEGIN
  PERFORM gateway_cleanup.require_worker();
  SELECT * INTO hold FROM gateway_archive.protection WHERE id=target;
  SELECT array_agg(id ORDER BY id) INTO newest FROM
    (SELECT id FROM gateway_archive.job WHERE status='verified' ORDER BY created_at DESC,id DESC LIMIT 2) recent;
  IF hold.ready_at IS NULL OR hold.minimum_recovery_days<>30
      OR newest IS DISTINCT FROM ARRAY[hold.first_archive_id,hold.second_archive_id]
      OR EXISTS(SELECT 1 FROM gateway_archive.job WHERE status IN ('exporting','awaiting_verification','interrupted','retiring')
        OR status='verified' AND recovery_protection_id IS NULL) THEN
    RAISE EXCEPTION 'gateway_cleanup_archive_boundary';
  END IF;
  SELECT * INTO first_job FROM gateway_archive.job WHERE id=hold.first_archive_id;
  SELECT * INTO second_job FROM gateway_archive.job WHERE id=hold.second_archive_id;
  IF (first_job.recovery_protection_id=hold.id AND second_job.recovery_protection_id=hold.id
      AND first_job.manifest_sha256=hold.first_manifest_sha256 AND second_job.manifest_sha256=hold.second_manifest_sha256
      AND first_job.policy_hash=second_job.policy_hash
      AND first_job.manifest->'retention'->'entries'=second_job.manifest->'retention'->'entries'
      AND jsonb_array_length(first_job.manifest->'retention'->'entries') BETWEEN 1 AND 100
      AND (first_job.manifest->'report'->>'retentionDays')::integer >= 90
      AND first_job.manifest->'report'->>'retentionDays'=second_job.manifest->'report'->>'retentionDays') IS NOT TRUE THEN
    RAISE EXCEPTION 'gateway_cleanup_archive_boundary';
  END IF;
  RETURN hold;
END $$;

CREATE FUNCTION gateway_cleanup.admit(target uuid, provider text, policy text, candidates text)
RETURNS gateway_cleanup.operation LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE hold gateway_archive.protection; op gateway_cleanup.operation;
BEGIN
  hold := gateway_cleanup.check_pair(target);
  IF hold.provider_hash IS DISTINCT FROM provider OR hold.candidates_sha256 IS DISTINCT FROM candidates
      OR NOT EXISTS(SELECT 1 FROM gateway_archive.job WHERE id=hold.first_archive_id AND policy_hash=policy)
      OR NOT EXISTS(SELECT 1 FROM ollama_gateway.admission WHERE id=hold.ledger_id AND provider_hash=provider AND binding_count>=80000) THEN
    RAISE EXCEPTION 'gateway_cleanup_identity_changed';
  END IF;
  SELECT * INTO op FROM gateway_cleanup.operation WHERE ledger_id=hold.ledger_id AND provider_hash=provider AND candidates_sha256=candidates;
  IF op.status='completed' THEN RETURN op; END IF;
  IF op.status='admitted' THEN RAISE EXCEPTION 'gateway_cleanup_unresolved'; END IF;
  IF op.attempt>=3 THEN RAISE EXCEPTION 'gateway_cleanup_attempts_exhausted'; END IF;
  IF op.retry_after>clock_timestamp() OR EXISTS(SELECT 1 FROM gateway_cleanup.operation
      WHERE last_attempt_at>clock_timestamp()-interval '5 minutes') THEN RAISE EXCEPTION 'gateway_cleanup_cooldown'; END IF;
  INSERT INTO gateway_cleanup.operation(protection_id,ledger_id,provider_hash,candidates_sha256,attempt,status,last_attempt_at)
    VALUES(target,hold.ledger_id,provider,candidates,1,'admitted',clock_timestamp())
    ON CONFLICT(ledger_id,provider_hash,candidates_sha256) DO UPDATE SET protection_id=target,attempt=gateway_cleanup.operation.attempt+1,status='admitted',
      last_attempt_at=clock_timestamp(),retry_after=NULL RETURNING * INTO op;
  RETURN op;
END $$;

CREATE FUNCTION gateway_cleanup.execute_batch(operation_id uuid, expected_attempt integer)
RETURNS gateway_cleanup.operation LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp
SET timezone='UTC' SET datestyle='ISO, YMD' AS $$
DECLARE op gateway_cleanup.operation; hold gateway_archive.protection; state ollama_gateway.admission;
  entries jsonb; actual jsonb; cutoff timestamptz; ids uuid[]; requests uuid[]; n integer; nc integer; np integer;
BEGIN
  PERFORM gateway_cleanup.require_worker();
  SELECT * INTO op FROM gateway_cleanup.operation WHERE id=operation_id FOR UPDATE NOWAIT;
  IF op.status='completed' THEN RETURN op; END IF;
  IF op.status IS DISTINCT FROM 'admitted' OR op.attempt IS DISTINCT FROM expected_attempt THEN
    RAISE EXCEPTION 'gateway_cleanup_operation_fence';
  END IF;
  hold := gateway_cleanup.check_pair(op.protection_id);
  -- Fences unlinked recovery-receipt inserts; FK-linked stop/peer/completion writes are fenced by binding row locks.
  LOCK TABLE ollama_gateway.recovery_receipt IN SHARE MODE NOWAIT;
  SELECT * INTO state FROM ollama_gateway.admission WHERE id=op.ledger_id FOR UPDATE NOWAIT;
  IF state.provider_hash IS DISTINCT FROM op.provider_hash OR state.binding_count<80000 OR state.maintenance_receipt IS NOT NULL
      OR state.active_request IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ollama_gateway.request_binding WHERE request_id=state.active_request)
      OR state.binding_count IS DISTINCT FROM (SELECT count(*)::integer FROM ollama_gateway.request_binding) THEN
    RAISE EXCEPTION 'gateway_cleanup_source_changed';
  END IF;
  SELECT manifest->'retention'->'entries',
    clock_timestamp()-make_interval(days=>GREATEST(90,(manifest->'report'->>'retentionDays')::integer))
    INTO entries,cutoff FROM gateway_archive.job WHERE id=hold.first_archive_id;
  SELECT array_agg((e->>'bindingId')::uuid),array_agg((e->>'requestId')::uuid)
    INTO ids,requests FROM jsonb_array_elements(entries) e;
  PERFORM id FROM ollama_gateway.request_binding WHERE id=ANY(ids) ORDER BY id FOR UPDATE NOWAIT;
  SELECT jsonb_agg(jsonb_build_object('bindingId',b.id,'requestId',b.request_id,'attempt',b.attempt::text,
      'rowSha256',encode(sha256(convert_to(jsonb_build_object('binding',to_jsonb(b),'completion',to_jsonb(c),'peer',to_jsonb(p))::text,'UTF8')),'hex'))
      ORDER BY b.attempt) INTO actual
    FROM ollama_gateway.request_binding b
    JOIN ollama_gateway.completion_receipt c ON c.request_id=b.request_id
    LEFT JOIN ollama_gateway.upstream_peer_observation p ON p.binding_id=b.id
    WHERE b.id=ANY(ids) AND b.ledger_id=state.id AND b.provider_hash=state.provider_hash
      AND b.request_id IS DISTINCT FROM state.active_request AND b.admitted_at<cutoff AND c.recorded_at<cutoff
      AND c.outcome IN ('response_completed','provider_rejected','not_dispatched')
      AND NOT EXISTS(SELECT 1 FROM ollama_gateway.recovery_receipt r WHERE r.request_id=b.request_id)
      AND NOT EXISTS(SELECT 1 FROM ollama_gateway.provider_stop_intent s WHERE s.binding_id=b.id);
  IF actual IS DISTINCT FROM entries THEN RAISE EXCEPTION 'gateway_cleanup_candidates_changed'; END IF;
  DELETE FROM ollama_gateway.upstream_peer_observation WHERE binding_id=ANY(ids); GET DIAGNOSTICS np=ROW_COUNT;
  DELETE FROM ollama_gateway.completion_receipt WHERE request_id=ANY(requests); GET DIAGNOSTICS nc=ROW_COUNT;
  DELETE FROM ollama_gateway.request_binding WHERE id=ANY(ids); GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>jsonb_array_length(entries) OR nc<>n THEN RAISE EXCEPTION 'gateway_cleanup_candidates_changed'; END IF;
  UPDATE ollama_gateway.admission SET binding_count=binding_count-n WHERE id=state.id;
  UPDATE gateway_cleanup.operation SET status='completed',completed_at=clock_timestamp(),completed_xid=pg_current_xact_id(),
    deleted_bindings=n,deleted_completions=nc,deleted_peers=np WHERE id=op.id RETURNING * INTO op;
  RETURN op;
END $$;

CREATE FUNCTION gateway_cleanup.reconcile(operation_id uuid) RETURNS gateway_cleanup.operation
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE op gateway_cleanup.operation;
BEGIN
  PERFORM gateway_cleanup.require_worker();
  SELECT * INTO op FROM gateway_cleanup.operation WHERE id=operation_id FOR UPDATE NOWAIT;
  IF op.status='completed' AND op.confirmed_at IS NULL THEN
    IF op.completed_xid=pg_current_xact_id() THEN RAISE EXCEPTION 'gateway_cleanup_commit_unconfirmed'; END IF;
    UPDATE gateway_cleanup.operation SET confirmed_at=GREATEST(clock_timestamp(),completed_at) WHERE id=op.id RETURNING * INTO op;
  ELSIF op.status='admitted' THEN
    UPDATE gateway_cleanup.operation SET status='failed',
      retry_after=clock_timestamp()+CASE WHEN attempt=1 THEN interval '5 minutes' ELSE interval '30 minutes' END
      WHERE id=op.id RETURNING * INTO op;
  END IF;
  RETURN op;
END $$;
ALTER FUNCTION gateway_cleanup.require_worker() OWNER TO classifarr_gateway_cleanup_owner;
ALTER FUNCTION gateway_cleanup.check_pair(uuid) OWNER TO classifarr_gateway_cleanup_owner;
ALTER FUNCTION gateway_cleanup.admit(uuid,text,text,text) OWNER TO classifarr_gateway_cleanup_owner;
ALTER FUNCTION gateway_cleanup.execute_batch(uuid,integer) OWNER TO classifarr_gateway_cleanup_owner;
ALTER FUNCTION gateway_cleanup.reconcile(uuid) OWNER TO classifarr_gateway_cleanup_owner;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gateway_cleanup FROM PUBLIC;
COMMIT;
