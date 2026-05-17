/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Shared enrichment state constants and helpers.
 */
import { TAVILY_METADATA_KEYS } from './metadataEnrichment.mjs';

export const ENRICHMENT_ITEM_STATUSES = Object.freeze({
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    DEFERRED: 'deferred',
    FAILED: 'failed',
});

export const ENRICHMENT_PROVIDER_STATES = Object.freeze({
    NONE: 'none',
    OMDB: 'omdb',
    TAVILY: 'tavily',
    OMDB_AND_TAVILY: 'omdb+tavily',
});

export const TAVILY_MONTHLY_DEFERRED_REASON = 'tavily_monthly_quota_deferred';
export const TAVILY_MONTHLY_DEFERRED_MESSAGE = 'Tavily monthly quota reached; deferred until next month reset';

export function detectEnrichmentProviderState(metadata = {}) {
    const hasOmdb = Boolean(metadata?.omdb);
    const hasTavily = TAVILY_METADATA_KEYS.some((key) => Boolean(metadata?.[key]));

    if (hasOmdb && hasTavily) {
        return ENRICHMENT_PROVIDER_STATES.OMDB_AND_TAVILY;
    }
    if (hasOmdb) {
        return ENRICHMENT_PROVIDER_STATES.OMDB;
    }
    if (hasTavily) {
        return ENRICHMENT_PROVIDER_STATES.TAVILY;
    }

    return ENRICHMENT_PROVIDER_STATES.NONE;
}

export function isDeferredRetryReason(reason) {
    return reason === TAVILY_MONTHLY_DEFERRED_REASON;
}

