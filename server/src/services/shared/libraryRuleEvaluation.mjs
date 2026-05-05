/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { normalizeMetadataListLower } from '../../utils/metadataNormalization.mjs';

function normalizeRuleValues(value) {
    if (Array.isArray(value)) {
        return value
            .map((entry) => String(entry).trim().toLowerCase())
            .filter(Boolean);
    }

    if (value === null || value === undefined) {
        return [];
    }

    return String(value)
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
}

function parseBetweenBounds(rawValue, normalizedValues) {
    const rawText = Array.isArray(rawValue) ? rawValue.join(',') : String(rawValue ?? '');
    const segments = rawText.includes(',')
        ? rawText.split(',')
        : normalizedValues;

    const [minSegment, maxSegment = minSegment] = segments;
    const min = Number.parseFloat(String(minSegment).trim());
    const max = Number.parseFloat(String(maxSegment).trim());

    if (Number.isNaN(min) || Number.isNaN(max)) {
        return null;
    }

    return { min, max };
}

function normalizeArrayFieldValue(fieldValue) {
    return fieldValue.map((entry) => String(entry).toLowerCase());
}

function evaluateArrayCondition(arrayValues, operator, normalizedValues) {
    switch (operator) {
        case 'equals':
        case 'is':
        case 'includes':
            return normalizedValues.some((value) => arrayValues.includes(value));
        case 'not_equals':
        case 'excludes':
            return !normalizedValues.some((value) => arrayValues.includes(value));
        case 'contains':
            return normalizedValues.some((value) => arrayValues.some((item) => item.includes(value)));
        case 'not_contains':
            return !normalizedValues.some((value) => arrayValues.some((item) => item.includes(value)));
        default:
            return false;
    }
}

function evaluateScalarCondition(fieldValue, operator, rawValue, normalizedValues) {
    const stringValue = String(fieldValue).toLowerCase();

    switch (operator) {
        case 'equals':
        case 'is':
        case 'includes':
            return normalizedValues.includes(stringValue);
        case 'not_equals':
        case 'excludes':
            return !normalizedValues.includes(stringValue);
        case 'contains':
            return normalizedValues.some((value) => stringValue.includes(value));
        case 'not_contains':
            return !normalizedValues.some((value) => stringValue.includes(value));
        case 'greater_than':
            return Number.parseFloat(fieldValue) > Number.parseFloat(normalizedValues[0]);
        case 'less_than':
            return Number.parseFloat(fieldValue) < Number.parseFloat(normalizedValues[0]);
        case 'between': {
            const bounds = parseBetweenBounds(rawValue, normalizedValues);
            if (!bounds) {
                return false;
            }

            const numericValue = Number.parseFloat(fieldValue);
            if (Number.isNaN(numericValue)) {
                return false;
            }

            return numericValue >= bounds.min && numericValue <= bounds.max;
        }
        default:
            return false;
    }
}

export function getMetadataRuleFieldValue(metadata, field) {
    if (field === 'content_type') {
        return metadata.contentAnalysis?.bestMatch?.type;
    }

    return metadata[field];
}

export function evaluateRuleCondition(fieldValue, operator, value) {
    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
        return false;
    }

    const normalizedValues = normalizeRuleValues(value);
    if (normalizedValues.length === 0) {
        return false;
    }

    if (Array.isArray(fieldValue)) {
        return evaluateArrayCondition(normalizeArrayFieldValue(fieldValue), operator, normalizedValues);
    }

    return evaluateScalarCondition(fieldValue, operator, value, normalizedValues);
}

export function evaluateMetadataRuleCondition(metadata, condition) {
    return evaluateRuleCondition(
        getMetadataRuleFieldValue(metadata, condition.field),
        condition.operator,
        condition.value
    );
}

export function buildLibraryRuleContext(metadata, { detectEventTypesFromMetadata = () => [] } = {}) {
    return {
        rating: (metadata.certification || '').toUpperCase(),
        genre: normalizeMetadataListLower(metadata.genres),
        keyword: normalizeMetadataListLower(metadata.keywords),
        language: (metadata.original_language || '').toLowerCase(),
        year: metadata.year ? Number.parseInt(metadata.year, 10) : null,
        title: (metadata.title || '').toLowerCase(),
        overview: (metadata.overview || '').toLowerCase(),
        content_type: metadata.contentAnalysis?.bestMatch?.type || null,
        event_type: detectEventTypesFromMetadata(metadata),
    };
}
