-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE policy_feedback_sources (
    classification_id bigint PRIMARY KEY CHECK (classification_id > 0),
    feedback_id integer UNIQUE REFERENCES policy_feedback_log(id) ON DELETE SET NULL,
    intake varchar(20) NOT NULL CHECK (intake IN ('standalone', 'prompt')),
    request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE policy_feedback_sources IS
    'One feedback receipt per classification event; source IDs survive history retention and deleted feedback leaves a replay-blocking tombstone.';
COMMENT ON COLUMN policy_feedback_sources.classification_id IS
    'Validated against locked classification_history at intake; intentionally no cascading history foreign key. Legacy feedback is not backfilled.';
