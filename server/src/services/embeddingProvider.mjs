/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import * as db from '../config/database.mjs';
import { providerLock } from './providerLock.mjs';
import { createLogger } from '../utils/logger.mjs';
import { embeddingCircuitBreaker, OPEN_CIRCUIT_ERROR_MESSAGE } from './embeddingCircuitBreaker.mjs';
import { withRetry, isRetryableError } from '../utils/retryUtils.mjs';
import { createAdapterMethods } from './embeddingProviderAdapters.mjs';
import { ConfigurationError, PROVIDER_DEFAULTS, RECOMMENDED_EMBEDDING_MODELS, SAME_MODE_DEFAULTS } from './embeddingProviderConfig.mjs';
import {
    createInitialMetrics,
    isModelCold as _isModelCold,
    getAdaptiveTimeout as _getAdaptiveTimeout,
    recordError as _recordError,
    recordRetry as _recordRetry,
    getMetricsSnapshot,
    COLD_MODEL_IDLE_THRESHOLD
} from './embeddingProviderMetrics.mjs';
import {
    getSameModeProvider as _getSameModeProvider,
    getSameModeEmbedding as _getSameModeEmbedding,
    getCloudEmbedding as _getCloudEmbedding,
    normalizeTestConfig as _normalizeTestConfig
} from './embeddingProviderDispatch.mjs';
import { getEmbeddingModels as _getEmbeddingModels } from './embeddingProviderModels.mjs';
import {
    createProviderBusyError,
    isProviderPreemptedError,
} from './embeddingServiceErrors.mjs';

const logger = createLogger('EmbeddingProvider');

class EmbeddingProvider {
    constructor() {
        this.circuitBreaker = embeddingCircuitBreaker;
        this.metrics = createInitialMetrics();
        this.coldModelIdleThreshold = COLD_MODEL_IDLE_THRESHOLD;

        Object.assign(this, createAdapterMethods({
            getAdaptiveTimeout: (config) => this.getAdaptiveTimeout(config),
            createRetriedOperation: (fn, options) => this.createRetriedOperation(fn, options),
            recordRetry: (...args) => this.recordRetry(...args)
        }));
    }

    async getConfig() {
        try {
            const result = await db.query(`
                SELECT
                    embedding_provider_mode,
                    embedding_ollama_host,
                    embedding_ollama_port,
                    embedding_ollama_model,
                    embedding_cloud_provider,
                    embedding_cloud_api_key,
                    embedding_cloud_model,
                    primary_provider,
                    api_key,
                    api_endpoint,
                    ollama_host,
                    ollama_port,
                    embedding_model
                FROM ai_provider_config
                WHERE id = 1
            `);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to get embedding provider config', { error: error.message });
            return null;
        }
    }

    resetConfig() {
        logger.debug('Embedding provider reset hook invoked');
    }

    resetMetrics() {
        this.metrics = createInitialMetrics();
        this.circuitBreaker.reset();
    }

    async createRetriedOperation(fn, options) {
        return withRetry(fn, options);
    }

    async isRetryableRequestError(error) {
        return isRetryableError(error);
    }

    getCircuitStatus() {
        return this.circuitBreaker.getStatus();
    }

    getCircuitStateHistory(limit = 20) {
        return this.circuitBreaker.getStateHistory(limit);
    }

    resetCircuit() {
        this.circuitBreaker.reset();
    }

    isModelCold() {
        return _isModelCold(this.metrics, this.coldModelIdleThreshold);
    }

    getAdaptiveTimeout(config) {
        return _getAdaptiveTimeout(config, this.metrics, this.coldModelIdleThreshold);
    }

    async warmup() {
        logger.info('Warming up embedding model');
        const startTime = Date.now();

        try {
            await this.getEmbedding('warmup test');
            const duration = Date.now() - startTime;
            logger.info('Model warmup completed', { duration });
            return { success: true, duration };
        } catch (error) {
            logger.error('Model warmup failed', { error: error.message });
            throw error;
        }
    }

    getMetrics() {
        return getMetricsSnapshot(this.metrics, this.isModelCold(), this.circuitBreaker.getStatus());
    }

