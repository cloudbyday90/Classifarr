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

-- Backfill library_name where it's NULL but library_id exists
-- This fixes historical data before the library_name field was consistently updated
UPDATE classification_history ch
SET library_name = l.name
FROM libraries l
WHERE ch.library_id = l.id
  AND ch.library_name IS NULL;
