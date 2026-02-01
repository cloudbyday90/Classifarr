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

-- v0.39.3: Add post_upgrade_tasks table and backfill library_name

-- Create table to track post-upgrade tasks
CREATE TABLE IF NOT EXISTS post_upgrade_tasks (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(100) UNIQUE NOT NULL,
    version VARCHAR(20) NOT NULL,
    description TEXT,
    executed_at TIMESTAMP DEFAULT NOW()
);

-- Create index on task_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_post_upgrade_tasks_task_id ON post_upgrade_tasks(task_id);

-- Create index on version for filtering by version
CREATE INDEX IF NOT EXISTS idx_post_upgrade_tasks_version ON post_upgrade_tasks(version);
