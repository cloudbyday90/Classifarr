/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Pure policy helpers for RAG model metadata resolution.
 */

function normalizeTextModelMode(mode) {
    if (['same', 'separate_ollama', 'cloud'].includes(mode)) {
        return mode;
    }
    return 'same';
}

function resolveSelectedTextModelProvider({ mode, provider, config, embeddingProvider }) {
    const normalizedProvider = (provider || '').trim().toLowerCase();
    if (normalizedProvider) {
        return normalizedProvider;
    }

    if (mode === 'separate_ollama') {
        return 'ollama';
    }

    if (mode === 'cloud') {
        return (config?.embedding_cloud_provider || '').trim().toLowerCase() || null;
    }

    try {
        return embeddingProvider.getSameModeProvider(config).provider;
    } catch (_error) {
        return null;
    }
}

function resolveTextModelApiKey({ mode, provider, apiKey, config, isMaskedToken }) {
    if (apiKey && !isMaskedToken(apiKey)) {
        return apiKey;
    }

    if (!provider || provider === 'ollama') {
        return '';
    }

    if (mode === 'cloud') {
        return config?.embedding_cloud_api_key || '';
    }

    return config?.api_key || '';
}

function resolveTextModelApiEndpoint({ mode, apiEndpoint, config }) {
    if (apiEndpoint) {
        return apiEndpoint;
    }

    if (mode === 'same') {
        return config?.api_endpoint || '';
    }

    return '';
}

function resolveImageModelsCacheForLookup({ config, mode, localHost, localPort, cloudProvider, cloudApiEndpoint }) {
    const cache = config?.image_embedding_models_cache || {};

    if (mode === 'cloud') {
        const entry = cache.cloud || null;
        if (!entry) return null;
        const providerMatch = (entry.provider || '') === cloudProvider;
        const endpointMatch = (entry.api_endpoint || '') === cloudApiEndpoint;
        if (!providerMatch || !endpointMatch) return null;
        return { scope: 'cloud', entry };
    }

    if (mode === 'separate_local') {
        const entry = cache.local || null;
        if (!entry) return null;
        const hostMatch = (entry.host || '') === localHost;
        const portMatch = Number(entry.port || 8000) === Number(localPort || 8000);
        if (!hostMatch || !portMatch) return null;
        return { scope: 'local', entry };
    }

    return null;
}

function resolveImageCloudApiKey({ apiKey, config, isMaskedToken }) {
    if (apiKey && !isMaskedToken(apiKey)) {
        return apiKey;
    }
    return config?.image_embedding_cloud_api_key || '';
}

module.exports = {
    normalizeTextModelMode,
    resolveSelectedTextModelProvider,
    resolveTextModelApiKey,
    resolveTextModelApiEndpoint,
    resolveImageModelsCacheForLookup,
    resolveImageCloudApiKey
};
