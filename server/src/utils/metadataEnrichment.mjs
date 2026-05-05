/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Metadata enrichment helper utilities.
 */
const TAVILY_METADATA_KEYS = [
    'tavily_imdb',
    'tavily_advisory',
    'tavily_content_type',
    'tavily_holiday',
    'tavily_anime'
];

const ENRICHMENT_METADATA_KEYS = [
    'omdb',
    ...TAVILY_METADATA_KEYS
];

function hasTavilyEnrichmentMetadata(metadata = {}) {
    return TAVILY_METADATA_KEYS.some((key) => Boolean(metadata?.[key]));
}

function buildJsonbPresenceOr(columnName, keys) {
    return keys.map((key) => `${columnName}->'${key}' IS NOT NULL`).join(' OR ');
}

function buildJsonbDeleteChain(baseExpression, keys) {
    return keys.reduce((expression, key) => `${expression}\n         - '${key}'`, baseExpression);
}

const metadataEnrichment = {
    TAVILY_METADATA_KEYS,
    ENRICHMENT_METADATA_KEYS,
    hasTavilyEnrichmentMetadata,
    buildJsonbPresenceOr,
    buildJsonbDeleteChain
};

export { TAVILY_METADATA_KEYS, ENRICHMENT_METADATA_KEYS, hasTavilyEnrichmentMetadata, buildJsonbPresenceOr, buildJsonbDeleteChain };
export default metadataEnrichment;
