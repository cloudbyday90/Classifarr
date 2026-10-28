-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE feedback_review_references (
    id uuid PRIMARY KEY,
    actor_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    classification_id bigint NOT NULL REFERENCES classification_history(id) ON DELETE CASCADE,
    projection jsonb NOT NULL CHECK (jsonb_typeof(projection)='object' AND octet_length(projection::text)<=65536),
    created_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',CURRENT_TIMESTAMP) CHECK (isfinite(created_at)),
    expires_at timestamptz NOT NULL DEFAULT (date_trunc('milliseconds',CURRENT_TIMESTAMP)+interval '10 minutes') CHECK (isfinite(expires_at)),
    UNIQUE(actor_id,classification_id),
    CHECK (expires_at-created_at=interval '10 minutes')
);
CREATE INDEX idx_feedback_review_reference_expiry ON feedback_review_references(expires_at,id);
COMMENT ON TABLE feedback_review_references IS 'Bounded ten-minute actor-owned operational review state; never an outcome vote or portable backup data.';

ALTER TABLE policy_feedback_sources ADD COLUMN review_id uuid;
ALTER TABLE policy_feedback_sources ADD COLUMN review_actor_fingerprint text CHECK (review_actor_fingerprint ~ '^[a-f0-9]{64}$');
ALTER TABLE policy_feedback_sources ADD CONSTRAINT feedback_review_receipt_binding_check CHECK (
    (review_id IS NULL AND review_actor_fingerprint IS NULL AND
        (outcome_snapshot IS NULL OR outcome_snapshot->>'version' IS DISTINCT FROM 'classification.feedback_outcome.v3'))
    OR (review_id IS NOT NULL AND review_actor_fingerprint IS NOT NULL AND (outcome_snapshot IS NULL OR COALESCE(
        outcome_snapshot->>'version'='classification.feedback_outcome.v3'
        AND outcome_snapshot->>'classificationId'=classification_id::text AND outcome_snapshot->>'intake'=intake
        AND outcome_snapshot->'reference'->>'reviewId'=review_id::text
        AND outcome_snapshot->'reference'->>'actorFingerprint'=review_actor_fingerprint,false)))
);
CREATE OR REPLACE FUNCTION guard_feedback_source_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.classification_id IS DISTINCT FROM OLD.classification_id
        OR NEW.intake IS DISTINCT FROM OLD.intake OR NEW.request_fingerprint IS DISTINCT FROM OLD.request_fingerprint
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
        OR NEW.review_id IS DISTINCT FROM OLD.review_id
        OR NEW.review_actor_fingerprint IS DISTINCT FROM OLD.review_actor_fingerprint
        OR (NEW.feedback_id IS DISTINCT FROM OLD.feedback_id AND NEW.feedback_id IS NOT NULL)
        OR (NEW.outcome_snapshot IS DISTINCT FROM OLD.outcome_snapshot AND NEW.outcome_snapshot IS NOT NULL)
    THEN RAISE EXCEPTION 'Feedback source provenance cannot be replaced' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END;
$$;
