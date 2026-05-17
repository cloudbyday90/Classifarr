/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import { createRagStatusHelpers } from '../routes/helpers/ragStatusHelpers.mjs';

describe('ragStatusHelpers', () => {
    const buildHelpers = (overrides = {}) => createRagStatusHelpers({
        db: {
            query: jest.fn()
        },
        ragLogger: {
            getMetricsByOperation: jest.fn(),
            getHealthSummary: jest.fn(),
            getRecentErrors: jest.fn()
        },
        embeddingService: {
            getStats: jest.fn(),
            hasMinimumEmbeddings: jest.fn(),
            getImageStats: jest.fn(),
            shouldIncludeImageEmbeddings: jest.fn(),
            getPendingCount: jest.fn()
        },
        embeddingRouter: {
            getConfig: jest.fn(),
            getCircuitStatus: jest.fn(),
            getCircuitStateHistory: jest.fn()
        },
        embeddingProvider: {
            getMetrics: jest.fn()
        },
        imageEmbeddingProvider: {
            getConfig: jest.fn(),
            isConfigured: jest.fn(),
            getEffectiveModel: jest.fn()
        },
        getBackfillHistoryPayload: jest.fn().mockResolvedValue({ history: [] }),
        resolveEmbeddingAvailability: jest.fn(),
        isEmbeddingProviderConfigured: jest.fn(() => true),
        ...overrides
    });

    test('parseDetailedHours defaults to 24 and rejects invalid values', () => {
        const helpers = buildHelpers();

        expect(helpers.parseDetailedHours(undefined)).toBe(24);
        expect(helpers.parseDetailedHours('720')).toBe(720);
        expect(() => helpers.parseDetailedHours('0')).toThrow(
            "Invalid hours parameter: '0'. Must be an integer between 1 and 720."
        );
        expect(() => helpers.parseDetailedHours('721')).toThrow(
            "Invalid hours parameter: '721'. Must be an integer between 1 and 720."
        );
    });

    test('getStatusPayload reports not_configured image embeddings when provider is set up but zero image rows exist', async () => {
        const db = {
            query: jest.fn()
                .mockResolvedValueOnce({
                    rows: [
                        { key: 'avx_guard_pgvector_selected', value: 'pgvector-cpu' }
                    ]
                })
                .mockResolvedValueOnce({
                    rows: [{ text_failed_count: '0', image_failed_count: '0' }]
                })
        };
        const embeddingRouter = {
            getConfig: jest.fn().mockResolvedValue({
                rag_enabled: true,
                embedding_provider: 'openai',
                embedding_model: 'text-embedding-3-large',
                rag_min_history_count: 75,
                rag_image_weight: 0.35
            }),
            getCircuitStatus: jest.fn().mockResolvedValue({ state: 'CLOSED' }),
            getCircuitStateHistory: jest.fn()
        };
        const embeddingService = {
            getStats: jest.fn().mockResolvedValue({ total: 40, pendingRetries: 0 }),
            hasMinimumEmbeddings: jest.fn().mockResolvedValue(true),
            getImageStats: jest.fn().mockResolvedValue({ total: 0 }),
            shouldIncludeImageEmbeddings: jest.fn(),
            getPendingCount: jest.fn()
        };
        const imageEmbeddingProvider = {
            getConfig: jest.fn().mockResolvedValue({
                image_embedding_provider_mode: 'cloud',
                image_embedding_cloud_provider: 'openai',
                image_embedding_models_cache_updated_at: '2026-03-28T09:00:00.000Z'
            }),
            isConfigured: jest.fn(() => true),
            getEffectiveModel: jest.fn(() => 'clip-large')
        };
        const helpers = buildHelpers({
            db,
            embeddingRouter,
            embeddingService,
            imageEmbeddingProvider,
            resolveEmbeddingAvailability: jest.fn().mockResolvedValue({ status: 'available' })
        });

        const payload = await helpers.getStatusPayload();

        expect(payload.providerOnline).toBe(true);
        expect(payload.image).toEqual({
            enabled: true,
            providerOnline: true,
            providerConfigured: true,
            status: 'not_configured',
            providerMode: 'cloud',
            provider: 'openai',
            model: 'clip-large',
            stats: { total: 0, failedCount: 0 }
        });
        expect(payload.pgvectorVariant).toBe('pgvector-cpu');
        expect(payload.minimumRequired).toBe(75);
        expect(payload.stats.failedCount).toBe(0);
        expect(payload.stats.totalFailedCount).toBe(0);
    });

    test('getStatusPayload reports configured local image embeddings when image rows already exist', async () => {
        const db = {
            query: jest.fn()
                .mockResolvedValueOnce({
                    rows: []
                })
                .mockResolvedValueOnce({
                    rows: [{ text_failed_count: '0', image_failed_count: '2' }]
                })
        };
        const embeddingRouter = {
            getConfig: jest.fn().mockResolvedValue({
                rag_enabled: true,
                embedding_provider: 'openai',
                embedding_model: 'text-embedding-3-large',
                rag_min_history_count: 25,
                rag_image_weight: 0.5
            }),
            getCircuitStatus: jest.fn().mockResolvedValue({ state: 'CLOSED' }),
            getCircuitStateHistory: jest.fn()
        };
        const embeddingService = {
            getStats: jest.fn().mockResolvedValue({ total: 8 }),
            hasMinimumEmbeddings: jest.fn().mockResolvedValue(false),
            getImageStats: jest.fn().mockResolvedValue({ total: 3 }),
            shouldIncludeImageEmbeddings: jest.fn(),
            getPendingCount: jest.fn()
        };
        const imageEmbeddingProvider = {
            getConfig: jest.fn().mockResolvedValue({
                image_embedding_provider_mode: 'local',
                image_embedding_local_host: '127.0.0.1'
            }),
            isConfigured: jest.fn(() => true),
            getEffectiveModel: jest.fn(() => 'jina-clip-v2')
        };
        const helpers = buildHelpers({
            db,
            embeddingRouter,
            embeddingService,
            imageEmbeddingProvider,
            resolveEmbeddingAvailability: jest.fn().mockResolvedValue({ status: 'available' })
        });

        const payload = await helpers.getStatusPayload();

        expect(payload.image).toEqual({
            enabled: true,
            providerOnline: true,
            providerConfigured: true,
            status: 'configured',
            providerMode: 'separate_local',
            provider: 'local',
            model: 'jina-clip-v2',
            stats: { total: 3, failedCount: 2 }
        });
        expect(payload.stats.failedCount).toBe(0);
        expect(payload.stats.totalFailedCount).toBe(2);
    });

    test('getOverviewPayload carries includeImage into pending-count lookup and respects offline availability', async () => {
        const db = {
            query: jest.fn()
                .mockResolvedValueOnce({ rows: [{ total: '18' }] })
                .mockResolvedValueOnce({ rows: [{ text_failed_count: '3', image_failed_count: '4' }] })
                .mockResolvedValueOnce({
                    rows: [{ avg_time: '123.8', last_time: '2026-03-28T09:30:00.000Z' }]
                })
                .mockResolvedValueOnce({
                    rows: [{ id: 11, message: 'recent activity' }]
                })
        };
        const embeddingRouter = {
            getConfig: jest.fn().mockResolvedValue({
                embedding_provider_mode: 'cloud',
                embedding_model: 'text-embedding-3-small'
            }),
            getCircuitStatus: jest.fn().mockResolvedValue({ state: 'OPEN' }),
            getCircuitStateHistory: jest.fn()
        };
        const embeddingService = {
            getStats: jest.fn(),
            hasMinimumEmbeddings: jest.fn(),
            getImageStats: jest.fn(),
            shouldIncludeImageEmbeddings: jest.fn().mockResolvedValue(true),
            getPendingCount: jest.fn().mockResolvedValue(9)
        };
        const helpers = buildHelpers({
            db,
            embeddingRouter,
            embeddingService,
            resolveEmbeddingAvailability: jest.fn().mockResolvedValue({ status: 'cooldown' })
        });

        const payload = await helpers.getOverviewPayload();

        expect(embeddingService.getPendingCount).toHaveBeenCalledWith({ includeImage: true });
        expect(payload).toEqual({
            providerConfigured: true,
            providerOnline: false,
            embeddingAvailability: { status: 'cooldown' },
            stats: {
                totalEmbeddings: 18,
                pendingCount: 9,
                failedCount: 3,
                imageFailedCount: 4,
                totalFailedCount: 7,
                avgGenerationTime: 124,
                lastEmbeddingTime: '2026-03-28T09:30:00.000Z'
            },
            config: {
                embedding_provider_mode: 'cloud'
            },
            currentModel: 'text-embedding-3-small',
            recentActivity: [{ id: 11, message: 'recent activity' }]
        });
    });

    test('getOverviewPayload falls back to an unknown model when the config has no explicit model fields', async () => {
        const db = {
            query: jest.fn()
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [{ text_failed_count: '0', image_failed_count: '0' }] })
                .mockResolvedValueOnce({ rows: [{}] })
                .mockResolvedValueOnce({ rows: [] })
        };
        const embeddingRouter = {
            getConfig: jest.fn().mockResolvedValue({
                embedding_provider_mode: 'same'
            }),
            getCircuitStatus: jest.fn().mockResolvedValue({ state: 'CLOSED' }),
            getCircuitStateHistory: jest.fn()
        };
        const embeddingService = {
            getStats: jest.fn(),
            hasMinimumEmbeddings: jest.fn(),
            getImageStats: jest.fn(),
            shouldIncludeImageEmbeddings: jest.fn().mockResolvedValue(false),
            getPendingCount: jest.fn().mockResolvedValue(0)
        };
        const helpers = buildHelpers({
            db,
            embeddingRouter,
            embeddingService,
            resolveEmbeddingAvailability: jest.fn().mockResolvedValue({ status: 'available' }),
            isEmbeddingProviderConfigured: jest.fn(() => false)
        });

        const payload = await helpers.getOverviewPayload();

        expect(payload.providerConfigured).toBe(false);
        expect(payload.providerOnline).toBe(false);
        expect(payload.currentModel).toBe('unknown');
    });

    test('getDetailedPayload normalizes breaker diagnostics and provider metrics', async () => {
        const db = {
            query: jest.fn()
                .mockResolvedValueOnce({
                    rows: [{ text_failed_count: '2', image_failed_count: '1' }]
                })
                .mockResolvedValueOnce({
                    rows: [{ avg_time: '88.4', last_time: '2026-03-28T08:00:00.000Z' }]
                })
        };
        const ragLogger = {
            getMetricsByOperation: jest.fn()
                .mockResolvedValueOnce({ requests: 1 })
                .mockResolvedValueOnce({ requests: 2 })
                .mockResolvedValueOnce({ requests: 3 })
                .mockResolvedValueOnce({ requests: 4 }),
            getHealthSummary: jest.fn(),
            getRecentErrors: jest.fn()
        };
        const embeddingService = {
            getStats: jest.fn().mockResolvedValue({
                totalEmbeddings: 22,
                pendingCount: 5
            }),
            hasMinimumEmbeddings: jest.fn(),
            getImageStats: jest.fn(),
            shouldIncludeImageEmbeddings: jest.fn(),
            getPendingCount: jest.fn()
        };
        const embeddingRouter = {
            getConfig: jest.fn().mockResolvedValue({
                embedding_provider: 'openai',
                embedding_model: 'text-embedding-3-large',
                embedding_dims: 3072
            }),
            getCircuitStatus: jest.fn().mockResolvedValue({
                state: 'HALF_OPEN',
                failures: 6,
                lastFailure: '2026-03-28T07:30:00.000Z',
                config: { failureThreshold: 5 }
            }),
            getCircuitStateHistory: jest.fn(() => [{ state: 'OPEN' }, { state: 'HALF_OPEN' }])
        };
        const embeddingProvider = {
            getMetrics: jest.fn(() => ({ openai: { requests: 6 } }))
        };
        const getBackfillHistoryPayload = jest.fn().mockResolvedValue({
            history: [{ id: 91, created_at: '2026-03-28T07:00:00.000Z' }]
        });
        const helpers = buildHelpers({
            db,
            ragLogger,
            embeddingService,
            embeddingRouter,
            embeddingProvider,
            getBackfillHistoryPayload,
            resolveEmbeddingAvailability: jest.fn().mockResolvedValue({ status: 'available' })
        });

        const payload = await helpers.getDetailedPayload(48);

        expect(ragLogger.getMetricsByOperation).toHaveBeenNthCalledWith(1, 'semantic_search', 48);
        expect(getBackfillHistoryPayload).toHaveBeenCalled();
        expect(payload.stats).toEqual({
            totalEmbeddings: 22,
            pendingCount: 5,
            failedCount: 2,
            imageFailedCount: 1,
            totalFailedCount: 3,
            avgGenerationTime: 88,
            lastEmbeddingTime: '2026-03-28T08:00:00.000Z'
        });
        expect(payload.circuitBreaker).toEqual({
            state: 'HALF_OPEN',
            failureCount: 6,
            lastFailureTime: '2026-03-28T07:30:00.000Z',
            stateHistory: [{ state: 'OPEN' }, { state: 'HALF_OPEN' }],
            config: { failureThreshold: 5 }
        });
        expect(payload.providerMetrics).toEqual({
            openai: { requests: 6 }
        });
        expect(payload.backfillHistory).toEqual([
            { id: 91, created_at: '2026-03-28T07:00:00.000Z' }
        ]);
        expect(payload.config).toEqual({
            provider: 'openai',
            model: 'text-embedding-3-large',
            dimensions: 3072
        });
        expect(payload.timestamp).toEqual(expect.any(String));
    });

    test('getMetricsPayload reuses the shared operation metrics collector and returns provider metrics under the public shape', async () => {
        const ragLogger = {
            getMetricsByOperation: jest.fn()
                .mockResolvedValueOnce({ samples: 1 })
                .mockResolvedValueOnce({ samples: 2 })
                .mockResolvedValueOnce({ samples: 3 })
                .mockResolvedValueOnce({ samples: 4 }),
            getHealthSummary: jest.fn(),
            getRecentErrors: jest.fn()
        };
        const embeddingProvider = {
            getMetrics: jest.fn(() => ({ openai: { requests: 12 } }))
        };
        const helpers = buildHelpers({
            ragLogger,
            embeddingProvider
        });

        const payload = await helpers.getMetricsPayload('72');

        expect(ragLogger.getMetricsByOperation).toHaveBeenNthCalledWith(1, 'semantic_search', 72);
        expect(payload).toEqual({
            semantic_search: { samples: 1 },
            hybrid_search: { samples: 2 },
            embedding_generation: { samples: 3 },
            pattern_mining: { samples: 4 },
            provider: { openai: { requests: 12 } }
        });
    });

    test('getStatusPayload normalizes local image mode and returns not_configured when image support is effectively off', async () => {
        const db = {
            query: jest.fn()
                .mockRejectedValueOnce(new Error('settings table missing'))
                .mockResolvedValueOnce({ rows: [{ text_failed_count: '0', image_failed_count: '0' }] })
        };
        const embeddingRouter = {
            getConfig: jest.fn().mockResolvedValue({
                rag_enabled: false,
                embedding_provider: 'openai',
                rag_image_weight: 0,
                embedding_provider_mode: 'cloud'
            }),
            getCircuitStatus: jest.fn().mockResolvedValue({ state: 'CLOSED' }),
            getCircuitStateHistory: jest.fn()
        };
        const embeddingService = {
            getStats: jest.fn().mockResolvedValue({ total: 0 }),
            hasMinimumEmbeddings: jest.fn().mockResolvedValue(false),
            getImageStats: jest.fn().mockResolvedValue({ total: 0 }),
            shouldIncludeImageEmbeddings: jest.fn(),
            getPendingCount: jest.fn()
        };
        const imageEmbeddingProvider = {
            getConfig: jest.fn().mockResolvedValue({
                image_embedding_provider_mode: 'local',
                image_embedding_local_host: '127.0.0.1'
            }),
            isConfigured: jest.fn(() => false),
            getEffectiveModel: jest.fn(() => null)
        };
        const helpers = buildHelpers({
            db,
            embeddingRouter,
            embeddingService,
            imageEmbeddingProvider,
            resolveEmbeddingAvailability: jest.fn().mockResolvedValue({ status: 'available' }),
            isEmbeddingProviderConfigured: jest.fn(() => false)
        });

        const payload = await helpers.getStatusPayload();

        expect(payload.providerConfigured).toBe(false);
        expect(payload.providerOnline).toBe(false);
        expect(payload.image).toEqual({
            enabled: false,
            providerOnline: false,
            providerConfigured: false,
            status: 'disabled',
            providerMode: 'separate_local',
            provider: 'local',
            model: null,
            stats: { total: 0, failedCount: 0 }
        });
        expect(payload.pgvectorVariant).toBeNull();
    });

    test('getDetailedPayload falls back to safe defaults when breaker and config fields are missing', async () => {
        const db = {
            query: jest.fn()
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValueOnce({ rows: [{}] })
        };
        const ragLogger = {
            getMetricsByOperation: jest.fn()
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({}),
            getHealthSummary: jest.fn(),
            getRecentErrors: jest.fn()
        };
        const embeddingService = {
            getStats: jest.fn().mockResolvedValue({}),
            hasMinimumEmbeddings: jest.fn(),
            getImageStats: jest.fn(),
            shouldIncludeImageEmbeddings: jest.fn(),
            getPendingCount: jest.fn()
        };
        const embeddingRouter = {
            getConfig: jest.fn().mockResolvedValue({}),
            getCircuitStatus: jest.fn().mockResolvedValue({}),
            getCircuitStateHistory: jest.fn(() => [])
        };
        const helpers = buildHelpers({
            db,
            ragLogger,
            embeddingService,
            embeddingRouter,
            resolveEmbeddingAvailability: jest.fn().mockResolvedValue({ status: 'probe_due' })
        });

        const payload = await helpers.getDetailedPayload(24);

        expect(payload.stats).toEqual({
            totalEmbeddings: 0,
            pendingCount: 0,
            failedCount: 0,
            imageFailedCount: 0,
            totalFailedCount: 0,
            avgGenerationTime: 0,
            lastEmbeddingTime: null
        });
        expect(payload.providerOnline).toBe(false);
        expect(payload.circuitBreaker).toEqual({
            state: 'unknown',
            failureCount: 0,
            lastFailureTime: null,
            stateHistory: [],
            config: {}
        });
        expect(payload.config).toEqual({
            provider: 'unknown',
            model: 'unknown',
            dimensions: 0
        });
    });

    test('getHealthPayload returns the health summary and recent errors directly', async () => {
        const ragLogger = {
            getMetricsByOperation: jest.fn(),
            getHealthSummary: jest.fn().mockResolvedValue({ status: 'healthy' }),
            getRecentErrors: jest.fn().mockResolvedValue([{ id: 1, message: 'none' }])
        };
        const helpers = buildHelpers({
            ragLogger
        });

        const payload = await helpers.getHealthPayload();

        expect(payload).toEqual({
            health: { status: 'healthy' },
            recentErrors: [{ id: 1, message: 'none' }]
        });
    });

    test('getCostsPayload parses numeric cost aggregates', async () => {
        const db = {
            query: jest.fn().mockResolvedValue({
                rows: [{
                    provider: 'openai',
                    total_tokens: '1234',
                    total_items: '17',
                    total_cost: '0.42'
                }]
            })
        };
        const helpers = buildHelpers({
            db
        });

        const payload = await helpers.getCostsPayload();

        expect(payload).toEqual({
            last30Days: [{
                provider: 'openai',
                tokens: 1234,
                items: 17,
                cost: 0.42
            }]
        });
    });
});
