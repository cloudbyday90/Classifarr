-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Nullable and prospective. Never infer historical confirmations from silence.
ALTER TABLE policy_feedback_sources ADD COLUMN IF NOT EXISTS outcome_snapshot jsonb;
ALTER TABLE policy_feedback_sources ADD CONSTRAINT policy_feedback_sources_outcome_snapshot_check
    CHECK (outcome_snapshot IS NULL OR
        (jsonb_typeof(outcome_snapshot) = 'object' AND octet_length(outcome_snapshot::text) <= 1024));
CREATE INDEX IF NOT EXISTS idx_policy_feedback_sources_outcome_retention
    ON policy_feedback_sources(created_at, classification_id) WHERE outcome_snapshot IS NOT NULL;
COMMENT ON COLUMN policy_feedback_sources.outcome_snapshot IS
    'Thirty-day explicit selection and original decision projection. Expiry clears only this field, preserving the replay tombstone; no raw content or routing authority.';

ALTER TABLE classification_intake_receipts ADD COLUMN IF NOT EXISTS decision_context jsonb;
ALTER TABLE classification_intake_receipts ADD CONSTRAINT classification_intake_receipts_decision_context_check
    CHECK (decision_context IS NULL OR
        (jsonb_typeof(decision_context) = 'object' AND octet_length(decision_context::text) <= 1024));
COMMENT ON COLUMN classification_intake_receipts.decision_context IS
    'Original saved movie/TV decision linked to classification_id; no history foreign key. Null when capture is unavailable. Same thirty-day retention as the intake receipt.';
COMMENT ON TABLE classification_intake_receipts IS
    'Thirty-day classification intake diagnostics with bounded typed decision IDs and states; no titles, names, users, request bodies, provider payloads, or routing authority.';
