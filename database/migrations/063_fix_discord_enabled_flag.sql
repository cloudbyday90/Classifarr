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

-- Migration: Fix Discord enabled flag for existing configurations
-- Bug #11: Discord enabled defaults to false
-- 
-- Problem: Users who configured Discord before the enabled flag existed,
-- or whose configs were created without explicitly setting enabled = true,
-- have notifications silently disabled.
--
-- Solution: Enable Discord for configs that have valid credentials but enabled = false

-- Update notification_config to enable Discord for existing valid configurations
UPDATE notification_config 
SET enabled = true, updated_at = NOW()
WHERE bot_token IS NOT NULL 
  AND bot_token != ''
  AND channel_id IS NOT NULL 
  AND channel_id != ''
  AND enabled = false;


