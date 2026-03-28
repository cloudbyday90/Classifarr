/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { createRagCoreHelpers } = require('../routes/helpers/ragCoreHelpers');

describe('ragCoreHelpers', () => {
    const buildHelpers = (overrides = {}) => createRagCoreHelpers({
        isMaskedToken: jest.fn(() => false),
        embeddingProvider: {
            testConnection: jest.fn(),
            getEmbeddingModels: jest.fn(),
            getEmbedding: jest.fn()
        },
        imageEmbeddingProvider: {
            normalizeMode: jest.fn((mode) => mode),
            getLocalModels: jest.fn(),
            getConfig: jest.fn()
        },
        resolveImageModelMetadata: jest.fn(),
        resolveTextModelMetadata: jest.fn(),
        getStatusPayload: jest.fn(),
        getOverviewPayload: jest.fn(),
        getHealthPayload: jest.fn(),
        getCostsPayload: jest.fn(),
        getDetailedPayload: jest.fn(),
        getMetricsPayload: jest.fn(),
        parseDetailedHours: jest.fn((hours) => Number(hours || 24)),
        ...overrides
    });

    test('testConnection returns provider latency and dimensions', async () => {
        const embeddingProvider = {
            testConnection: jest.fn().mockResolvedValue({
                success: true,
                dimensions: 1024,
                provider: 'openai',
                model: 'text-embedding-3-large',
                error: null
            })
        };
        const helpers = buildHelpers({ embeddingProvider });

        const result = await helpers.testConnection({ provider: 'openai' });

        expect(embeddingProvider.testConnection).toHaveBeenCalledWith({ provider: 'openai' });
        expect(result).toMatchObject({
            success: true,
            dims: 1024,
            provider: 'openai',
            model: 'text-embedding-3-large',
            error: null
        });
        expect(result.latency).toEqual(expect.any(Number));
        expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    test('testImageConnection validates separate_local host requirement', async () => {
        const imageEmbeddingProvider = {
            normalizeMode: jest.fn(() => 'separate_local'),
            getLocalModels: jest.fn(),
            getConfig: jest.fn()
        };
        const helpers = buildHelpers({ imageEmbeddingProvider });

        const result = await helpers.testImageConnection({
            mode: 'separate_local',
            local_host: '   '
        });

        expect(result).toEqual({
            success: false,
            error: 'Local host is required'
        });
        expect(imageEmbeddingProvider.getLocalModels).not.toHaveBeenCalled();
    });

    test('testImageConnection falls back to stored cloud key when request key is masked', async () => {
        const embeddingProvider = {
            getEmbeddingModels: jest.fn().mockResolvedValue([
                { id: 'clip-large' },
                { id: 'clip-small' }
            ])
        };
        const imageEmbeddingProvider = {
            normalizeMode: jest.fn(() => 'cloud'),
            getLocalModels: jest.fn(),
            getConfig: jest.fn().mockResolvedValue({
                image_embedding_cloud_api_key: 'stored-key'
            })
        };
        const helpers = buildHelpers({
            isMaskedToken: jest.fn(() => true),
            embeddingProvider,
            imageEmbeddingProvider
        });

        const result = await helpers.testImageConnection({
            mode: 'cloud',
            cloud_provider: 'openai',
            cloud_api_key: '********',
            cloud_model: 'clip-small',
            cloud_api_endpoint: 'https://example.test'
        });

        expect(embeddingProvider.getEmbeddingModels).toHaveBeenCalledWith({
            provider: 'openai',
            api_key: 'stored-key',
            api_endpoint: 'https://example.test'
        });
        expect(result).toEqual({
            success: true,
            provider: 'openai',
            model: 'clip-small',
            modelsCount: 2
        });
    });
});
