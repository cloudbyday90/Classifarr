-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Nullable historical detail preserves pre-upgrade uncertainty. Fixed slots bound retention.
ALTER TABLE library_observation_samples ADD COLUMN library_coverage_v1 JSONB;
ALTER TABLE library_observation_samples ADD CONSTRAINT library_coverage_v1_bounded CHECK (
    library_coverage_v1 IS NULL OR (
        status = 'available' AND octet_length(library_coverage_v1::text) <= 16384
        AND CASE WHEN jsonb_typeof(library_coverage_v1) = 'array'
            THEN jsonb_array_length(library_coverage_v1) = cardinality(library_ids)
                AND jsonb_array_length(library_coverage_v1) <= 12
            ELSE false END
    )
);
