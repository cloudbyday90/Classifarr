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
const { createLogger } = require('../utils/logger');
const db = require('../config/database');

const logger = createLogger('CloudLLM');

/**
 * Pricing data for cost estimation (per 1M tokens) - Updated December 2025
 * OpenRouter provides real-time pricing in response headers
 */
const OPENAI_PRICING = {
    // GPT-5 series (latest 2025)
    'gpt-5.2': { input: 1.75, output: 14.00 },
    'gpt-5.2-pro': { input: 21.00, output: 168.00 },
    'gpt-5-mini': { input: 0.25, output: 2.00 },
    // O-series reasoning models (2025)
    'o3': { input: 2.00, output: 8.00 },
    'o3-mini': { input: 1.10, output: 4.40 },
    'o3-pro': { input: 20.00, output: 80.00 },
    'o1': { input: 15.00, output: 60.00 },
    'o1-mini': { input: 1.10, output: 4.40 },
    // GPT-4 series (still available)
    'gpt-4.1': { input: 3.00, output: 12.00 },
    'gpt-4o': { input: 5.00, output: 15.00 },
    'gpt-4o-mini': { input: 0.60, output: 2.40 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
};

// Gemini pricing (per 1M tokens) - Updated December 2025
const GEMINI_PRICING = {
    // Gemini 3 series (latest December 2025)
    'gemini-3-flash': { input: 0.50, output: 3.00 },
    'gemini-3-pro-preview': { input: 2.00, output: 12.00 },
    // Gemini 2.5 series
    'gemini-2.5-pro': { input: 1.25, output: 10.00 },
    'gemini-2.5-flash': { input: 0.30, output: 2.50 },
    'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
    // Gemini 2.0 series
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },
    'gemini-2.0-flash-lite': { input: 0.08, output: 0.30 },
    'gemini-2.0-flash-exp': { input: 0, output: 0 }, // Free experimental
    // Legacy 1.5 series
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
};

/**
 * Cloud LLM Service
 * Supports OpenAI, OpenRouter, LiteLLM, and any OpenAI-compatible endpoint
 */
class CloudLLMService {
    constructor() {
        this.defaultEndpoints = {
            openai: 'https://api.openai.com/v1',
            openrouter: 'https://openrouter.ai/api/v1',
            litellm: 'http://localhost:4000/v1',
            gemini: 'https://generativelanguage.googleapis.com/v1beta',
        };
    }

    /**
     * Get the API endpoint for a provider
     * Note: Only litellm/custom use custom endpoints. OpenAI/OpenRouter/Gemini 
     * always use their official endpoints to prevent stale configuration issues
     * when switching providers (fixes issue #68)
     */
    getEndpoint(config) {
        // Only use custom endpoints for providers that genuinely need them
        if (config.api_endpoint && ['litellm', 'custom'].includes(config.primary_provider)) {
            return config.api_endpoint;
        }
        return this.defaultEndpoints[config.primary_provider] || config.api_endpoint;
    }

