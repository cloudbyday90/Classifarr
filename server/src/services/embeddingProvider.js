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
const { createLogger } = require('../utils/logger');

const logger = createLogger('EmbeddingProvider');

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
 */
class EmbeddingProvider {
    constructor() {
        this.config = null;
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

        const config = await this.getConfig();
        if (!config) {
            throw new Error('No embedding provider configuration found');
        }

        const mode = config.embedding_provider_mode || 'same';

        try {
            let result;

            switch (mode) {
                case 'same':
                    // Use classification provider (legacy behavior via ollamaService)
                    result = await this.getOllamaEmbedding(
                        text,
                        null,  // Don't pass host - use ollamaService
                        null,  // Don't pass port - use ollamaService
                        config.embedding_model || 'nomic-embed-text-v2-moe'
                    );
                    break;

                case 'separate_ollama':
                    // Use dedicated Ollama instance
                    result = await this.getOllamaEmbedding(
                        text,
                        config.embedding_ollama_host,
                        config.embedding_ollama_port,
                        config.embedding_ollama_model || 'nomic-embed-text-v2-moe'
                    );
                    break;

                case 'cloud':
                    // Use cloud provider
                    result = await this.getCloudEmbedding(text, config);
                    break;

                default:
                    throw new Error(`Unknown embedding provider mode: ${mode}`);
            }

            logger.info('Embedding generated', {
                mode,
                provider: result.provider,
                model: result.model,
                dims: result.dims,
                cost: result.cost
            });

            return result;

        } catch (error) {
            logger.error('Failed to generate embedding', {
                mode,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Generate embedding using Ollama
     * @param {string} text - Text to embed
     * @param {string} host - Ollama host
     * @param {number} port - Ollama port
     * @param {string} model - Embedding model
     */
    async getOllamaEmbedding(text, host, port, model) {
        // If using classification Ollama (same mode), use existing service
        if (!host || !port) {
            const result = await ollamaService.embed(text, model);
            return {
                embedding: result.embedding,
                dims: result.dims,
                provider: 'ollama',
                model: model,
                cost: 0
            };
        }

        // Otherwise, make direct request to separate Ollama instance
        try {
            const baseUrl = `http://${host}:${port}`;
            
            const response = await axios.post(
                `${baseUrl}/api/embeddings`,
                {
                    model: model,
                    prompt: text
                },
                { timeout: 60000 }
            );

            const embedding = response.data.embedding;

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
            throw new Error('No cloud embedding provider configured');
        }

        if (!apiKey) {
            throw new Error(`No API key configured for ${provider}`);
        }

        switch (provider) {
            case 'openai':
                return await this.getOpenAIEmbedding(text, apiKey, model);
            case 'gemini':
                return await this.getGeminiEmbedding(text, apiKey, model);
            case 'voyage':
                return await this.getVoyageEmbedding(text, apiKey, model);
            case 'openrouter':
                return await this.getOpenRouterEmbedding(text, apiKey, model);
            case 'cohere':
                return await this.getCohereEmbedding(text, apiKey, model);
            default:
                throw new Error(`Unknown cloud provider: ${provider}`);
        }
    }

    /**
     * OpenAI embeddings
     */
    async getOpenAIEmbedding(text, apiKey, model = 'text-embedding-3-small') {
        try {
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
                    timeout: 60000
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
        } catch (error) {
            throw new Error(`OpenAI embedding failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Google Gemini embeddings
     */
    async getGeminiEmbedding(text, apiKey, model = 'text-embedding-004') {
        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1/models/${model}:embedContent?key=${apiKey}`,
                {
                    content: {
                        parts: [{ text: text }]
                    }
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000
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
        } catch (error) {
            throw new Error(`Gemini embedding failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Voyage AI embeddings
     */
    async getVoyageEmbedding(text, apiKey, model = 'voyage-2') {
        try {
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
                    timeout: 60000
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
        } catch (error) {
            throw new Error(`Voyage embedding failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * OpenRouter embeddings
     */
    async getOpenRouterEmbedding(text, apiKey, model = 'openai/text-embedding-3-small') {
        try {
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
                    timeout: 60000
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
        } catch (error) {
            throw new Error(`OpenRouter embedding failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Cohere embeddings
     */
    async getCohereEmbedding(text, apiKey, model = 'embed-english-v3.0') {
        try {
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
                    timeout: 60000
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
        } catch (error) {
            throw new Error(`Cohere embedding failed: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Test connection for any provider
     */
    async testConnection() {
        try {
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