    recordError(error, latency, retryable) {
        _recordError(this.metrics, error, latency, retryable);
    }

    recordRetry(attempt, error, delay, retryAfter) {
        _recordRetry(this.metrics, attempt, error, delay, retryAfter);
    }

    createPreemptedError() {
        return createProviderBusyError({
            message: 'Embedding operation was preempted by high-priority classification request. Please retry the operation.',
            lockHolder: 'classification',
            activeModel: providerLock.getActiveModel(),
            preemptRequested: true,
        });
    }

    async getEmbedding(text, options = {}) {
        const signal = options.signal || null;

        if (!text || text.trim().length === 0) {
            throw new Error('Cannot embed empty text');
        }

        if (!this.circuitBreaker.isAllowed()) {
            const error = new Error(OPEN_CIRCUIT_ERROR_MESSAGE);
            error.code = 'EMBEDDING_CIRCUIT_OPEN';
            logger.warn('Request blocked by circuit breaker');
            this.recordError(error, 0, false);
            throw error;
        }

        const config = await this.getConfig();
        if (!config) {
            throw new ConfigurationError('No embedding provider configuration found');
        }

        const mode = config.embedding_provider_mode || 'same';
        const needsLock = mode === 'same';

        if (needsLock) {
            await providerLock.acquireLock('embedding', 'normal');
        }

        const heartbeatIntervalMs = needsLock ? providerLock.config.heartbeatInterval : null;
        let heartbeatTimer = null;
        let lockReleased = false;
        const startTime = Date.now();
        const preemptionController = needsLock ? new AbortController() : null;
        const effectiveSignal = preemptionController
            ? (signal ? AbortSignal.any([signal, preemptionController.signal]) : preemptionController.signal)
            : signal;
        let preemptedError = null;

        try {
            if (needsLock) {
                heartbeatTimer = setInterval(() => {
                    const shouldContinue = providerLock.heartbeat('embedding');
                    if (!shouldContinue) {
                        clearInterval(heartbeatTimer);
                        heartbeatTimer = null;
                        providerLock.releaseLock('embedding');
                        lockReleased = true;
                        preemptedError = this.createPreemptedError();
                        if (!preemptionController.signal.aborted) {
                            preemptionController.abort(preemptedError);
                        }
                    }
                }, heartbeatIntervalMs);
            }

            let result;

            const checkPreemptionAndYield = () => {
                if (preemptedError) {
                    throw preemptedError;
                }
                if (needsLock && providerLock.isPreemptPending()) {
                    if (heartbeatTimer) {
                        clearInterval(heartbeatTimer);
                        heartbeatTimer = null;
                    }
                    providerLock.releaseLock('embedding');
                    lockReleased = true;
                    preemptedError = this.createPreemptedError();
                    if (!preemptionController.signal.aborted) {
                        preemptionController.abort(preemptedError);
                    }
                    throw preemptedError;
                }
            };

            switch (mode) {
                case 'same':
                    checkPreemptionAndYield();
                    result = await this.getSameModeEmbedding(text, config, effectiveSignal);
                    break;
                case 'separate_ollama':
                    if (!config.embedding_ollama_host) {
                        throw new ConfigurationError('No separate Ollama host configured. Please configure host and port in RAG Settings > Embedding Provider.');
                    }
                    checkPreemptionAndYield();
                    result = await this.getOllamaEmbedding(
                        text,
                        config.embedding_ollama_host,
                        config.embedding_ollama_port,
                        config.embedding_ollama_model || 'nomic-embed-text-v2-moe',
                        config,
                        effectiveSignal
                    );
                    break;
                case 'cloud':
                    checkPreemptionAndYield();
                    result = await this.getCloudEmbedding(text, config, effectiveSignal);
                    break;
                default:
                    throw new ConfigurationError(`Unknown embedding provider mode: ${mode}`);
            }

            if (preemptedError) {
                throw preemptedError;
            }

            const latency = Date.now() - startTime;
            this.metrics.totalRequests++;
            this.metrics.successfulRequests++;
            this.metrics.totalLatency += latency;
            this.metrics.lastRequestTime = Date.now();
            this.circuitBreaker.recordSuccess();

            logger.info('Embedding generated', {
                mode,
                provider: result.provider,
                model: result.model,
                dims: result.dims,
                cost: result.cost,
                latency
            });

            return result;
        } catch (error) {
            if (preemptedError) {
                error = preemptedError;
            }

            if (isProviderPreemptedError(error)) {
                logger.info('Embedding preempted by high-priority classification request', {
                    mode,
                    activeModel: error.activeModel || null,
                    lockHolder: error.lockHolder || null,
                });
                throw error;
            }

            if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || error.code === 'ABORT_ERR') {
                throw error;
            }

            const latency = Date.now() - startTime;
            this.metrics.totalRequests++;
            this.metrics.failedRequests++;
            this.metrics.totalLatency += latency;
            const retryable = await this.isRetryableRequestError(error);
            const isConfigError = error.isConfigurationError || error.name === 'ConfigurationError';

            if (!isConfigError && (retryable || (error.response?.status >= 500))) {
                const previousStatus = this.getCircuitStatus();
                this.circuitBreaker.recordFailure(error);
                const nextStatus = this.getCircuitStatus();
                if (previousStatus.state !== 'OPEN' && nextStatus.state === 'OPEN') {
                    logger.warn('Circuit breaker opened', {
                        failures: nextStatus.failureCount ?? 0,
                        error: error.message
                    }, { skipDbPersist: true });
                }
            }

            this.recordError(error, latency, retryable);

            logger.error('Failed to generate embedding', {
                mode,
                error: error.message,
                latency,
                retryable,
                isConfigError
            });
            throw error;
        } finally {
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
            }
            if (needsLock && !lockReleased) {
                providerLock.releaseLock('embedding');
            }
        }
    }

    async getSameModeEmbedding(text, config, signal = null) {
        return _getSameModeEmbedding(text, config, signal, this.getOllamaEmbedding.bind(this));
    }

    getSameModeProvider(config = {}) {
        return _getSameModeProvider(config);
    }

    async getCloudEmbedding(text, config, signal = null) {
        return _getCloudEmbedding(text, config, signal, this);
    }

    normalizeTestConfig(savedConfig = {}, override = {}) {
        return _normalizeTestConfig(savedConfig, override);
    }

    async testConnection(config = {}) {
        try {
            const savedConfig = await this.getConfig();
            const effectiveConfig = this.normalizeTestConfig(savedConfig || {}, config);
            if (!effectiveConfig || Object.keys(effectiveConfig).length === 0) {
                throw new ConfigurationError('No embedding provider configuration found');
            }

            const mode = effectiveConfig.embedding_provider_mode || 'same';
            let testEmbedding;

            if (mode === 'same') {
                testEmbedding = await this.getSameModeEmbedding('test connection', effectiveConfig);
            } else if (mode === 'separate_ollama') {
                const host = effectiveConfig.embedding_ollama_host;
                const port = effectiveConfig.embedding_ollama_port;
                const model = effectiveConfig.embedding_ollama_model || SAME_MODE_DEFAULTS.ollama;
                testEmbedding = await this.getOllamaEmbedding('test connection', host, port, model, effectiveConfig);
            } else if (mode === 'cloud') {
                testEmbedding = await this.getCloudEmbedding('test connection', effectiveConfig);
            } else {
                throw new ConfigurationError(`Unknown embedding provider mode: ${mode}`);
            }

            return {
                success: true,
                provider: testEmbedding.provider,
                model: testEmbedding.model,
                dimensions: testEmbedding.dims,
                cost: testEmbedding.cost
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    getProviderDefaults() {
        return PROVIDER_DEFAULTS;
    }

    getRecommendedModels() {
        return RECOMMENDED_EMBEDDING_MODELS;
    }

    async getEmbeddingModels(opts) {
        return _getEmbeddingModels(opts);
    }
}

export const embeddingProvider = new EmbeddingProvider();

export { ConfigurationError, PROVIDER_DEFAULTS, RECOMMENDED_EMBEDDING_MODELS, SAME_MODE_DEFAULTS } from './embeddingProviderConfig.mjs';
