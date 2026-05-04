/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import axios from 'axios';
import db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { decryptValue, parseEncryptedValue } from '../utils/encryption.mjs';
import CircuitBreaker from './circuitBreaker.mjs';
import { withRetry } from '../utils/retryUtils.mjs';

const logger = createLogger('ImageEmbeddingProvider');

const DEFAULTS = {
    image_size: 512,
    rps: 0.5,
    concurrency: 2,
    batch_size: 1,
    cache_ttl_hours: 24,
    cache_max_mb: 1024
};

const embedCircuitBreaker = new CircuitBreaker({
    name: 'ImageEmbedding',
    failureThreshold: 5,
    recoveryTimeout: 60000,
    halfOpenMaxAttempts: 2
});

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

class SimpleRateLimiter {
    constructor({ concurrency, rps }) {
        this.concurrency = Math.max(1, concurrency || 1);
        this.minIntervalMs = rps ? Math.max(1, Math.floor(1000 / rps)) : 0;
        this.active = 0;
        this.queue = [];
        this.lastStart = 0;
        this.draining = false;
    }

    schedule(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.drain();
        });
    }

    drain() {
        if (this.draining) return;
        this.draining = true;

        const runNext = () => {
            while (this.active < this.concurrency && this.queue.length > 0) {
                const { fn, resolve, reject } = this.queue.shift();
                const now = Date.now();
                const waitMs = Math.max(0, this.minIntervalMs - (now - this.lastStart));
                this.lastStart = now + waitMs;
                this.active += 1;

                setTimeout(async () => {
                    try {
                        const result = await fn();
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    } finally {
                        this.active -= 1;
                        runNext();
                    }
                }, waitMs);
            }

            this.draining = false;
        };

        runNext();
    }
}

class ImageEmbeddingProvider {
    constructor() {
        this.config = null;
        this.limiter = null;
        this.limiterKey = null;
        this._localApiKey = null;
    }

    async createRetriedOperation(fn, options) {
        return withRetry(fn, options);
    }

    normalizeMode(mode) {
        const raw = (mode || '').toLowerCase();
        if (raw === 'cloud') return 'cloud';
        if (raw === 'separate_local' || raw === 'local') return 'separate_local';
        if (raw === 'disabled') return 'disabled';
        return 'disabled';
    }

    resetConfig() {
        if (embedCircuitBreaker.state !== 'CLOSED') {
            logger.info('[EMBED] Config changed \u2014 circuit breaker reset to CLOSED to allow immediate validation.');
            embedCircuitBreaker.reset();
        }
        this.config = null;
        this.limiter = null;
        this.limiterKey = null;
        this._localApiKey = null;
    }

    async getConfig() {
        try {
            const result = await db.query(`
                SELECT
                    rag_image_weight,
                    image_embedding_provider_mode,
                    image_embedding_local_host,
                    image_embedding_local_port,
                    image_embedding_local_model,
                    image_embedding_cloud_provider,
                    image_embedding_cloud_api_key,
                    image_embedding_cloud_model,
                    image_embedding_cloud_api_endpoint,
                    image_embedding_local_api_key,
                    image_embedding_local_timeout_ms,
                    image_embedding_image_size,
                    image_embedding_rps,
                    image_embedding_concurrency,
                    image_embedding_batch_size,
                    image_embedding_cache_ttl_hours,
                    image_embedding_cache_max_mb,
                    image_embedding_models_cache,
                    image_embedding_models_cache_updated_at,
                    api_endpoint
                FROM ai_provider_config
                WHERE id = 1
            `);

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            if (row.image_embedding_local_api_key) {
                try {
                    const { encrypted, iv, authTag } = parseEncryptedValue(row.image_embedding_local_api_key);
                    const decryptedApiKey = decryptValue(encrypted, iv, authTag);
                    this._localApiKey = typeof decryptedApiKey === 'string' ? decryptedApiKey.trim() : decryptedApiKey;
                } catch (decryptErr) {
                    logger.error('[EMBED] Failed to decrypt sidecar API key \u2014 key may be stale after encryption key rotation', { error: decryptErr.message });
                    this._localApiKey = null;
                }
            } else {
                this._localApiKey = null;
            }
            this.config = row;
            return this.config;
        } catch (error) {
            logger.error('Failed to get image embedding config', { error: error.message });
            return null;
        }
    }

