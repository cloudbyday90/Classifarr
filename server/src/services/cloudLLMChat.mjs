/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { httpPost } from '../utils/httpClient.mjs';
import { createLogger } from '../utils/logger.mjs';
import * as db from '../config/database.mjs';
import { calculateCost as calculateCostFn, calculateGeminiCost as calculateGeminiCostFn } from './cloudLLMPricing.mjs';
import { logUsage as logUsageFn, updateMonthlyUsage as updateMonthlyUsageFn } from './cloudLLMUsage.mjs';
import { getEndpoint, getHeaders } from './cloudLLMHelpers.mjs';
import { buildResponsesRequestBody, extractResponsesContent, normalizeResponsesUsage } from './cloudLLMRequestBuilder.mjs';

const logger = createLogger('CloudLLM');

export async function chatResponses(messages, config, options = {}, startTime) {
    const endpoint = getEndpoint(config);
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
            headers: getHeaders(config),
            timeout: 120000,
        }
    );

    const result = response.data;
    const usage = normalizeResponsesUsage(result.usage || {});

    const cost = calculateCostFn(
        config.primary_provider,
        config.model,
        usage.promptTokens,
        usage.completionTokens,
        response.headers
    );

    await logUsageFn({ db, logger }, {
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

    await updateMonthlyUsageFn({ db, logger }, cost);

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

export async function chatGemini(messages, config, options = {}, startTime) {
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

        const cost = calculateGeminiCostFn(config.model, promptTokens, completionTokens);

        await logUsageFn({ db, logger }, {
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

        await updateMonthlyUsageFn({ db, logger }, cost);

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
        await logUsageFn({ db, logger }, {
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
