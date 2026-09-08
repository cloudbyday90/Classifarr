-- Stores only the latest aggregate, private eligibility-audit receipt for a
-- fixed durable lifecycle-receipt source. This is a resumable automation
-- cursor, not a cohort, label set, semantic result, or routing instruction.

CREATE TABLE IF NOT EXISTS held_out_semantic_study_lifecycle_reaudit_state (
    state_key TEXT PRIMARY KEY
        CHECK (state_key = 'normal_policy_lifecycle_receipts'),
    source_fingerprint CHAR(64) NOT NULL
        CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
    source_receipt JSONB NOT NULL
        CHECK (jsonb_typeof(source_receipt) = 'object'),
    attempt_count SMALLINT NOT NULL
        CHECK (attempt_count BETWEEN 1 AND 3),
    audit_status_id TEXT NOT NULL
        CHECK (audit_status_id IN (
            'candidate_source_truncated',
            'complete',
            'configuration_changed',
            'failed'
        )),
    audit_receipt JSONB NOT NULL
        CHECK (jsonb_typeof(audit_receipt) = 'object'),
    audited_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
