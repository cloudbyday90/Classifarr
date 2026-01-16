/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const axios = require('axios');
const db = require('../config/database');
const ollamaService = require('./ollama');
const providerLock = require('./providerLock');
const { createLogger } = require('../utils/logger');
const { withRetry, isRetryableError } = require('../utils/retryUtils');
const CircuitBreaker = require('./circuitBreaker');

const logger = createLogger('EmbeddingProvider');

/**
 * Configuration Error class - used to distinguish config errors from transient failures
 * Configuration errors should NOT trip the circuit breaker
 */
class ConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigurationError';
        this.isConfigurationError = true;
    }
}

// Provider-specific model defaults and pricing
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
            'text-embedding-3-small': 0.02,  // per 1M tokens
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
            'text-embedding-004': 0.025,  // per 1M characters
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
            'voyage-2': 0.012,  // per 1M tokens (estimate)
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
            'openai/text-embedding-3-small': 0.02,  // per 1M tokens
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
            'embed-english-v3.0': 0.10,  // per 1M characters (estimate)
            'embed-multilingual-v3.0': 0.10,
            'embed-english-light-v3.0': 0.10
        }
    }
};

/**
 * Embedding Provider Service
 * Routes embedding requests to appropriate provider based on configuration:
 * - 'same': Use classification provider (existing behavior)
 * - 'separate_ollama': Use dedicated Ollama instance
 * - 'cloud': Use cloud embedding provider (OpenAI, Gemini, Voyage, OpenRouter, Cohere)
 * 
 * Note: Metrics updates in this class use simple counter increments which are atomic
 * in Node.js's single-threaded event loop. In a truly concurrent environment (e.g.,
 * worker threads, cluster mode), these would require synchronization mechanisms.
 */
