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

-- Add heartbeat configuration columns to ai_provider_config
-- These control the provider lock system that prevents Ollama resource contention

ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS heartbeat_timeout INTEGER DEFAULT 30000;
  
ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS heartbeat_interval INTEGER DEFAULT 5000;
  
ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS max_wait_time INTEGER DEFAULT 60000;

-- Ensure a configuration row exists and initialize heartbeat values
INSERT INTO ai_provider_config (id, heartbeat_timeout, heartbeat_interval, max_wait_time)
VALUES (1, 30000, 5000, 60000)
ON CONFLICT (id) DO UPDATE
SET
  heartbeat_timeout  = COALESCE(ai_provider_config.heartbeat_timeout, 30000),
  heartbeat_interval = COALESCE(ai_provider_config.heartbeat_interval, 5000),
  max_wait_time      = COALESCE(ai_provider_config.max_wait_time, 60000);
