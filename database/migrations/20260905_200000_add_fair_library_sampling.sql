-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE INDEX idx_media_items_library_order ON media_server_items (library_id, id);
CREATE INDEX idx_libraries_active_order ON libraries (id) WHERE is_active = true;

CREATE TABLE library_observation_sampling_state (
    singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
    last_library_id INTEGER NOT NULL DEFAULT 0 CHECK (last_library_id >= 0),
    ceiling_library_id INTEGER NOT NULL DEFAULT 0 CHECK (ceiling_library_id >= last_library_id),
    active_library_count INTEGER NOT NULL DEFAULT 0 CHECK (active_library_count >= 0),
    last_sample_at TIMESTAMPTZ CHECK (isfinite(last_sample_at)),
    continuity_since TIMESTAMPTZ CHECK (isfinite(continuity_since)),
    CHECK ((last_sample_at IS NULL AND continuity_since IS NULL)
        OR (last_sample_at IS NOT NULL AND continuity_since IS NOT NULL AND continuity_since <= last_sample_at))
);
INSERT INTO library_observation_sampling_state (singleton) VALUES (true);

CREATE TABLE library_observation_points (
    sample_slot SMALLINT PRIMARY KEY CHECK (sample_slot BETWEEN 0 AND 2015),
    observed_at TIMESTAMPTZ NOT NULL CHECK (isfinite(observed_at)),
    library_id INTEGER NOT NULL CHECK (library_id > 0),
    status TEXT NOT NULL CHECK (status IN ('available', 'capacity_exceeded')),
    acquisition_configured BOOLEAN NOT NULL,
    continuity_since TIMESTAMPTZ NOT NULL CHECK (isfinite(continuity_since) AND continuity_since <= observed_at),
    inventory_lower_bound INTEGER NOT NULL CHECK (inventory_lower_bound BETWEEN 0 AND 20001),
    population_fingerprint TEXT,
    inventory_rows INTEGER,
    supported_rows INTEGER,
    identified_rows INTEGER,
    captured_rows INTEGER,
    fresh_rows INTEGER,
    keyword_rows INTEGER,
    language_rows INTEGER,
    CHECK (sample_slot = mod(floor(extract(epoch FROM observed_at) / 300)::bigint, 2016)),
    CHECK ((status = 'available' AND population_fingerprint IS NOT NULL AND population_fingerprint ~ '^[a-f0-9]{64}$'
        AND num_nonnulls(inventory_rows,supported_rows,identified_rows,captured_rows,fresh_rows,keyword_rows,language_rows) = 7
        AND inventory_rows BETWEEN 0 AND 20000 AND inventory_lower_bound = inventory_rows
        AND supported_rows BETWEEN 0 AND inventory_rows AND identified_rows BETWEEN 0 AND supported_rows
        AND captured_rows BETWEEN 0 AND identified_rows AND fresh_rows BETWEEN 0 AND captured_rows
        AND keyword_rows BETWEEN 0 AND captured_rows AND language_rows BETWEEN 0 AND captured_rows)
        OR (status = 'capacity_exceeded' AND inventory_lower_bound = 20001 AND population_fingerprint IS NULL
            AND num_nonnulls(inventory_rows,supported_rows,identified_rows,captured_rows,fresh_rows,keyword_rows,language_rows) = 0))
);
