/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { createRagModelMetadataHelpers } = require('../routes/helpers/ragModelMetadataHelpers');

describe('ragModelMetadataHelpers', () => {
    const buildHelpers = (overrides = {}) => createRagModelMetadataHelpers({
        db: {
            query: jest.fn()
        },
        logger: {
            warn: jest.fn()
        },
        isMaskedToken: jest.fn(() => false),
        embeddingRouter: {
            getConfig: jest.fn()
        },
        embeddingProvider: {
            getSameModeProvider: jest.fn(),
            getRecommendedModels: jest.fn(),
            getEmbeddingModels: jest.fn()
        },
        imageEmbeddingProvider: {
            getConfig: jest.fn(),
            normalizeMode: jest.fn((mode) => mode),
            getLocalModels: jest.fn()
        },
        ...overrides
    });

    test('resolveTextModelMetadata uses same-mode provider resolution and stored credentials when request fields are masked', async () => {
        const embeddingRouter = {
            getConfig: jest.fn().mockResolvedValue({
                embedding_provider_mode: 'same',
                api_key: 'stored-openai-key',
                api_endpoint: 'https://api.openai.test'
            })
        };
        const embeddingProvider = {
            getSameModeProvider: jest.fn(() => ({ provider: 'openai' })),
            getRecommendedModels: jest.fn(() => ({
                openai: [{ id: 'text-embedding-3-large' }]
            })),
            getEmbeddingModels: jest.fn().mockResolvedValue([
                { id: 'text-embedding-3-large' }
            ])
        };
        const helpers = buildHelpers({
            embeddingRouter,
            embeddingProvider,
            isMaskedToken: jest.fn((value) => value === '********')
        });

        const result = await helpers.resolveTextModelMetadata({
            api_key: '********'
        });

        expect(embeddingProvider.getSameModeProvider).toHaveBeenCalledWith({
            embedding_provider_mode: 'same',
            api_key: 'stored-openai-key',
            api_endpoint: 'https://api.openai.test'
        });
        expect(embeddingProvider.getEmbeddingModels).toHaveBeenCalledWith({
            provider: 'openai',
            api_key: 'stored-openai-key',
            api_endpoint: 'https://api.openai.test'
        });
        expect(result).toEqual({
            mode: 'same',
            provider: 'openai',
            recommended: [{ id: 'text-embedding-3-large' }],
            models: [{ id: 'text-embedding-3-large' }]
        });
    });

    test('resolveTextModelMetadata skips remote model discovery for ollama-backed selections', async () => {
        const embeddingRouter = {
            getConfig: jest.fn().mockResolvedValue({
                embedding_provider_mode: 'separate_ollama'
            })
        };
        const embeddingProvider = {
            getSameModeProvider: jest.fn(),
            getRecommendedModels: jest.fn(() => ({
                ollama: [{ id: 'mxbai-embed-large' }]
            })),
            getEmbeddingModels: jest.fn()
        };
        const helpers = buildHelpers({
            embeddingRouter,
            embeddingProvider
        });

        const result = await helpers.resolveTextModelMetadata();

        expect(embeddingProvider.getEmbeddingModels).not.toHaveBeenCalled();
        expect(result).toEqual({
            mode: 'separate_ollama',
            provider: 'ollama',
            recommended: [{ id: 'mxbai-embed-large' }],
            models: []
        });
    });

    test('resolveImageModelMetadata returns a cache hit without refresh when the cloud lookup matches the stored cache key', async () => {
        const imageEmbeddingProvider = {
            getConfig: jest.fn().mockResolvedValue({
                image_embedding_provider_mode: 'cloud',
                image_embedding_cloud_provider: 'openai',
                image_embedding_cloud_api_endpoint: 'https://api.openai.test',
                image_embedding_models_cache: {
                    cloud: {
                        provider: 'openai',
                        api_endpoint: 'https://api.openai.test',
                        models: [{ id: 'clip-large' }],
                        fetched_at: '2026-03-28T06:00:00.000Z'
                    }
                }
            }),
            normalizeMode: jest.fn(() => 'cloud'),
            getLocalModels: jest.fn()
        };
        const embeddingProvider = {
            getSameModeProvider: jest.fn(),
            getRecommendedModels: jest.fn(),
            getEmbeddingModels: jest.fn()
        };
        const helpers = buildHelpers({
            imageEmbeddingProvider,
            embeddingProvider
        });

        const result = await helpers.resolveImageModelMetadata({
            refresh: false
        });

        expect(embeddingProvider.getEmbeddingModels).not.toHaveBeenCalled();
        expect(result).toEqual({
            mode: 'cloud',
            scope: 'cloud',
            models: [{ id: 'clip-large' }],
            fetchedAt: '2026-03-28T06:00:00.000Z',
            cacheHit: true
        });
    });

    test('resolveImageModelMetadata refreshes local models and writes an updated cache entry', async () => {
        const db = {
            query: jest.fn()
                .mockResolvedValueOnce({
                    rows: [{
                        image_embedding_models_cache: {
                            cloud: { models: [{ id: 'remote' }] }
                        }
                    }]
                })
                .mockResolvedValueOnce({ rows: [] })
        };
        const imageEmbeddingProvider = {
            getConfig: jest.fn().mockResolvedValue({
                image_embedding_provider_mode: 'separate_local',
                image_embedding_local_host: '127.0.0.1',
                image_embedding_local_port: 8080
            }),
            normalizeMode: jest.fn(() => 'separate_local'),
            getLocalModels: jest.fn().mockResolvedValue([
                { id: 'jina-clip-v1' }
            ])
        };
        const helpers = buildHelpers({
            db,
            imageEmbeddingProvider
        });

        const result = await helpers.resolveImageModelMetadata({
            refresh: true
        });

        expect(imageEmbeddingProvider.getLocalModels).toHaveBeenCalledWith({
            image_embedding_local_host: '127.0.0.1',
            image_embedding_local_port: 8080
        });
        expect(db.query).toHaveBeenNthCalledWith(
            1,
            'SELECT image_embedding_models_cache FROM ai_provider_config WHERE id = 1'
        );
        expect(db.query).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('UPDATE ai_provider_config'),
            [expect.objectContaining({
                cloud: { models: [{ id: 'remote' }] },
                local: expect.objectContaining({
                    host: '127.0.0.1',
                    port: 8080,
                    models: [{ id: 'jina-clip-v1' }],
                    fetched_at: expect.any(String)
                })
            })]
        );
        expect(result).toEqual({
            mode: 'separate_local',
            scope: 'local',
            models: [{ id: 'jina-clip-v1' }],
            fetchedAt: expect.any(String),
            cacheHit: false
        });
    });
});
