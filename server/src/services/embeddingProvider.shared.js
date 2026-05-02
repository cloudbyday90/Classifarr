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

const axios = require('axios');
const db = require('../config/database');
const ollamaService = require('./ollama');
const cloudLLMService = require('./cloudLLM');
const providerLock = require('./providerLock');
const { createLogger } = require('../utils/logger');
const { embeddingCircuitBreaker, OPEN_CIRCUIT_ERROR_MESSAGE } = require('./embeddingCircuitBreaker');
const retryUtils = require('../utils/retryUtils');

const logger = createLogger('EmbeddingProvider');

async function defaultLoadRetryUtils() {
    return retryUtils;
}

const SAME_MODE_DEFAULTS = {
    ollama: 'nomic-embed-text-v2-moe',
    openai: 'text-embedding-3-small',
    gemini: 'text-embedding-005',
    openrouter: 'text-embedding-3-small',
    litellm: 'text-embedding-3-small',
    custom: 'text-embedding-3-small'
};

const RECOMMENDED_EMBEDDING_MODELS = {
    ollama: [
        { id: 'nomic-embed-text', name: 'Nomic Embed Text', dims: 768, recommended: true, desc: 'High-performing open embedding model with large context window' },
        { id: 'mxbai-embed-large', name: 'MxBai Embed Large', dims: 1024, recommended: true, desc: 'State-of-the-art large embedding model from mixedbread.ai' },
        { id: 'bge-m3', name: 'BGE-M3', dims: 1024, desc: 'Multi-Functionality, Multi-Linguality, Multi-Granularity model from BAAI' },
        { id: 'all-minilm', name: 'All-MiniLM', dims: 384, desc: 'Fast, lightweight model for sentence embeddings' },
        { id: 'snowflake-arctic-embed', name: 'Snowflake Arctic Embed', dims: 1024, desc: 'Suite of text embedding models optimized for performance' },
        { id: 'snowflake-arctic-embed2', name: 'Snowflake Arctic Embed 2', dims: 1024, desc: 'Multilingual support without sacrificing English performance' },
        { id: 'nomic-embed-text-v2-moe', name: 'Nomic Embed v2 MoE', dims: 768, desc: 'Multilingual MoE text embedding model' },
        { id: 'bge-large', name: 'BGE Large', dims: 1024, desc: 'Embedding model from BAAI mapping texts to vectors' },
        { id: 'qwen3-embedding', name: 'Qwen3 Embedding', dims: 1024, desc: 'Text embeddings from Qwen3 series in various sizes' },
        { id: 'granite-embedding', name: 'Granite Embedding', dims: 768, desc: 'IBM Granite multilingual text embedding model' },
        { id: 'embeddinggemma', name: 'EmbeddingGemma', dims: 768, desc: '300M parameter embedding model from Google' },
        { id: 'paraphrase-multilingual', name: 'Paraphrase Multilingual', dims: 768, desc: 'Sentence-transformers model for clustering or semantic search' }
    ],
    openai: [
        { id: 'text-embedding-3-small', name: 'Embedding 3 Small', dims: 1536, recommended: true, desc: 'Cost-effective, efficient for most use cases' },
        { id: 'text-embedding-3-large', name: 'Embedding 3 Large', dims: 3072, desc: 'Highest quality for demanding applications' },
        { id: 'text-embedding-ada-002', name: 'Ada 002', dims: 1536, desc: 'Previous generation, widely supported' }
    ],
    gemini: [
        { id: 'text-embedding-005', name: 'Text Embedding 005', dims: 768, recommended: true, desc: 'Latest Gemini embedding model' },
        { id: 'text-embedding-004', name: 'Text Embedding 004', dims: 768, desc: 'Previous Gemini embedding model' }
    ]
};

class ConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigurationError';
        this.isConfigurationError = true;
    }
}

