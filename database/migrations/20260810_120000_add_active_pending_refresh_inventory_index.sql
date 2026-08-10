-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- The historic route-safety refresh inventory reads active decisions by an
-- ascending, keyset-paginated identifier. Keep that read bounded even when
-- the retained classification history is large. The migration runner applies
-- migrations transactionally, so a standard index build is required here.
CREATE INDEX IF NOT EXISTS idx_classification_history_active_pending_refresh_inventory
  ON classification_history (id ASC)
  WHERE status IN ('awaiting_decision', 'pending_retry');
