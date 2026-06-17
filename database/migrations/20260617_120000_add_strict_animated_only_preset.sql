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

-- Add an explicit strict preset for animated-only libraries.
-- Non-animated media will fail strict genre constraints and surface as policy conflicts.

WITH preset_payload AS (
  SELECT
    'animated_only_strict'::text AS key,
    'Animated Only (Strict)'::text AS name,
    'Routes non-anime animated movies only. Non-animated or anime-signaled items are treated as strict policy conflicts.'::text AS description,
    '🎞️'::text AS icon,
    'genre'::text AS category,
    '{
      "media_type": {
        "include": ["movie"],
        "strict": true,
        "weight": 1.0
      },
      "genres": {
        "require_any": ["Animation"],
        "strict": true,
        "weight": 2.0
      },
      "keywords": {
        "prefer": ["animated", "animation", "cartoon", "cgi", "pixar", "dreamworks"],
        "exclude": ["anime", "manga", "shonen", "seinen", "shojo", "japanese animation"],
        "strict": true,
        "weight": 0.4
      }
    }'::jsonb AS signals,
    true AS is_system,
    121 AS display_order
),
updated AS (
  UPDATE content_presets cp
  SET
    name = payload.name,
    description = payload.description,
    icon = payload.icon,
    category = payload.category,
    signals = payload.signals,
    is_system = payload.is_system,
    display_order = payload.display_order
  FROM preset_payload payload
  WHERE cp.key = payload.key
  RETURNING cp.id
)
INSERT INTO content_presets (
  key,
  name,
  description,
  icon,
  category,
  signals,
  is_system,
  display_order
)
SELECT
  payload.key,
  payload.name,
  payload.description,
  payload.icon,
  payload.category,
  payload.signals,
  payload.is_system,
  payload.display_order
FROM preset_payload payload
WHERE NOT EXISTS (SELECT 1 FROM updated);
