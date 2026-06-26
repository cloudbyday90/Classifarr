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

-- Add bounded Discord mention targeting for pending classification alerts.

ALTER TABLE notification_config
  ADD COLUMN IF NOT EXISTS pending_mention_here BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pending_mention_type VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS pending_mention_target_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pending_mention_target_label VARCHAR(150);

ALTER TABLE notification_config
  DROP CONSTRAINT IF EXISTS notification_config_pending_mention_type_check;

ALTER TABLE notification_config
  ADD CONSTRAINT notification_config_pending_mention_type_check
  CHECK (pending_mention_type IN ('none', 'user', 'role'));
