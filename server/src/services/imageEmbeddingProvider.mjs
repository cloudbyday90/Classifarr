import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { decryptValue, parseEncryptedValue } from '../utils/encryption.mjs';
import { CircuitBreaker } from './circuitBreaker.mjs';
import {
    AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
    buildEmbeddingRuntimeDedupeKey,
} from './aiEmbeddingProviderIntegrityService.mjs';
import { withRetry } from '../utils/retryUtils.mjs';
import {
    DEFAULTS,
    normalizeMode as _normalizeMode,
    isConfigured as _isConfigured,
    getEffectiveSize as _getEffectiveSize,
    getEffectiveModel as _getEffectiveModel,
} from './imageEmbeddingConfig.mjs';
import {
    MAX_IMAGE_BYTES,
    embedCloud as _embedCloud,
    embedLocal as _embedLocal,
    getLocalModels as _getLocalModels,
} from './imageEmbeddingProviders.mjs';

const logger = createLogger('ImageEmbeddingProvider');

const embedCircuitBreaker = new CircuitBreaker({
    name: 'ImageEmbedding',
    failureThreshold: 5,
    recoveryTimeout: 60000,
    halfOpenMaxAttempts: 2
});

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
        return _normalizeMode(mode);
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
                    logger.error('[EMBED] Failed to decrypt sidecar API key \u2014 key may be stale after encryption key rotation', {
                        error: decryptErr.message,
                    }, {
                        dedupeKey: buildEmbeddingRuntimeDedupeKey(
                            'image',
                            'local_api_key_decrypt_failed',
                            decryptErr.message
                        ),
                        dedupeWindowMs: AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
                    });
                    this._localApiKey = null;
                }
            } else {
                this._localApiKey = null;
            }
            this.config = row;
            return this.config;
        } catch (error) {
            logger.error('Failed to get image embedding config', { error: error.message }, {
                dedupeKey: buildEmbeddingRuntimeDedupeKey(
                    'image',
                    'config_query_failed',
                    `${error.code || 'unknown'}:${error.message || 'unknown'}`
                ),
                dedupeWindowMs: AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
            });
            return null;
        }
    }

    isConfigured(config) {
        return _isConfigured(config);
    }

    getEffectiveSize(config) {
        return _getEffectiveSize(config);
    }

    getEffectiveModel(config) {
        return _getEffectiveModel(config);
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
                return await _embedCloud(imageUrl, config, { model, imageSize });
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
                }, {
                    dedupeKey: buildEmbeddingRuntimeDedupeKey('image', 'circuit_open', 'circuit_open'),
                    dedupeWindowMs: AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
                });
            } else if (err.response?.status === 401) {
                logger.error('[EMBED_AUTH_FAIL] Sidecar rejected request: API key missing or incorrect', {
                    statusCode: 401,
                    host,
                    port,
                    hint: 'Verify the key in Settings \u2192 RAG & Embeddings \u2192 Image Embeddings'
                }, {
                    dedupeKey: buildEmbeddingRuntimeDedupeKey(
                        'image',
                        'auth_fail',
                        `${host}:${port}:401`
                    ),
                    dedupeWindowMs: AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
                });
            } else {
                logger.error('[EMBED_FAIL] Image embedding request failed after retries', {
                    error: err.message,
                    host,
                    port,
                    statusCode: err.response?.status
                }, {
                    dedupeKey: buildEmbeddingRuntimeDedupeKey(
                        'image',
                        'request_failed_after_retries',
                        `${host}:${port}:${err.code || err.response?.status || err.message || 'unknown'}`
                    ),
                    dedupeWindowMs: AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
                });
            }
            throw err;
        }
    }

    async embedLocal(imageUrl, config, opts) {
        return _embedLocal(imageUrl, config, opts, this._localApiKey);
    }

    async getLocalModels(config) {
        return _getLocalModels(config, this._localApiKey);
    }
}

export const imageEmbeddingProvider = new ImageEmbeddingProvider();

export { DEFAULTS, MAX_IMAGE_BYTES, SimpleRateLimiter };
