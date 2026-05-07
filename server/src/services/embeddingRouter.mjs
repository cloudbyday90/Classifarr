/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { ollamaService } from './ollama.mjs';
import { embeddingProvider } from './embeddingProvider.mjs';
import { embeddingCircuitBreaker, OPEN_CIRCUIT_ERROR_MESSAGE } from './embeddingCircuitBreaker.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('EmbeddingRouter');

const DEFAULT_MODELS = {
    ollama: 'nomic-embed-text-v2-moe',
    openai: 'text-embedding-3-small',
    gemini: 'text-embedding-005',
    openrouter: 'text-embedding-3-small',
    litellm: 'text-embedding-3-small'
};

class EmbeddingRouter {
    resetConfig() {
        embeddingProvider.resetConfig();
    }

    async getConfig() {
        try {
            const result = await db.query(`
                SELECT
                    rag_enabled,
                    embedding_provider,
                    embedding_model,
                    rag_similarity_threshold,
                    rag_text_weight,
                    rag_image_weight,
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
                    embedding_cloud_model,
                    image_embedding_provider_mode,
                    image_embedding_local_host,
                    image_embedding_local_port,
                    image_embedding_local_model,
                    image_embedding_cloud_provider,
                    image_embedding_cloud_api_key,
                    image_embedding_cloud_model,
                    image_embedding_cloud_api_endpoint,
                    image_embedding_image_size,
                    image_embedding_rps,
                    image_embedding_concurrency,
                    image_embedding_batch_size,
                    image_embedding_cache_ttl_hours,
                    image_embedding_cache_max_mb,
                    rag_graph_enabled,
                    rag_graph_weight,
                    rag_graph_collection_enabled,
                    rag_graph_director_enabled,
                    rag_graph_studio_enabled,
                    rag_graph_cast_enabled,
                    rag_graph_genre_enabled,
                    rag_graph_min_matches_to_apply,
                    rag_graph_candidates_limit
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

    async isEnabled() {
        const config = await this.getConfig();
        return config?.rag_enabled === true;
    }

    isCircuitOpen() {
        return embeddingProvider.getCircuitStatus().state === 'OPEN';
    }

    recordFailure(error = null) {
        const previousStatus = embeddingProvider.getCircuitStatus();
        embeddingCircuitBreaker.recordFailure(error || new Error('Embedding router failure'));
        const nextStatus = embeddingProvider.getCircuitStatus();

        if (previousStatus.state !== 'OPEN' && nextStatus.state === 'OPEN') {
            logger.warn('Circuit breaker opened', {
                failures: nextStatus.failureCount ?? nextStatus.failures ?? 0,
                error: error?.message || null
            }, { skipDbPersist: true });
        }
    }

    resetCircuit() {
        embeddingProvider.resetCircuit();
    }

    isConfigurationError(error) {
        return error?.isConfigurationError === true || error?.name === 'ConfigurationError';
    }

    isOpenCircuitError(error) {
        return error?.code === 'EMBEDDING_CIRCUIT_OPEN' ||
            error?.message?.includes('Circuit breaker is OPEN');
    }

    shouldRecordFailure(error) {
        if (!error || error.name === 'AbortError') {
            return false;
        }

        if (this.isConfigurationError(error) || this.isOpenCircuitError(error)) {
            return false;
        }

        return true;
    }

    async getOpenCircuitFallback(text, config, signal) {
        const mode = config?.embedding_provider_mode || 'same';

        if (mode === 'same') {
            const providerConfig = embeddingProvider.getSameModeProvider(config);
            const provider = providerConfig?.provider || 'ollama';

            if (!config?.ollama_fallback_enabled || provider === 'ollama') {
                const error = new Error(OPEN_CIRCUIT_ERROR_MESSAGE);
                error.code = 'EMBEDDING_CIRCUIT_OPEN';
                throw error;
            }

            logger.info('Circuit breaker open, using Ollama fallback', { provider }, { skipDbPersist: true });
            return await this.embedWithOllama(text, DEFAULT_MODELS.ollama, '5m', signal);
        }

        if (mode === 'cloud' && config?.ollama_fallback_enabled) {
            logger.info('Circuit breaker open, using Ollama fallback', { mode }, { skipDbPersist: true });
            return await this.embedWithOllama(text, DEFAULT_MODELS.ollama, '5m', signal);
        }

        const error = new Error(OPEN_CIRCUIT_ERROR_MESSAGE);
        error.code = 'EMBEDDING_CIRCUIT_OPEN';
        throw error;
    }

    async testConnection() {
        return await embeddingProvider.testConnection();
    }

    canUseOllamaFallback(config) {
        if (!config?.ollama_fallback_enabled) {
            return false;
        }

        const mode = config?.embedding_provider_mode || 'same';
        if (mode !== 'same') {
            return true;
        }

        const providerConfig = embeddingProvider.getSameModeProvider(config);
        return providerConfig?.provider !== 'ollama';
    }

    async embed(text, options = {}) {
        const signal = options.signal || null;

        if (!text || text.trim().length === 0) {
            throw new Error('Cannot embed empty text');
        }

        const enabled = await this.isEnabled();
        if (!enabled) {
            throw new Error('RAG is not enabled');
        }

        const config = await this.getConfig();
        const mode = config?.embedding_provider_mode || 'same';

        if (mode === 'same' && !embeddingCircuitBreaker.isAllowed()) {
            const fallbackResult = await this.getOpenCircuitFallback(text, config, signal);
            return {
                ...fallbackResult,
                provider: 'ollama',
                model: DEFAULT_MODELS.ollama,
                fallback: true
            };
        }

        try {
            return await embeddingProvider.getEmbedding(text, { signal });
        } catch (error) {
            if (error.name === 'AbortError') {
                throw error;
            }

            if (this.isOpenCircuitError(error)) {
                const fallbackResult = await this.getOpenCircuitFallback(text, config, signal);
                return {
                    ...fallbackResult,
                    provider: 'ollama',
                    model: DEFAULT_MODELS.ollama,
                    fallback: true
                };
            }

            if (this.shouldRecordFailure(error)) {
                this.recordFailure(error);
            }

            logger.warn('Embedding failed, trying fallback', {
                mode,
                error: error.message
            });

            if (this.canUseOllamaFallback(config)) {
                try {
                    const fallbackResult = await this.embedWithOllama(text, DEFAULT_MODELS.ollama, '5m', signal);
                    return {
                        ...fallbackResult,
                        provider: 'ollama',
                        model: DEFAULT_MODELS.ollama,
                        fallback: true
                    };
                } catch (fallbackError) {
                    if (fallbackError.name === 'AbortError') {
                        throw fallbackError;
                    }
                    logger.error('Fallback embedding also failed', { error: fallbackError.message });
                }
            }

            throw error;
        }
    }

    async embedWithOllama(text, model = DEFAULT_MODELS.ollama, keepAlive = '5m', signal = null) {
        const result = await ollamaService.embed(text, model, keepAlive, signal);
        return {
            embedding: result.embedding,
            dims: result.dims,
            provider: 'ollama',
            model,
            cost: 0
        };
    }

    getCircuitStatus() {
        const status = embeddingProvider.getCircuitStatus();
        return {
            ...status,
            failures: status.failureCount ?? 0,
            lastFailure: status.lastFailureTime ?? null,
            threshold: status.config?.failureThreshold ?? 0
        };
    }

    getCircuitStateHistory(limit = 20) {
        return embeddingProvider.getCircuitStateHistory(limit);
    }
}

export const embeddingRouter = new EmbeddingRouter();

export { DEFAULT_MODELS };
