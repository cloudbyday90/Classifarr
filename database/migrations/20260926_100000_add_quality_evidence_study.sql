-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE IF NOT EXISTS quality_evidence_study (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    generation uuid NOT NULL DEFAULT gen_random_uuid(),
    protocol_id text NOT NULL CHECK (protocol_id ~ '^[a-f0-9]{64}$'),
    protocol jsonb NOT NULL CHECK (jsonb_typeof(protocol) = 'object' AND octet_length(protocol::text) <= 262144),
    evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'object' AND octet_length(evidence::text) <= 1048576),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'drifted', 'conflicted')),
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
  CHECK (expires_at = created_at + interval '720 hours')
);
COMMENT ON TABLE quality_evidence_study IS
    'Explicitly started singleton movie/TV quality study. Bounded hashed outcomes and usage only; no labels, prompts, raw responses or routing authority. Original 30-day expiry is never renewed.';
