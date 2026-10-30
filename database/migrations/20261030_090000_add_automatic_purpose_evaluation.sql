-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE automatic_purpose_evaluation (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    status text NOT NULL CHECK (status IN ('complete', 'failed')),
    input_fingerprint text CHECK (input_fingerprint ~ '^[a-f0-9]{64}$'),
    report jsonb CHECK (jsonb_typeof(report) = 'object' AND octet_length(report::text) <= 16384),
    observed_at timestamptz NOT NULL CHECK (isfinite(observed_at)),
    evaluated_at timestamptz CHECK (isfinite(evaluated_at)),
    next_check_at timestamptz NOT NULL CHECK (isfinite(next_check_at)),
    failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count BETWEEN 0 AND 5),
    failure_code text CHECK (failure_code IN ('busy','memory_pressure','memory_unknown','evidence_budget',
        'invalid_evidence','deadline','sources_unavailable','evaluation_unavailable')),
    CHECK ((status = 'complete' AND input_fingerprint IS NOT NULL AND report IS NOT NULL
        AND evaluated_at IS NOT NULL AND failure_code IS NULL AND failure_count = 0)
      OR (status = 'failed' AND input_fingerprint IS NULL AND report IS NULL
        AND evaluated_at IS NULL AND failure_code IS NOT NULL AND failure_count > 0)),
    CHECK (next_check_at > observed_at AND (evaluated_at IS NULL OR evaluated_at <= observed_at))
);
COMMENT ON TABLE automatic_purpose_evaluation IS
    'One replaceable aggregate checkpoint, not source evidence or recovery authority. Excluded from portable exports; reset on configuration restore.';
