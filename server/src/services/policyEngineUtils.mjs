/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const FORMULA_CONFIDENCE_CAP = 95;
export const MOVIE_CERTIFICATION_ORDER = ['G', 'PG', 'PG-13', 'R', 'NC-17'];
export const TV_CERTIFICATION_ORDER = ['TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'];
export const DEFAULT_RAG_WEIGHT = 0.15;
export const VALID_COMBINATION_MODES = new Set(['best_match', 'average', 'weighted_average', 'require_all']);

export function normalizePresetAttachmentWeight(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1.0;
}

export function parseFiniteNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) {
        return null;
    }

    const numeric = Number(trimmedValue);
    return Number.isFinite(numeric) ? numeric : null;
}

export function hasConfiguredList(values) {
    return Array.isArray(values) && values.length > 0;
}

export function getCertificationOrder(value) {
    const certification = String(value || '').toUpperCase();

    if (MOVIE_CERTIFICATION_ORDER.includes(certification)) {
        return MOVIE_CERTIFICATION_ORDER;
    }

    if (TV_CERTIFICATION_ORDER.includes(certification)) {
        return TV_CERTIFICATION_ORDER;
    }

    return null;
}

export function isAlphaNumericBoundary(text, index) {
    if (index < 0 || index >= text.length) {
        return true;
    }

    return !/[\p{L}\p{N}]/u.test(text[index]);
}

export function textContainsWholeTerm(searchableText, normalizedTerm) {
    let matchIndex = searchableText.indexOf(normalizedTerm);

    while (matchIndex !== -1) {
        const beforeIndex = matchIndex - 1;
        const afterIndex = matchIndex + normalizedTerm.length;

        if (
            isAlphaNumericBoundary(searchableText, beforeIndex)
            && isAlphaNumericBoundary(searchableText, afterIndex)
        ) {
            return true;
        }

        matchIndex = searchableText.indexOf(normalizedTerm, matchIndex + 1);
    }

    return false;
}

export function keywordMatchesTerm(term, keywordList, searchableText) {
    const normalizedTerm = String(term || '').trim().toLowerCase();
    if (!normalizedTerm) {
        return false;
    }

    if (keywordList.includes(normalizedTerm)) {
        return true;
    }

    return textContainsWholeTerm(searchableText, normalizedTerm);
}

export function isPositiveContribution(score) {
    return Number.isFinite(score) && score > 0;
}

export function normalizeCombinationMode(mode) {
    return VALID_COMBINATION_MODES.has(mode) ? mode : 'best_match';
}
