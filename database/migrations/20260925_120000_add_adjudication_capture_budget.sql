-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE IF NOT EXISTS adjudication_capture_budget (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
    daily_calls integer NOT NULL DEFAULT 0 CHECK (daily_calls BETWEEN 0 AND 200),
    daily_tokens integer NOT NULL DEFAULT 0 CHECK (daily_tokens BETWEEN 0 AND 1689600),
    quota_day date NOT NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date) CHECK (isfinite(quota_day)),
    calls_reserved integer NOT NULL DEFAULT 0 CHECK (calls_reserved BETWEEN 0 AND 200),
    tokens_reserved integer NOT NULL DEFAULT 0 CHECK (tokens_reserved = calls_reserved * 8448),
    selection_offset integer NOT NULL DEFAULT 0 CHECK (selection_offset BETWEEN 0 AND 299),
    next_check_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (isfinite(next_check_at)),
    status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled','ready','captured','waiting_for_replay','budget_exhausted','deferred','unavailable')),
    published_fingerprint text CHECK (published_fingerprint ~ '^[a-f0-9]{64}$'),
    progress_key text CHECK (progress_key ~ '^[a-f0-9]{64}$'),
    progress jsonb CHECK (jsonb_typeof(progress) = 'object' AND octet_length(progress::text) <= 1048576),
    captured_at timestamptz CHECK (isfinite(captured_at)),
    expires_at timestamptz CHECK (isfinite(expires_at)),
    CHECK ((daily_calls = 0 AND daily_tokens = 0) OR (daily_calls > 0 AND daily_tokens >= 8448)),
    CHECK ((progress IS NULL AND progress_key IS NULL AND captured_at IS NULL AND expires_at IS NULL)
        OR (progress IS NOT NULL AND progress_key IS NOT NULL AND captured_at IS NOT NULL AND expires_at IS NOT NULL
            AND expires_at > captured_at AND expires_at <= captured_at + interval '7 days'))
);
INSERT INTO adjudication_capture_budget(singleton) VALUES(true) ON CONFLICT DO NOTHING;
COMMENT ON TABLE adjudication_capture_budget IS
    'Opt-in local AI evaluation quota and resumable exact-response progress. UTC reservations survive restart; unknown calls are not refunded. No prompts or routing authority.';
