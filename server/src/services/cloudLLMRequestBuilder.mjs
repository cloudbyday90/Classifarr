/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function isOpenAIReasoningModel(config) {
    if (config.primary_provider !== 'openai') {
        return false;
    }

    const model = String(config.model || '').toLowerCase();
    return /^o\d/.test(model) || /^gpt-5(?:[.-]|$)/.test(model);
}

export function normalizeOpenAIReasoningMessages(messages) {
    return messages.map(message => ({
        ...message,
        role: message.role === 'system' ? 'developer' : message.role,
    }));
}

export function buildChatRequestBody(messages, config) {
    const requestBody = {
        model: config.model,
        messages: isOpenAIReasoningModel(config)
            ? normalizeOpenAIReasoningMessages(messages)
            : messages,
    };

    const maxTokens = parseInt(config.max_tokens) || 2000;

    if (config.primary_provider === 'openai') {
        requestBody.max_completion_tokens = maxTokens;

        if (!isOpenAIReasoningModel(config)) {
            requestBody.temperature = parseFloat(config.temperature) || 0.7;
        }

        return requestBody;
    }

    requestBody.temperature = parseFloat(config.temperature) || 0.7;
    requestBody.max_tokens = maxTokens;
    return requestBody;
}

export function buildResponsesRequestBody(messages, config) {
    return {
        model: config.model,
        input: normalizeOpenAIReasoningMessages(messages),
        max_output_tokens: parseInt(config.max_tokens) || 2000,
    };
}

export function extractResponsesContent(result) {
    if (typeof result.output_text === 'string') {
        return result.output_text;
    }

    if (!Array.isArray(result.output)) {
        return '';
    }

    return result.output
        .filter(item => item?.type === 'message' && Array.isArray(item.content))
        .flatMap(item => item.content)
        .map(part => {
            if (typeof part?.text === 'string') {
                return part.text;
            }
            if (typeof part?.output_text === 'string') {
                return part.output_text;
            }
            return '';
        })
        .filter(Boolean)
        .join('');
}

export function normalizeResponsesUsage(usage = {}) {
    const promptTokens = usage.input_tokens || 0;
    const completionTokens = usage.output_tokens || 0;

    return {
        promptTokens,
        completionTokens,
        totalTokens: usage.total_tokens || (promptTokens + completionTokens),
    };
}
