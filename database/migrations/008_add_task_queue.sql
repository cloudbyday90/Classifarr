-- Migration: Add task_queue table for background job processing
-- This enables Ollama offline resilience - tasks persist until processing is possible

CREATE TABLE IF NOT EXISTS task_queue (
    id SERIAL PRIMARY KEY,
    task_type VARCHAR(50) NOT NULL, -- 'classification', 'sync', 'notification'
    payload JSONB NOT NULL, -- Original webhook/request payload
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN (
            'pending',
            'processing',
            'completed',
            'failed',
            'cancelled'
        )
    ),
    priority INTEGER DEFAULT 0, -- Higher = process first
    attempts INTEGER DEFAULT 0, -- Current retry count
    max_attempts INTEGER DEFAULT 5, -- Max retries before permanent failure
    error_message TEXT, -- Last error message
    webhook_log_id INTEGER REFERENCES webhook_log (id) ON DELETE SET NULL,
    source VARCHAR(50) DEFAULT 'webhook', -- 'webhook', 'manual', 'scheduled'
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP, -- When processing began
    completed_at TIMESTAMP, -- When processing finished
    next_retry_at TIMESTAMP DEFAULT NOW() -- When to retry (for exponential backoff)
);

-- Index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue (status);

CREATE INDEX IF NOT EXISTS idx_task_queue_next_retry ON task_queue (next_retry_at)
WHERE
    status = 'pending';

CREATE INDEX IF NOT EXISTS idx_task_queue_priority ON task_queue (priority DESC, created_at ASC)
WHERE
    status = 'pending';