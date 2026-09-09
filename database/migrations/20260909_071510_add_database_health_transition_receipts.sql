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

-- A singleton holds the currently confirmed coarse PostgreSQL state and, at
-- most, one subsequent state awaiting its second ordinary observation. It
-- intentionally has no raw counters, database name, table name, query text,
-- library, provider, configuration, policy, AI, media, label, or routing data.
CREATE TABLE IF NOT EXISTS database_health_transition_state (
    singleton SMALLINT PRIMARY KEY DEFAULT 1,
    statistics_reset_at TIMESTAMPTZ NOT NULL,
    stable_read_operations VARCHAR(16) NOT NULL,
    stable_write_operations VARCHAR(16) NOT NULL,
    stable_cache_hits VARCHAR(16) NOT NULL,
    stable_estimated_dead_tuples VARCHAR(16) NOT NULL,
    stable_tables_with_dead_tuples VARCHAR(16) NOT NULL,
    pending_read_operations VARCHAR(16),
    pending_write_operations VARCHAR(16),
    pending_cache_hits VARCHAR(16),
    pending_estimated_dead_tuples VARCHAR(16),
    pending_tables_with_dead_tuples VARCHAR(16),
    pending_observation_count SMALLINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT database_health_transition_state_singleton_ck CHECK (singleton = 1),
    CONSTRAINT database_health_transition_state_stable_bucket_ck CHECK (
        stable_read_operations IN ('none', 'low', 'moderate', 'high')
        AND stable_write_operations IN ('none', 'low', 'moderate', 'high')
        AND stable_cache_hits IN ('none', 'low', 'moderate', 'high')
        AND stable_estimated_dead_tuples IN ('none', 'low', 'moderate', 'high')
        AND stable_tables_with_dead_tuples IN ('none', 'low', 'moderate', 'high')
    ),
    CONSTRAINT database_health_transition_state_pending_ck CHECK (
        (
            pending_observation_count = 0
            AND pending_read_operations IS NULL
            AND pending_write_operations IS NULL
            AND pending_cache_hits IS NULL
            AND pending_estimated_dead_tuples IS NULL
            AND pending_tables_with_dead_tuples IS NULL
        )
        OR (
            pending_observation_count = 1
            AND pending_read_operations IN ('none', 'low', 'moderate', 'high')
            AND pending_write_operations IN ('none', 'low', 'moderate', 'high')
            AND pending_cache_hits IN ('none', 'low', 'moderate', 'high')
            AND pending_estimated_dead_tuples IN ('none', 'low', 'moderate', 'high')
            AND pending_tables_with_dead_tuples IN ('none', 'low', 'moderate', 'high')
        )
    )
);

-- Receipts are append-only provenance for a confirmed state transition. A
-- receipt can be emitted only after exactly two ordinary observations of the
-- new bucket state, and never authorizes maintenance or any media workflow.
CREATE TABLE IF NOT EXISTS database_health_transition_receipts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    receipt_version SMALLINT NOT NULL DEFAULT 1,
    statistics_reset_at TIMESTAMPTZ NOT NULL,
    before_read_operations VARCHAR(16) NOT NULL,
    before_write_operations VARCHAR(16) NOT NULL,
    before_cache_hits VARCHAR(16) NOT NULL,
    before_estimated_dead_tuples VARCHAR(16) NOT NULL,
    before_tables_with_dead_tuples VARCHAR(16) NOT NULL,
    after_read_operations VARCHAR(16) NOT NULL,
    after_write_operations VARCHAR(16) NOT NULL,
    after_cache_hits VARCHAR(16) NOT NULL,
    after_estimated_dead_tuples VARCHAR(16) NOT NULL,
    after_tables_with_dead_tuples VARCHAR(16) NOT NULL,
    confirmation_observation_count SMALLINT NOT NULL DEFAULT 2,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT database_health_transition_receipts_version_ck CHECK (receipt_version = 1),
    CONSTRAINT database_health_transition_receipts_confirmation_ck CHECK (confirmation_observation_count = 2),
    CONSTRAINT database_health_transition_receipts_before_bucket_ck CHECK (
        before_read_operations IN ('none', 'low', 'moderate', 'high')
        AND before_write_operations IN ('none', 'low', 'moderate', 'high')
        AND before_cache_hits IN ('none', 'low', 'moderate', 'high')
        AND before_estimated_dead_tuples IN ('none', 'low', 'moderate', 'high')
        AND before_tables_with_dead_tuples IN ('none', 'low', 'moderate', 'high')
    ),
    CONSTRAINT database_health_transition_receipts_after_bucket_ck CHECK (
        after_read_operations IN ('none', 'low', 'moderate', 'high')
        AND after_write_operations IN ('none', 'low', 'moderate', 'high')
        AND after_cache_hits IN ('none', 'low', 'moderate', 'high')
        AND after_estimated_dead_tuples IN ('none', 'low', 'moderate', 'high')
        AND after_tables_with_dead_tuples IN ('none', 'low', 'moderate', 'high')
    ),
    CONSTRAINT database_health_transition_receipts_changed_state_ck CHECK (
        before_read_operations <> after_read_operations
        OR before_write_operations <> after_write_operations
        OR before_cache_hits <> after_cache_hits
        OR before_estimated_dead_tuples <> after_estimated_dead_tuples
        OR before_tables_with_dead_tuples <> after_tables_with_dead_tuples
    )
);

CREATE INDEX IF NOT EXISTS idx_database_health_transition_receipts_current_reset
    ON database_health_transition_receipts (statistics_reset_at, recorded_at DESC, id DESC);

CREATE OR REPLACE FUNCTION enforce_database_health_transition_receipts_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Database health transition receipts are append-only'
        USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS database_health_transition_receipts_append_only
    ON database_health_transition_receipts;

CREATE TRIGGER database_health_transition_receipts_append_only
    BEFORE UPDATE OR DELETE ON database_health_transition_receipts
    FOR EACH ROW
    EXECUTE FUNCTION enforce_database_health_transition_receipts_append_only();

COMMENT ON TABLE database_health_transition_state IS
    'Singleton confirmation state for coarse PostgreSQL health buckets; no raw operational statistics or application dimensions.';
COMMENT ON TABLE database_health_transition_receipts IS
    'Append-only, confirmed coarse PostgreSQL health bucket transitions; no raw counts, query, database, media, library, provider, configuration, policy, AI, label, or routing data.';
