-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Preserve lazy legacy batches while making the worker schema durable.
CREATE TABLE IF NOT EXISTS reclassification_batches (
    id SERIAL PRIMARY KEY,
    status VARCHAR(50) DEFAULT 'pending',
    total_items INTEGER DEFAULT 0,
    completed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    skipped_items INTEGER DEFAULT 0,
    paused_at_item INTEGER DEFAULT NULL,
    pause_on_error BOOLEAN DEFAULT true,
    created_by VARCHAR(100) DEFAULT 'user',
    error_message TEXT DEFAULT NULL,
    started_at TIMESTAMP DEFAULT NULL,
    completed_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS reclassification_batch_items (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER REFERENCES reclassification_batches(id) ON DELETE CASCADE,
    classification_id INTEGER NOT NULL,
    target_library_id INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    validation_result JSONB DEFAULT NULL,
    execution_result JSONB DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    execution_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE reclassification_batches
    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- NULL deliberately identifies legacy claims; do not infer safe replay.
ALTER TABLE reclassification_batch_items
    ADD COLUMN IF NOT EXISTS execution_version SMALLINT CHECK (execution_version = 1);
CREATE INDEX IF NOT EXISTS idx_batch_items_batch_id ON reclassification_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_status ON reclassification_batch_items(status);
CREATE INDEX IF NOT EXISTS idx_reclassification_batch_due
    ON reclassification_batches(next_attempt_at, id) WHERE status = 'executing';
CREATE INDEX IF NOT EXISTS idx_reclassification_batch_pending
    ON reclassification_batch_items(batch_id, execution_order, id)
    WHERE status::text = ANY (ARRAY['executing'::text, 'pending'::text, 'validated'::text]);
