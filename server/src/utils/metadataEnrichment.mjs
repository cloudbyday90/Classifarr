/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import metadataEnrichment from './metadataEnrichment.shared.js';

const {
    TAVILY_METADATA_KEYS,
    ENRICHMENT_METADATA_KEYS,
    hasTavilyEnrichmentMetadata,
    buildJsonbPresenceOr,
    buildJsonbDeleteChain
} = metadataEnrichment;

export {
    TAVILY_METADATA_KEYS,
    ENRICHMENT_METADATA_KEYS,
    hasTavilyEnrichmentMetadata,
    buildJsonbPresenceOr,
    buildJsonbDeleteChain
};

export default metadataEnrichment;
