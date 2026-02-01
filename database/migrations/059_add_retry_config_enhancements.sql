-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

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
ADD COLUMN IF NOT EXISTS retry_backoff_multiplier NUMERIC(3,1) 
    CHECK (retry_backoff_multiplier >= 1.0 AND retry_backoff_multiplier <= 5.0)
    DEFAULT 2.0;

-- Jitter factor for randomizing retry delays (0-1)
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS jitter_factor NUMERIC(3,2)
    CHECK (jitter_factor >= 0 AND jitter_factor <= 1)
    DEFAULT 0.3;

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
