/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const db = require('../config/database');
const ollamaService = require('./ollama');
const cloudLLMService = require('./cloudLLM');
const embeddingProvider = require('./embeddingProvider');
const { createLogger } = require('../utils/logger');

const logger = createLogger('EmbeddingRouter');

// Default embedding models per provider
const DEFAULT_MODELS = {
    ollama: 'nomic-embed-text-v2-moe',
    openai: 'text-embedding-3-small',
    gemini: 'text-embedding-005',
    openrouter: 'text-embedding-3-small',
    litellm: 'text-embedding-3-small'
};

// Circuit breaker state
const circuitBreaker = {
    state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
    failures: 0,
    lastFailure: null,
    threshold: 5,
    resetTimeMs: 300000 // 5 minutes
};

/**
 * Embedding Router Service
 * Routes embedding requests to the appropriate provider (Ollama, OpenAI, Gemini)
 * with fallback support and circuit breaker protection
 */
class EmbeddingRouter {
    constructor() {
        this.config = null;
    }

    /**
     * Reset cached configuration
     */
    resetConfig() {
        this.config = null;
        embeddingProvider.resetConfig();
    }

    /**
     * Get RAG configuration from database
     */
    async getConfig() {
        try {
            const result = await db.query(`
                SELECT 
                    rag_enabled,
                    embedding_provider,
                    embedding_model,
                    rag_similarity_threshold,
                    rag_backfill_budget_type,
                    rag_backfill_budget_value,
                    rag_min_history_count,
                    primary_provider,
                    api_key,
                    api_endpoint,
                    ollama_host,
                    ollama_port,
                    ollama_fallback_enabled,
                    pattern_mining_enabled,
                    pattern_rule_priority,
                    pattern_ai_skip_threshold,
                    pattern_notification_dismissed,
                    formula_pattern_weight,
                    formula_rule_weight,
                    formula_rag_weight,
                    formula_history_weight,
                    embedding_provider_mode,
                    embedding_ollama_host,
                    embedding_ollama_port,
                    embedding_ollama_model,
                    embedding_cloud_provider,
                    embedding_cloud_api_key,
                    embedding_cloud_model
                FROM ai_provider_config 
                WHERE id = 1
            `);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to get RAG config', { error: error.message });
            return null;
        }
    }

    /**
     * Check if RAG is enabled
     */
    async isEnabled() {
        const config = await this.getConfig();
        return config?.rag_enabled === true;
    }

    /**
     * Get the effective embedding provider
     * 'auto' = use same as LLM provider
     */
    async getProvider() {
        const config = await this.getConfig();
        if (!config) return null;

        let provider = config.embedding_provider;

        // 'auto' means use the same provider as LLM
        if (provider === 'auto') {
            provider = config.primary_provider;
        }

        return {
            provider,
            model: config.embedding_model || DEFAULT_MODELS[provider] || DEFAULT_MODELS.ollama,
            config
        };
    }

