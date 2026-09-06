-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Keep clock-only changes out of the profile refresh revision.
ALTER TABLE library_profile_inventory_state ADD COLUMN observation_clock_revision BIGINT NOT NULL DEFAULT 0
    CHECK (observation_clock_revision >= 0);

CREATE FUNCTION capture_library_observation_clock_change() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    INSERT INTO public.library_profile_inventory_state (library_id, observation_clock_revision)
    SELECT DISTINCT new_row.library_id, 1 FROM old_items old_row JOIN new_items new_row USING (id)
    JOIN public.libraries library ON library.id = new_row.library_id
    WHERE ROW(old_row.inventory_tmdb_attempted_at, old_row.inventory_tmdb_fetched_at)
        IS DISTINCT FROM ROW(new_row.inventory_tmdb_attempted_at, new_row.inventory_tmdb_fetched_at)
    ORDER BY new_row.library_id
    ON CONFLICT (library_id) DO UPDATE SET observation_clock_revision =
        public.library_profile_inventory_state.observation_clock_revision + 1;
    RETURN NULL;
END;
$$;
CREATE TRIGGER library_observation_clock_update AFTER UPDATE ON media_server_items
    REFERENCING OLD TABLE AS old_items NEW TABLE AS new_items FOR EACH STATEMENT
    EXECUTE FUNCTION capture_library_observation_clock_change();

CREATE TABLE library_observation_scan_progress (
    library_id INTEGER PRIMARY KEY REFERENCES libraries(id) ON DELETE CASCADE,
    inventory_revision BIGINT NOT NULL CHECK (inventory_revision >= 0),
    clock_revision BIGINT NOT NULL CHECK (clock_revision >= 0),
    after_id INTEGER NOT NULL CHECK (after_id > 0),
    scan_started_at TIMESTAMPTZ NOT NULL CHECK (isfinite(scan_started_at)),
    last_visit_at TIMESTAMPTZ NOT NULL CHECK (isfinite(last_visit_at) AND last_visit_at >= scan_started_at
        AND last_visit_at <= scan_started_at + INTERVAL '7 days'),
    continuity_since TIMESTAMPTZ NOT NULL CHECK (isfinite(continuity_since)),
    acquisition_configured BOOLEAN NOT NULL,
    population_fingerprint TEXT NOT NULL CHECK (population_fingerprint ~ '^[a-f0-9]{64}$'),
    inventory_rows INTEGER NOT NULL CHECK (inventory_rows > 0),
    supported_rows INTEGER NOT NULL CHECK (supported_rows BETWEEN 0 AND inventory_rows),
    identified_rows INTEGER NOT NULL CHECK (identified_rows BETWEEN 0 AND supported_rows),
    captured_rows INTEGER NOT NULL CHECK (captured_rows BETWEEN 0 AND identified_rows),
    fresh_rows INTEGER NOT NULL CHECK (fresh_rows BETWEEN 0 AND captured_rows),
    keyword_rows INTEGER NOT NULL CHECK (keyword_rows BETWEEN 0 AND captured_rows),
    language_rows INTEGER NOT NULL CHECK (language_rows BETWEEN 0 AND captured_rows)
);

ALTER TABLE library_observation_points
    ADD COLUMN measurement_version SMALLINT NOT NULL DEFAULT 2 CHECK (measurement_version IN (2,3)),
    ADD COLUMN scan_started_at TIMESTAMPTZ CHECK (isfinite(scan_started_at) AND scan_started_at <= observed_at),
    ADD COLUMN scanned_rows INTEGER CHECK (scanned_rows >= 0),
    ADD COLUMN restart_reason TEXT CHECK (restart_reason IN ('inventory_changed','observation_clocks_changed',
        'sampling_gap','configuration_changed','expired','clock_anomaly','changed_before_write')),
    DROP CONSTRAINT library_observation_points_status_check,
    DROP CONSTRAINT library_observation_points_inventory_lower_bound_check,
    DROP CONSTRAINT library_observation_points_check2,
    ADD CHECK (status IN ('available','capacity_exceeded','in_progress','invalidated')),
    ADD CHECK (inventory_lower_bound >= 0),
    ADD CHECK ((measurement_version = 2 AND scan_started_at IS NULL AND scanned_rows IS NULL AND restart_reason IS NULL
            AND status IN ('available','capacity_exceeded') AND inventory_lower_bound <= 20001)
        OR (measurement_version = 3 AND scan_started_at IS NOT NULL AND scanned_rows IS NOT NULL
            AND scan_started_at >= observed_at - INTERVAL '7 days' AND status IN ('available','in_progress','invalidated'))),
    ADD CHECK ((status = 'available' AND population_fingerprint IS NOT NULL AND population_fingerprint ~ '^[a-f0-9]{64}$'
        AND num_nonnulls(inventory_rows,supported_rows,identified_rows,captured_rows,fresh_rows,keyword_rows,language_rows) = 7
        AND inventory_rows >= 0 AND inventory_lower_bound = inventory_rows
        AND (measurement_version = 3 OR inventory_rows <= 20000)
        AND (measurement_version = 2 OR scanned_rows = inventory_rows)
        AND supported_rows BETWEEN 0 AND inventory_rows AND identified_rows BETWEEN 0 AND supported_rows
        AND captured_rows BETWEEN 0 AND identified_rows AND fresh_rows BETWEEN 0 AND captured_rows
        AND keyword_rows BETWEEN 0 AND captured_rows AND language_rows BETWEEN 0 AND captured_rows)
        OR (status <> 'available' AND population_fingerprint IS NULL
            AND num_nonnulls(inventory_rows,supported_rows,identified_rows,captured_rows,fresh_rows,keyword_rows,language_rows) = 0
            AND ((status = 'capacity_exceeded' AND inventory_lower_bound = 20001)
                OR (status = 'in_progress' AND scanned_rows > 0 AND inventory_lower_bound = scanned_rows + 1)
                OR (status = 'invalidated' AND scanned_rows = 0 AND inventory_lower_bound = 0))));
