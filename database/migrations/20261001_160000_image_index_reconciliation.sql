-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Deliberately no queue FK: pruning a task must not erase its repair budget.
CREATE TABLE image_index_reconciliation_state (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    task_id bigint CHECK (task_id > 0),
    attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
    next_attempt_at timestamptz,
    last_result varchar(64) NOT NULL DEFAULT 'unobserved'
);
