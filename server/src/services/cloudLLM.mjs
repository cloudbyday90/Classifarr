/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { httpGet, httpPost } from '../utils/httpClient.mjs';
import { createLogger } from '../utils/logger.mjs';
import * as db from '../config/database.mjs';
import { calculateCost as calculateCostFn, calculateGeminiCost as calculateGeminiCostFn } from './cloudLLMPricing.mjs';
import { logUsage as logUsageFn, logEmbeddingCost as logEmbeddingCostFn, updateMonthlyUsage as updateMonthlyUsageFn, checkBudget as checkBudgetFn, resetMonthlyUsage as resetMonthlyUsageFn, getUsageStats as getUsageStatsFn } from './cloudLLMUsage.mjs';
import { isOpenAIReasoningModel, normalizeOpenAIReasoningMessages, buildChatRequestBody, buildResponsesRequestBody, extractResponsesContent, normalizeResponsesUsage } from './cloudLLMRequestBuilder.mjs';

const logger = createLogger('CloudLLM');

class CloudLLMService {
    constructor() {
        this.defaultEndpoints = {
            openai: 'https://api.openai.com/v1',
            openrouter: 'https://openrouter.ai/api/v1',
            litellm: 'http://localhost:4000/v1',
            gemini: 'https://generativelanguage.googleapis.com/v1beta',
        };
    }

    getEndpoint(config) {
        if (config.api_endpoint && ['litellm', 'custom'].includes(config.primary_provider)) {
            return config.api_endpoint;
        }
        return this.defaultEndpoints[config.primary_provider] || config.api_endpoint;
    }

