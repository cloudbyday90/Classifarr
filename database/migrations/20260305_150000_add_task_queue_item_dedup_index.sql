/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

-- Migration: 20260305_150000_add_task_queue_item_dedup_index.sql
--
-- Adds a partial unique index on (task_type, payload->>'media_item_id') scoped
-- to only the *active* states ('pending', 'processing').
--
-- The previous scheduler INSERT used ON CONFLICT DO NOTHING with no conflict
-- target, which resolves against the primary key only and therefore never fires.
-- This allowed duplicate pending rows to accumulate for the same media_item_id.
-- Using a partial index scoped to active statuses correctly skips items that are
-- already queued or in-flight, while still allowing failed/cancelled items to be
-- re-queued without any conflict.
--
-- Referenced in: scheduler.js runRatingNormalizationCheck()
-- ON CONFLICT (task_type, (payload->>'media_item_id')) WHERE status IN ('pending', 'processing') DO NOTHING

-- Pre-dedup: cancel any duplicate active tasks that would prevent the unique index from building.
-- Keeps the OLDEST row per (task_type, media_item_id), cancels newer duplicates.
-- Cancelled rows fall outside the partial index scope so they do not conflict.
-- Rows whose payload has no media_item_id key are unaffected (NULL values are
-- excluded from the IS NOT NULL guard and do not participate in uniqueness).
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY task_type, (payload->>'media_item_id')
               ORDER BY id ASC  -- keep the oldest (lowest id)
           ) AS rn
    FROM task_queue
    WHERE status IN ('pending', 'processing')
      AND payload->>'media_item_id' IS NOT NULL
)
UPDATE task_queue
SET status        = 'cancelled',
    error_message = 'Duplicate task cancelled during dedup migration (idx_task_queue_active_item_dedup)'
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_queue_active_item_dedup
    ON task_queue (task_type, (payload->>'media_item_id'))
    WHERE status IN ('pending', 'processing');
