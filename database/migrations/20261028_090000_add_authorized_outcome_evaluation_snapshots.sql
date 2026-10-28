-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Evaluation evidence expires independently of the immutable replay receipt.
-- No history FK and no retrospective reconstruction from mutable history.
CREATE TABLE policy_authorized_outcome_evaluation_snapshots (
    receipt_id bigint PRIMARY KEY REFERENCES policy_authorized_outcome_source_event_receipts(id) ON DELETE CASCADE,
    snapshot_version smallint NOT NULL DEFAULT 1 CHECK (snapshot_version = 1),
    event_key varchar(160) NOT NULL CHECK (length(btrim(event_key)) BETWEEN 1 AND 160),
    media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
    identity_key text NOT NULL CHECK (
        identity_key ~ '^source:[a-f0-9]{64}$'
        OR CASE WHEN identity_key ~ ('^' || media_type || ':[1-9][0-9]{0,9}$')
            THEN split_part(identity_key, ':', 2)::bigint <= 2147483647 ELSE false END
    ),
    selected_library_id integer NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    action_kind text NOT NULL CHECK (action_kind IN ('confirmation', 'correction')),
    decision_context jsonb CHECK (decision_context IS NULL OR
        (jsonb_typeof(decision_context) = 'object' AND octet_length(decision_context::text) <= 1024)),
    observed_at timestamptz NOT NULL CHECK (isfinite(observed_at))
);
CREATE INDEX idx_authorized_outcome_evaluation_observed
    ON policy_authorized_outcome_evaluation_snapshots (observed_at, receipt_id);
CREATE INDEX idx_authorized_outcome_evaluation_event
    ON policy_authorized_outcome_evaluation_snapshots (event_key);
CREATE INDEX idx_authorized_outcome_evaluation_receipts_created
    ON policy_authorized_outcome_source_event_receipts (created_at, id)
    WHERE source_id IN ('manual_classification_change', 'operator_confirmation')
      AND final_outcome_status_id IN ('resolved', 'routed');

CREATE FUNCTION guard_authorized_outcome_evaluation_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Authorized outcome evaluation snapshots cannot be updated';
END;
$$;
CREATE TRIGGER authorized_outcome_evaluation_update_guard
    BEFORE UPDATE ON policy_authorized_outcome_evaluation_snapshots
    FOR EACH ROW EXECUTE FUNCTION guard_authorized_outcome_evaluation_update();
COMMENT ON TABLE policy_authorized_outcome_evaluation_snapshots IS
    'Thirty-day private explicit-choice evidence; no actors, titles, metadata, credentials or routing/learning authority. Replay never refreshes evidence.';
