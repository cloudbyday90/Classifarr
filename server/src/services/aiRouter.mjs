/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { createLogger } from '../utils/logger.mjs';
import { ServiceUnavailableError } from '../utils/appError.mjs';
import * as db from '../config/database.mjs';
import { cloudLLMService as cloudLLM } from './cloudLLM.mjs';
import {
    AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
    buildAiRuntimeDedupeKey,
} from './aiEmbeddingProviderIntegrityService.mjs';
import {
    AI_PROVIDER_AUTHORITY_MODE_IDS,
    buildAiProviderAuthorityProfile,
    buildAiProviderAuthorityView,
    isAiProviderAuthorityModeGranted,
} from './aiProviderAuthority.mjs';
import { ollamaService } from './ollama.mjs';

const logger = createLogger('AIRouter');

function isStrictAuthorityMode(mode) {
    return [
        AI_PROVIDER_AUTHORITY_MODE_IDS.STRUCTURED_CONTRACT,
        AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
    ].includes(mode);
}

function hasStructuredResponseSchema(format) {
    return Boolean(format && typeof format === 'object' && !Array.isArray(format));
}

function resolveProviderAuthority(provider, requestedMode) {
    return provider?.authority || buildAiProviderAuthorityProfile({
        providerId: provider?.type,
        model: provider?.config?.model,
        requestedMode,
    });
}

export class AIRouterService {
    constructor({
        cloudLLMService = cloudLLM,
        ollamaClient = ollamaService,
    } = {}) {
        this.cloudLLM = cloudLLMService;
        this.ollamaClient = ollamaClient;
        this.configCache = null;
        this.configCacheTime = null;
        this.cacheTTL = 30000;
    }

    async getConfig() {
        if (this.configCache && (Date.now() - this.configCacheTime) < this.cacheTTL) {
            return this.configCache;
        }

        try {
            const result = await db.query('SELECT * FROM ai_provider_config WHERE id = 1');

            if (result.rows.length === 0) {
                return {
                    primary_provider: 'none',
                    ollama_fallback_enabled: false
                };
            }

            this.configCache = result.rows[0];
            this.configCacheTime = Date.now();
            return this.configCache;
        } catch (_error) {
            logger.debug('AI config table not found, using defaults');
            return {
                primary_provider: 'none',
                ollama_fallback_enabled: false
            };
        }
    }

    clearCache() {
        this.configCache = null;
        this.configCacheTime = null;
    }

    async getProvider(taskType = 'classification', options = {}) {
        const config = await this.getConfig();
        const requestedAuthorityMode = options.authorityMode;

        if (config.primary_provider === 'none') {
            if (config.ollama_fallback_enabled) {
                logger.debug('No primary provider, using Ollama fallback');
                return this.getOllamaProvider(config, {
                    requestedAuthorityMode,
                    isFallback: true,
                });
            }
            logger.debug('AI disabled - no provider configured');
            return null;
        }

        if (config.primary_provider === 'ollama') {
            return this.getOllamaProvider(config, { requestedAuthorityMode });
        }

        const budgetStatus = await this.cloudLLM.checkBudget();

        if (budgetStatus.exhausted) {
            logger.warn('Cloud AI budget exhausted', {
                provider: config.primary_provider,
                usage: `$${budgetStatus.usage.toFixed(2)}`,
                budget: `$${budgetStatus.budget.toFixed(2)}`,
                shouldPause: budgetStatus.shouldPause === true,
            }, {
                dedupeKey: buildAiRuntimeDedupeKey(
                    'budget_exhausted',
                    `${config.primary_provider}:${budgetStatus.shouldPause === true ? 'paused' : 'soft'}:${Number(budgetStatus.budget || 0).toFixed(2)}`
                ),
                dedupeWindowMs: AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
            });

            if (budgetStatus.shouldPause && config.ollama_fallback_enabled && config.ollama_for_budget_exhausted) {
                logger.info('Falling back to Ollama due to budget exhaustion');
                return this.getOllamaProvider(config, {
                    requestedAuthorityMode,
                    isFallback: true,
                });
            }

            if (budgetStatus.shouldPause) {
                logger.warn('AI paused due to budget exhaustion', {
                    provider: config.primary_provider,
                    budget: `$${budgetStatus.budget.toFixed(2)}`,
                }, {
                    dedupeKey: buildAiRuntimeDedupeKey(
                        'budget_paused',
                        `${config.primary_provider}:${Number(budgetStatus.budget || 0).toFixed(2)}`
                    ),
                    dedupeWindowMs: AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
                });
                return null;
            }
        }

        if (config.ollama_for_basic_tasks && taskType === 'basic' && config.ollama_fallback_enabled) {
            logger.debug('Using Ollama for basic task');
            return this.getOllamaProvider(config, {
                requestedAuthorityMode,
                isFallback: true,
            });
        }

        const model = config.model || 'unknown';
        return {
            type: config.primary_provider,
            isCloud: true,
            authority: buildAiProviderAuthorityProfile({
                providerId: config.primary_provider,
                model,
                requestedMode: requestedAuthorityMode,
            }),
            config: {
                primary_provider: config.primary_provider,
                api_endpoint: config.api_endpoint,
                api_key: config.api_key,
                model,
                temperature: config.temperature,
                max_tokens: config.max_tokens
            }
        };
    }

