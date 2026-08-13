-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Supports the actor-bound, fixed-window lookup of one recent receipt without
-- scanning retained receipts or item rows.
CREATE INDEX IF NOT EXISTS idx_historic_route_safety_refresh_receipts_actor_recent
  ON policy_runtime_historic_route_safety_refresh_receipts (actor_id, created_at DESC, receipt_id DESC);
