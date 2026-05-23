export const DEFAULTS = {
    image_size: 512,
    rps: 0.5,
    concurrency: 2,
    batch_size: 1,
    cache_ttl_hours: 24,
    cache_max_mb: 1024
};

export function normalizeMode(mode) {
    const raw = (mode || '').toLowerCase();
    if (raw === 'cloud') return 'cloud';
    if (raw === 'separate_local' || raw === 'local') return 'separate_local';
    if (raw === 'disabled') return 'disabled';
    return 'disabled';
}

export function isConfigured(config) {
    if (!config) return false;

    const mode = normalizeMode(config.image_embedding_provider_mode);
    if (mode === 'disabled') {
        return false;
    }
    const hasCloud = !!config.image_embedding_cloud_provider && !!config.image_embedding_cloud_api_key;
    const hasLocal = !!config.image_embedding_local_host;

    if (mode === 'cloud') {
        return hasCloud;
    }

    if (mode === 'separate_local') {
        return hasLocal;
    }

    return false;
}

export function getEffectiveSize(config) {
    return config?.image_embedding_image_size ?? DEFAULTS.image_size;
}

export function getEffectiveModel(config) {
    const mode = normalizeMode(config?.image_embedding_provider_mode);
    if (mode === 'disabled') {
        return null;
    }

    if (mode === 'cloud') {
        if (config?.image_embedding_cloud_model) {
            return config.image_embedding_cloud_model;
        }

        const provider = (config?.image_embedding_cloud_provider || '').toLowerCase();
        if (provider === 'voyage') {
            return 'voyage-multimodal-3.5';
        }
        if (provider === 'cohere') {
            return 'embed-english-v3.0';
        }

        return 'multimodalembedding@001';
    }

    return config?.image_embedding_local_model || 'ViT-B-16';
}