    /**
     * Test connection to the API
     */
    async testConnection(config) {
        try {
            // Gemini uses different endpoint format
            if (config.primary_provider === 'gemini') {
                return await this.testGeminiConnection(config);
            }

            const endpoint = this.getEndpoint(config);
            const response = await axios.get(`${endpoint}/models`, {
                headers: this.getHeaders(config),
                timeout: 10000
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

    /**
     * Test Gemini connection
     */
    async testGeminiConnection(config) {
        try {
            const response = await axios.get(
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

    /**
     * Get available models from the provider
     */
    async getModels(config) {
        try {
            // Gemini uses different API format
            if (config.primary_provider === 'gemini') {
                return await this.getGeminiModels(config);
            }

            const endpoint = this.getEndpoint(config);
            const response = await axios.get(`${endpoint}/models`, {
                headers: this.getHeaders(config),
                timeout: 10000
            });

            const models = response.data?.data || [];

            // Filter and sort models (prioritize chat models)
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

    /**
     * Get Gemini models
     */
    async getGeminiModels(config) {
        try {
            const response = await axios.get(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${config.api_key}`,
                { timeout: 10000 }
            );

            const models = response.data?.models || [];

            // Filter for generative models only
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

    /**
     * Get request headers for the provider
     */
    getHeaders(config) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (config.api_key) {
            headers['Authorization'] = `Bearer ${config.api_key}`;
        }

        // OpenRouter specific headers
        if (config.primary_provider === 'openrouter') {
            headers['HTTP-Referer'] = 'https://classifarr.local';
            headers['X-Title'] = 'Classifarr';
        }

        return headers;
    }

    /**
     * Send a chat completion request
     */
    async chat(messages, config, options = {}) {
        const startTime = Date.now();

        // Use Gemini-specific API
        if (config.primary_provider === 'gemini') {
            return await this.chatGemini(messages, config, options, startTime);
        }

        const endpoint = this.getEndpoint(config);

        try {
            const requestBody = {
                model: config.model,
                messages: messages,
                temperature: parseFloat(config.temperature) || 0.7,
                max_tokens: parseInt(config.max_tokens) || 2000,
            };

            logger.debug('Cloud LLM request', {
                provider: config.primary_provider,
                model: config.model,
                messageCount: messages.length
            });

            const response = await axios.post(
                `${endpoint}/chat/completions`,
                requestBody,
                {
                    headers: this.getHeaders(config),
                    timeout: 120000 // 2 minute timeout
                }
            );

            const result = response.data;
            const usage = result.usage || {};

            // Calculate cost
            const cost = this.calculateCost(
                config.primary_provider,
                config.model,
                usage.prompt_tokens || 0,
                usage.completion_tokens || 0,
                response.headers // OpenRouter includes pricing in headers
            );

            // Log usage
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

            // Update running total
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
            // Log failed request
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

    /**
     * Send a chat request to Gemini API
     */
    async chatGemini(messages, config, options = {}, startTime) {
        try {
            // Convert OpenAI format to Gemini format
            const geminiContents = messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }));

            // Add system instruction separately
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

            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.api_key}`,
                requestBody,
                { timeout: 120000 }
            );

            const result = response.data;
            const candidate = result.candidates?.[0];
            const content = candidate?.content?.parts?.[0]?.text || '';

            // Gemini usage metadata
            const usage = result.usageMetadata || {};
            const promptTokens = usage.promptTokenCount || 0;
            const completionTokens = usage.candidatesTokenCount || 0;
            const totalTokens = usage.totalTokenCount || 0;

            // Calculate cost using Gemini pricing
            const cost = this.calculateGeminiCost(config.model, promptTokens, completionTokens);

            // Log usage
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

            // Update running total
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
            // Log failed request
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

    /**
     * Calculate Gemini cost
     */
    calculateGeminiCost(model, promptTokens, completionTokens) {
        const pricing = GEMINI_PRICING[model];
        if (pricing) {
            const inputCost = (promptTokens / 1000000) * pricing.input;
            const outputCost = (completionTokens / 1000000) * pricing.output;
            return inputCost + outputCost;
        }
        // Default Gemini estimate
        return ((promptTokens + completionTokens) / 1000000) * 0.5;
    }

    /**
     * Calculate cost based on provider and token usage
     */
    calculateCost(provider, model, promptTokens, completionTokens, headers = {}) {
        // OpenRouter provides pricing in response headers
        if (provider === 'openrouter') {
            const promptPrice = parseFloat(headers['x-openrouter-price-per-prompt-token']) || 0;
            const completionPrice = parseFloat(headers['x-openrouter-price-per-completion-token']) || 0;

            if (promptPrice > 0 || completionPrice > 0) {
                return (promptTokens * promptPrice) + (completionTokens * completionPrice);
            }
        }

        // Use hardcoded pricing for OpenAI
        const pricing = OPENAI_PRICING[model];
        if (pricing) {
            const inputCost = (promptTokens / 1000000) * pricing.input;
            const outputCost = (completionTokens / 1000000) * pricing.output;
            return inputCost + outputCost;
        }

        // Default fallback estimate (conservative)
        return ((promptTokens + completionTokens) / 1000000) * 5.0; // $5 per 1M tokens
    }

    /**
     * Log usage to database
     */
    async logUsage(usage) {
        try {
            await db.query(`
                INSERT INTO ai_usage_log 
                (provider, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, request_type, item_title, success, error_message)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                usage.provider,
                usage.model,
                usage.promptTokens,
                usage.completionTokens,
                usage.totalTokens,
                usage.costUSD,
                usage.requestType,
                usage.itemTitle,
                usage.success,
                usage.errorMessage
            ]);
        } catch (error) {
            logger.error('Failed to log AI usage', { error: error.message });
        }
    }

    /**
     * Update monthly usage running total
     */
    async updateMonthlyUsage(cost) {
        try {
            await db.query(`
                UPDATE ai_provider_config 
                SET current_month_usage_usd = current_month_usage_usd + $1,
                    updated_at = NOW()
                WHERE id = 1
            `, [cost]);
        } catch (error) {
            logger.error('Failed to update monthly usage', { error: error.message });
        }
    }

    /**
     * Check if budget is exhausted
     */
    async checkBudget() {
        try {
            const result = await db.query(`
                SELECT monthly_budget_usd, current_month_usage_usd, pause_on_budget_exhausted
                FROM ai_provider_config WHERE id = 1
            `);

            if (result.rows.length === 0) return { exhausted: false };

            const config = result.rows[0];
            if (!config.monthly_budget_usd) return { exhausted: false };

            const exhausted = parseFloat(config.current_month_usage_usd) >= parseFloat(config.monthly_budget_usd);

            return {
                exhausted,
                shouldPause: exhausted && config.pause_on_budget_exhausted,
                usage: parseFloat(config.current_month_usage_usd),
                budget: parseFloat(config.monthly_budget_usd),
                percentUsed: Math.round((config.current_month_usage_usd / config.monthly_budget_usd) * 100)
            };
        } catch (error) {
            logger.error('Failed to check budget', { error: error.message });
            return { exhausted: false };
        }
    }

    /**
     * Reset monthly usage (called by scheduler on month boundary)
     */
    async resetMonthlyUsage() {
        try {
            const currentMonth = new Date().toISOString().slice(0, 7);

            // Archive current usage to monthly summary
            await db.query(`
                INSERT INTO ai_usage_monthly (year_month, provider, total_requests, total_tokens, total_cost_usd)
                SELECT 
                    $1,
                    provider,
                    COUNT(*),
                    SUM(total_tokens),
                    SUM(cost_usd)
                FROM ai_usage_log
                WHERE created_at >= date_trunc('month', CURRENT_DATE)
                GROUP BY provider
                ON CONFLICT (year_month, provider) 
                DO UPDATE SET 
                    total_requests = EXCLUDED.total_requests,
                    total_tokens = EXCLUDED.total_tokens,
                    total_cost_usd = EXCLUDED.total_cost_usd
            `, [currentMonth]);

            // Reset running total
            await db.query(`
                UPDATE ai_provider_config 
                SET current_month_usage_usd = 0,
                    last_budget_reset = CURRENT_DATE,
                    updated_at = NOW()
                WHERE id = 1
            `);

            logger.info('Monthly AI usage reset completed');
        } catch (error) {
            logger.error('Failed to reset monthly usage', { error: error.message });
        }
    }

    /**
     * Get usage statistics
     */
    async getUsageStats() {
        try {
            // Current month stats
            const currentResult = await db.query(`
                SELECT 
                    COUNT(*) as total_requests,
                    SUM(total_tokens) as total_tokens,
                    SUM(cost_usd) as total_cost,
                    SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests
                FROM ai_usage_log
                WHERE created_at >= date_trunc('month', CURRENT_DATE)
            `);

            // Last month stats
            const lastMonthResult = await db.query(`
                SELECT * FROM ai_usage_monthly 
                WHERE year_month = to_char(CURRENT_DATE - interval '1 month', 'YYYY-MM')
            `);

            // Budget info
            const budgetResult = await db.query(`
                SELECT monthly_budget_usd, current_month_usage_usd, budget_alert_threshold
                FROM ai_provider_config WHERE id = 1
            `);

            const current = currentResult.rows[0] || {};
            const lastMonth = lastMonthResult.rows[0] || {};
            const budget = budgetResult.rows[0] || {};

            return {
                currentMonth: {
                    requests: parseInt(current.total_requests) || 0,
                    tokens: parseInt(current.total_tokens) || 0,
                    cost: parseFloat(current.total_cost) || 0,
                    successRate: current.total_requests > 0
                        ? Math.round((current.successful_requests / current.total_requests) * 100)
                        : 100
                },
                lastMonth: {
                    requests: parseInt(lastMonth.total_requests) || 0,
                    tokens: parseInt(lastMonth.total_tokens) || 0,
                    cost: parseFloat(lastMonth.total_cost_usd) || 0
                },
                budget: {
                    limit: parseFloat(budget.monthly_budget_usd) || null,
                    used: parseFloat(budget.current_month_usage_usd) || 0,
                    alertThreshold: budget.budget_alert_threshold || 80
                }
            };
        } catch (error) {
            logger.error('Failed to get usage stats', { error: error.message });
            return null;
        }
    }
}

module.exports = new CloudLLMService();
