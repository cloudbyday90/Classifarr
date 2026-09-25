-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE IF NOT EXISTS automatic_source_pair_evaluation (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    status text NOT NULL CHECK (status IN ('complete', 'failed')),
    input_fingerprint text CHECK (input_fingerprint ~ '^[a-f0-9]{64}$'),
    report jsonb CHECK (jsonb_typeof(report) = 'object' AND octet_length(report::text) <= 16384),
    observed_at timestamptz NOT NULL CHECK (isfinite(observed_at)),
    evaluated_at timestamptz CHECK (isfinite(evaluated_at)),
    next_check_at timestamptz NOT NULL CHECK (isfinite(next_check_at)),
    cohort jsonb CHECK (jsonb_typeof(cohort) = 'array' AND jsonb_array_length(cohort) <= 300 AND octet_length(cohort::text) <= 21000),
    cohort_created_at timestamptz CHECK (isfinite(cohort_created_at)),
    failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count BETWEEN 0 AND 5),
    failure_code text CHECK (failure_code IN ('busy', 'memory_pressure', 'memory_unknown', 'disabled',
        'unsupported_provider', 'representation_unavailable', 'evidence_budget', 'deadline', 'evaluation_unavailable')),
    CHECK ((cohort IS NULL) = (cohort_created_at IS NULL)),
    CHECK ((status = 'complete' AND input_fingerprint IS NOT NULL AND report IS NOT NULL
        AND evaluated_at IS NOT NULL AND cohort IS NOT NULL AND failure_code IS NULL AND failure_count = 0)
      OR (status = 'failed' AND input_fingerprint IS NULL AND report IS NULL
        AND evaluated_at IS NULL AND failure_code IS NOT NULL AND failure_count > 0)),
    CHECK (next_check_at > observed_at AND (evaluated_at IS NULL OR evaluated_at <= observed_at))
);
COMMENT ON TABLE automatic_source_pair_evaluation IS
    'One replaceable cached retrieval-pair aggregate and up to 300 opaque cohort references. No source content, credentials, routing authority or provider calls. Reports expire after fifteen minutes; cohorts rotate after thirty days.';
