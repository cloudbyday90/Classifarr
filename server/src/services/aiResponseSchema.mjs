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
 * Unified JSON Schema for AI media classification response using a Union (oneOf).
 * Designed to be highly compatible with Ollama's constrained decoding grammar engine,
 * OpenAI's Structured Outputs strict mode, Gemini's responseSchema,
 * and standard schema validators (like Zod/Pydantic/OpenAI).
 * 
 * It models the exact decision contract for CONFIDENT, CONFIRM, and CLARIFY modes
 * without forcing the model to generate redundant dummy fields.
 */
export const classificationResponseSchema = {
    type: 'object',
    properties: {
        decision: { 
            type: 'string', 
            enum: ['CONFIDENT', 'CONFIRM', 'CLARIFY'],
            description: 'The classification decision.'
        },
        library_number: { 
            type: ['integer', 'null'],
            description: 'The 1-based index number of the matching library (e.g. 4) for CONFIDENT or CONFIRM, or null for CLARIFY.'
        },
        confidence: { 
            type: ['integer', 'null'],
            minimum: 0,
            maximum: 100,
            description: 'Confidence percentage (0-100) for CONFIDENT, or null otherwise.'
        },
        reason: { 
            type: ['string', 'null'],
            description: 'Brief plain-text explanation for CONFIDENT or CONFIRM, or null otherwise.'
        },
        problem_summary: { 
            type: ['string', 'null'],
            description: 'Short summary of the conflict for CLARIFY (max 50 chars), or null otherwise.'
        },
        why_uncertain: { 
            type: ['string', 'null'],
            description: 'Explanation of conflicting signals for CLARIFY, or null otherwise.'
        },
        question: { 
            type: ['string', 'null'],
            description: 'Specific question to ask the user for CLARIFY, or null otherwise.'
        },
        options: {
            type: ['array', 'null'],
            items: { 
                type: 'integer' 
            },
            description: 'List of 1-based library indexes as options for CLARIFY (2-3 items), or null otherwise.'
        }
    },
    required: [
        'decision',
        'library_number',
        'confidence',
        'reason',
        'problem_summary',
        'why_uncertain',
        'question',
        'options'
    ],
    additionalProperties: false
};

/**
 * Advisory candidate adjudication may choose only from the server-supplied
 * closed list. It has no confirmation form because it cannot authorize a
 * route or verify a server-selected singleton.
 */
export const candidateAdjudicationResponseSchema = {
    ...classificationResponseSchema,
    properties: {
        ...classificationResponseSchema.properties,
        decision: {
            type: 'string',
            enum: ['CONFIDENT', 'CLARIFY'],
            description: 'An advisory proposal for a bounded candidate, or a request for clarification.'
        },
    },
};

/**
 * Strict contract for a server-selected, candidate-bound verification. The
 * candidate is deliberately absent from model output: only the server may
 * bind a confirmation to a library.
 */
export const candidateBoundVerificationResponseSchema = {
    type: 'object',
    properties: {
        decision: {
            type: 'string',
            enum: ['CONFIRM', 'ABSTAIN'],
            description: 'Confirm the server-selected candidate or abstain from verification.'
        },
        reason: {
            type: 'string',
            // Keep the provider-facing schema within the shared structured-output
            // subset. The strict parser applies the non-empty, 280-character bound.
            description: 'Brief verification or abstention reason. It cannot select a destination.'
        }
    },
    required: ['decision', 'reason'],
    additionalProperties: false
};
