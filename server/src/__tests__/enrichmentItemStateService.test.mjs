/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for EnrichmentItemStateService
 */
import { jest } from '@jest/globals';

import {
    deriveEnrichmentItemState,
    EnrichmentItemStateService
} from '../services/enrichmentItemStateService.mjs';
import {
    ENRICHMENT_ITEM_STATUSES,
    ENRICHMENT_PROVIDER_STATES,
    TAVILY_MONTHLY_DEFERRED_REASON
} from '../utils/enrichmentState.mjs';

describe('deriveEnrichmentItemState', () => {
    test('returns processing when active task/retry exists', () => {
        const result = deriveEnrichmentItemState({
            metadata: { omdb: { data: { Title: 'Test' } } },
            hasProcessingTask: true,
        });

        expect(result).toEqual({
            status: ENRICHMENT_ITEM_STATUSES.PROCESSING,
            providerState: ENRICHMENT_PROVIDER_STATES.OMDB,
            deferredReason: null,
        });
    });

    test('returns deferred when Tavily fallback is waiting on monthly reset', () => {
        const result = deriveEnrichmentItemState({
            metadata: {},
            hasDeferredRetry: true,
            deferredReason: TAVILY_MONTHLY_DEFERRED_REASON,
        });

        expect(result).toEqual({
            status: ENRICHMENT_ITEM_STATUSES.DEFERRED,
            providerState: ENRICHMENT_PROVIDER_STATES.NONE,
            deferredReason: TAVILY_MONTHLY_DEFERRED_REASON,
        });
    });

    test('returns completed when provider metadata exists and no work remains', () => {
        const result = deriveEnrichmentItemState({
            metadata: {
                omdb: { data: { Title: 'Test' } },
                tavily_holiday: { answer: 'Holiday title' }
            }
        });

        expect(result).toEqual({
            status: ENRICHMENT_ITEM_STATUSES.COMPLETED,
            providerState: ENRICHMENT_PROVIDER_STATES.OMDB_AND_TAVILY,
            deferredReason: null,
        });
    });

    test('returns failed when no provider data exists and retries failed', () => {
        const result = deriveEnrichmentItemState({
            metadata: {},
            hasFailedRetry: true,
        });

        expect(result).toEqual({
            status: ENRICHMENT_ITEM_STATUSES.FAILED,
            providerState: ENRICHMENT_PROVIDER_STATES.NONE,
            deferredReason: null,
        });
    });

    test('returns not_needed when enriched without OMDb and OMDb is inactive', () => {
        const result = deriveEnrichmentItemState({
            metadata: {
                content_analysis: { source: 'metadata_enrichment' }
            },
            isOmdbActive: false,
        });

        expect(result).toEqual({
            status: ENRICHMENT_ITEM_STATUSES.NOT_NEEDED,
            providerState: ENRICHMENT_PROVIDER_STATES.NONE,
            deferredReason: null,
        });
    });

    test('returns pending when enriched without OMDb but OMDb is active', () => {
        const result = deriveEnrichmentItemState({
            metadata: {
                content_analysis: { source: 'metadata_enrichment' }
            },
            isOmdbActive: true,
        });

        expect(result).toEqual({
            status: ENRICHMENT_ITEM_STATUSES.PENDING,
            providerState: ENRICHMENT_PROVIDER_STATES.NONE,
            deferredReason: null,
        });
    });
});

describe('EnrichmentItemStateService', () => {
    let db;
    let logger;
    let service;

    beforeEach(() => {
        db = { query: jest.fn() };
        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
        service = new EnrichmentItemStateService({ db, logger });
    });

    test('markProcessing updates item state without altering provider state', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 42,
                enrichment_status: ENRICHMENT_ITEM_STATUSES.PROCESSING,
                enrichment_provider_state: ENRICHMENT_PROVIDER_STATES.OMDB,
                enrichment_deferred_reason: null
            }]
        });

        const row = await service.markProcessing(42);

        expect(row.enrichment_status).toBe(ENRICHMENT_ITEM_STATUSES.PROCESSING);
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('SET enrichment_status = $2'),
            [42, ENRICHMENT_ITEM_STATUSES.PROCESSING]
        );
    });

    test('syncItemState persists explicit deferred state from snapshot', async () => {
        db.query
            .mockResolvedValueOnce({
                rows: [{
                    id: 7,
                    metadata: { omdb: { data: { Title: 'Movie' } } },
                    is_omdb_active: true,
                    has_processing_task: false,
                    has_pending_task: false,
                    has_failed_task: false,
                    has_processing_retry: false,
                    has_pending_retry: false,
                    has_deferred_retry: true,
                    has_failed_retry: false,
                    deferred_reason: TAVILY_MONTHLY_DEFERRED_REASON
                }]
            })
            .mockResolvedValueOnce({
                rows: [{
                    id: 7,
                    enrichment_status: ENRICHMENT_ITEM_STATUSES.DEFERRED,
                    enrichment_provider_state: ENRICHMENT_PROVIDER_STATES.OMDB,
                    enrichment_deferred_reason: TAVILY_MONTHLY_DEFERRED_REASON
                }]
            });

        const row = await service.syncItemState(7);

        expect(row).toEqual({
            id: 7,
            enrichment_status: ENRICHMENT_ITEM_STATUSES.DEFERRED,
            enrichment_provider_state: ENRICHMENT_PROVIDER_STATES.OMDB,
            enrichment_deferred_reason: TAVILY_MONTHLY_DEFERRED_REASON
        });
        expect(db.query).toHaveBeenLastCalledWith(
            expect.stringContaining('SET enrichment_status = $2'),
            [7, ENRICHMENT_ITEM_STATUSES.DEFERRED, ENRICHMENT_PROVIDER_STATES.OMDB, TAVILY_MONTHLY_DEFERRED_REASON]
        );
    });
});

