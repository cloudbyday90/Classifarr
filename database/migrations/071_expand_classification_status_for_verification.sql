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

-- Migration: 071_expand_classification_status_for_verification.sql
-- Purpose: Allow verification + reclassification status values in classification_history

ALTER TABLE classification_history
DROP CONSTRAINT IF EXISTS classification_history_status_check;

ALTER TABLE classification_history
ADD CONSTRAINT classification_history_status_check CHECK (
    status IN (
        'completed',         -- Classification finished successfully
        'failed',            -- Classification failed with error
        'corrected',         -- User corrected the classification
        'awaiting_decision', -- Pending user clarification/confirmation
        'pending',           -- In queue, not yet processed
        'pending_retry',     -- Queued for retry when AI becomes available
        'verified',          -- User verified classification (e.g., Discord confirmation)
        'reclassified'       -- Item was reclassified
    )
);
