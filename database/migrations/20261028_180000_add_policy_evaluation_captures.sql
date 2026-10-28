-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE classification_policy_evaluation_captures (
    classification_id bigint PRIMARY KEY REFERENCES classification_history(id) ON DELETE CASCADE,
    capture_version smallint NOT NULL DEFAULT 1 CHECK (capture_version = 1),
    media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
    identity_key text NOT NULL CHECK (
        CASE WHEN identity_key ~ ('^' || media_type || ':[1-9][0-9]{0,9}$')
            THEN split_part(identity_key, ':', 2)::bigint <= 2147483647 ELSE false END),
    observed_at timestamptz NOT NULL CHECK (isfinite(observed_at)),
    expires_at timestamptz NOT NULL CHECK (isfinite(expires_at) AND expires_at = observed_at + INTERVAL '720 hours'),
    reason_id text NOT NULL CHECK (reason_id IN ('complete', 'authoritative_bypass', 'no_active_policies',
        'no_compatible_policies', 'pool_overflow', 'payload_overflow', 'capture_invalid', 'binding_failure')),
    payload jsonb CHECK (payload IS NULL OR
        (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 65536)),
    expired_at timestamptz CHECK (expired_at IS NULL OR (isfinite(expired_at) AND expired_at >= expires_at)),
    CHECK ((reason_id = 'complete' AND ((payload IS NOT NULL AND expired_at IS NULL)
        OR (payload IS NULL AND expired_at IS NOT NULL)))
        OR (reason_id <> 'complete' AND payload IS NULL AND expired_at IS NULL))
);
CREATE INDEX idx_policy_evaluation_capture_expiry ON classification_policy_evaluation_captures (expires_at, classification_id)
    WHERE payload IS NOT NULL;
CREATE FUNCTION guard_policy_evaluation_capture_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (to_jsonb(NEW) - ARRAY['payload', 'expired_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['payload', 'expired_at'])
       OR OLD.payload IS NULL OR NEW.payload IS NOT NULL OR OLD.expired_at IS NOT NULL
       OR OLD.expires_at > statement_timestamp() OR NEW.expired_at IS NULL
       OR NEW.expired_at < OLD.expires_at OR NEW.expired_at > statement_timestamp() THEN
        RAISE EXCEPTION 'Policy evaluation captures only permit expired payload removal';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER policy_evaluation_capture_update_guard BEFORE UPDATE ON classification_policy_evaluation_captures
    FOR EACH ROW EXECUTE FUNCTION guard_policy_evaluation_capture_update();
CREATE FUNCTION guard_policy_evaluation_capture_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'TRUNCATE' THEN
        RAISE EXCEPTION 'Policy evaluation capture tombstones cannot be truncated';
    END IF;
    IF EXISTS (SELECT 1 FROM classification_history WHERE id = OLD.classification_id) THEN
        RAISE EXCEPTION 'Policy evaluation captures are removed only with their History row';
    END IF;
    RETURN OLD;
END;
$$;
CREATE TRIGGER policy_evaluation_capture_delete_guard BEFORE DELETE ON classification_policy_evaluation_captures
    FOR EACH ROW EXECUTE FUNCTION guard_policy_evaluation_capture_delete();
CREATE TRIGGER policy_evaluation_capture_truncate_guard BEFORE TRUNCATE ON classification_policy_evaluation_captures
    FOR EACH STATEMENT EXECUTE FUNCTION guard_policy_evaluation_capture_delete();
COMMENT ON TABLE classification_policy_evaluation_captures IS
    'Private first-write retained live policy evaluation; 30-day payload and expiry tombstones; History cascade, no configuration backup, routing or learning authority.';