const PROVIDER_DEFAULTS = {
    openai: {
        models: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
        default: 'text-embedding-3-small',
        dimensions: {
            'text-embedding-3-small': 1536,
            'text-embedding-3-large': 3072,
            'text-embedding-ada-002': 1536
        },
        pricing: {
            'text-embedding-3-small': 0.02,
            'text-embedding-3-large': 0.13,
            'text-embedding-ada-002': 0.02
        }
    },
    gemini: {
        models: ['text-embedding-004', 'embedding-001'],
        default: 'text-embedding-004',
        dimensions: {
            'text-embedding-004': 768,
            'embedding-001': 768
        },
        pricing: {
            'text-embedding-004': 0.025,
            'embedding-001': 0.025
        }
    },
    voyage: {
        models: ['voyage-2', 'voyage-large-2', 'voyage-code-2'],
        default: 'voyage-2',
        dimensions: {
            'voyage-2': 1024,
            'voyage-large-2': 1536,
            'voyage-code-2': 1536
        },
        pricing: {
            'voyage-2': 0.012,
            'voyage-large-2': 0.012,
            'voyage-code-2': 0.012
        }
    },
    openrouter: {
        models: ['openai/text-embedding-3-small', 'openai/text-embedding-3-large'],
        default: 'openai/text-embedding-3-small',
        dimensions: {
            'openai/text-embedding-3-small': 1536,
            'openai/text-embedding-3-large': 3072
        },
        pricing: {
            'openai/text-embedding-3-small': 0.02,
            'openai/text-embedding-3-large': 0.13
        }
    },
    cohere: {
        models: ['embed-english-v3.0', 'embed-multilingual-v3.0', 'embed-english-light-v3.0'],
        default: 'embed-english-v3.0',
        dimensions: {
            'embed-english-v3.0': 1024,
            'embed-multilingual-v3.0': 1024,
            'embed-english-light-v3.0': 384
        },
        pricing: {
            'embed-english-v3.0': 0.10,
            'embed-multilingual-v3.0': 0.10,
            'embed-english-light-v3.0': 0.10
        }
    }
};

