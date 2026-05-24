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

import { httpPost } from '../utils/httpClient.mjs';
import { ollamaService } from './ollama.mjs';
import { createLogger } from '../utils/logger.mjs';
import { PROVIDER_DEFAULTS } from './embeddingProviderConfig.mjs';
import { executeCloudEmbedding } from './embeddingCloudAdapterHelper.mjs';

const logger = createLogger('EmbeddingProvider');

export function createAdapterMethods({ getAdaptiveTimeout, createRetriedOperation, recordRetry }) {
    const cloudDeps = { getAdaptiveTimeout, createRetriedOperation, recordRetry };

    async function getOllamaEmbedding(text, host, port, model, config, signal = null) {
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

        const timeout = getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const baseUrl = `http://${host}:${port}`;
            const response = await httpPost(
                `${baseUrl}/api/embed`,
                { model, input: text },
                { timeout, signal }
            );
            return response.data.embeddings?.[0] || response.data.embedding;
        };

        const embeddingWithRetry = await createRetriedOperation(makeRequest, {
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
                recordRetry(attempt + 1, error, delay, retryAfter);
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

    async function getOpenAIEmbedding(text, apiKey, model = 'text-embedding-3-small', config = {}, signal = null) {
        return executeCloudEmbedding({
            text, model, config, signal,
            url: 'https://api.openai.com/v1/embeddings',
            providerName: 'OpenAI',
            bodyBuilder: (t, m) => ({
                body: { input: t, model: m },
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
            }),
            responseParser: (data) => {
                const embedding = data.data[0].embedding;
                const costPerMillion = PROVIDER_DEFAULTS.openai.pricing[model] || 0.02;
                const cost = (data.usage?.total_tokens || 0) / 1000000 * costPerMillion;
                return { embedding, dims: embedding.length, provider: 'openai', model, cost };
            },
            errorExtractor: (err) => err.response?.data?.error?.message || err.message
        }, cloudDeps);
    }

    async function getGeminiEmbedding(text, apiKey, model = 'text-embedding-004', config = {}, signal = null) {
        return executeCloudEmbedding({
            text, model, config, signal,
            url: `https://generativelanguage.googleapis.com/v1/models/${model}:embedContent?key=${apiKey}`,
            providerName: 'Gemini',
            bodyBuilder: (t) => ({
                body: { content: { parts: [{ text: t }] } },
                headers: { 'Content-Type': 'application/json' }
            }),
            responseParser: (data) => {
                const embedding = data.embedding.values;
                const costPerMillion = PROVIDER_DEFAULTS.gemini.pricing[model] || 0.025;
                const cost = (text.length / 1000000) * costPerMillion;
                return { embedding, dims: embedding.length, provider: 'gemini', model, cost };
            },
            errorExtractor: (err) => err.response?.data?.error?.message || err.message
        }, cloudDeps);
    }

    async function getVoyageEmbedding(text, apiKey, model = 'voyage-2', config = {}, signal = null) {
        return executeCloudEmbedding({
            text, model, config, signal,
            url: 'https://api.voyageai.com/v1/embeddings',
            providerName: 'Voyage',
            bodyBuilder: (t, m) => ({
                body: { input: t, model: m },
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
            }),
            responseParser: (data) => {
                const embedding = data.data[0].embedding;
                const costPerMillion = PROVIDER_DEFAULTS.voyage.pricing[model] || 0.012;
                const cost = (data.usage?.total_tokens || 0) / 1000000 * costPerMillion;
                return { embedding, dims: embedding.length, provider: 'voyage', model, cost };
            },
            errorExtractor: (err) => err.response?.data?.error?.message || err.message
        }, cloudDeps);
    }

    async function getOpenRouterEmbedding(text, apiKey, model = 'openai/text-embedding-3-small', config = {}, signal = null) {
        return executeCloudEmbedding({
            text, model, config, signal,
            url: 'https://openrouter.ai/api/v1/embeddings',
            providerName: 'OpenRouter',
            bodyBuilder: (t, m) => ({
                body: { input: t, model: m },
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
            }),
            responseParser: (data) => {
                const embedding = data.data[0].embedding;
                const costPerMillion = PROVIDER_DEFAULTS.openrouter.pricing[model] || 0.02;
                const cost = (data.usage?.total_tokens || 0) / 1000000 * costPerMillion;
                return { embedding, dims: embedding.length, provider: 'openrouter', model, cost };
            },
            errorExtractor: (err) => err.response?.data?.error?.message || err.message
        }, cloudDeps);
    }

    async function getCohereEmbedding(text, apiKey, model = 'embed-english-v3.0', config = {}, signal = null) {
        return executeCloudEmbedding({
            text, model, config, signal,
            url: 'https://api.cohere.ai/v1/embed',
            providerName: 'Cohere',
            bodyBuilder: (t, m) => ({
                body: { texts: [t], model: m, input_type: 'search_document' },
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
            }),
            responseParser: (data) => {
                const embedding = data.embeddings[0];
                const costPerMillion = PROVIDER_DEFAULTS.cohere.pricing[model] || 0.10;
                const cost = (text.length / 1000000) * costPerMillion;
                return { embedding, dims: embedding.length, provider: 'cohere', model, cost };
            },
            errorExtractor: (err) => err.response?.data?.message || err.message
        }, cloudDeps);
    }

    return { getOllamaEmbedding, getOpenAIEmbedding, getGeminiEmbedding, getVoyageEmbedding, getOpenRouterEmbedding, getCohereEmbedding };
}
