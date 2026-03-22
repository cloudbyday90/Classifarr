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

-- v0.44.x: Move standalone custom presets into content_presets so policy
-- attachments can treat builtin and custom presets through the same model.

WITH migrated_custom_presets AS (
    SELECT
        cp.id AS legacy_custom_preset_id,
        cp.name,
        cp.description,
        cp.icon,
        cp.category,
        cp.signals,
        cp.created_by,
        cp.created_at,
        cp.updated_at,
        LEFT(
            CONCAT(
                'custom_',
                cp.id,
                '_',
                COALESCE(
                    NULLIF(
                        TRIM(BOTH '_' FROM REGEXP_REPLACE(LOWER(cp.name), '[^a-z0-9]+', '_', 'g')),
                        ''
                    ),
                    'preset'
                )
            ),
            50
        ) AS generated_key
    FROM custom_presets cp
)
INSERT INTO content_presets (
    key,
    name,
    description,
    icon,
    category,
    signals,
    is_system,
    user_id,
    is_public,
    based_on_preset_id,
    usage_count,
    display_order,
    created_at,
    updated_at
)
SELECT
    mcp.generated_key,
    mcp.name,
    mcp.description,
    mcp.icon,
    mcp.category,
    mcp.signals,
    false,
    mcp.created_by,
    false,
    null,
    0,
    0,
    mcp.created_at,
    mcp.updated_at
FROM migrated_custom_presets mcp
WHERE NOT EXISTS (
    SELECT 1
    FROM content_presets existing
    WHERE existing.key = mcp.generated_key
      AND existing.user_id IS NOT DISTINCT FROM mcp.created_by
);
