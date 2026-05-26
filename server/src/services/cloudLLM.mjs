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
import { isOpenAIReasoningModel, buildChatRequestBody } from './cloudLLMRequestBuilder.mjs';
import { DEFAULT_ENDPOINTS, getEndpoint as _getEndpoint, getHeaders as _getHeaders } from './cloudLLMHelpers.mjs';
import { testGeminiConnection as _testGeminiConnection, getOpenAIModels, getOpenAIEmbeddingModels, getGeminiModels as _getGeminiModels, getGeminiEmbeddingModels as _getGeminiEmbeddingModels } from './cloudLLMModels.mjs';
import { embed as _embed, embedGemini as _embedGemini } from './cloudLLMEmbeddings.mjs';
import { chatResponses as _chatResponses, chatGemini as _chatGemini } from './cloudLLMChat.mjs';

const logger = createLogger('CloudLLM');

class CloudLLMService {
    constructor() {
        this.defaultEndpoints = DEFAULT_ENDPOINTS;
    }

    getEndpoint(config) {
        return _getEndpoint(config);
    }

    getHeaders(config) {
        return _getHeaders(config);
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
        return _testGeminiConnection(config);
    }

    async chatResponses(messages, config, options = {}, startTime) {
        return _chatResponses(messages, config, options, startTime);
    }

    async getModels(config) {
        if (config.primary_provider === 'gemini') {
            return await this.getGeminiModels(config);
        }
        return await getOpenAIModels(config);
    }

    async getEmbeddingModels(config) {
        if (config.primary_provider === 'gemini') {
            return await this.getGeminiEmbeddingModels(config);
        }
        return await getOpenAIEmbeddingModels(config);
    }

    async getGeminiModels(config) {
        return _getGeminiModels(config);
    }

    async getGeminiEmbeddingModels(config) {
        return _getGeminiEmbeddingModels(config);
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

            const requestBody = buildChatRequestBody(messages, config, options);

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
        return _chatGemini(messages, config, options, startTime);
    }

    async embed(text, config, model = 'text-embedding-3-small', signal = null) {
        return _embed(text, config, model, signal);
    }

    async embedGemini(text, config, model = 'text-embedding-005', signal = null) {
        return _embedGemini(text, config, model, signal);
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
