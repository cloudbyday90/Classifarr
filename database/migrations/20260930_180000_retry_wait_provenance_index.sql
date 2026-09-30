-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Startup migration: fail atomically rather than wait indefinitely for other writers.
-- The migration runner owns the transaction; CONCURRENTLY is not valid here.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE INDEX idx_enrichment_retry_wait_provenance
    ON enrichment_retry_queue (enrichment_type)
    WHERE status = 'pending' AND retry_wait_context IS NOT NULL
      AND retry_wait_until = next_attempt_at;
