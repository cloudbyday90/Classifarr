/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

let createRagModelMetadataHelpers;

describe('ragModelMetadataHelpers', () => {
    beforeAll(async () => {
        ({ createRagModelMetadataHelpers } = await import('../routes/helpers/ragModelMetadataHelpers.mjs'));
    });

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

    test('resolveImageModelMetadata returns a cache hit for matching local host and port lookups', async () => {
        const imageEmbeddingProvider = {
            getConfig: jest.fn().mockResolvedValue({
                image_embedding_provider_mode: 'separate_local',
                image_embedding_local_host: '127.0.0.1',
                image_embedding_local_port: 8080,
                image_embedding_models_cache: {
                    local: {
                        host: '127.0.0.1',
                        port: 8080,
                        models: [{ id: 'jina-clip-v2' }],
                        fetched_at: '2026-03-28T07:00:00.000Z'
                    }
                }
            }),
            normalizeMode: jest.fn(() => 'separate_local'),
            getLocalModels: jest.fn()
        };
        const helpers = buildHelpers({
            imageEmbeddingProvider
        });

        const result = await helpers.resolveImageModelMetadata({
            refresh: false
        });

        expect(result).toEqual({
            mode: 'separate_local',
            scope: 'local',
            models: [{ id: 'jina-clip-v2' }],
            fetchedAt: '2026-03-28T07:00:00.000Z',
            cacheHit: true
        });
    });

    test('resolveImageModelMetadata returns a cache miss when the stored cloud cache does not match the requested endpoint', async () => {
        const imageEmbeddingProvider = {
            getConfig: jest.fn().mockResolvedValue({
                image_embedding_provider_mode: 'cloud',
                image_embedding_cloud_provider: 'openai',
                image_embedding_cloud_api_endpoint: 'https://api.openai.test',
                image_embedding_models_cache: {
                    cloud: {
                        provider: 'openai',
                        api_endpoint: 'https://different.example',
                        models: [{ id: 'clip-large' }],
                        fetched_at: '2026-03-28T06:00:00.000Z'
                    }
                }
            }),
            normalizeMode: jest.fn(() => 'cloud'),
            getLocalModels: jest.fn()
        };
        const helpers = buildHelpers({
            imageEmbeddingProvider
        });

        const result = await helpers.resolveImageModelMetadata({
            refresh: false
        });

        expect(result).toEqual({
            mode: 'cloud',
            scope: 'cloud',
            models: [],
            fetchedAt: null,
            cacheHit: false
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

    test('resolveTextModelMetadata falls back to same mode when the request mode is invalid and same-mode provider resolution fails', async () => {
        const embeddingRouter = {
            getConfig: jest.fn().mockResolvedValue({
                embedding_provider_mode: 'weird-mode'
            })
        };
        const embeddingProvider = {
            getSameModeProvider: jest.fn(() => {
                throw new Error('missing provider');
            }),
            getRecommendedModels: jest.fn(() => ({
                openai: [{ id: 'text-embedding-3-small' }]
            })),
            getEmbeddingModels: jest.fn()
        };
        const helpers = buildHelpers({
            embeddingRouter,
            embeddingProvider
        });

        const result = await helpers.resolveTextModelMetadata();

        expect(result).toEqual({
            mode: 'same',
            provider: null,
            recommended: [],
            models: []
        });
        expect(embeddingProvider.getEmbeddingModels).not.toHaveBeenCalled();
    });

    test('resolveTextModelMetadata uses cloud provider credentials from config when request values are omitted', async () => {
        const embeddingRouter = {
            getConfig: jest.fn().mockResolvedValue({
                embedding_provider_mode: 'cloud',
                embedding_cloud_provider: 'openrouter',
                embedding_cloud_api_key: 'stored-router-key'
            })
        };
        const embeddingProvider = {
            getSameModeProvider: jest.fn(),
            getRecommendedModels: jest.fn(() => ({
                openrouter: [{ id: 'openai/text-embedding-3-small' }]
            })),
            getEmbeddingModels: jest.fn().mockResolvedValue([{ id: 'openai/text-embedding-3-small' }])
        };
        const helpers = buildHelpers({
            embeddingRouter,
            embeddingProvider
        });

        const result = await helpers.resolveTextModelMetadata({});

        expect(result.provider).toBe('openrouter');
        expect(embeddingProvider.getEmbeddingModels).toHaveBeenCalledWith({
            provider: 'openrouter',
            api_key: 'stored-router-key',
            api_endpoint: ''
        });
    });

    test('resolveImageModelMetadata returns disabled metadata when image embeddings are disabled', async () => {
        const imageEmbeddingProvider = {
            getConfig: jest.fn().mockResolvedValue({
                image_embedding_provider_mode: 'disabled'
            }),
            normalizeMode: jest.fn(() => 'disabled'),
            getLocalModels: jest.fn()
        };
        const helpers = buildHelpers({
            imageEmbeddingProvider
        });

        const result = await helpers.resolveImageModelMetadata();

        expect(result).toEqual({
            mode: 'disabled',
            scope: null,
            models: [],
            fetchedAt: null,
            cacheHit: false
        });
    });

    test('resolveImageModelMetadata returns an empty cloud refresh result when provider is missing', async () => {
        const imageEmbeddingProvider = {
            getConfig: jest.fn().mockResolvedValue({
                image_embedding_provider_mode: 'cloud'
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
            refresh: true
        });

        expect(result).toEqual({
            mode: 'cloud',
            scope: 'cloud',
            models: [],
            fetchedAt: null,
            cacheHit: false
        });
        expect(embeddingProvider.getEmbeddingModels).not.toHaveBeenCalled();
    });

    test('resolveImageModelMetadata returns an empty local refresh result when local host is missing', async () => {
        const imageEmbeddingProvider = {
            getConfig: jest.fn().mockResolvedValue({
                image_embedding_provider_mode: 'separate_local',
                image_embedding_local_host: ''
            }),
            normalizeMode: jest.fn(() => 'separate_local'),
            getLocalModels: jest.fn()
        };
        const helpers = buildHelpers({
            imageEmbeddingProvider
        });

        const result = await helpers.resolveImageModelMetadata({
            refresh: true
        });

        expect(result).toEqual({
            mode: 'separate_local',
            scope: 'local',
            models: [],
            fetchedAt: null,
            cacheHit: false
        });
        expect(imageEmbeddingProvider.getLocalModels).not.toHaveBeenCalled();
    });

    test('resolveImageModelMetadata uses the explicit unmasked cloud API key from the request payload', async () => {
        const imageEmbeddingProvider = {
            getConfig: jest.fn().mockResolvedValue({
                image_embedding_provider_mode: 'cloud',
                image_embedding_cloud_provider: 'openai',
                image_embedding_cloud_api_key: 'stored-key'
            }),
            normalizeMode: jest.fn(() => 'cloud'),
            getLocalModels: jest.fn()
        };
        const embeddingProvider = {
            getSameModeProvider: jest.fn(),
            getRecommendedModels: jest.fn(),
            getEmbeddingModels: jest.fn().mockResolvedValue([{ id: 'clip-large' }])
        };
        const helpers = buildHelpers({
            imageEmbeddingProvider,
            embeddingProvider
        });

        await helpers.resolveImageModelMetadata({
            refresh: true,
            cloud_provider: 'openai',
            cloud_api_key: 'request-key',
            cloud_api_endpoint: 'https://api.openai.test'
        });

        expect(embeddingProvider.getEmbeddingModels).toHaveBeenCalledWith({
            provider: 'openai',
            api_key: 'request-key',
            api_endpoint: 'https://api.openai.test'
        });
    });

    test('resolveTextModelMetadata honor explicit provider and api endpoint overrides', async () => {
        const embeddingRouter = {
            getConfig: jest.fn().mockResolvedValue({
                embedding_provider_mode: 'same',
                api_key: 'stored-openai-key',
                api_endpoint: 'https://stored-endpoint.test'
            })
        };
        const embeddingProvider = {
            getSameModeProvider: jest.fn(),
            getRecommendedModels: jest.fn(() => ({
                openrouter: [{ id: 'openai/text-embedding-3-large' }]
            })),
            getEmbeddingModels: jest.fn().mockResolvedValue([
                { id: 'openai/text-embedding-3-large' }
            ])
        };
        const helpers = buildHelpers({
            embeddingRouter,
            embeddingProvider
        });

        const result = await helpers.resolveTextModelMetadata({
            provider: ' OpenRouter ',
            api_key: 'request-router-key',
            api_endpoint: 'https://override-endpoint.test'
        });

        expect(result).toEqual({
            mode: 'same',
            provider: 'openrouter',
            recommended: [{ id: 'openai/text-embedding-3-large' }],
            models: [{ id: 'openai/text-embedding-3-large' }]
        });
        expect(embeddingProvider.getEmbeddingModels).toHaveBeenCalledWith({
            provider: 'openrouter',
            api_key: 'request-router-key',
            api_endpoint: 'https://override-endpoint.test'
        });
        expect(embeddingProvider.getSameModeProvider).not.toHaveBeenCalled();
    });

    test('resolveImageModelMetadata logs and continues when cache persistence fails during a cloud refresh', async () => {
        const logger = {
            warn: jest.fn()
        };
        const db = {
            query: jest.fn().mockRejectedValue(new Error('db unavailable'))
        };
        const imageEmbeddingProvider = {
            getConfig: jest.fn().mockResolvedValue({
                image_embedding_provider_mode: 'cloud',
                image_embedding_cloud_provider: 'openai',
                image_embedding_cloud_api_key: 'stored-key'
            }),
            normalizeMode: jest.fn(() => 'cloud'),
            getLocalModels: jest.fn()
        };
        const embeddingProvider = {
            getSameModeProvider: jest.fn(),
            getRecommendedModels: jest.fn(),
            getEmbeddingModels: jest.fn().mockResolvedValue([{ id: 'clip-large' }])
        };
        const helpers = buildHelpers({
            db,
            logger,
            imageEmbeddingProvider,
            embeddingProvider
        });

        const result = await helpers.resolveImageModelMetadata({
            refresh: true,
            cloud_provider: 'openai'
        });

        expect(result.scope).toBe('cloud');
        expect(result.models).toEqual([{ id: 'clip-large' }]);
        expect(logger.warn).toHaveBeenCalledWith('Failed to update image models cache', {
            error: 'db unavailable'
        });
    });
});
