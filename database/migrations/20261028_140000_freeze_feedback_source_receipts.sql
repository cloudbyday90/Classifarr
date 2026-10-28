-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- No legacy reconstruction. Exact v2 identity/action binding supplements application validation.
ALTER TABLE policy_feedback_sources ADD CONSTRAINT policy_feedback_sources_selection_binding_check CHECK (
    outcome_snapshot IS NULL OR outcome_snapshot->>'version' IS DISTINCT FROM 'classification.feedback_outcome.v2'
    OR COALESCE(jsonb_typeof(outcome_snapshot->'classificationId') = 'string'
        AND outcome_snapshot->>'classificationId' = classification_id::text
        AND outcome_snapshot->>'intake' = intake AND outcome_snapshot->>'action' = 'selection', false)
);

CREATE FUNCTION guard_feedback_source_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.classification_id IS DISTINCT FROM OLD.classification_id
        OR NEW.intake IS DISTINCT FROM OLD.intake
        OR NEW.request_fingerprint IS DISTINCT FROM OLD.request_fingerprint
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
        OR (NEW.feedback_id IS DISTINCT FROM OLD.feedback_id AND NEW.feedback_id IS NOT NULL)
        OR (NEW.outcome_snapshot IS DISTINCT FROM OLD.outcome_snapshot AND NEW.outcome_snapshot IS NOT NULL)
    THEN
        RAISE EXCEPTION 'Feedback source provenance cannot be replaced' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER feedback_source_update_guard BEFORE UPDATE ON policy_feedback_sources
    FOR EACH ROW EXECUTE FUNCTION guard_feedback_source_update();
COMMENT ON COLUMN policy_feedback_sources.outcome_snapshot IS
    'Thirty-day private versioned selection evidence. v2 binds exact classification/intake and names a commit-time server shortlist; it does not prove a confirmation command or displayed reference. Clearing preserves replay protection; replacement and rehydration are prohibited.';
