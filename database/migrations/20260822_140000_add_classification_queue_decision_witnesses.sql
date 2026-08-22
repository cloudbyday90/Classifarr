-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
-- SPDX-License-Identifier: GPL-3.0-or-later
--
-- Persist a bounded, versioned projection of a queued classification result.
-- This supports local evaluation without exposing a task's raw payload,
-- provider response, prompt context, routing result, or history metadata.

CREATE TABLE IF NOT EXISTS classification_queue_decision_witnesses (
    queue_task_id BIGINT NOT NULL REFERENCES task_queue(id) ON DELETE CASCADE,
    classification_id BIGINT NOT NULL REFERENCES classification_history(id) ON DELETE CASCADE,
    witness JSONB NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (queue_task_id, classification_id),
    CONSTRAINT classification_queue_decision_witnesses_fingerprint_check
        CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
    CONSTRAINT classification_queue_decision_witnesses_witness_object_check
        CHECK (jsonb_typeof(witness) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_classification_queue_decision_witnesses_queue_created
    ON classification_queue_decision_witnesses (queue_task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_classification_queue_decision_witnesses_classification
    ON classification_queue_decision_witnesses (classification_id);

COMMENT ON TABLE classification_queue_decision_witnesses IS
    'Bounded, versioned queued classification outcomes for local evaluation; contains no raw request or provider evidence.';
