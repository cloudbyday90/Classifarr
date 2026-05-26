/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Unified JSON Schema for AI media classification response.
 * Designed to be highly compatible with Ollama's constrained decoding grammar engine
 * and standard schema validators (like Zod/Pydantic/OpenAI).
 * 
 * It supports CONFIDENT, CONFIRM, and CLARIFY modes in a single robust schema.
 */
export const classificationResponseSchema = {
    type: 'object',
    properties: {
        decision: { 
            type: 'string', 
            enum: ['CONFIDENT', 'CONFIRM', 'CLARIFY'] 
        },
        library_number: { 
            type: 'integer',
            description: 'The 1-based index number of the matching library (e.g. 4) for CONFIDENT or CONFIRM.'
        },
        confidence: { 
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Confidence percentage (0-100) for CONFIDENT.'
        },
        reason: { 
            type: 'string',
            description: 'Brief plain-text explanation for CONFIDENT or CONFIRM.'
        },
        problem_summary: { 
            type: 'string',
            description: 'Short summary of the conflict for CLARIFY (max 50 chars).'
        },
        why_uncertain: { 
            type: 'string',
            description: 'Explanation of conflicting signals for CLARIFY.'
        },
        question: { 
            type: 'string',
            description: 'Specific question to ask the user for CLARIFY.'
        },
        options: {
            type: 'array',
            items: { 
                type: 'integer' 
            },
            description: 'List of 1-based library indexes as options for CLARIFY (2-3 items).'
        }
    },
    required: ['decision']
};
