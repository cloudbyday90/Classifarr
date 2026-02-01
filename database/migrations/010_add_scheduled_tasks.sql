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

-- Migration 010: Add scheduled tasks table
-- Allows scheduling periodic library scans and classifications

-- Create scheduled_tasks table
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    task_type VARCHAR(50) NOT NULL DEFAULT 'library_scan',
    library_id INTEGER REFERENCES libraries (id) ON DELETE CASCADE,
    cron_expression VARCHAR(100),
    interval_minutes INTEGER,
    enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP
    WITH
        TIME ZONE,
        next_run_at TIMESTAMP
    WITH
        TIME ZONE,
        run_count INTEGER DEFAULT 0,
        last_result TEXT,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on next_run_at for efficient polling
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks (next_run_at)
WHERE
    enabled = true;

-- Comment on table
COMMENT ON
TABLE scheduled_tasks IS 'Scheduled tasks for periodic operations like library scans';

COMMENT ON COLUMN scheduled_tasks.task_type IS 'Type of task: library_scan, full_rescan, etc.';

COMMENT ON COLUMN scheduled_tasks.cron_expression IS 'Cron expression for complex schedules (optional)';

COMMENT ON COLUMN scheduled_tasks.interval_minutes IS 'Simple interval in minutes (alternative to cron)';