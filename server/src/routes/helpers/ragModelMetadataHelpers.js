/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const {
    normalizeTextModelMode,
    resolveSelectedTextModelProvider,
    resolveTextModelApiKey,
    resolveTextModelApiEndpoint,
    resolveImageModelsCacheForLookup,
    resolveImageCloudApiKey
} = require('./ragModelMetadataPolicy');

function createRagModelMetadataHelpers({
    db,
    logger,
    isMaskedToken,
    embeddingRouter,
    embeddingProvider,
    imageEmbeddingProvider
}) {
    const updateImageModelsCache = async ({ scope, payload }) => {
        try {
            const result = await db.query(
                'SELECT image_embedding_models_cache FROM ai_provider_config WHERE id = 1'
            );
            const current = result.rows[0]?.image_embedding_models_cache || {};
            const next = {
                ...current,
                [scope]: {
                    ...payload,
                    fetched_at: new Date().toISOString()
                }
            };

            await db.query(
                `UPDATE ai_provider_config
                 SET image_embedding_models_cache = $1,
                     image_embedding_models_cache_updated_at = NOW()
                 WHERE id = 1`,
                [next]
            );
        } catch (error) {
            logger.warn('Failed to update image models cache', { error: error.message });
        }
    };

    const resolveTextModelMetadata = async (payload = {}) => {
        const config = await embeddingRouter.getConfig();
        const mode = normalizeTextModelMode(payload.mode || config?.embedding_provider_mode || 'same');
        const provider = resolveSelectedTextModelProvider({
            mode,
            provider: payload.provider,
            config,
            embeddingProvider
        });
        const catalog = embeddingProvider.getRecommendedModels();
        const recommended = provider ? (catalog[provider] || []) : [];

        let models = [];
        if (provider && provider !== 'ollama') {
            const apiKey = resolveTextModelApiKey({
                mode,
                provider,
                apiKey: payload.api_key,
                config,
                isMaskedToken
            });
            const apiEndpoint = resolveTextModelApiEndpoint({
                mode,
                apiEndpoint: payload.api_endpoint,
                config
            });

            models = await embeddingProvider.getEmbeddingModels({
                provider,
                api_key: apiKey,
                api_endpoint: apiEndpoint
            });
        }

        return {
            mode,
            provider,
            recommended,
            models
        };
    };

    const resolveImageModelLookup = async (payload = {}) => {
        const config = await imageEmbeddingProvider.getConfig();
        const mode = imageEmbeddingProvider.normalizeMode(payload.mode || config?.image_embedding_provider_mode);
        const localApiKeyValue = typeof payload.local_api_key === 'string'
            ? payload.local_api_key.trim()
            : payload.local_api_key;
        const localApiKey = (localApiKeyValue && !isMaskedToken(localApiKeyValue))
            ? localApiKeyValue
            : null;

        return {
            config,
            mode,
            localHost: (payload.local_host || config?.image_embedding_local_host || '').trim(),
            localPort: Number(payload.local_port || config?.image_embedding_local_port || 8000),
            localApiKey,
            cloudProvider: (payload.cloud_provider || config?.image_embedding_cloud_provider || '').trim(),
            cloudApiEndpoint: payload.cloud_api_endpoint ?? config?.image_embedding_cloud_api_endpoint ?? ''
        };
    };

    const resolveImageModelMetadata = async (payload = {}) => {
        const lookup = await resolveImageModelLookup(payload);
        const { config, mode, localHost, localPort, localApiKey, cloudProvider, cloudApiEndpoint } = lookup;

        if (mode === 'disabled') {
            return {
                mode,
                scope: null,
                models: [],
                fetchedAt: null,
                cacheHit: false
            };
        }

        if (payload.refresh !== true) {
            const match = resolveImageModelsCacheForLookup(lookup);
            if (match) {
                return {
                    mode,
                    scope: match.scope,
                    models: match.entry.models || [],
                    fetchedAt: match.entry.fetched_at || null,
                    cacheHit: true
                };
            }

            return {
                mode,
                scope: mode === 'cloud' ? 'cloud' : 'local',
                models: [],
                fetchedAt: null,
                cacheHit: false
            };
        }

        if (mode === 'cloud') {
            if (!cloudProvider) {
                return {
                    mode,
                    scope: 'cloud',
                    models: [],
                    fetchedAt: null,
                    cacheHit: false
                };
            }

            const models = await embeddingProvider.getEmbeddingModels({
                provider: cloudProvider,
                api_key: resolveImageCloudApiKey({
                    apiKey: payload.cloud_api_key,
                    config,
                    isMaskedToken
                }),
                api_endpoint: cloudApiEndpoint
            });
            const fetchedAt = new Date().toISOString();

            await updateImageModelsCache({
                scope: 'cloud',
                payload: {
                    provider: cloudProvider,
                    api_endpoint: cloudApiEndpoint,
                    models,
                    fetched_at: fetchedAt
                }
            });

            return {
                mode,
                scope: 'cloud',
                models,
                fetchedAt,
                cacheHit: false
            };
        }

        if (!localHost) {
            return {
                mode,
                scope: 'local',
                models: [],
                fetchedAt: null,
                cacheHit: false
            };
        }

        const localModelRequest = {
            image_embedding_local_host: localHost,
            image_embedding_local_port: localPort
        };

        if (localApiKey) {
            localModelRequest.image_embedding_local_api_key = localApiKey;
        }

        const models = await imageEmbeddingProvider.getLocalModels(localModelRequest);
        const fetchedAt = new Date().toISOString();

        await updateImageModelsCache({
            scope: 'local',
            payload: {
                host: localHost,
                port: localPort,
                models,
                fetched_at: fetchedAt
            }
        });

        return {
            mode,
            scope: 'local',
            models,
            fetchedAt,
            cacheHit: false
        };
    };

    return {
        resolveImageModelMetadata,
        resolveTextModelMetadata
    };
}

module.exports = {
    createRagModelMetadataHelpers
};
