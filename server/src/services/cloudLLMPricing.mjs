/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const OPENAI_PRICING = {
    'gpt-5.2': { input: 1.75, output: 14.00 },
    'gpt-5.2-pro': { input: 21.00, output: 168.00 },
    'gpt-5-mini': { input: 0.25, output: 2.00 },
    'o3': { input: 2.00, output: 8.00 },
    'o3-mini': { input: 1.10, output: 4.40 },
    'o3-pro': { input: 20.00, output: 80.00 },
    'o1': { input: 15.00, output: 60.00 },
    'o1-mini': { input: 1.10, output: 4.40 },
    'gpt-4.1': { input: 3.00, output: 12.00 },
    'gpt-4o': { input: 5.00, output: 15.00 },
    'gpt-4o-mini': { input: 0.60, output: 2.40 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
};

export const GEMINI_PRICING = {
    'gemini-3-flash': { input: 0.50, output: 3.00 },
    'gemini-3-pro-preview': { input: 2.00, output: 12.00 },
    'gemini-2.5-pro': { input: 1.25, output: 10.00 },
    'gemini-2.5-flash': { input: 0.30, output: 2.50 },
    'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },
    'gemini-2.0-flash-lite': { input: 0.08, output: 0.30 },
    'gemini-2.0-flash-exp': { input: 0, output: 0 },
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
};

export function calculateCost(provider, model, promptTokens, completionTokens, headers = {}) {
    if (provider === 'openrouter') {
        const promptPrice = parseFloat(headers['x-openrouter-price-per-prompt-token']) || 0;
        const completionPrice = parseFloat(headers['x-openrouter-price-per-completion-token']) || 0;

        if (promptPrice > 0 || completionPrice > 0) {
            return (promptTokens * promptPrice) + (completionTokens * completionPrice);
        }
    }

    const pricing = OPENAI_PRICING[model];
    if (pricing) {
        const inputCost = (promptTokens / 1000000) * pricing.input;
        const outputCost = (completionTokens / 1000000) * pricing.output;
        return inputCost + outputCost;
    }

    return ((promptTokens + completionTokens) / 1000000) * 5.0;
}

export function calculateGeminiCost(model, promptTokens, completionTokens) {
    const pricing = GEMINI_PRICING[model];
    if (pricing) {
        const inputCost = (promptTokens / 1000000) * pricing.input;
        const outputCost = (completionTokens / 1000000) * pricing.output;
        return inputCost + outputCost;
    }
    return ((promptTokens + completionTokens) / 1000000) * 0.5;
}
