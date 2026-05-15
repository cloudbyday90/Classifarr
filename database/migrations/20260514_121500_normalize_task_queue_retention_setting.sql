/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

-- Migration: 20260514_121500_normalize_task_queue_retention_setting.sql
--
-- Why this exists:
--   1. The original task_queue retention migration seeded
--      settings.task_queue_retention_days, but that seed was never carried into
--      the schema snapshot used for fresh installs.
--   2. As a result, some current installations legitimately have no
--      task_queue_retention_days row even though the code and migration comments
--      expect one to exist.
--   3. We now treat 0 as a valid operator value that disables age-based cleanup
--      while keeping the total-row cap safety valve active.
--
-- What this migration does:
--   - Ensures task_queue_retention_days exists for all installs.
--   - Normalizes invalid stored values back to the default of 7.
--   - Preserves valid non-negative integers, including 0.

INSERT INTO settings (key, value)
VALUES ('task_queue_retention_days', '7')
ON CONFLICT (key) DO NOTHING;

UPDATE settings
SET
    value = CASE
        WHEN btrim(value) ~ '^[0-9]+$' THEN btrim(value)
        ELSE '7'
    END,
    updated_at = NOW()
WHERE key = 'task_queue_retention_days'
  AND (
      value IS NULL
      OR value <> btrim(value)
      OR NOT (btrim(value) ~ '^[0-9]+$')
  );
