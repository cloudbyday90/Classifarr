-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Preserve UUID history while accepting the bounded text trace contract already
-- used by retry requests, route decisions and provider health events.
ALTER TABLE web_search_provider_usage
    ALTER COLUMN correlation_id TYPE VARCHAR(120) USING correlation_id::text;
