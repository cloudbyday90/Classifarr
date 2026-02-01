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

-- v0.37.2: Add custom_signals column to policy_presets
-- Allows per-policy customization of preset signals (certifications, genres, keywords)

ALTER TABLE policy_presets
ADD COLUMN IF NOT EXISTS custom_signals JSONB DEFAULT NULL;

COMMENT ON COLUMN policy_presets.custom_signals IS 'Per-policy customization of preset signals (overrides preset defaults)';

-- Add sort_order column if missing (for ordering presets within a policy)
ALTER TABLE policy_presets
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;