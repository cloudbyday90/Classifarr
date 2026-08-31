/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

-- Stores only coarse fixed-period review activity. There is deliberately no
-- policy, outcome, actor, media, library, provider, prompt, response, RAG,
-- rationale, event identifier, or event timestamp column.

CREATE TABLE IF NOT EXISTS policy_change_review_history_controls (
    control_key VARCHAR(64) PRIMARY KEY,
    record_version SMALLINT NOT NULL DEFAULT 1,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pcc_pcrh_control_key_chk CHECK (
        control_key = 'policy_change_review_history_summary'
    ),
    CONSTRAINT pcc_pcrh_control_version_chk CHECK (
        record_version = 1
    )
);

INSERT INTO policy_change_review_history_controls (control_key)
VALUES ('policy_change_review_history_summary')
ON CONFLICT (control_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS policy_change_review_history_aggregates (
    period_start DATE NOT NULL,
    decision_id VARCHAR(64) NOT NULL,
    recorded_count INTEGER NOT NULL DEFAULT 0,
    revised_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (period_start, decision_id),
    CONSTRAINT pcc_pcrh_decision_chk CHECK (
        decision_id IN (
            'retain_current_policy',
            'investigate_policy_evidence',
            'prepare_manual_policy_change'
        )
    ),
    CONSTRAINT pcc_pcrh_counts_chk CHECK (
        recorded_count >= 0
        AND revised_count >= 0
        AND recorded_count + revised_count > 0
    )
);
