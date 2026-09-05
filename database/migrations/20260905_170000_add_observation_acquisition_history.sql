-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Fixed hourly slots impose a storage bound independent of scheduled cleanup.
CREATE TABLE inventory_observation_activity (
    hour_slot SMALLINT PRIMARY KEY CHECK (hour_slot BETWEEN 0 AND 167),
    bucket_at TIMESTAMPTZ NOT NULL CHECK (isfinite(bucket_at)),
    captured BIGINT NOT NULL CHECK (captured >= 0),
    unavailable BIGINT NOT NULL CHECK (unavailable >= 0),
    CHECK (captured + unavailable <= 9007199254740991),
    CHECK (bucket_at = date_trunc('hour', bucket_at, 'UTC')),
    CHECK (hour_slot = mod(floor(extract(epoch FROM bucket_at) / 3600)::bigint, 168))
);

CREATE TABLE library_observation_samples (
    hour_slot SMALLINT PRIMARY KEY CHECK (hour_slot BETWEEN 0 AND 167),
    observed_at TIMESTAMPTZ NOT NULL CHECK (isfinite(observed_at)),
    status TEXT NOT NULL CHECK (status IN ('available', 'capacity_exceeded')),
    library_ids INTEGER[] NOT NULL CHECK (cardinality(library_ids) <= 12),
    excluded_library_count INTEGER NOT NULL CHECK (excluded_library_count >= 0),
    acquisition_configured BOOLEAN NOT NULL,
    inventory_rows INTEGER,
    supported_rows INTEGER,
    identified_rows INTEGER,
    captured_rows INTEGER,
    fresh_rows INTEGER,
    keyword_rows INTEGER,
    language_rows INTEGER,
    CHECK (hour_slot = mod(floor(extract(epoch FROM observed_at) / 3600)::bigint, 168)),
    CHECK ((status = 'available' AND num_nonnulls(inventory_rows, supported_rows, identified_rows,
        captured_rows, fresh_rows, keyword_rows, language_rows) = 7
        AND inventory_rows BETWEEN 0 AND 20000 AND supported_rows BETWEEN 0 AND inventory_rows
        AND identified_rows BETWEEN 0 AND supported_rows AND captured_rows BETWEEN 0 AND identified_rows
        AND fresh_rows BETWEEN 0 AND captured_rows AND keyword_rows BETWEEN 0 AND captured_rows
        AND language_rows BETWEEN 0 AND captured_rows)
        OR (status = 'capacity_exceeded' AND num_nonnulls(inventory_rows, supported_rows, identified_rows,
            captured_rows, fresh_rows, keyword_rows, language_rows) = 0))
);
