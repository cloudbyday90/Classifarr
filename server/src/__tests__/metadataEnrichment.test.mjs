/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
    ENRICHMENT_METADATA_KEYS,
    TAVILY_METADATA_KEYS,
    WEB_SEARCH_METADATA_KEYS,
    buildJsonbDeleteChain,
    buildJsonbPresenceOr,
    hasTavilyEnrichmentMetadata,
    hasWebSearchEnrichmentMetadata,
} from '../utils/metadataEnrichment.mjs';

describe('metadataEnrichment', () => {
    test('exposes stable Tavily and enrichment key sets', () => {
        expect(TAVILY_METADATA_KEYS).toEqual([
            'tavily_imdb',
            'tavily_advisory',
            'tavily_content_type',
            'tavily_holiday',
            'tavily_anime'
        ]);
        expect(WEB_SEARCH_METADATA_KEYS).toEqual([
            'web_search_imdb',
            'web_search_advisory',
            'web_search_content_type',
            'web_search_holiday',
            'web_search_anime'
        ]);
        expect(ENRICHMENT_METADATA_KEYS).toEqual([
            'omdb',
            ...TAVILY_METADATA_KEYS,
            ...WEB_SEARCH_METADATA_KEYS
        ]);
    });

    test('detects Tavily enrichment metadata and builds jsonb SQL helpers', () => {
        expect(hasTavilyEnrichmentMetadata({ tavily_holiday: { answer: 'yes' } })).toBe(true);
        expect(hasTavilyEnrichmentMetadata({ omdb: { title: 'x' } })).toBe(false);
        expect(hasWebSearchEnrichmentMetadata({ web_search_holiday: { answer: 'yes' } })).toBe(true);
        expect(hasWebSearchEnrichmentMetadata({ tavily_holiday: { answer: 'yes' } })).toBe(true);

        expect(buildJsonbPresenceOr('metadata', ['omdb', 'tavily_imdb'])).toBe(
            "metadata->'omdb' IS NOT NULL OR metadata->'tavily_imdb' IS NOT NULL"
        );
        expect(buildJsonbDeleteChain("COALESCE(metadata, '{}'::jsonb)", ['omdb', 'tavily_imdb'])).toBe(
            "COALESCE(metadata, '{}'::jsonb)\n         - 'omdb'\n         - 'tavily_imdb'"
        );
    });
});
