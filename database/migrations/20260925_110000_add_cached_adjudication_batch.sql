-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE IF NOT EXISTS cached_adjudication_batch (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    batch jsonb NOT NULL CHECK (jsonb_typeof(batch) = 'object' AND octet_length(batch::text) <= 1048576),
    captured_at timestamptz NOT NULL CHECK (isfinite(captured_at)),
    expires_at timestamptz NOT NULL CHECK (isfinite(expires_at)),
    CHECK (expires_at > captured_at AND expires_at <= captured_at + interval '7 days')
);
COMMENT ON TABLE cached_adjudication_batch IS
    'One private, bounded batch of explicitly captured local AI evaluation responses. No prompts or routing authority. Seven-day expiry; exact request hashes and pinned model provenance required for replay.';
