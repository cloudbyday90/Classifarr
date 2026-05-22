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

const logger = createLogger('EmbeddingProvider');

export function createAdapterMethods({ getAdaptiveTimeout, createRetriedOperation, recordRetry }) {
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
                {
                    model,
                    input: text
                },
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
        const timeout = getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const response = await httpPost(
                'https://api.openai.com/v1/embeddings',
                { input: text, model },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout,
                    signal,
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

        const embeddingWithRetry = await createRetriedOperation(makeRequest, {
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
                recordRetry(attempt + 1, error, delay, retryAfter);
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

    async function getGeminiEmbedding(text, apiKey, model = 'text-embedding-004', config = {}, signal = null) {
        const timeout = getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const response = await httpPost(
                `https://generativelanguage.googleapis.com/v1/models/${model}:embedContent?key=${apiKey}`,
                { content: { parts: [{ text }] } },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout,
                    signal,
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

        const embeddingWithRetry = await createRetriedOperation(makeRequest, {
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
                recordRetry(attempt + 1, error, delay, retryAfter);
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

    async function getVoyageEmbedding(text, apiKey, model = 'voyage-2', config = {}, signal = null) {
        const timeout = getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const response = await httpPost(
                'https://api.voyageai.com/v1/embeddings',
                { input: text, model },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout,
                    signal,
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

        const embeddingWithRetry = await createRetriedOperation(makeRequest, {
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
                recordRetry(attempt + 1, error, delay, retryAfter);
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

    async function getOpenRouterEmbedding(text, apiKey, model = 'openai/text-embedding-3-small', config = {}, signal = null) {
        const timeout = getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const response = await httpPost(
                'https://openrouter.ai/api/v1/embeddings',
                { input: text, model },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout,
                    signal,
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

        const embeddingWithRetry = await createRetriedOperation(makeRequest, {
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
                recordRetry(attempt + 1, error, delay, retryAfter);
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

    async function getCohereEmbedding(text, apiKey, model = 'embed-english-v3.0', config = {}, signal = null) {
        const timeout = getAdaptiveTimeout(config);
        const maxRetries = config.max_retries || 3;
        const baseDelay = config.retry_delay || 1000;
        const backoffMultiplier = config.retry_backoff_multiplier || 2;
        const jitter = config.jitter_factor || 0.3;

        const makeRequest = async () => {
            const response = await httpPost(
                'https://api.cohere.ai/v1/embed',
                {
                    texts: [text],
                    model,
                    input_type: 'search_document',
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout,
                    signal,
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

        const embeddingWithRetry = await createRetriedOperation(makeRequest, {
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
                recordRetry(attempt + 1, error, delay, retryAfter);
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

    return { getOllamaEmbedding, getOpenAIEmbedding, getGeminiEmbedding, getVoyageEmbedding, getOpenRouterEmbedding, getCohereEmbedding };
}
