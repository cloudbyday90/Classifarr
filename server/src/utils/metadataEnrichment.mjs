/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Metadata enrichment helper utilities.
 */
export const TAVILY_METADATA_KEYS = [
    'tavily_imdb',
    'tavily_advisory',
    'tavily_content_type',
    'tavily_holiday',
    'tavily_anime'
];

export const WEB_SEARCH_METADATA_KEYS = [
    'web_search_imdb',
    'web_search_advisory',
    'web_search_content_type',
    'web_search_holiday',
    'web_search_anime'
];

/** @internal */
export const ENRICHMENT_METADATA_KEYS = [
    'omdb',
    ...TAVILY_METADATA_KEYS,
    ...WEB_SEARCH_METADATA_KEYS
];

/** @internal */
export function hasTavilyEnrichmentMetadata(metadata = {}) {
    return TAVILY_METADATA_KEYS.some((key) => Boolean(metadata?.[key]));
}

/** @internal */
export function hasWebSearchEnrichmentMetadata(metadata = {}) {
    return [
        ...TAVILY_METADATA_KEYS,
        ...WEB_SEARCH_METADATA_KEYS
    ].some((key) => Boolean(metadata?.[key]));
}

/** @internal */
export function buildJsonbPresenceOr(columnName, keys) {
    return keys.map((key) => `${columnName}->'${key}' IS NOT NULL`).join(' OR ');
}

/** @internal */
export function buildJsonbDeleteChain(baseExpression, keys) {
    return keys.reduce((expression, key) => `${expression}\n         - '${key}'`, baseExpression);
}
