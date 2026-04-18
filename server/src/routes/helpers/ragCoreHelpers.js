/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function createRagCoreHelpers({
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

            // Ensure provider config is loaded so masked/omitted local API key uses
            // the decrypted in-memory sidecar key rather than encrypted DB text.
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
            const match = models.find(model => (model.id || model.name) === selected);

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
            const match = models.find(model => (model.id || model.name) === selected);

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

function registerRagCoreRoutes({
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

    router.post('/test-connection', async (req, res) => {
        try {
            res.json(await testConnection(req.body));
        } catch (error) {
            res.json({
                success: false,
                error: error.message
            });
        }
    });

    router.get('/status', async (req, res) => {
        try {
            res.json(await getStatusPayload());
        } catch (error) {
            logger.error('Failed to get RAG status', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/text-models', async (req, res) => {
        try {
            res.json(await resolveTextModelMetadata(req.body || {}));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/image-test-connection', async (req, res) => {
        try {
            res.json(await testImageConnection(req.body || {}));
        } catch (error) {
            res.json({ success: false, error: error.message });
        }
    });

    router.post('/image-models-metadata', async (req, res) => {
        try {
            res.json(await resolveImageModelMetadata(req.body || {}));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/test', async (req, res) => {
        try {
            res.json(await testEmbedding(req.body || {}));
        } catch (error) {
            logger.error('Embedding test failed', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    });

    router.get('/costs', async (req, res) => {
        try {
            res.json(await getCostsPayload());
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/health', async (req, res) => {
        try {
            res.json(await getHealthPayload());
        } catch (error) {
            logger.error('Failed to get RAG health', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/detailed', async (req, res) => {
        try {
            const hours = parseDetailedHours(req.query.hours);
            res.json(await getDetailedPayload(hours));
        } catch (error) {
            if (error.status) {
                return res.status(error.status).json({ error: error.message });
            }
            logger.error('Failed to get detailed RAG stats', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/metrics', async (req, res) => {
        try {
            const { hours = 24 } = req.query;
            res.json(await getMetricsPayload(hours));
        } catch (error) {
            logger.error('Failed to get RAG metrics', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/overview', async (req, res) => {
        try {
            res.json(await getOverviewPayload());
        } catch (error) {
            logger.error('Failed to get overview', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });
}

module.exports = {
    createRagCoreHelpers,
    registerRagCoreRoutes
};
