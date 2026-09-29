-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
ALTER TABLE enrichment_retry_queue
    ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Preserve the historical monthly wait without inventing ownership or retrying
-- terminal records. PostgreSQL's clock is the authority; reset boundaries are UTC.
UPDATE enrichment_retry_queue
SET next_attempt_at = (date_trunc('month', COALESCE(last_attempt_at, created_at)
    AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC'
WHERE enrichment_type = 'tavily' AND status = 'pending'
    AND reason = 'tavily_monthly_quota_deferred';

CREATE INDEX idx_enrichment_retry_due
    ON enrichment_retry_queue (enrichment_type, next_attempt_at, priority, id)
    WHERE status = 'pending';

CREATE TABLE enrichment_retry_cooldowns (
    dependency TEXT PRIMARY KEY CHECK (dependency IN ('omdb', 'web_search')),
    next_attempt_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL
);
