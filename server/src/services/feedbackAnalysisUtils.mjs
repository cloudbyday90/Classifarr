/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';

const logger = createLogger('FeedbackAnalysis');

export const TUNING_CONSTANTS = {
    THRESHOLD_ADJUSTMENT: 5,
    WEIGHT_ADJUSTMENT: 0.1,
    MIN_AUTO_CLASSIFY_THRESHOLD: 60,
    MAX_AUTO_CLASSIFY_THRESHOLD: 95,
    MIN_PROMPT_THRESHOLD: 50,
    MIN_WEIGHT: 0.05,
    MAX_WEIGHT: 0.60
};

export function normalizeGroupingValues(field, values) {
    if (field === 'genres' || field === 'keywords' || field === 'production_companies') {
        return normalizeMetadataList(values);
    }

    if (field === 'belongs_to_collection') {
        if (!values) {
            return [];
        }

        if (typeof values === 'string') {
            try {
                const parsed = JSON.parse(values);
                if (parsed && typeof parsed === 'object') {
                    return normalizeMetadataList([parsed]);
                }
                return values.trim() ? [values] : [];
            } catch {
                return values.trim() ? [values] : [];
            }
        }

        return normalizeMetadataList([values]);
    }

    if (typeof values === 'string') {
        try {
            values = JSON.parse(values);
        } catch {
            values = [values];
        }
    }

    if (!Array.isArray(values)) {
        values = [values];
    }

    return values.map(v => {
        if (typeof v === 'object' && v !== null) {
            return v.name || v.title || JSON.stringify(v);
        }
        return v;
    }).filter(Boolean);
}

export function groupByMetadataField(feedback, field) {
    const groups = {};

    for (const f of feedback) {
        try {
            const metadata = f.item_metadata || {};
            const values = normalizeGroupingValues(field, metadata[field]);

            if (!values) continue;
            if (values.length === 0) continue;

            for (const value of values) {
                if (!groups[value]) {
                    groups[value] = { count: 0, feedbackIds: [] };
                }
                groups[value].count++;
                groups[value].feedbackIds.push(f.id);
            }
        } catch (error) {
            logger.warn('Skipping feedback due to invalid item_metadata in groupByMetadataField', {
                feedbackId: f.id,
                field,
                error: error && error.message ? error.message : String(error),
                rawMetadata: f.item_metadata
            });
            continue;
        }
    }

    return groups;
}

export function extractSignificantPatterns(groups, type, minCount = 3) {
    const patterns = [];

    for (const [value, data] of Object.entries(groups)) {
        if (data.count >= minCount) {
            patterns.push({
                type,
                value,
                count: data.count,
                feedbackIds: data.feedbackIds
            });
        }
    }

    return patterns.sort((a, b) => b.count - a.count);
}