class EmbeddingProvider {
    constructor() {
        this.config = null;
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: 5,
            recoveryTimeout: 60000,
            halfOpenMaxAttempts: 3
        });

        // Metrics tracking
        // Note: Updates to these metrics are performed with simple increments which are
        // safe in Node.js's single-threaded model. For cluster/worker thread scenarios,
        // consider using atomic operations or shared memory solutions.
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

        // Cold model detection
        this.coldModelIdleThreshold = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get embedding provider configuration from database
     */
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
                    -- Legacy columns for 'same' mode
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

    /**
     * Reset cached configuration
     */
    resetConfig() {
        this.config = null;
        logger.info('Embedding provider config cache cleared');
    }

    /**
     * Reset metrics
     * @note This method is intended for testing purposes only to ensure test isolation.
     * It should not be called in production code as it will clear all tracking data.
     */
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
    }

    /**
     * Check if model is likely cold (needs warmup)
     * @returns {boolean} True if model is likely cold
     */
    isModelCold() {
        if (!this.metrics.lastRequestTime) {
            return true; // Never used
        }

        const idleTime = Date.now() - this.metrics.lastRequestTime;
        return idleTime > this.coldModelIdleThreshold;
    }

    /**
     * Get adaptive timeout based on model state
     * @param {Object} config - Configuration object
     * @returns {number} Timeout in milliseconds
     */
    getAdaptiveTimeout(config) {
        const warmupTimeout = config.warmup_timeout || 120000; // 120s default
        const requestTimeout = config.request_timeout || 30000; // 30s default

        return this.isModelCold() ? warmupTimeout : requestTimeout;
    }

    /**
     * Warmup the model by making a test embedding request
     * @returns {Promise<Object>} Warmup result
     */
    async warmup() {
        logger.info('Warming up embedding model');
        const startTime = Date.now();

        try {
            await this.getEmbedding('warmup test');
            const duration = Date.now() - startTime;

            logger.info('Model warmup completed', { duration });
            return {
                success: true,
                duration
            };
        } catch (error) {
            logger.error('Model warmup failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Get metrics data
     * @returns {Object} Metrics information
     */
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
            // Return last 100 items for history (limited internally to 100)
            errorHistory: this.metrics.errorHistory.slice(-100),
            retryHistory: this.metrics.retryHistory.slice(-100),
            circuitBreaker: this.circuitBreaker.getStatus()
        };
    }

    /**
     * Record an error in history
     * @param {Error} error - The error that occurred
     * @param {number} latency - Request latency in ms
     * @param {boolean} retryable - Whether error was retryable
     */
    recordError(error, latency, retryable) {
        const errorRecord = {
            timestamp: Date.now(),
            message: error.message,
            code: error.response?.status || error.code,
            latency,
            retryable
        };

        this.metrics.errorHistory.push(errorRecord);

        // Keep history limited
        if (this.metrics.errorHistory.length > 100) {
            this.metrics.errorHistory.shift();
        }
    }

    /**
     * Record a retry attempt in history
     * @param {number} attempt - Retry attempt number
     * @param {Error} error - The error that caused retry
     * @param {number} delay - Backoff delay in ms
     * @param {string} retryAfter - Retry-After header value if present
     */
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

        // Keep history limited
        if (this.metrics.retryHistory.length > 100) {
            this.metrics.retryHistory.shift();
        }
    }

    /**
     * Generate embedding for text
     * Routes to appropriate provider based on embedding_provider_mode
     * 
     * @param {string} text - Text to embed
     * @returns {Promise<{embedding: number[], dims: number, provider: string, model: string, cost: number}>}
     */
    async getEmbedding(text) {
        if (!text || text.trim().length === 0) {
            throw new Error('Cannot embed empty text');
        }

        // Check circuit breaker
        if (!this.circuitBreaker.isAllowed()) {
            const error = new Error('Circuit breaker is OPEN - too many recent failures');
            logger.warn('Request blocked by circuit breaker');

            // Record the circuit breaker rejection in error history
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

        // Store config interval to avoid race conditions
        const heartbeatIntervalMs = needsLock ? providerLock.config.heartbeatInterval : null;
        let heartbeatTimer = null;
        let lockReleased = false; // Track if lock was already released
        const startTime = Date.now();

        try {
            if (needsLock) {
                // Start heartbeat and check for preemption
                heartbeatTimer = setInterval(() => {
                    const shouldContinue = providerLock.heartbeat('embedding');
                    if (!shouldContinue) {
                        // Preemption requested - pause and yield
                        clearInterval(heartbeatTimer);
                        heartbeatTimer = null; // Mark timer as cleared
                        providerLock.releaseLock('embedding');
                        lockReleased = true; // Mark lock as released
                        throw new Error('Embedding operation was preempted by high-priority classification request. Please retry the operation.');
                    }
                }, heartbeatIntervalMs);
            }

            let result;

            // Helper to check preemption and yield if needed (best practice per Node.js async patterns)
            // This allows classification to preempt BEFORE the HTTP call starts, not just during heartbeats
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
                    // Use classification provider (legacy behavior via ollamaService)
                    // Validate that primary provider is configured
                    if (!config.primary_provider || config.primary_provider === 'none') {
                        throw new ConfigurationError('No AI provider configured for embedding generation. Please configure an AI provider in Settings > AI Provider.');
                    }
                    // Check preemption BEFORE starting HTTP request (Node.js event loop is non-preemptive)
                    checkPreemptionAndYield();
                    result = await this.getOllamaEmbedding(
                        text,
                        null,  // Don't pass host - use ollamaService
                        null,  // Don't pass port - use ollamaService
                        config.embedding_model || 'nomic-embed-text-v2-moe',
                        config
                    );
                    break;

                case 'separate_ollama':
                    // Use dedicated Ollama instance
                    // Validate that separate Ollama host is configured
                    if (!config.embedding_ollama_host) {
                        throw new ConfigurationError('No separate Ollama host configured. Please configure host and port in RAG Settings > Embedding Provider.');
                    }
                    // Check preemption before HTTP request
                    checkPreemptionAndYield();
                    result = await this.getOllamaEmbedding(
                        text,
                        config.embedding_ollama_host,
                        config.embedding_ollama_port,
                        config.embedding_ollama_model || 'nomic-embed-text-v2-moe',
                        config
                    );
                    break;

                case 'cloud':
                    // Use cloud provider
                    // Validation happens in getCloudEmbedding
                    checkPreemptionAndYield();
                    result = await this.getCloudEmbedding(text, config);
                    break;

                default:
                    throw new ConfigurationError(`Unknown embedding provider mode: ${mode}`);
            }

            // Record success metrics
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
            // Record failure metrics
            const latency = Date.now() - startTime;
            this.metrics.totalRequests++;
            this.metrics.failedRequests++;
            this.metrics.totalLatency += latency;
            const retryable = isRetryableError(error);

            // Only trip circuit breaker for retryable (transient) errors or server errors (5xx)
            // Don't trip for client errors (4xx), configuration issues, or validation errors to avoid false 'Offline' status
            const isConfigError = error.isConfigurationError || error.name === 'ConfigurationError';
            if (!isConfigError && (retryable || (error.response?.status >= 500))) {
                this.circuitBreaker.recordFailure(error);
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
            // Clean up heartbeat and release lock (only if not already released)
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
            }
            if (needsLock && !lockReleased) {
                providerLock.releaseLock('embedding');
            }
        }
    }

    /**
     * Generate embedding using Ollama
     * @param {string} text - Text to embed
     * @param {string} host - Ollama host
     * @param {number} port - Ollama port
     * @param {string} model - Embedding model
     * @param {Object} config - Configuration object
     */
    async getOllamaEmbedding(text, host, port, model, config) {
        // If using classification Ollama (same mode), use existing service
        if (!host || !port) {
            // Use 15m keep_alive for batch efficiency during backfill operations
            const result = await ollamaService.embed(text, model, '15m');
            return {
                embedding: result.embedding,
                dims: result.dims,
                provider: 'ollama',
                model: model,
                cost: 0
            };
        }

        // Otherwise, make direct request to separate Ollama instance with retry logic
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
                    model: model,
                    input: text
                },
                { timeout }
            );

            // New /api/embed endpoint returns embeddings array (for batch support)
            return response.data.embeddings?.[0] || response.data.embedding;
        };

        const embeddingWithRetry = withRetry(makeRequest, {
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
                embedding: embedding,
                dims: embedding.length,
                provider: 'ollama',
                model: model,
                cost: 0
            };
        } catch (error) {
            throw new Error(`Failed to generate Ollama embedding: ${error.message}`);
        }
    }

    /**
     * Generate embedding using cloud provider
     * @param {string} text - Text to embed
     * @param {object} config - Configuration object
     */
    async getCloudEmbedding(text, config) {
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
                return await this.getOpenAIEmbedding(text, apiKey, model, config);
            case 'gemini':
                return await this.getGeminiEmbedding(text, apiKey, model, config);
            case 'voyage':
                return await this.getVoyageEmbedding(text, apiKey, model, config);
            case 'openrouter':
                return await this.getOpenRouterEmbedding(text, apiKey, model, config);
            case 'cohere':
                return await this.getCohereEmbedding(text, apiKey, model, config);
            default:
                throw new ConfigurationError(`Unknown cloud provider: ${provider}`);
        }
    }

    /**
     * OpenAI embeddings
     */
    async getOpenAIEmbedding(text, apiKey, model = 'text-embedding-3-small', config = {}) {
        const timeout = this.getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const response = await axios.post(
                'https://api.openai.com/v1/embeddings',
                {
                    input: text,
                    model: model
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout
                }
            );

            const embedding = response.data.data[0].embedding;
            const usage = response.data.usage || {};

            // Calculate cost using pricing from PROVIDER_DEFAULTS
            const costPerMillion = PROVIDER_DEFAULTS.openai.pricing[model] || 0.02;
            const cost = (usage.total_tokens || 0) / 1000000 * costPerMillion;

            return {
                embedding: embedding,
                dims: embedding.length,
                provider: 'openai',
                model: model,
                cost: cost
            };
        };

        const embeddingWithRetry = withRetry(makeRequest, {
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
            throw new Error(`OpenAI embedding failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Google Gemini embeddings
     */
    async getGeminiEmbedding(text, apiKey, model = 'text-embedding-004', config = {}) {
        const timeout = this.getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1/models/${model}:embedContent?key=${apiKey}`,
                {
                    content: {
                        parts: [{ text: text }]
                    }
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout
                }
            );

            const embedding = response.data.embedding.values;

            // Gemini embedding cost using pricing from PROVIDER_DEFAULTS
            const costPerMillion = PROVIDER_DEFAULTS.gemini.pricing[model] || 0.025;
            const cost = (text.length / 1000000) * costPerMillion;

            return {
                embedding: embedding,
                dims: embedding.length,
                provider: 'gemini',
                model: model,
                cost: cost
            };
        };

        const embeddingWithRetry = withRetry(makeRequest, {
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
            throw new Error(`Gemini embedding failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Voyage AI embeddings
     */
    async getVoyageEmbedding(text, apiKey, model = 'voyage-2', config = {}) {
        const timeout = this.getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const response = await axios.post(
                'https://api.voyageai.com/v1/embeddings',
                {
                    input: text,
                    model: model
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout
                }
            );

            const embedding = response.data.data[0].embedding;
            const usage = response.data.usage || {};

            // Voyage pricing from PROVIDER_DEFAULTS
            const costPerMillion = PROVIDER_DEFAULTS.voyage.pricing[model] || 0.012;
            const cost = (usage.total_tokens || 0) / 1000000 * costPerMillion;

            return {
                embedding: embedding,
                dims: embedding.length,
                provider: 'voyage',
                model: model,
                cost: cost
            };
        };

        const embeddingWithRetry = withRetry(makeRequest, {
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
            throw new Error(`Voyage embedding failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * OpenRouter embeddings
     */
    async getOpenRouterEmbedding(text, apiKey, model = 'openai/text-embedding-3-small', config = {}) {
        const timeout = this.getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const response = await axios.post(
                'https://openrouter.ai/api/v1/embeddings',
                {
                    input: text,
                    model: model
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout
                }
            );

            const embedding = response.data.data[0].embedding;
            const usage = response.data.usage || {};

            // OpenRouter pricing from PROVIDER_DEFAULTS  
            const costPerMillion = PROVIDER_DEFAULTS.openrouter.pricing[model] || 0.02;
            const cost = (usage.total_tokens || 0) / 1000000 * costPerMillion;

            return {
                embedding: embedding,
                dims: embedding.length,
                provider: 'openrouter',
                model: model,
                cost: cost
            };
        };

        const embeddingWithRetry = withRetry(makeRequest, {
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
            throw new Error(`OpenRouter embedding failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Cohere embeddings
     */
    async getCohereEmbedding(text, apiKey, model = 'embed-english-v3.0', config = {}) {
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
                    model: model,
                    input_type: 'search_document'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout
                }
            );

            const embedding = response.data.embeddings[0];

            // Cohere pricing from PROVIDER_DEFAULTS (character-based, not token-based)
            // Note: This is an estimate - actual pricing may vary
            const costPerMillion = PROVIDER_DEFAULTS.cohere.pricing[model] || 0.10;
            const cost = (text.length / 1000000) * costPerMillion;

            return {
                embedding: embedding,
                dims: embedding.length,
                provider: 'cohere',
                model: model,
                cost: cost
            };
        };

        const embeddingWithRetry = withRetry(makeRequest, {
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
            throw new Error(`Cohere embedding failed: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Test connection for any provider
     */
    async testConnection(config = {}) {
        try {
            // If config is provided, we are testing a specific setup (draft)
            if (Object.keys(config).length > 0) {
                const mode = config.mode || config.embedding_provider_mode;

                if (mode === 'same' || mode === 'separate_ollama') {
                    const host = config.host || config.embedding_ollama_host;
                    const port = config.port || config.embedding_ollama_port;
                    const model = config.model || config.embedding_ollama_model;

                    // Use getOllamaEmbedding with explicit config
                    const result = await this.getOllamaEmbedding('Test Connection', host, port, model, config);

                    return {
                        success: true,
                        provider: 'ollama',
                        model: model,
                        dimensions: result.dims,
                        cost: 0
                    };
                }

                // TODO: Add cloud provider test logic here if needed
            }

            // Fallback: Test existing saved configuration
            const testEmbedding = await this.getEmbedding('test connection');
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

    /**
     * Get provider defaults for UI
     */
    getProviderDefaults() {
        return PROVIDER_DEFAULTS;
    }
}

module.exports = new EmbeddingProvider();
