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
import { getEndpoint, getHeaders } from './cloudLLMHelpers.mjs';
import { logEmbeddingCost as logEmbeddingCostFn } from './cloudLLMUsage.mjs';

const logger = createLogger('CloudLLM');

export async function embed(text, config, model = 'text-embedding-3-small', signal = null) {
    const endpoint = getEndpoint(config);

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
                headers: getHeaders(config),
                timeout: 60000,
                signal: signal,
            }
        );

        const embedding = response.data.data?.[0]?.embedding;
        const usage = response.data.usage || {};

        const costPerMillion = model.includes('large') ? 0.13 : 0.02;
        const cost = (usage.total_tokens || 0) / 1000000 * costPerMillion;

        await logEmbeddingCostFn({ db, logger }, config.primary_provider, model, usage.total_tokens || 0, cost);

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

export async function embedGemini(text, config, model = 'text-embedding-005', signal = null) {
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

        await logEmbeddingCostFn({ db, logger }, 'gemini', model, text.length, cost);

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
