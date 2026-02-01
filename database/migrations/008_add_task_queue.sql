-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

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