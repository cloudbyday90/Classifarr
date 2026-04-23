/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const { createLogger } = require('../utils/logger');
const db = require('../config/database');

const logger = createLogger('AIRouter');

/**
 * AI Router Service
 * Routes AI requests to the appropriate provider (Ollama or Cloud)
 */
class AIRouterService {
    constructor() {
        this.configCache = null;
        this.configCacheTime = null;
        this.cacheTTL = 30000; // 30 second cache
    }

    /**
     * Get AI provider configuration
     */
    async getConfig() {
        // Check cache
        if (this.configCache && (Date.now() - this.configCacheTime) < this.cacheTTL) {
            return this.configCache;
        }

        try {
            const result = await db.query('SELECT * FROM ai_provider_config WHERE id = 1');

            if (result.rows.length === 0) {
                // Return default config
                return {
                    primary_provider: 'none',
                    ollama_fallback_enabled: false
                };
            }

            this.configCache = result.rows[0];
            this.configCacheTime = Date.now();
            return this.configCache;
        } catch (_error) {
            // Table might not exist yet
            logger.debug('AI config table not found, using defaults');
            return {
                primary_provider: 'none',
                ollama_fallback_enabled: false
            };
        }
    }

    /**
     * Clear config cache (call after config updates)
     */
    clearCache() {
        this.configCache = null;
        this.configCacheTime = null;
    }

    /**
     * Determine which provider to use for a request
     * @param {string} taskType - 'classification', 'enrichment', 'basic'
     * @returns {object|null} Provider config or null if AI disabled
     */
    async getProvider(taskType = 'classification') {
        const config = await this.getConfig();

        // No provider configured
        if (config.primary_provider === 'none') {
            if (config.ollama_fallback_enabled) {
                logger.debug('No primary provider, using Ollama fallback');
                return this.getOllamaProvider(config);
            }
            logger.debug('AI disabled - no provider configured');
            return null;
        }

        // Ollama is primary provider (standalone use)
        if (config.primary_provider === 'ollama') {
            return this.getOllamaProvider(config);
        }

        // Cloud provider - check budget
        const cloudLLM = require('./cloudLLM');
        const budgetStatus = await cloudLLM.checkBudget();

        if (budgetStatus.exhausted) {
            logger.warn('Cloud AI budget exhausted', {
                usage: `$${budgetStatus.usage.toFixed(2)}`,
                budget: `$${budgetStatus.budget.toFixed(2)}`
            });

            if (budgetStatus.shouldPause && config.ollama_fallback_enabled && config.ollama_for_budget_exhausted) {
                logger.info('Falling back to Ollama due to budget exhaustion');
                return this.getOllamaProvider(config);
            }

            if (budgetStatus.shouldPause) {
                logger.warn('AI paused due to budget exhaustion');
                return null;
            }
        }

        // Use Ollama for basic tasks if configured
        if (config.ollama_for_basic_tasks && taskType === 'basic' && config.ollama_fallback_enabled) {
            logger.debug('Using Ollama for basic task');
            return this.getOllamaProvider(config);
        }

        // Use cloud provider
        return {
            type: config.primary_provider,
            isCloud: true,
            config: {
                primary_provider: config.primary_provider,
                api_endpoint: config.api_endpoint,
                api_key: config.api_key,
                model: config.model,
                temperature: config.temperature,
                max_tokens: config.max_tokens
            }
        };
    }

    /**
     * Get Ollama provider config
     */
    getOllamaProvider(config) {
        return {
            type: 'ollama',
            isCloud: false,
            config: {
                host: config.ollama_host || 'http://ollama:11434',
                port: config.ollama_port || 11434,
                model: config.ollama_model || 'llama3.2'
            }
        };
    }

    /**
     * Check if AI is available (any provider configured and not budget-blocked)
     */
    async isAvailable() {
        const provider = await this.getProvider();
        return provider !== null;
    }

    /**
     * Classify content using the active AI provider
     */
    async classify(prompt, options = {}) {
        const provider = await this.getProvider(options.taskType || 'classification');

        if (!provider) {
            throw new Error('AI is not available - no provider configured or budget exhausted');
        }

        if (provider.type === 'ollama') {
            const ollamaService = require('./ollama');
            return ollamaService.generate(prompt, provider.config.model);
        }

        // Cloud provider
        const cloudLLM = require('./cloudLLM');
        const messages = [
            { role: 'system', content: 'You are a media classification assistant.' },
            { role: 'user', content: prompt }
        ];

        const result = await cloudLLM.chat(messages, provider.config, {
            requestType: options.requestType || 'classification',
            itemTitle: options.itemTitle
        });

        return result.content;
    }

    /**
     * Get the active provider type and status
     */
    async getStatus() {
        const config = await this.getConfig();
        const provider = await this.getProvider();

        let status = {
            configured: config.primary_provider !== 'none' || config.ollama_fallback_enabled,
            primaryProvider: config.primary_provider,
            activeProvider: provider?.type || 'none',
            ollamaFallbackEnabled: config.ollama_fallback_enabled,
            budgetInfo: null
        };

        // Get budget info for cloud providers
        if (['openai', 'gemini', 'openrouter', 'litellm', 'custom'].includes(config.primary_provider)) {
            const cloudLLM = require('./cloudLLM');
            const budgetStatus = await cloudLLM.checkBudget();
            status.budgetInfo = budgetStatus;
        }

        return status;
    }

    /**
     * Full availability probe: checks provider configuration and tests Ollama
     * connectivity when Ollama is the active provider.
     *
     * @param {boolean} currentlyAvailable  - caller's current state for transition logging
     * @param {object}  ollamaService       - injected so aiRouter stays stateless
     * @param {object}  callerLogger        - caller's logger for transition logging
     * @returns {Promise<boolean>}
     */
    async checkAvailability(currentlyAvailable, ollamaService, callerLogger) {
        try {
            const provider = await this.getProvider('classification');

            if (!provider) {
                if (currentlyAvailable) {
                    callerLogger.info('AI is disabled or no provider configured');
                }
                return false;
            }

            // Cloud provider — assume available if configured
            if (provider.isCloud) {
                if (!currentlyAvailable) {
                    callerLogger.info(`Cloud AI provider available: ${provider.type}`);
                }
                return true;
            }

            // Ollama — probe connectivity
            if (provider.type === 'ollama') {
                const result = await ollamaService.testConnection();
                if (result.success) {
                    if (!currentlyAvailable) callerLogger.info('Ollama is now available');
                    return true;
                } else {
                    if (currentlyAvailable) callerLogger.warn('Ollama is offline', { error: result.error });
                    return false;
                }
            }

            callerLogger.warn('Unknown AI provider type', { type: provider.type });
            return false;
        } catch (error) {
            if (currentlyAvailable) callerLogger.warn('AI availability check failed', { error: error.message });
            return false;
        }
    }
}

module.exports = new AIRouterService();
