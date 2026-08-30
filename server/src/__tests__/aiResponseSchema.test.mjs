/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import {
    candidateAdjudicationResponseSchema,
    classificationResponseSchema,
} from '../services/aiResponseSchema.mjs';

describe('AI Response Schema Validation (OpenAI Strict Mode & Ollama Grammar Compatibility)', () => {
    it('should be a valid JSON schema object', () => {
        expect(classificationResponseSchema).toBeDefined();
        expect(classificationResponseSchema.type).toBe('object');
        expect(classificationResponseSchema.properties).toBeDefined();
    });

    it('should enforce strict mode with additionalProperties: false', () => {
        expect(classificationResponseSchema.additionalProperties).toBe(false);
    });

    it('should mark all defined properties as required to satisfy OpenAI Strict Mode rules', () => {
        const properties = Object.keys(classificationResponseSchema.properties);
        const required = classificationResponseSchema.required;
        
        expect(required).toBeDefined();
        expect(Array.isArray(required)).toBe(true);
        
        // Every property defined in the schema must be listed in the required array for OpenAI strict outputs
        properties.forEach(prop => {
            expect(required).toContain(prop);
        });
        
        // The length should match precisely
        expect(required.length).toBe(properties.length);
    });

    it('should use explicit type arrays with null for nullable fields to ensure local/cloud compliance', () => {
        const props = classificationResponseSchema.properties;
        
        // decision must be a string and required to be non-nullable
        expect(props.decision.type).toBe('string');
        expect(Array.isArray(props.decision.type)).toBe(false);
        
        // Nullable fields must explicitly use the type: [type, "null"] array construct rather than union schemas
        const nullableFields = [
            'library_number',
            'confidence',
            'reason',
            'problem_summary',
            'why_uncertain',
            'question',
            'options'
        ];
        
        nullableFields.forEach(field => {
            const prop = props[field];
            expect(prop).toBeDefined();
            expect(Array.isArray(prop.type)).toBe(true);
            expect(prop.type).toContain('null');
        });
    });

    it('should define precise data types and bounds for library options and constraints', () => {
        const props = classificationResponseSchema.properties;
        
        // library_number
        expect(props.library_number.type).toContain('integer');
        
        // confidence
        expect(props.confidence.type).toContain('integer');
        expect(props.confidence.minimum).toBe(0);
        expect(props.confidence.maximum).toBe(100);
        
        // options
        expect(props.options.type).toContain('array');
        expect(props.options.items).toBeDefined();
        expect(props.options.items.type).toBe('integer');
    });

    it('should avoid top-level union constraints like oneOf/anyOf to prevent compilation lag and compatibility blocks', () => {
        expect(classificationResponseSchema.oneOf).toBeUndefined();
        expect(classificationResponseSchema.anyOf).toBeUndefined();
        expect(classificationResponseSchema.allOf).toBeUndefined();
    });

    it('restricts bounded adjudication to proposal or clarification decisions', () => {
        expect(candidateAdjudicationResponseSchema.additionalProperties).toBe(false);
        expect(candidateAdjudicationResponseSchema.required)
            .toEqual(classificationResponseSchema.required);
        expect(candidateAdjudicationResponseSchema.properties.decision.enum)
            .toEqual(['CONFIDENT', 'CLARIFY']);
    });
});
