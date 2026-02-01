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

-- v0.35.1: Restore ollama_config Table
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CRITICAL: This migration restores the ollama_config table that was incorrectly
-- dropped in migration 034_cleanup_unused_tables.sql.
--
-- The ollama_config table IS ACTIVELY USED by:
--   - server/src/routes/settings.js - Configuration endpoints
--   - server/src/routes/libraries.js - AI classification logic
--
-- While we are moving towards a unified ai_provider_config, the legacy table
-- is still required for the current codebase to function.
--
-- DO NOT DROP THIS TABLE IN FUTURE CLEANUP MIGRATIONS until verify no code usage!
-- ═══════════════════════════════════════════════════════════════════════════

-- Restore ollama_config table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS ollama_config (
    id SERIAL PRIMARY KEY,
    host VARCHAR(500) NOT NULL DEFAULT 'host.docker.internal',
    port INTEGER NOT NULL DEFAULT 11434,
    model VARCHAR(100) NOT NULL DEFAULT 'qwen3:14b',
    temperature DECIMAL(3, 2) DEFAULT 0.30,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Log the migration
COMMENT ON
TABLE ollama_config IS 'Legacy Ollama configuration table. Actively used by Settings UI and classification. DO NOT DROP.';