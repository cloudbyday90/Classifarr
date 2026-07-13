/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

BEGIN;

COMMENT ON COLUMN task_queue.stage_started_at IS
  'When the current classification stage started';
COMMENT ON COLUMN task_queue.stage_history IS
  'JSON array of completed classification stages with timestamps and durations';

COMMIT;
