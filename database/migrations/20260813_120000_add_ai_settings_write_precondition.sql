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

-- Add an opaque resource version for conditional AI Settings writes. The
-- value is intentionally unrelated to the private receipt revision and
-- contains no provider, credential, policy, routing, or item data.

ALTER TABLE ai_provider_config
    ADD COLUMN IF NOT EXISTS configuration_write_tag UUID;

UPDATE ai_provider_config
SET configuration_write_tag = gen_random_uuid()
WHERE configuration_write_tag IS NULL;

ALTER TABLE ai_provider_config
    ALTER COLUMN configuration_write_tag SET DEFAULT gen_random_uuid(),
    ALTER COLUMN configuration_write_tag SET NOT NULL;

COMMENT ON COLUMN ai_provider_config.configuration_write_tag IS
    'Opaque strong ETag value for conditional AI settings writes; rotated only by the AI settings write boundary.';
