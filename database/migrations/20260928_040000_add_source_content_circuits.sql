-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE media_source_content_circuits (
  media_server_id INTEGER PRIMARY KEY REFERENCES media_server(id) ON DELETE CASCADE,
  source_revision BIGINT NOT NULL CHECK (source_revision > 0),
  epoch BIGINT NOT NULL DEFAULT 0 CHECK (epoch >= 0),
  state TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('closed','open','probing','review')),
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  reason TEXT CHECK (reason IN ('unreachable','timeout','rate_limited','provider_unavailable','probe_interrupted','probe_inconclusive')),
  next_attempt_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK ((state IN ('open','probing')) = (next_attempt_at IS NOT NULL))
);
-- Do not infer source outages from historical per-library errors.
