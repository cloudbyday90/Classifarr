-- Stores a fixed aggregate source observation separately from an eligibility
-- audit receipt. This lets the passive gate observe an ineligible state before
-- later eligible evidence returns, without recording a fabricated audit.

CREATE TABLE IF NOT EXISTS held_out_semantic_study_lifecycle_source_checkpoint (
    state_key TEXT PRIMARY KEY
        CHECK (state_key = 'normal_policy_lifecycle_source'),
    source_fingerprint CHAR(64) NOT NULL
        CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
    source_receipt JSONB NOT NULL
        CHECK (jsonb_typeof(source_receipt) = 'object'),
    observed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
