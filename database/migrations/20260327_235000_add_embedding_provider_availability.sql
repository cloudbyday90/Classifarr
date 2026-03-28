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

-- Shared embedding provider availability state.
-- Safe for both fresh installs and upgrades:
--   - CREATE TABLE IF NOT EXISTS is idempotent
--   - singleton seed row uses ON CONFLICT DO NOTHING
--   - trigger creation is guarded so older/newer schema states do not fail

CREATE TABLE IF NOT EXISTS embedding_provider_availability (
    id INTEGER PRIMARY KEY DEFAULT 1,
    availability_status VARCHAR(20) NOT NULL DEFAULT 'available',
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    last_failure_source VARCHAR(50),
    last_failure_at TIMESTAMPTZ,
    cooldown_until TIMESTAMPTZ,
    probe_started_at TIMESTAMPTZ,
    last_probe_at TIMESTAMPTZ,
    last_recovered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT embedding_provider_availability_single_row CHECK (id = 1),
    CONSTRAINT embedding_provider_availability_status_chk CHECK (
        availability_status IN ('available', 'cooldown', 'probing')
    )
);

INSERT INTO embedding_provider_availability (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'update_updated_at_column'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
          AND event_object_table = 'embedding_provider_availability'
          AND trigger_name = 'trg_embedding_provider_availability_updated_at'
    ) THEN
        EXECUTE '
            CREATE TRIGGER trg_embedding_provider_availability_updated_at
            BEFORE UPDATE ON embedding_provider_availability
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
        ';
    END IF;
END $$;
