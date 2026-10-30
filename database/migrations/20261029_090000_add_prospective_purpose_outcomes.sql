-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
ALTER TABLE classification_policy_evaluation_captures
    DROP CONSTRAINT classification_policy_evaluation_captures_capture_version_check;
ALTER TABLE classification_policy_evaluation_captures
    ADD CONSTRAINT classification_policy_evaluation_captures_capture_version_check CHECK (capture_version IN (1, 2));
-- Preserve DEFAULT 1 for older writers. New writers set capture_version=2 explicitly.

CREATE TABLE policy_purpose_outcome_supplements (
    event_key text PRIMARY KEY CHECK (event_key ~ '^(runtime_resolution:[1-9][0-9]*:[A-Za-z0-9_-]{22}|classification_correction:[1-9][0-9]*|feedback_review:[1-9][0-9]*)$'),
    classification_id bigint NOT NULL REFERENCES classification_history(id) ON DELETE CASCADE,
    authorized_receipt_id bigint UNIQUE REFERENCES policy_authorized_outcome_source_event_receipts(id) ON DELETE CASCADE,
    feedback_classification_id bigint UNIQUE REFERENCES policy_feedback_sources(classification_id) ON DELETE CASCADE,
    supplement_version smallint NOT NULL DEFAULT 1 CHECK (supplement_version = 1),
    source_kind text NOT NULL CHECK (source_kind IN ('runtime', 'manual', 'history_review')),
    action_reference text NOT NULL CHECK (action_reference IN ('runtime_answer_contract', 'manual_prior_destination', 'original_automated_destination')),
    media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
    identity_key text CHECK (identity_key ~ '^source:[a-f0-9]{64}$' OR
        CASE WHEN identity_key ~ ('^' || media_type || ':[1-9][0-9]{0,9}$')
        THEN split_part(identity_key, ':', 2)::bigint <= 2147483647 ELSE false END),
    selected_library_id integer CHECK (selected_library_id > 0),
    action_kind text CHECK (action_kind IN ('confirmation', 'correction')),
    observed_at timestamptz NOT NULL CHECK (isfinite(observed_at)),
    frozen_at timestamptz NOT NULL DEFAULT transaction_timestamp() CHECK (isfinite(frozen_at) AND frozen_at >= observed_at),
    expires_at timestamptz NOT NULL CHECK (isfinite(expires_at) AND expires_at <= observed_at + INTERVAL '720 hours'),
    reason_id text NOT NULL CHECK (reason_id IN ('available', 'missing_capture', 'legacy_capture', 'expired_capture',
        'capture_gap', 'invalid_capture', 'unverified_purpose', 'no_policy_leader', 'source_only_identity', 'binding_failure', 'legacy_event')),
    payload jsonb CHECK (payload IS NULL OR (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 4096)),
    expired_at timestamptz CHECK (expired_at IS NULL OR (isfinite(expired_at) AND expired_at >= expires_at)),
    CHECK (num_nonnulls(authorized_receipt_id, feedback_classification_id) = 1),
    CHECK ((source_kind = 'history_review') = (feedback_classification_id IS NOT NULL)),
    CHECK ((source_kind = 'history_review' AND feedback_classification_id = classification_id AND
            action_reference = 'original_automated_destination' AND event_key = 'feedback_review:' || classification_id::text)
        OR (source_kind = 'manual' AND authorized_receipt_id IS NOT NULL AND
            action_reference = 'manual_prior_destination' AND event_key ~ '^classification_correction:')
        OR (source_kind = 'runtime' AND authorized_receipt_id IS NOT NULL AND
            action_reference = 'runtime_answer_contract' AND event_key LIKE 'runtime_resolution:' || classification_id::text || ':%')),
    CHECK ((expired_at IS NOT NULL AND payload IS NULL AND identity_key IS NULL AND selected_library_id IS NULL AND action_kind IS NULL) OR
        (expired_at IS NULL AND identity_key IS NOT NULL AND selected_library_id IS NOT NULL AND action_kind IS NOT NULL AND
          ((reason_id = 'available' AND payload IS NOT NULL AND expires_at > frozen_at) OR
           (reason_id <> 'available' AND payload IS NULL AND expires_at = observed_at + INTERVAL '720 hours'))))
);
CREATE INDEX idx_purpose_outcome_expiry ON policy_purpose_outcome_supplements(expires_at, event_key) WHERE expired_at IS NULL;
CREATE INDEX idx_purpose_outcome_observed ON policy_purpose_outcome_supplements(observed_at, event_key);
CREATE FUNCTION guard_purpose_outcome_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (to_jsonb(NEW) - ARRAY['payload', 'expired_at', 'identity_key', 'selected_library_id', 'action_kind']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['payload', 'expired_at', 'identity_key', 'selected_library_id', 'action_kind'])
        OR NEW.payload IS NOT NULL OR NEW.identity_key IS NOT NULL OR NEW.selected_library_id IS NOT NULL
        OR NEW.action_kind IS NOT NULL OR OLD.expired_at IS NOT NULL
        OR OLD.expires_at > statement_timestamp() OR NEW.expired_at IS NULL
        OR NEW.expired_at < OLD.expires_at OR NEW.expired_at > statement_timestamp() THEN
        RAISE EXCEPTION 'Purpose outcome evidence only permits expired payload removal';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER purpose_outcome_update_guard BEFORE UPDATE ON policy_purpose_outcome_supplements
    FOR EACH ROW EXECUTE FUNCTION guard_purpose_outcome_update();
CREATE FUNCTION guard_purpose_outcome_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'TRUNCATE' THEN RAISE EXCEPTION 'Purpose outcome tombstones cannot be truncated'; END IF;
    -- FK cascades may replace a parent in the same statement during an authorized runtime reset.
    IF pg_trigger_depth() = 1 AND EXISTS (SELECT 1 FROM classification_history WHERE id = OLD.classification_id) AND
       (EXISTS (SELECT 1 FROM policy_feedback_sources WHERE classification_id = OLD.feedback_classification_id) OR
        EXISTS (SELECT 1 FROM policy_authorized_outcome_source_event_receipts WHERE id = OLD.authorized_receipt_id)) THEN
        RAISE EXCEPTION 'Purpose outcomes are removed only with their source or History row';
    END IF;
    RETURN OLD;
END;
$$;
CREATE TRIGGER purpose_outcome_delete_guard BEFORE DELETE ON policy_purpose_outcome_supplements
    FOR EACH ROW EXECUTE FUNCTION guard_purpose_outcome_delete();
CREATE TRIGGER purpose_outcome_truncate_guard BEFORE TRUNCATE ON policy_purpose_outcome_supplements
    FOR EACH STATEMENT EXECUTE FUNCTION guard_purpose_outcome_delete();
COMMENT ON TABLE policy_purpose_outcome_supplements IS
    'Private first-write canonical-event purpose reference or commit-time gap; source-lease-bounded payload, expiry tombstones, no portable backup, routing or learning authority.';
