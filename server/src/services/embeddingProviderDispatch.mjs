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

import { cloudLLMService } from './cloudLLM.mjs';
import { ConfigurationError, PROVIDER_DEFAULTS, SAME_MODE_DEFAULTS } from './embeddingProviderConfig.mjs';

export function getSameModeProvider(config = {}) {
    const provider = config.primary_provider;
    if (!provider || provider === 'none') {
        throw new ConfigurationError('No AI provider configured for embedding generation. Please configure an AI provider in Settings > AI Provider.');
    }

    return {
        provider,
        model: config.embedding_model || SAME_MODE_DEFAULTS[provider] || SAME_MODE_DEFAULTS.ollama
    };
}

export function buildLegacyCloudConfig(config = {}, provider) {
    return {
        primary_provider: provider,
        api_key: config.api_key,
        api_endpoint: config.api_endpoint
    };
}

export async function getSameModeEmbedding(text, config = {}, signal = null, getOllamaEmbedding) {
    const { provider, model } = getSameModeProvider(config);

    switch (provider) {
        case 'ollama':
            return await getOllamaEmbedding(text, null, null, model, config, signal);
        case 'gemini': {
            const cloudConfig = buildLegacyCloudConfig(config, provider);
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
            const cloudConfig = buildLegacyCloudConfig(config, provider);
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

export async function getCloudEmbedding(text, config, signal = null, adapters) {
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
            return await adapters.getOpenAIEmbedding(text, apiKey, model, config, signal);
        case 'gemini':
            return await adapters.getGeminiEmbedding(text, apiKey, model, config, signal);
        case 'voyage':
            return await adapters.getVoyageEmbedding(text, apiKey, model, config, signal);
        case 'openrouter':
            return await adapters.getOpenRouterEmbedding(text, apiKey, model, config, signal);
        case 'cohere':
            return await adapters.getCohereEmbedding(text, apiKey, model, config, signal);
        default:
            throw new ConfigurationError(`Unknown cloud provider: ${provider}`);
    }
}

export function normalizeTestConfig(savedConfig = {}, override = {}) {
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