    async testConnection(config) {
        try {
            if (config.primary_provider === 'gemini') {
                return await this.testGeminiConnection(config);
            }

            const endpoint = this.getEndpoint(config);
            const response = await httpGet(`${endpoint}/models`, {
                headers: this.getHeaders(config),
                timeout: 10000,
            });

            const models = response.data?.data || [];
            return {
                success: true,
                message: `Connected successfully. Found ${models.length} models.`,
                models: models.slice(0, 10).map(m => m.id)
            };
        } catch (error) {
            logger.error('Cloud LLM connection test failed', { error: error.message });
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    async testGeminiConnection(config) {
        try {
            const response = await httpGet(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${config.api_key}`,
                { timeout: 10000 }
            );

            const models = response.data?.models || [];
            return {
                success: true,
                message: `Connected successfully. Found ${models.length} models.`,
                models: models.slice(0, 10).map(m => m.name.replace('models/', ''))
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    async chatResponses(messages, config, options = {}, startTime) {
        const endpoint = this.getEndpoint(config);
        const requestBody = buildResponsesRequestBody(messages, config);

        logger.debug('Cloud LLM Responses request', {
            provider: config.primary_provider,
            model: config.model,
            messageCount: messages.length
        });

        const response = await httpPost(
            `${endpoint}/responses`,
            requestBody,
            {
                headers: this.getHeaders(config),
                timeout: 120000,
            }
        );

        const result = response.data;
        const usage = normalizeResponsesUsage(result.usage || {});

        const cost = this.calculateCost(
            config.primary_provider,
            config.model,
            usage.promptTokens,
            usage.completionTokens,
            response.headers
        );

        await this.logUsage({
            provider: config.primary_provider,
            model: config.model,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            costUSD: cost,
            requestType: options.requestType || 'classification',
            itemTitle: options.itemTitle,
            success: true
        });

        await this.updateMonthlyUsage(cost);

        const elapsedMs = Date.now() - startTime;
        logger.info('Cloud LLM Responses response', {
            provider: config.primary_provider,
            model: config.model,
            tokens: usage.totalTokens,
            cost: `$${cost.toFixed(6)}`,
            elapsedMs
        });

        return {
            content: extractResponsesContent(result),
            usage: {
                ...usage,
                cost: cost
            },
            model: result.model || config.model,
            finishReason: result.incomplete_details?.reason || result.status
        };
    }

    async getModels(config) {
        try {
            if (config.primary_provider === 'gemini') {
                return await this.getGeminiModels(config);
            }

            const endpoint = this.getEndpoint(config);
            const response = await httpGet(`${endpoint}/models`, {
                headers: this.getHeaders(config),
                timeout: 10000,
            });

            const models = response.data?.data || [];

            const chatModels = models
                .filter(m => !m.id.includes('embedding') && !m.id.includes('whisper') && !m.id.includes('tts'))
                .map(m => ({
                    id: m.id,
                    name: m.id,
                    owned_by: m.owned_by
                }))
                .sort((a, b) => a.id.localeCompare(b.id));

            return chatModels;
        } catch (error) {
            logger.error('Failed to get models', { error: error.message });
            return [];
        }
    }

    async getEmbeddingModels(config) {
        try {
            if (config.primary_provider === 'gemini') {
                return await this.getGeminiEmbeddingModels(config);
            }

            const endpoint = this.getEndpoint(config);
            const response = await httpGet(`${endpoint}/models`, {
                headers: this.getHeaders(config),
                timeout: 10000,
            });

            const models = response.data?.data || [];

            const embeddingModels = models
                .filter(m => /embed|embedding/i.test(m.id || ''))
                .map(m => ({
                    id: m.id,
                    name: m.id,
                    owned_by: m.owned_by
                }))
                .sort((a, b) => a.id.localeCompare(b.id));

            return embeddingModels;
        } catch (error) {
            logger.error('Failed to get embedding models', { error: error.message });
            return [];
        }
    }

    async getGeminiEmbeddingModels(config) {
        try {
            const response = await httpGet(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${config.api_key}`,
                { timeout: 10000 }
            );

            const models = response.data?.models || [];

            return models
                .filter(m => {
                    const name = (m.name || '').toLowerCase();
                    const display = (m.displayName || '').toLowerCase();
                    const methods = (m.supportedGenerationMethods || []).map(method => method.toLowerCase());
                    return name.includes('embedding') ||
                        display.includes('embedding') ||
                        methods.some(method => method.includes('embed'));
                })
                .map(m => ({
                    id: m.name.replace('models/', ''),
                    name: m.displayName || m.name.replace('models/', ''),
                    description: m.description
                }));
        } catch (error) {
            logger.error('Failed to get Gemini embedding models', { error: error.message });
            return [];
        }
    }

    async getGeminiModels(config) {
        try {
            const response = await httpGet(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${config.api_key}`,
                { timeout: 10000 }
            );

            const models = response.data?.models || [];

            return models
                .filter(m => m.name.includes('gemini'))
                .map(m => ({
                    id: m.name.replace('models/', ''),
                    name: m.displayName || m.name.replace('models/', ''),
                    description: m.description
                }));
        } catch (error) {
            logger.error('Failed to get Gemini models', { error: error.message });
            return [];
        }
    }

    getHeaders(config) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (config.api_key) {
            headers['Authorization'] = `Bearer ${config.api_key}`;
        }

        if (config.primary_provider === 'openrouter') {
            headers['HTTP-Referer'] = 'https://classifarr.local';
            headers['X-Title'] = 'Classifarr';
        }

        return headers;
    }

    async chat(messages, config, options = {}) {
        const startTime = Date.now();

        if (config.primary_provider === 'gemini') {
            return await this.chatGemini(messages, config, options, startTime);
        }

        const endpoint = this.getEndpoint(config);

        try {
            if (isOpenAIReasoningModel(config)) {
                return await this.chatResponses(messages, config, options, startTime);
            }

            const requestBody = buildChatRequestBody(messages, config);

            logger.debug('Cloud LLM request', {
                provider: config.primary_provider,
                model: config.model,
                messageCount: messages.length
            });

            const response = await httpPost(
                `${endpoint}/chat/completions`,
                requestBody,
                {
                    headers: this.getHeaders(config),
                    timeout: 120000,
                }
            );

            const result = response.data;
            const usage = result.usage || {};

            const cost = this.calculateCost(
                config.primary_provider,
                config.model,
                usage.prompt_tokens || 0,
                usage.completion_tokens || 0,
                response.headers
            );

            await this.logUsage({
                provider: config.primary_provider,
                model: config.model,
                promptTokens: usage.prompt_tokens || 0,
                completionTokens: usage.completion_tokens || 0,
                totalTokens: usage.total_tokens || 0,
                costUSD: cost,
                requestType: options.requestType || 'classification',
                itemTitle: options.itemTitle,
                success: true
            });

            await this.updateMonthlyUsage(cost);

            const elapsedMs = Date.now() - startTime;
            logger.info('Cloud LLM response', {
                provider: config.primary_provider,
                model: config.model,
                tokens: usage.total_tokens,
                cost: `$${cost.toFixed(6)}`,
                elapsedMs
            });

            return {
                content: result.choices?.[0]?.message?.content || '',
                usage: {
                    promptTokens: usage.prompt_tokens,
                    completionTokens: usage.completion_tokens,
                    totalTokens: usage.total_tokens,
                    cost: cost
                },
                model: result.model,
                finishReason: result.choices?.[0]?.finish_reason
            };
        } catch (error) {
            await this.logUsage({
                provider: config.primary_provider,
                model: config.model,
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                costUSD: 0,
                requestType: options.requestType || 'classification',
                itemTitle: options.itemTitle,
                success: false,
                errorMessage: error.message
            });

            logger.error('Cloud LLM request failed', {
                provider: config.primary_provider,
                error: error.response?.data?.error?.message || error.message
            });

            throw error;
        }
    }

    async chatGemini(messages, config, options = {}, startTime) {
        try {
            const geminiContents = messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }));

            const systemMessage = messages.find(m => m.role === 'system');

            const requestBody = {
                contents: geminiContents,
                generationConfig: {
                    temperature: parseFloat(config.temperature) || 0.7,
                    maxOutputTokens: parseInt(config.max_tokens) || 2000,
                }
            };

            if (systemMessage) {
                requestBody.systemInstruction = {
                    parts: [{ text: systemMessage.content }]
                };
            }

            logger.debug('Gemini request', {
                model: config.model,
                messageCount: geminiContents.length
            });

            const response = await httpPost(
                `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.api_key}`,
                requestBody,
                { timeout: 120000 }
            );

            const result = response.data;
            const candidate = result.candidates?.[0];
            const content = candidate?.content?.parts?.[0]?.text || '';

            const usage = result.usageMetadata || {};
            const promptTokens = usage.promptTokenCount || 0;
            const completionTokens = usage.candidatesTokenCount || 0;
            const totalTokens = usage.totalTokenCount || 0;

            const cost = calculateGeminiCost(config.model, promptTokens, completionTokens);

            await this.logUsage({
                provider: 'gemini',
                model: config.model,
                promptTokens,
                completionTokens,
                totalTokens,
                costUSD: cost,
                requestType: options.requestType || 'classification',
                itemTitle: options.itemTitle,
                success: true
            });

            await this.updateMonthlyUsage(cost);

            const elapsedMs = Date.now() - startTime;
            logger.info('Gemini response', {
                model: config.model,
                tokens: totalTokens,
                cost: `$${cost.toFixed(6)}`,
                elapsedMs
            });

            return {
                content,
                usage: {
                    promptTokens,
                    completionTokens,
                    totalTokens,
                    cost
                },
                model: config.model,
                finishReason: candidate?.finishReason
            };
        } catch (error) {
            await this.logUsage({
                provider: 'gemini',
                model: config.model,
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                costUSD: 0,
                requestType: options.requestType || 'classification',
                itemTitle: options.itemTitle,
                success: false,
                errorMessage: error.message
            });

            logger.error('Gemini request failed', {
                error: error.response?.data?.error?.message || error.message
            });

            throw error;
        }
    }

    async embed(text, config, model = 'text-embedding-3-small', signal = null) {
        const endpoint = this.getEndpoint(config);

        try {
            logger.debug('Embedding request', {
                provider: config.primary_provider,
                model: model,
                textLength: text.length
            });

            const response = await httpPost(
                `${endpoint}/embeddings`,
                {
                    model: model,
                    input: text
                },
                {
                    headers: this.getHeaders(config),
                    timeout: 60000,
                    signal: signal,
                }
            );

            const embedding = response.data.data?.[0]?.embedding;
            const usage = response.data.usage || {};

            const costPerMillion = model.includes('large') ? 0.13 : 0.02;
            const cost = (usage.total_tokens || 0) / 1000000 * costPerMillion;

            await this.logEmbeddingCost(config.primary_provider, model, usage.total_tokens || 0, cost);

            logger.info('Embedding generated', {
                provider: config.primary_provider,
                model: model,
                dims: embedding?.length || 0,
                cost: `$${cost.toFixed(6)}`
            });

            return {
                embedding: embedding,
                dims: embedding?.length || 0,
                cost: cost,
                tokens: usage.total_tokens || 0
            };
        } catch (error) {
            if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
                throw error;
            }
            logger.error('Embedding request failed', {
                provider: config.primary_provider,
                error: error.response?.data?.error?.message || error.message
            });
            throw error;
        }
    }

    async embedGemini(text, config, model = 'text-embedding-005', signal = null) {
        try {
            logger.debug('Gemini embedding request', {
                model: model,
                textLength: text.length
            });

            const response = await httpPost(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${config.api_key}`,
                {
                    content: {
                        parts: [{ text: text }]
                    }
                },
                { timeout: 60000, signal: signal }
            );

            const embedding = response.data.embedding?.values;

            const cost = (text.length / 1000000) * 0.025;

            await this.logEmbeddingCost('gemini', model, text.length, cost);

            logger.info('Gemini embedding generated', {
                model: model,
                dims: embedding?.length || 0,
                cost: `$${cost.toFixed(6)}`
            });

            return {
                embedding: embedding,
                dims: embedding?.length || 0,
                cost: cost,
                tokens: text.length
            };
        } catch (error) {
            if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
                throw error;
            }
            logger.error('Gemini embedding request failed', {
                error: error.response?.data?.error?.message || error.message
            });
            throw error;
        }
    }

    async logEmbeddingCost(provider, model, tokens, costUSD) {
        return logEmbeddingCostFn({ db, logger }, provider, model, tokens, costUSD);
    }

    calculateCost(provider, model, promptTokens, completionTokens, headers) {
        return calculateCostFn(provider, model, promptTokens, completionTokens, headers);
    }

    calculateGeminiCost(model, promptTokens, completionTokens) {
        return calculateGeminiCostFn(model, promptTokens, completionTokens);
    }

    async logUsage(usage) {
        return logUsageFn({ db, logger }, usage);
    }

    async updateMonthlyUsage(cost) {
        return updateMonthlyUsageFn({ db, logger }, cost);
    }

    async checkBudget() {
        return checkBudgetFn({ db, logger });
    }

    async resetMonthlyUsage() {
        return resetMonthlyUsageFn({ db, logger });
    }

    async getUsageStats() {
        return getUsageStatsFn({ db, logger });
    }
}

export const cloudLLMService = new CloudLLMService();