    /**
     * Check circuit breaker state
     */
    isCircuitOpen() {
        if (circuitBreaker.state === 'OPEN') {
            const timeSinceFailure = Date.now() - circuitBreaker.lastFailure;
            if (timeSinceFailure > circuitBreaker.resetTimeMs) {
                circuitBreaker.state = 'HALF_OPEN';
                logger.info('Circuit breaker half-open, testing provider');
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Record a failure for circuit breaker
     */
    recordFailure() {
        circuitBreaker.failures++;
        circuitBreaker.lastFailure = Date.now();

        if (circuitBreaker.failures >= circuitBreaker.threshold) {
            circuitBreaker.state = 'OPEN';
            logger.error('Circuit breaker opened', { failures: circuitBreaker.failures });
        }
    }

    /**
     * Reset circuit breaker on success
     */
    resetCircuit() {
        circuitBreaker.state = 'CLOSED';
        circuitBreaker.failures = 0;
    }

    /**
     * Generate embedding for text
     * Routes to appropriate provider with fallback support
     * 
     * @param {string} text - Text to embed
     * @returns {Promise<{embedding: number[], dims: number, provider: string, model: string, cost: number}>}
     */
    async embed(text) {
        if (!text || text.trim().length === 0) {
            throw new Error('Cannot embed empty text');
        }

        const enabled = await this.isEnabled();
        if (!enabled) {
            throw new Error('RAG is not enabled');
        }

        // Check circuit breaker
        if (this.isCircuitOpen()) {
            logger.warn('Circuit breaker open, using fallback');
            return await this.embedWithOllama(text);
        }

        const config = await this.getConfig();

        // Check if using new embedding provider mode
        const mode = config?.embedding_provider_mode || 'same';

        if (mode !== 'same') {
            // Use new embeddingProvider service for separate_ollama and cloud modes
            try {
                const result = await embeddingProvider.getEmbedding(text);

                // Success - reset circuit breaker
                this.resetCircuit();

                return result;
            } catch (error) {
                this.recordFailure();

                logger.warn('Embedding provider failed, trying fallback', {
                    mode,
                    error: error.message
                });

                // Try Ollama fallback if enabled
                if (config?.ollama_fallback_enabled) {
                    try {
                        const fallbackResult = await this.embedWithOllama(text);
                        return {
                            ...fallbackResult,
                            provider: 'ollama',
                            model: DEFAULT_MODELS.ollama,
                            fallback: true
                        };
                    } catch (fallbackError) {
                        logger.error('Fallback embedding also failed', { error: fallbackError.message });
                    }
                }

                throw error;
            }
        }

        // Legacy behavior: use embedding_provider column (mode = 'same')
        const { provider, model, config: providerConfig } = await this.getProvider();

        try {
            let result;

            switch (provider) {
                case 'ollama':
                    result = await this.embedWithOllama(text, model);
                    break;

                case 'gemini':
                    result = await this.embedWithGemini(text, model, providerConfig);
                    break;

                case 'openai':
                case 'openrouter':
                case 'litellm':
                case 'custom':
                    result = await this.embedWithCloud(text, model, providerConfig);
                    break;

                default:
                    // Default to Ollama for local embedding
                    result = await this.embedWithOllama(text, DEFAULT_MODELS.ollama);
            }

            // Success - reset circuit breaker
            this.resetCircuit();

            return {
                ...result,
                provider: result.provider || provider || 'ollama',
                model: result.model || model
            };

        } catch (error) {
            this.recordFailure();

            logger.warn('Primary embedding failed, trying fallback', {
                provider,
                error: error.message
            });

            // Try Ollama fallback if enabled
            if (providerConfig?.ollama_fallback_enabled && provider !== 'ollama') {
                try {
                    const fallbackResult = await this.embedWithOllama(text);
                    return {
                        ...fallbackResult,
                        provider: 'ollama',
                        model: DEFAULT_MODELS.ollama,
                        fallback: true
                    };
                } catch (fallbackError) {
                    logger.error('Fallback embedding also failed', { error: fallbackError.message });
                }
            }

            throw error;
        }
    }

    /**
     * Embed using Ollama
     */
    async embedWithOllama(text, model = DEFAULT_MODELS.ollama) {
        const result = await ollamaService.embed(text, model);
        return {
            embedding: result.embedding,
            dims: result.dims,
            provider: 'ollama',
            model: model,
            cost: 0 // Local is free
        };
    }

    /**
     * Embed using cloud provider (OpenAI, OpenRouter, LiteLLM)
     */
    async embedWithCloud(text, model, config) {
        const result = await cloudLLMService.embed(text, config, model);
        return {
            embedding: result.embedding,
            dims: result.dims,
            cost: result.cost
        };
    }

    /**
     * Embed using Gemini
     */
    async embedWithGemini(text, model, config) {
        const result = await cloudLLMService.embedGemini(text, config, model);
        return {
            embedding: result.embedding,
            dims: result.dims,
            cost: result.cost
        };
    }

    /**
     * Get circuit breaker status
     */
    getCircuitStatus() {
        return {
            state: circuitBreaker.state,
            failures: circuitBreaker.failures,
            lastFailure: circuitBreaker.lastFailure,
            threshold: circuitBreaker.threshold
        };
    }

    /**
     * Get recommended embedding models for each provider
     */
    getRecommendedModels() {
        return {
            ollama: [
                // Popular/Recommended
                { id: 'nomic-embed-text', name: 'Nomic Embed Text', dims: 768, recommended: true, desc: 'High-performing open embedding model with large context window' },
                { id: 'mxbai-embed-large', name: 'MxBai Embed Large', dims: 1024, recommended: true, desc: 'State-of-the-art large embedding model from mixedbread.ai' },
                { id: 'bge-m3', name: 'BGE-M3', dims: 1024, desc: 'Multi-Functionality, Multi-Linguality, Multi-Granularity model from BAAI' },
                { id: 'all-minilm', name: 'All-MiniLM', dims: 384, desc: 'Fast, lightweight model for sentence embeddings' },
                // Additional models
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
    }
}

module.exports = new EmbeddingRouter();
