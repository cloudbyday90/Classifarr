/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
    buildRagErrorResponse,
    createRagRoute
} from './ragRouteResponseSupport.mjs';

export function createRagCoreHelpers({
    isMaskedToken,
    embeddingProvider,
    imageEmbeddingProvider,
    resolveImageModelMetadata,
    resolveTextModelMetadata,
    getStatusPayload,
    getOverviewPayload,
    getHealthPayload,
    getCostsPayload,
    getDetailedPayload,
    getMetricsPayload,
    parseDetailedHours
}) {
    const testConnection = async (payload = {}) => {
        const start = Date.now();
        const result = await embeddingProvider.testConnection(payload);

        return {
            success: result.success,
            latency: Date.now() - start,
            dims: result.dimensions,
            provider: result.provider,
            model: result.model,
            error: result.error
        };
    };

    const testImageConnection = async (payload = {}) => {
        const {
            mode,
            local_host,
            local_port,
            local_model,
            local_api_key,
            cloud_provider,
            cloud_api_key,
            cloud_model,
            cloud_api_endpoint,
            image_size
        } = payload;

        const normalizedMode = imageEmbeddingProvider.normalizeMode(mode);

        if (normalizedMode === 'disabled') {
            return { success: false, error: 'Image embeddings are disabled' };
        }

        if (normalizedMode === 'separate_local') {
            const host = (local_host || '').trim();
            const port = Number(local_port || 8000);

            if (!host) {
                return { success: false, error: 'Local host is required' };
            }

            const localApiKeyValue = typeof local_api_key === 'string'
                ? local_api_key.trim()
                : local_api_key;
            const localApiKey = (localApiKeyValue && !isMaskedToken(localApiKeyValue))
                ? localApiKeyValue
                : null;

            if (!localApiKey) {
                await imageEmbeddingProvider.getConfig();
            }

            const modelRequest = {
                image_embedding_local_host: host,
                image_embedding_local_port: port
            };

            if (localApiKey) {
                modelRequest.image_embedding_local_api_key = localApiKey;
            }

            const models = await imageEmbeddingProvider.getLocalModels(modelRequest);

            const selected = (local_model || '').trim();
            const match = models.find((model) => (model.id || model.name) === selected);

            return {
                success: true,
                provider: 'local',
                model: selected || match?.id || null,
                dims: match?.dims || null,
                image_size: image_size || null,
                modelsCount: models.length
            };
        }

        if (normalizedMode === 'cloud') {
            const provider = (cloud_provider || '').trim();
            if (!provider) {
                return { success: false, error: 'Cloud provider is required' };
            }

            let apiKey = cloud_api_key;
            if (!apiKey || isMaskedToken(apiKey)) {
                const storedConfig = await imageEmbeddingProvider.getConfig();
                apiKey = storedConfig?.image_embedding_cloud_api_key || '';
            }

            const models = await embeddingProvider.getEmbeddingModels({
                provider,
                api_key: apiKey,
                api_endpoint: cloud_api_endpoint
            });

            const selected = (cloud_model || '').trim();
            const match = models.find((model) => (model.id || model.name) === selected);

            return {
                success: true,
                provider,
                model: selected || match?.id || null,
                modelsCount: models.length
            };
        }

        return { success: false, error: 'Unsupported image embedding mode' };
    };

    const testEmbedding = async ({ text } = {}) => {
        const testText = text || 'Test embedding for Classifarr';
        const startTime = Date.now();
        const result = await embeddingProvider.getEmbedding(testText);

        return {
            success: true,
            provider: result.provider,
            model: result.model,
            dims: result.dims,
            cost: result.cost,
            elapsedMs: Date.now() - startTime
        };
    };

    return {
        getCostsPayload,
        getDetailedPayload,
        getHealthPayload,
        getMetricsPayload,
        getOverviewPayload,
        getStatusPayload,
        parseDetailedHours,
        resolveImageModelMetadata,
        resolveTextModelMetadata,
        testConnection,
        testEmbedding,
        testImageConnection
    };
}

export function registerRagCoreRoutes({
    router,
    logger,
    helpers
}) {
    const {
        getCostsPayload,
        getDetailedPayload,
        getHealthPayload,
        getMetricsPayload,
        getOverviewPayload,
        getStatusPayload,
        parseDetailedHours,
        resolveImageModelMetadata,
        resolveTextModelMetadata,
        testConnection,
        testEmbedding,
        testImageConnection
    } = helpers;

    router.post('/test-connection', createRagRoute(
        async (req) => testConnection(req.body),
        {
            fallbackStatus: 200,
            resolveErrorResponse: (error) => ({
                status: 200,
                body: {
                    success: false,
                    error: error.message
                }
            })
        }
    ));

    router.get('/status', createRagRoute(
        async () => getStatusPayload(),
        {
            logger,
            logMessage: 'Failed to get RAG status'
        }
    ));

    router.post('/text-models', createRagRoute(
        async (req) => resolveTextModelMetadata(req.body || {}),
        {
            fallbackStatus: 500
        }
    ));

    router.post('/image-test-connection', createRagRoute(
        async (req) => testImageConnection(req.body || {}),
        {
            fallbackStatus: 200,
            resolveErrorResponse: (error) => ({
                status: 200,
                body: {
                    success: false,
                    error: error.message
                }
            })
        }
    ));

    router.post('/image-models-metadata', createRagRoute(
        async (req) => resolveImageModelMetadata(req.body || {}),
        {
            fallbackStatus: 500
        }
    ));

    router.post('/test', createRagRoute(
        async (req) => testEmbedding(req.body || {}),
        {
            logger,
            logMessage: 'Embedding test failed',
            resolveErrorResponse: (error) => ({
                status: 500,
                body: {
                    success: false,
                    error: error.message
                }
            })
        }
    ));

    router.get('/costs', createRagRoute(
        async () => getCostsPayload(),
        {
            fallbackStatus: 500
        }
    ));

    router.get('/health', createRagRoute(
        async () => getHealthPayload(),
        {
            logger,
            logMessage: 'Failed to get RAG health'
        }
    ));

    router.get('/detailed', createRagRoute(
        async (req) => {
            const hours = parseDetailedHours(req.query.hours);
            return getDetailedPayload(hours);
        },
        {
            logger,
            logMessage: 'Failed to get detailed RAG stats',
            shouldLogError: (error) => !error?.status && !error?.statusCode && !error?.httpStatus,
            resolveErrorResponse: (error) => buildRagErrorResponse(error, { fallbackStatus: 500 })
        }
    ));

    router.get('/metrics', createRagRoute(
        async (req) => {
            const { hours = 24 } = req.query;
            return getMetricsPayload(hours);
        },
        {
            logger,
            logMessage: 'Failed to get RAG metrics'
        }
    ));

    router.get('/overview', createRagRoute(
        async () => getOverviewPayload(),
        {
            logger,
            logMessage: 'Failed to get overview'
        }
    ));
}
