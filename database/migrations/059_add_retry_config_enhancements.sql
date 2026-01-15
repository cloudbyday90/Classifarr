-- v0.39.0-alpha: Enhanced Retry Configuration and Circuit Breaker Support
-- Add additional retry configuration columns for adaptive timeouts and exponential backoff

-- ============================================================================
-- 1. ENHANCED RETRY CONFIGURATION COLUMNS
-- ============================================================================

-- Warmup timeout for cold model detection
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS warmup_timeout INTEGER DEFAULT 120000;

-- Retry backoff multiplier (exponential backoff)
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS retry_backoff_multiplier NUMERIC(3,1) DEFAULT 2.0;

-- Jitter factor for randomizing retry delays (0-1)
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS jitter_factor NUMERIC(3,2) DEFAULT 0.3;

-- ============================================================================
-- NOTES
-- ============================================================================
-- This migration enhances the retry configuration system with:
--
-- 1. Adaptive Timeouts:
--    - warmup_timeout: Extended timeout (default 120s) for cold models
--    - Works with existing request_timeout (default 30s) for warm models
--
-- 2. Exponential Backoff:
--    - retry_backoff_multiplier: Multiplier for exponential delay growth (default 2.0)
--    - Works with existing retry_delay as base delay (default 1000ms)
--    - Example sequence: 1s -> 2s -> 4s for multiplier of 2.0
--
-- 3. Jitter:
--    - jitter_factor: Randomization factor to prevent thundering herd (default 0.3)
--    - Adds ±30% randomness to retry delays
--
-- Together with migration 057's retry columns (max_retries, retry_delay, request_timeout),
-- this provides complete adaptive retry logic with circuit breaker support.
-- ============================================================================