    getOllamaProvider(config, {
        requestedAuthorityMode,
        isFallback = false,
    } = {}) {
        const model = config.ollama_model || 'llama3.2';
        return {
            type: 'ollama',
            isCloud: false,
            authority: buildAiProviderAuthorityProfile({
                providerId: 'ollama',
                model,
                requestedMode: requestedAuthorityMode,
                isFallback,
            }),
            config: {
                host: config.ollama_host || 'http://ollama:11434',
                port: config.ollama_port || 11434,
                model
            }
        };
    }

    async isAvailable() {
        const provider = await this.getProvider();
        return provider !== null;
    }

    async classify(prompt, options = {}) {
        const requestedAuthorityMode = options.authorityMode;
        const provider = options.provider || await this.getProvider(
            options.taskType || 'classification',
            { authorityMode: requestedAuthorityMode },
        );

        if (!provider) {
            throw new ServiceUnavailableError('AI is not available - no provider configured or budget exhausted');
        }

        const authority = resolveProviderAuthority(provider, requestedAuthorityMode);

        if (authority.effectiveMode === AI_PROVIDER_AUTHORITY_MODE_IDS.DISABLED) {
            throw new ServiceUnavailableError('AI output is disabled by authority mode');
        }

        if (
            isStrictAuthorityMode(requestedAuthorityMode)
            && options.requireAuthorityMode === true
            && !isAiProviderAuthorityModeGranted(authority, requestedAuthorityMode)
        ) {
            throw new ServiceUnavailableError(
                `AI provider cannot satisfy ${requestedAuthorityMode} authority`,
            );
        }

        if (
            isStrictAuthorityMode(requestedAuthorityMode)
            && isAiProviderAuthorityModeGranted(authority, requestedAuthorityMode)
            && !hasStructuredResponseSchema(options.format)
        ) {
            throw new ServiceUnavailableError(
                `AI provider cannot satisfy ${requestedAuthorityMode} authority without a structured response schema`,
            );
        }

        if (provider.type === 'ollama') {
            return this.ollamaClient.generate(
                prompt,
                provider.config.model,
                provider.config.temperature,
                { format: options.format },
            );
        }

        const messages = [
            { role: 'system', content: 'You are a media classification assistant.' },
            { role: 'user', content: prompt }
        ];

        const result = await this.cloudLLM.chat(messages, provider.config, {
            requestType: options.requestType || 'classification',
            itemTitle: options.itemTitle,
            format: options.format
        });

        return result.content;
    }

    async getStatus() {
        const config = await this.getConfig();
        const provider = await this.getProvider();

        let status = {
            configured: config.primary_provider !== 'none' || config.ollama_fallback_enabled,
            primaryProvider: config.primary_provider,
            activeProvider: provider?.type || 'none',
            ollamaFallbackEnabled: config.ollama_fallback_enabled,
            budgetInfo: null,
            authority: buildAiProviderAuthorityView(provider?.authority),
        };

        if (['openai', 'gemini', 'openrouter', 'litellm', 'custom'].includes(config.primary_provider)) {
            const budgetStatus = await this.cloudLLM.checkBudget();
            status.budgetInfo = budgetStatus;
        }

        return status;
    }

    async checkAvailability(currentlyAvailable, ollamaService, callerLogger) {
        try {
            const provider = await this.getProvider('classification');

            if (!provider) {
                if (currentlyAvailable) {
                    callerLogger.info('AI is disabled or no provider configured');
                }
                return false;
            }

            if (provider.isCloud) {
                if (!currentlyAvailable) {
                    callerLogger.info(`Cloud AI provider available: ${provider.type}`);
                }
                return true;
            }

            if (provider.type === 'ollama') {
                const result = await ollamaService.testConnection();
                if (result.success) {
                    if (!currentlyAvailable) callerLogger.info('Ollama is now available');
                    return true;
                } else {
                    if (currentlyAvailable) {
                        callerLogger.warn('Ollama is offline', {
                            error: result.error,
                        }, {
                            dedupeKey: buildAiRuntimeDedupeKey(
                                'provider_offline',
                                `ollama:${result.errorCode || result.error || 'unknown'}`
                            ),
                            dedupeWindowMs: AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
                        });
                    }
                    return false;
                }
            }

            callerLogger.warn('Unknown AI provider type', { type: provider.type }, {
                dedupeKey: buildAiRuntimeDedupeKey('unknown_provider_type', provider.type),
                dedupeWindowMs: AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
            });
            return false;
        } catch (error) {
            if (currentlyAvailable) {
                callerLogger.warn('AI availability check failed', { error: error.message }, {
                    dedupeKey: buildAiRuntimeDedupeKey(
                        'availability_check_failed',
                        `${error.code || 'unknown'}:${error.message || 'unknown'}`
                    ),
                    dedupeWindowMs: AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
                });
            }
            return false;
        }
    }
}

export const aiRouterService = new AIRouterService();
