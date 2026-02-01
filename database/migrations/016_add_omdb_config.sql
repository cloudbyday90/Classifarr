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

-- OMDb API configuration table
-- Free tier: 1,000 requests/day

CREATE TABLE IF NOT EXISTS omdb_config (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    daily_limit INTEGER DEFAULT 1000,
    requests_today INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default row if empty
INSERT INTO
    omdb_config (id, is_active)
SELECT 1, false
WHERE
    NOT EXISTS (
        SELECT 1
        FROM omdb_config
        WHERE
            id = 1
    );