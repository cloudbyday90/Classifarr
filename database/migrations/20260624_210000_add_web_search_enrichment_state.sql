-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Retain historical Tavily values while allowing provider-neutral web-search
-- execution to identify its persisted outcome accurately.
ALTER TABLE media_server_items
    DROP CONSTRAINT IF EXISTS media_server_items_enrichment_provider_state_check;

ALTER TABLE media_server_items
    ADD CONSTRAINT media_server_items_enrichment_provider_state_check
    CHECK (
        enrichment_provider_state IN (
            'none',
            'omdb',
            'tavily',
            'omdb+tavily',
            'web_search',
            'omdb+web_search'
        )
    );

COMMENT ON COLUMN media_server_items.enrichment_provider_state IS
    'Provider outcome persisted on the item row. Tavily values are historical; web_search identifies provider-neutral enrichment.';
