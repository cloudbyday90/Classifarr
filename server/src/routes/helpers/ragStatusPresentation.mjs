/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Pure presentation helpers for RAG status payload assembly.
 */

export function normalizeImageProviderMode(mode) {
    if (mode === 'local') {
        return 'separate_local';
    }

    return ['disabled', 'separate_local', 'cloud'].includes(mode) ? mode : 'disabled';
}

export function resolveImageStatus({ enabled, mode, providerConfigured, stats, config }) {
    if (mode === 'disabled' || !enabled) {
        return 'disabled';
    }

    if (!providerConfigured) {
        return 'not_configured';
    }

    const totalEmbeddings = Number(stats?.total ?? 0);
    const hasValidatedConfig = !!config?.image_embedding_models_cache_updated_at;
    return (totalEmbeddings > 0 || hasValidatedConfig) ? 'configured' : 'not_configured';
}

export function resolveProviderOnline({ providerConfigured, circuitStatus, embeddingAvailability }) {
    return Boolean(providerConfigured)
        && circuitStatus?.state !== 'OPEN'
        && embeddingAvailability?.status === 'available';
}

export function resolveImageProviderOnline({ mode, enabled, providerConfigured }) {
    return mode !== 'disabled' && Boolean(enabled) && Boolean(providerConfigured);
}

export function resolveImageProvider({ mode, config }) {
    if (mode === 'disabled') {
        return 'disabled';
    }

    if (mode === 'cloud') {
        return config?.image_embedding_cloud_provider || 'cloud';
    }

    if (mode === 'separate_local' || mode === 'local') {
        return 'local';
    }

    return config?.image_embedding_cloud_provider
        || (config?.image_embedding_local_host ? 'local' : 'unknown');
}

export function buildImageStatusPayload({
    config,
    imageConfig,
    imageStats,
    imageProviderConfigured,
    imageProvider: _imageProvider,
    imageEmbeddingProvider
}) {
    const imageProviderMode = normalizeImageProviderMode(imageConfig?.image_embedding_provider_mode || 'disabled');
    const imageWeight = Number(config?.rag_image_weight ?? 0);
    const imageEnabled = Number.isFinite(imageWeight) && imageWeight > 0;
    const imageStatus = resolveImageStatus({
        enabled: imageEnabled,
        mode: imageProviderMode,
        providerConfigured: imageProviderConfigured,
        stats: imageStats,
        config: imageConfig
    });
    const imageProviderOnline = resolveImageProviderOnline({
        mode: imageProviderMode,
        enabled: imageEnabled,
        providerConfigured: imageProviderConfigured
    });

    return {
        enabled: imageProviderMode === 'disabled' ? false : imageEnabled,
        providerOnline: imageProviderOnline,
        providerConfigured: imageProviderMode === 'disabled' ? false : imageProviderConfigured,
        status: imageStatus,
        providerMode: imageProviderMode,
        provider: resolveImageProvider({ mode: imageProviderMode, config: imageConfig }),
        model: imageConfig ? imageEmbeddingProvider.getEffectiveModel(imageConfig) : null,
        stats: imageStats
    };
}