    isConfigured(config) {
        if (!config) return false;

        const mode = this.normalizeMode(config.image_embedding_provider_mode);
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

    getEffectiveSize(config) {
        return config?.image_embedding_image_size ?? DEFAULTS.image_size;
    }

    getEffectiveModel(config) {
        const mode = this.normalizeMode(config?.image_embedding_provider_mode);
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

    getLimiter(config) {
        const rps = config?.image_embedding_rps ?? DEFAULTS.rps;
        const concurrency = config?.image_embedding_concurrency ?? DEFAULTS.concurrency;
        const key = `${rps}:${concurrency}`;

        if (!this.limiter || this.limiterKey !== key) {
            this.limiter = new SimpleRateLimiter({ rps, concurrency });
            this.limiterKey = key;
        }

        return this.limiter;
    }

    async embedImageFromUrl(imageUrl, overrides = {}) {
        const baseConfig = this.config || await this.getConfig();
        if (!baseConfig) {
            throw new Error('Image embedding configuration not found');
        }

        const config = { ...baseConfig, ...overrides };
        const mode = this.normalizeMode(config.image_embedding_provider_mode);
        if (mode === 'disabled') {
            return null;
        }
        const model = this.getEffectiveModel(config);
        const imageSize = this.getEffectiveSize(config);
        const limiter = this.getLimiter(config);

        const run = async () => {
            if (mode === 'cloud') {
                return await this.embedCloud(imageUrl, config, { model, imageSize });
            }

            return await this.embedLocal(imageUrl, config, { model, imageSize });
        };

        const host = config.image_embedding_local_host;
        const port = config.image_embedding_local_port;

        try {
            return await embedCircuitBreaker.run(async () => {
                return limiter.schedule(async () => {
                    const wrapped = await this.createRetriedOperation(run, {
                        maxRetries: 2,
                        onRetry: (error, attempt) => {
                            logger.warn('[EMBED_RETRY] Retrying image embed request', {
                                attempt,
                                statusCode: error.response?.status,
                                host,
                                port,
                                error: error.message
                            });
                        }
                    });
                    return await wrapped();
                });
            });
        } catch (err) {
            if (err.code === 'CIRCUIT_OPEN') {
                logger.warn('[EMBED_CIRCUIT_OPEN] Circuit breaker OPEN \u2014 image embedding calls suspended', {
                    recoveryTimeout: embedCircuitBreaker.recoveryTimeout
                });
            } else if (err.response?.status === 401) {
                logger.error('[EMBED_AUTH_FAIL] Sidecar rejected request: API key missing or incorrect', {
                    statusCode: 401,
                    host,
                    port,
                    hint: 'Verify the key in Settings \u2192 RAG & Embeddings \u2192 Image Embeddings'
                });
            } else {
                logger.error('[EMBED_FAIL] Image embedding request failed after retries', {
                    error: err.message,
                    host,
                    port,
                    statusCode: err.response?.status
                });
            }
            throw err;
        }
    }

    async embedCloud(imageUrl, config, { model, imageSize }) {
        const provider = (config.image_embedding_cloud_provider || '').toLowerCase();
        const apiKey = config.image_embedding_cloud_api_key;
        const apiEndpoint = config.image_embedding_cloud_api_endpoint || config.api_endpoint || '';

        if (!provider) {
            throw new Error('Image embedding cloud provider is not configured');
        }
        if (!apiKey) {
            throw new Error('Image embedding cloud API key is not configured');
        }

        switch (provider) {
            case 'vertex':
            case 'google':
            case 'vertex_ai':
                return await this.embedVertex(imageUrl, { apiKey, apiEndpoint, model, imageSize });
            case 'voyage':
                return await this.embedVoyage(imageUrl, { apiKey, model, imageSize });
            case 'cohere':
                return await this.embedCohere(imageUrl, { apiKey, model, imageSize });
            default:
                throw new Error(`Image embedding provider not supported: ${provider}`);
        }
    }

    async embedLocal(imageUrl, config, { model, imageSize }) {
        const host = config.image_embedding_local_host || 'localhost';
        const port = config.image_embedding_local_port || 8000;
        const timeout = config.image_embedding_local_timeout_ms ?? 15000;
        const headers = {};
        if (this._localApiKey) {
            headers['X-Api-Key'] = this._localApiKey;
        }

        const response = await axios.post(
            `http://${host}:${port}/embed-image`,
            {
                image_url: imageUrl,
                model,
                normalize: true,
                image_size: imageSize
            },
            { timeout, headers }
        );

        const embedding = response.data?.embedding || [];

        return {
            embedding,
            dims: response.data?.dims || embedding.length,
            provider: 'local',
            model,
            size: imageSize
        };
    }

    async getLocalModels(config) {
        const host = config?.image_embedding_local_host;
        const port = config?.image_embedding_local_port || 8000;
        const timeout = config?.image_embedding_local_timeout_ms ?? 15000;

        if (!host) {
            throw new Error('Image embedding local host is not configured');
        }

        const headers = {};
        const rawApiKey = config?.image_embedding_local_api_key !== undefined
            ? config.image_embedding_local_api_key
            : this._localApiKey;
        const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey;
        if (apiKey) {
            headers['X-Api-Key'] = apiKey;
        }

        const response = await axios.get(`http://${host}:${port}/models`, { timeout, headers });
        const models = response.data?.models || [];

        return models.map((model) => ({
            id: model.id || model.name || '',
            name: model.name || model.id || '',
            dims: model.dims,
            image_size: model.image_size
        })).filter((model) => model.id);
    }

    async embedVertex(imageUrl, { apiKey, apiEndpoint, model, imageSize }) {
        if (!apiEndpoint) {
            throw new Error('Vertex API endpoint is required for image embeddings');
        }

        const imageBase64 = await this.fetchImageBase64(imageUrl);
        const modelId = model || 'multimodalembedding@001';
        const endpoint = `${apiEndpoint}/${modelId}:predict`;

        const response = await axios.post(endpoint, {
            instances: [{ image: { bytesBase64Encoded: imageBase64 } }]
        }, {
            headers: {
                Authorization: `Bearer ${apiKey}`
            },
            timeout: 20000
        });

        const embedding = response.data?.predictions?.[0]?.imageEmbedding || [];

        return {
            embedding,
            dims: embedding.length,
            provider: 'vertex',
            model: modelId,
            size: imageSize
        };
    }

    async embedVoyage(imageUrl, { apiKey, model, imageSize }) {
        const modelId = model || 'voyage-multimodal-3.5';
        const response = await axios.post(
            'https://api.voyageai.com/v1/embeddings',
            {
                model: modelId,
                input: [{ type: 'image', image_url: imageUrl }]
            },
            {
                headers: { Authorization: `Bearer ${apiKey}` },
                timeout: 20000
            }
        );

        const embedding = response.data?.data?.[0]?.embedding || [];

        return {
            embedding,
            dims: embedding.length,
            provider: 'voyage',
            model: modelId,
            size: imageSize
        };
    }

    async embedCohere(imageUrl, { apiKey, model, imageSize }) {
        const modelId = model || 'embed-english-v3.0';
        const imageBase64 = await this.fetchImageBase64(imageUrl);

        const response = await axios.post(
            'https://api.cohere.com/v1/embed',
            {
                model: modelId,
                input_type: 'image',
                images: [imageBase64]
            },
            {
                headers: { Authorization: `Bearer ${apiKey}` },
                timeout: 20000
            }
        );

        const embedding = response.data?.embeddings?.[0] || [];

        return {
            embedding,
            dims: embedding.length,
            provider: 'cohere',
            model: modelId,
            size: imageSize
        };
    }

    async fetchImageBase64(imageUrl) {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            maxContentLength: MAX_IMAGE_BYTES
        });

        const buffer = Buffer.from(response.data);
        if (buffer.length > MAX_IMAGE_BYTES) {
            throw new Error('Image payload exceeds maximum size');
        }

        return buffer.toString('base64');
    }
}

const imageEmbeddingProvider = new ImageEmbeddingProvider();

export { DEFAULTS, MAX_IMAGE_BYTES, SimpleRateLimiter };
export default imageEmbeddingProvider;
