/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { createRagStatusHelpers } = require('../routes/helpers/ragStatusHelpers');

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
        expect(() => helpers.parseDetailedHours('0')).toThrow(
            "Invalid hours parameter: '0'. Must be an integer between 1 and 720."
        );
    });

    test('getStatusPayload reports configured image embeddings when validated cache exists even with zero image rows', async () => {
        const db = {
            query: jest.fn().mockResolvedValue({
                rows: [
                    { key: 'avx_guard_pgvector_selected', value: 'pgvector-cpu' }
                ]
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
            status: 'configured',
            providerMode: 'cloud',
            provider: 'openai',
            model: 'clip-large',
            stats: { total: 0 }
        });
        expect(payload.pgvectorVariant).toBe('pgvector-cpu');
        expect(payload.minimumRequired).toBe(75);
    });

    test('getOverviewPayload carries includeImage into pending-count lookup and respects offline availability', async () => {
        const db = {
            query: jest.fn()
                .mockResolvedValueOnce({ rows: [{ total: '18' }] })
                .mockResolvedValueOnce({ rows: [{ count: '3' }] })
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

    test('getDetailedPayload normalizes breaker diagnostics and provider metrics', async () => {
        const db = {
            query: jest.fn()
                .mockResolvedValueOnce({
                    rows: [{ count: '2' }]
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
});