class EmbeddingProvider {
    constructor() {
        this.circuitBreaker = embeddingCircuitBreaker;
        this.loadRetryUtils = defaultLoadRetryUtils;
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retryAttempts: 0,
            totalLatency: 0,
            lastRequestTime: null,
            errorHistory: [],
            retryHistory: []
        };
        this.coldModelIdleThreshold = 5 * 60 * 1000;
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
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retryAttempts: 0,
            totalLatency: 0,
            lastRequestTime: null,
            errorHistory: [],
            retryHistory: []
        };
        this.circuitBreaker.reset();
    }

    async createRetriedOperation(fn, options) {
        const { withRetry } = await this.loadRetryUtils();
        return withRetry(fn, options);
    }

    async isRetryableRequestError(error) {
        const { isRetryableError } = await this.loadRetryUtils();
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

    getSameModeProvider(config = {}) {
        const provider = config.primary_provider;
        if (!provider || provider === 'none') {
            throw new ConfigurationError('No AI provider configured for embedding generation. Please configure an AI provider in Settings > AI Provider.');
        }

        return {
            provider,
            model: config.embedding_model || SAME_MODE_DEFAULTS[provider] || SAME_MODE_DEFAULTS.ollama
        };
    }

    buildLegacyCloudConfig(config = {}, provider) {
        return {
            primary_provider: provider,
            api_key: config.api_key,
            api_endpoint: config.api_endpoint
        };
    }

    async getSameModeEmbedding(text, config = {}, signal = null) {
        const { provider, model } = this.getSameModeProvider(config);

        switch (provider) {
            case 'ollama':
                return await this.getOllamaEmbedding(text, null, null, model, config, signal);
            case 'gemini': {
                const cloudConfig = this.buildLegacyCloudConfig(config, provider);
                if (!cloudConfig.api_key) {
                    throw new ConfigurationError('No API key configured for gemini');
                }
                const result = await cloudLLMService.embedGemini(text, cloudConfig, model, signal);
                return {
                    embedding: result.embedding,
                    dims: result.dims,
                    provider,
                    model,
                    cost: result.cost
                };
            }
            case 'openai':
            case 'openrouter':
            case 'litellm':
            case 'custom': {
                const cloudConfig = this.buildLegacyCloudConfig(config, provider);
                if (!cloudConfig.api_key) {
                    throw new ConfigurationError(`No API key configured for ${provider}`);
                }
                const result = await cloudLLMService.embed(text, cloudConfig, model, signal);
                return {
                    embedding: result.embedding,
                    dims: result.dims,
                    provider,
                    model,
                    cost: result.cost
                };
            }
            default:
                throw new ConfigurationError(`Unknown embedding provider: ${provider}`);
        }
    }

    normalizeTestConfig(savedConfig = {}, override = {}) {
        if (!override || Object.keys(override).length === 0) {
            return savedConfig;
        }

        const mode = override.mode || override.embedding_provider_mode || savedConfig.embedding_provider_mode || 'same';
        return {
            ...savedConfig,
            embedding_provider_mode: mode,
            embedding_model: override.model || savedConfig.embedding_model,
            ollama_host: override.host || savedConfig.ollama_host,
            ollama_port: override.port || savedConfig.ollama_port,
            embedding_ollama_host: override.host || override.embedding_ollama_host || savedConfig.embedding_ollama_host,
            embedding_ollama_port: override.port || override.embedding_ollama_port || savedConfig.embedding_ollama_port,
            embedding_ollama_model: override.model || override.embedding_ollama_model || savedConfig.embedding_ollama_model,
            embedding_cloud_provider: override.provider || override.embedding_cloud_provider || savedConfig.embedding_cloud_provider,
            embedding_cloud_api_key: override.api_key || override.embedding_cloud_api_key || savedConfig.embedding_cloud_api_key,
            embedding_cloud_model: override.model || override.embedding_cloud_model || savedConfig.embedding_cloud_model,
            api_key: override.api_key || savedConfig.api_key,
            api_endpoint: override.api_endpoint || savedConfig.api_endpoint,
            primary_provider: override.primary_provider || savedConfig.primary_provider
        };
    }

    isModelCold() {
        if (!this.metrics.lastRequestTime) {
            return true;
        }

        const idleTime = Date.now() - this.metrics.lastRequestTime;
        return idleTime > this.coldModelIdleThreshold;
    }

    getAdaptiveTimeout(config) {
        const warmupTimeout = config.warmup_timeout || 120000;
        const requestTimeout = config.request_timeout || 30000;
        return this.isModelCold() ? warmupTimeout : requestTimeout;
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
        const avgLatency = this.metrics.totalRequests > 0
            ? this.metrics.totalLatency / this.metrics.totalRequests
            : 0;

        return {
            totalRequests: this.metrics.totalRequests,
            successfulRequests: this.metrics.successfulRequests,
            failedRequests: this.metrics.failedRequests,
            retryAttempts: this.metrics.retryAttempts,
            avgLatency: Math.round(avgLatency),
            lastRequestTime: this.metrics.lastRequestTime,
            isModelCold: this.isModelCold(),
            errorHistory: this.metrics.errorHistory.slice(-100),
            retryHistory: this.metrics.retryHistory.slice(-100),
            circuitBreaker: this.circuitBreaker.getStatus()
        };
    }

    recordError(error, latency, retryable) {
        const errorRecord = {
            timestamp: Date.now(),
            message: error.message,
            code: error.response?.status || error.code,
            latency,
            retryable
        };

        this.metrics.errorHistory.push(errorRecord);
        if (this.metrics.errorHistory.length > 100) {
            this.metrics.errorHistory.shift();
        }
    }

    recordRetry(attempt, error, delay, retryAfter) {
        const retryRecord = {
            timestamp: Date.now(),
            attempt,
            error: error.message,
            backoffDelay: delay,
            retryAfter: retryAfter || null
        };

        this.metrics.retryHistory.push(retryRecord);
        this.metrics.retryAttempts++;

        if (this.metrics.retryHistory.length > 100) {
            this.metrics.retryHistory.shift();
        }
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

        try {
            if (needsLock) {
                heartbeatTimer = setInterval(() => {
                    const shouldContinue = providerLock.heartbeat('embedding');
                    if (!shouldContinue) {
                        clearInterval(heartbeatTimer);
                        heartbeatTimer = null;
                        providerLock.releaseLock('embedding');
                        lockReleased = true;
                        throw new Error('Embedding operation was preempted by high-priority classification request. Please retry the operation.');
                    }
                }, heartbeatIntervalMs);
            }

            let result;

            const checkPreemptionAndYield = () => {
                if (needsLock && providerLock.isPreemptPending()) {
                    if (heartbeatTimer) {
                        clearInterval(heartbeatTimer);
                        heartbeatTimer = null;
                    }
                    providerLock.releaseLock('embedding');
                    lockReleased = true;
                    throw new Error('Embedding operation was preempted by high-priority classification request. Please retry the operation.');
                }
            };

            switch (mode) {
                case 'same':
                    checkPreemptionAndYield();
                    result = await this.getSameModeEmbedding(text, config, signal);
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
                        signal
                    );
                    break;
                case 'cloud':
                    checkPreemptionAndYield();
                    result = await this.getCloudEmbedding(text, config, signal);
                    break;
                default:
                    throw new ConfigurationError(`Unknown embedding provider mode: ${mode}`);
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

    async getOllamaEmbedding(text, host, port, model, config, signal = null) {
        if (!host || !port) {
            const result = await ollamaService.embed(text, model, '15m', signal);
            return {
                embedding: result.embedding,
                dims: result.dims,
                provider: 'ollama',
                model,
                cost: 0
            };
        }

        const timeout = this.getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const baseUrl = `http://${host}:${port}`;

            const response = await axios.post(
                `${baseUrl}/api/embed`,
                {
                    model,
                    input: text
                },
                { timeout, signal }
            );

            return response.data.embeddings?.[0] || response.data.embedding;
        };

        const embeddingWithRetry = await this.createRetriedOperation(makeRequest, {
            maxRetries,
            baseDelay,
            multiplier: backoffMultiplier,
            jitter,
            onRetry: (error, attempt, delay) => {
                logger.warn('Retrying Ollama embedding request', {
                    attempt: attempt + 1,
                    delay,
                    error: error.message
                });
                const retryAfter = error.response?.headers?.['retry-after'];
                this.recordRetry(attempt + 1, error, delay, retryAfter);
            }
        });

        try {
            const embedding = await embeddingWithRetry();
            return {
                embedding,
                dims: embedding.length,
                provider: 'ollama',
                model,
                cost: 0
            };
        } catch (error) {
            if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || error.code === 'ABORT_ERR') {
                throw error;
            }
            throw new Error(`Failed to generate Ollama embedding: ${error.message}`);
        }
    }

    async getCloudEmbedding(text, config, signal = null) {
        const provider = config.embedding_cloud_provider;
        const apiKey = config.embedding_cloud_api_key;
        const model = config.embedding_cloud_model || PROVIDER_DEFAULTS[provider]?.default;

        if (!provider) {
            throw new ConfigurationError('No cloud embedding provider configured');
        }

        if (!apiKey) {
            throw new ConfigurationError(`No API key configured for ${provider}`);
        }

        switch (provider) {
            case 'openai':
                return await this.getOpenAIEmbedding(text, apiKey, model, config, signal);
            case 'gemini':
                return await this.getGeminiEmbedding(text, apiKey, model, config, signal);
            case 'voyage':
                return await this.getVoyageEmbedding(text, apiKey, model, config, signal);
            case 'openrouter':
                return await this.getOpenRouterEmbedding(text, apiKey, model, config, signal);
            case 'cohere':
                return await this.getCohereEmbedding(text, apiKey, model, config, signal);
            default:
                throw new ConfigurationError(`Unknown cloud provider: ${provider}`);
        }
    }

    async getOpenAIEmbedding(text, apiKey, model = 'text-embedding-3-small', config = {}, signal = null) {
        const timeout = this.getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const response = await axios.post(
                'https://api.openai.com/v1/embeddings',
                { input: text, model },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout,
                    signal
                }
            );

            const embedding = response.data.data[0].embedding;
            const usage = response.data.usage || {};
            const costPerMillion = PROVIDER_DEFAULTS.openai.pricing[model] || 0.02;
            const cost = (usage.total_tokens || 0) / 1000000 * costPerMillion;

            return {
                embedding,
                dims: embedding.length,
                provider: 'openai',
                model,
                cost
            };
        };

        const embeddingWithRetry = await this.createRetriedOperation(makeRequest, {
            maxRetries,
            baseDelay,
            multiplier: backoffMultiplier,
            jitter,
            onRetry: (error, attempt, delay) => {
                logger.warn('Retrying OpenAI embedding request', {
                    attempt: attempt + 1,
                    delay,
                    error: error.message
                });
                const retryAfter = error.response?.headers?.['retry-after'];
                this.recordRetry(attempt + 1, error, delay, retryAfter);
            }
        });

        try {
            return await embeddingWithRetry();
        } catch (error) {
            if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || error.code === 'ABORT_ERR') {
                throw error;
            }
            throw new Error(`OpenAI embedding failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    async getGeminiEmbedding(text, apiKey, model = 'text-embedding-004', config = {}, signal = null) {
        const timeout = this.getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1/models/${model}:embedContent?key=${apiKey}`,
                { content: { parts: [{ text }] } },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout,
                    signal
                }
            );

            const embedding = response.data.embedding.values;
            const costPerMillion = PROVIDER_DEFAULTS.gemini.pricing[model] || 0.025;
            const cost = (text.length / 1000000) * costPerMillion;

            return {
                embedding,
                dims: embedding.length,
                provider: 'gemini',
                model,
                cost
            };
        };

        const embeddingWithRetry = await this.createRetriedOperation(makeRequest, {
            maxRetries,
            baseDelay,
            multiplier: backoffMultiplier,
            jitter,
            onRetry: (error, attempt, delay) => {
                logger.warn('Retrying Gemini embedding request', {
                    attempt: attempt + 1,
                    delay,
                    error: error.message
                });
                const retryAfter = error.response?.headers?.['retry-after'];
                this.recordRetry(attempt + 1, error, delay, retryAfter);
            }
        });

        try {
            return await embeddingWithRetry();
        } catch (error) {
            if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || error.code === 'ABORT_ERR') {
                throw error;
            }
            throw new Error(`Gemini embedding failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    async getVoyageEmbedding(text, apiKey, model = 'voyage-2', config = {}, signal = null) {
        const timeout = this.getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const response = await axios.post(
                'https://api.voyageai.com/v1/embeddings',
                { input: text, model },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout,
                    signal
                }
            );

            const embedding = response.data.data[0].embedding;
            const usage = response.data.usage || {};
            const costPerMillion = PROVIDER_DEFAULTS.voyage.pricing[model] || 0.012;
            const cost = (usage.total_tokens || 0) / 1000000 * costPerMillion;

            return {
                embedding,
                dims: embedding.length,
                provider: 'voyage',
                model,
                cost
            };
        };

        const embeddingWithRetry = await this.createRetriedOperation(makeRequest, {
            maxRetries,
            baseDelay,
            multiplier: backoffMultiplier,
            jitter,
            onRetry: (error, attempt, delay) => {
                logger.warn('Retrying Voyage embedding request', {
                    attempt: attempt + 1,
                    delay,
                    error: error.message
                });
                const retryAfter = error.response?.headers?.['retry-after'];
                this.recordRetry(attempt + 1, error, delay, retryAfter);
            }
        });

        try {
            return await embeddingWithRetry();
        } catch (error) {
            if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || error.code === 'ABORT_ERR') {
                throw error;
            }
            throw new Error(`Voyage embedding failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    async getOpenRouterEmbedding(text, apiKey, model = 'openai/text-embedding-3-small', config = {}, signal = null) {
        const timeout = this.getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const response = await axios.post(
                'https://openrouter.ai/api/v1/embeddings',
                { input: text, model },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout,
                    signal
                }
            );

            const embedding = response.data.data[0].embedding;
            const usage = response.data.usage || {};
            const costPerMillion = PROVIDER_DEFAULTS.openrouter.pricing[model] || 0.02;
            const cost = (usage.total_tokens || 0) / 1000000 * costPerMillion;

            return {
                embedding,
                dims: embedding.length,
                provider: 'openrouter',
                model,
                cost
            };
        };

        const embeddingWithRetry = await this.createRetriedOperation(makeRequest, {
            maxRetries,
            baseDelay,
            multiplier: backoffMultiplier,
            jitter,
            onRetry: (error, attempt, delay) => {
                logger.warn('Retrying OpenRouter embedding request', {
                    attempt: attempt + 1,
                    delay,
                    error: error.message
                });
                const retryAfter = error.response?.headers?.['retry-after'];
                this.recordRetry(attempt + 1, error, delay, retryAfter);
            }
        });

        try {
            return await embeddingWithRetry();
        } catch (error) {
            if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || error.code === 'ABORT_ERR') {
                throw error;
            }
            throw new Error(`OpenRouter embedding failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    async getCohereEmbedding(text, apiKey, model = 'embed-english-v3.0', config = {}, signal = null) {
        const timeout = this.getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const response = await axios.post(
                'https://api.cohere.ai/v1/embed',
                {
                    texts: [text],
                    model,
                    input_type: 'search_document'
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout,
                    signal
                }
            );

            const embedding = response.data.embeddings[0];
            const costPerMillion = PROVIDER_DEFAULTS.cohere.pricing[model] || 0.10;
            const cost = (text.length / 1000000) * costPerMillion;

            return {
                embedding,
                dims: embedding.length,
                provider: 'cohere',
                model,
                cost
            };
        };

        const embeddingWithRetry = await this.createRetriedOperation(makeRequest, {
            maxRetries,
            baseDelay,
            multiplier: backoffMultiplier,
            jitter,
            onRetry: (error, attempt, delay) => {
                logger.warn('Retrying Cohere embedding request', {
                    attempt: attempt + 1,
                    delay,
                    error: error.message
                });
                const retryAfter = error.response?.headers?.['retry-after'];
                this.recordRetry(attempt + 1, error, delay, retryAfter);
            }
        });

        try {
            return await embeddingWithRetry();
        } catch (error) {
            if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || error.code === 'ABORT_ERR') {
                throw error;
            }
            throw new Error(`Cohere embedding failed: ${error.response?.data?.message || error.message}`);
        }
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

    async getEmbeddingModels({ provider, api_key, api_endpoint } = {}) {
        const normalizedProvider = (provider || '').toLowerCase();
        if (!normalizedProvider) {
            return [];
        }

        switch (normalizedProvider) {
            case 'openai':
            case 'openrouter':
            case 'litellm':
            case 'custom':
                return await cloudLLMService.getEmbeddingModels({
                    primary_provider: normalizedProvider,
                    api_endpoint,
                    api_key
                });
            case 'gemini':
                return await cloudLLMService.getEmbeddingModels({
                    primary_provider: 'gemini',
                    api_key
                });
            case 'voyage':
            case 'cohere': {
                const defaults = PROVIDER_DEFAULTS[normalizedProvider]?.models || [];
                return defaults.map(id => ({ id, name: id }));
            }
            default:
                return [];
        }
    }
}

const embeddingProvider = new EmbeddingProvider();

module.exports = embeddingProvider;
