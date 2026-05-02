/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const express = require('express');
const request = require('supertest');
let createRagCoreHelpers;
let registerRagCoreRoutes;

describe('ragCoreHelpers', () => {
    beforeAll(async () => {
        ({
            createRagCoreHelpers,
            registerRagCoreRoutes
        } = await import('../routes/helpers/ragCoreHelpers.mjs'));
    });

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

    test('testImageConnection resolves local models and falls back to the matched model when no explicit local model is provided', async () => {
        const imageEmbeddingProvider = {
            normalizeMode: jest.fn(() => 'separate_local'),
            getLocalModels: jest.fn().mockResolvedValue([
                { id: 'jina-clip-v2', dims: 768 }
            ]),
            getConfig: jest.fn()
        };
        const helpers = buildHelpers({ imageEmbeddingProvider });

        const result = await helpers.testImageConnection({
            mode: 'separate_local',
            local_host: '127.0.0.1',
            local_port: 9000,
            local_model: 'jina-clip-v2'
        });

        expect(result).toEqual({
            success: true,
            provider: 'local',
            model: 'jina-clip-v2',
            dims: 768,
            image_size: null,
            modelsCount: 1
        });
    });

    test('testImageConnection with masked local key loads config but does not pass encrypted DB value as header key', async () => {
        const imageEmbeddingProvider = {
            normalizeMode: jest.fn(() => 'separate_local'),
            getLocalModels: jest.fn().mockResolvedValue([
                { id: 'ViT-B-16', dims: 512 }
            ]),
            getConfig: jest.fn().mockResolvedValue({
                image_embedding_local_api_key: 'enc:v1:abcdef'
            })
        };
        const helpers = buildHelpers({
            isMaskedToken: jest.fn((token) => token === '••••••••abcd'),
            imageEmbeddingProvider
        });

        const result = await helpers.testImageConnection({
            mode: 'separate_local',
            local_host: 'host.docker.internal',
            local_port: 8000,
            local_model: 'ViT-B-16',
            local_api_key: '••••••••abcd'
        });

        expect(imageEmbeddingProvider.getConfig).toHaveBeenCalledTimes(1);
        expect(imageEmbeddingProvider.getLocalModels).toHaveBeenCalledWith({
            image_embedding_local_host: 'host.docker.internal',
            image_embedding_local_port: 8000
        });
        expect(result).toEqual({
            success: true,
            provider: 'local',
            model: 'ViT-B-16',
            dims: 512,
            image_size: null,
            modelsCount: 1
        });
    });

    test('testImageConnection rejects missing cloud provider and unsupported modes', async () => {
        const helpers = buildHelpers({
            imageEmbeddingProvider: {
                normalizeMode: jest.fn((mode) => mode),
                getLocalModels: jest.fn(),
                getConfig: jest.fn()
            }
        });

        await expect(helpers.testImageConnection({
            mode: 'cloud',
            cloud_provider: '   '
        })).resolves.toEqual({
            success: false,
            error: 'Cloud provider is required'
        });

        await expect(helpers.testImageConnection({
            mode: 'mystery'
        })).resolves.toEqual({
            success: false,
            error: 'Unsupported image embedding mode'
        });
    });

    test('testEmbedding uses the default text payload when no text is provided', async () => {
        const embeddingProvider = {
            testConnection: jest.fn(),
            getEmbeddingModels: jest.fn(),
            getEmbedding: jest.fn().mockResolvedValue({
                provider: 'openai',
                model: 'text-embedding-3-small',
                dims: 1536,
                cost: 0.01
            })
        };
        const helpers = buildHelpers({ embeddingProvider });

        const result = await helpers.testEmbedding();

        expect(embeddingProvider.getEmbedding).toHaveBeenCalledWith('Test embedding for Classifarr');
        expect(result).toMatchObject({
            success: true,
            provider: 'openai',
            model: 'text-embedding-3-small',
            dims: 1536,
            cost: 0.01
        });
    });

    test('registerRagCoreRoutes covers success and error responses across the core route surface', async () => {
        const logger = {
            error: jest.fn()
        };
        const helpers = {
            getCostsPayload: jest.fn()
                .mockResolvedValueOnce({ cost: 1 })
                .mockRejectedValueOnce(new Error('costs failed')),
            getDetailedPayload: jest.fn()
                .mockResolvedValueOnce({ detail: true })
                .mockRejectedValueOnce(new Error('detail failed')),
            getHealthPayload: jest.fn()
                .mockResolvedValueOnce({ health: 'ok' })
                .mockRejectedValueOnce(new Error('health failed')),
            getMetricsPayload: jest.fn()
                .mockResolvedValueOnce({ metrics: true })
                .mockRejectedValueOnce(new Error('metrics failed')),
            getOverviewPayload: jest.fn()
                .mockResolvedValueOnce({ overview: true })
                .mockRejectedValueOnce(new Error('overview failed')),
            getStatusPayload: jest.fn()
                .mockResolvedValueOnce({ status: 'ok' })
                .mockRejectedValueOnce(new Error('status failed')),
            parseDetailedHours: jest.fn((hours) => {
                if (hours === 'bad') {
                    const error = new Error('invalid hours');
                    error.status = 400;
                    throw error;
                }
                return Number(hours || 24);
            }),
            resolveImageModelMetadata: jest.fn()
                .mockResolvedValueOnce({ mode: 'cloud' })
                .mockRejectedValueOnce(new Error('image metadata failed')),
            resolveTextModelMetadata: jest.fn()
                .mockResolvedValueOnce({ mode: 'same' })
                .mockRejectedValueOnce(new Error('text metadata failed')),
            testConnection: jest.fn()
                .mockResolvedValueOnce({ success: true })
                .mockRejectedValueOnce(new Error('connection failed')),
            testEmbedding: jest.fn()
                .mockResolvedValueOnce({ success: true })
                .mockRejectedValueOnce(new Error('embedding failed')),
            testImageConnection: jest.fn()
                .mockResolvedValueOnce({ success: true })
                .mockRejectedValueOnce(new Error('image connection failed'))
        };

        const app = express();
        const router = express.Router();
        app.use(express.json());
        registerRagCoreRoutes({ router, logger, helpers });
        app.use('/rag', router);

        await request(app).post('/rag/test-connection').send({ provider: 'openai' }).expect(200, { success: true });
        await request(app).post('/rag/test-connection').send({ provider: 'openai' }).expect(200, { success: false, error: 'connection failed' });

        await request(app).get('/rag/status').expect(200, { status: 'ok' });
        await request(app).get('/rag/status').expect(500, { error: 'status failed' });

        await request(app).post('/rag/text-models').send({}).expect(200, { mode: 'same' });
        await request(app).post('/rag/text-models').send({}).expect(500, { error: 'text metadata failed' });

        await request(app).post('/rag/image-test-connection').send({}).expect(200, { success: true });
        await request(app).post('/rag/image-test-connection').send({}).expect(200, { success: false, error: 'image connection failed' });

        await request(app).post('/rag/image-models-metadata').send({}).expect(200, { mode: 'cloud' });
        await request(app).post('/rag/image-models-metadata').send({}).expect(500, { error: 'image metadata failed' });

        await request(app).post('/rag/test').send({}).expect(200, { success: true });
        await request(app).post('/rag/test').send({}).expect(500, { success: false, error: 'embedding failed' });

        await request(app).get('/rag/costs').expect(200, { cost: 1 });
        await request(app).get('/rag/costs').expect(500, { error: 'costs failed' });

        await request(app).get('/rag/health').expect(200, { health: 'ok' });
        await request(app).get('/rag/health').expect(500, { error: 'health failed' });

        await request(app).get('/rag/detailed?hours=48').expect(200, { detail: true });
        await request(app).get('/rag/detailed?hours=bad').expect(400, { error: 'invalid hours' });
        await request(app).get('/rag/detailed?hours=72').expect(500, { error: 'detail failed' });

        await request(app).get('/rag/metrics?hours=12').expect(200, { metrics: true });
        await request(app).get('/rag/metrics?hours=12').expect(500, { error: 'metrics failed' });

        await request(app).get('/rag/overview').expect(200, { overview: true });
        await request(app).get('/rag/overview').expect(500, { error: 'overview failed' });

        expect(logger.error).toHaveBeenCalledWith('Failed to get RAG status', { error: 'status failed' });
        expect(logger.error).toHaveBeenCalledWith('Embedding test failed', { error: 'embedding failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get RAG health', { error: 'health failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get detailed RAG stats', { error: 'detail failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get RAG metrics', { error: 'metrics failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get overview', { error: 'overview failed' });
    });
});
