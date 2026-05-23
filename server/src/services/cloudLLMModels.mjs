/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { httpGet } from '../utils/httpClient.mjs';
import { createLogger } from '../utils/logger.mjs';
import { getEndpoint, getHeaders } from './cloudLLMHelpers.mjs';

const logger = createLogger('CloudLLM');

export async function testGeminiConnection(config) {
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

export async function getOpenAIModels(config) {
    try {
        const endpoint = getEndpoint(config);
        const response = await httpGet(`${endpoint}/models`, {
            headers: getHeaders(config),
            timeout: 10000,
        });

        const models = response.data?.data || [];

        return models
            .filter(m => !m.id.includes('embedding') && !m.id.includes('whisper') && !m.id.includes('tts'))
            .map(m => ({
                id: m.id,
                name: m.id,
                owned_by: m.owned_by
            }))
            .sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
        logger.error('Failed to get models', { error: error.message });
        return [];
    }
}

export async function getOpenAIEmbeddingModels(config) {
    try {
        const endpoint = getEndpoint(config);
        const response = await httpGet(`${endpoint}/models`, {
            headers: getHeaders(config),
            timeout: 10000,
        });

        const models = response.data?.data || [];

        return models
            .filter(m => /embed|embedding/i.test(m.id || ''))
            .map(m => ({
                id: m.id,
                name: m.id,
                owned_by: m.owned_by
            }))
            .sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
        logger.error('Failed to get embedding models', { error: error.message });
        return [];
    }
}

export async function getGeminiModels(config) {
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

export async function getGeminiEmbeddingModels(config) {
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
