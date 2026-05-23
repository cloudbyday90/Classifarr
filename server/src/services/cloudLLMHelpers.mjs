/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const DEFAULT_ENDPOINTS = {
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    litellm: 'http://localhost:4000/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
};

export function getEndpoint(config) {
    if (config.api_endpoint && ['litellm', 'custom'].includes(config.primary_provider)) {
        return config.api_endpoint;
    }
    return DEFAULT_ENDPOINTS[config.primary_provider] || config.api_endpoint;
}

export function getHeaders(config) {
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
