/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('RAGFusion');

export function calculateRRF(semanticMatches, textMatches, k = 60) {
    if (!semanticMatches && !textMatches) {
        return [];
    }

    const semantic = semanticMatches || [];
    const text = textMatches || [];

    if (semantic.length === 0 && text.length === 0) {
        return [];
    }

    if (typeof k !== 'number' || k < 0) {
        k = 60;
    }

    const combined = new Map();

    semantic.forEach((match, index) => {
        if (!match.classificationId) {
            logger.debug('Skipping match without classificationId', { match });
            return;
        }

        const rrfScore = 1 / (k + index + 1);
        combined.set(match.classificationId, {
            ...match,
            rrfScore,
            semanticRank: index + 1,
            textRank: null,
            vectorScore: match.similarity || 0,
            textScore: 0,
        });
    });

    text.forEach((match, index) => {
        if (!match.classificationId) {
            logger.debug('Skipping match without classificationId', { match });
            return;
        }

        const rrfScore = 1 / (k + index + 1);

        if (combined.has(match.classificationId)) {
            const existing = combined.get(match.classificationId);
            existing.rrfScore += rrfScore;
            existing.textRank = index + 1;
            existing.textScore = match.textScore || 0;
        } else {
            combined.set(match.classificationId, {
                ...match,
                rrfScore,
                semanticRank: null,
                textRank: index + 1,
                vectorScore: 0,
                textScore: match.textScore || 0,
            });
        }
    });

    return Array.from(combined.values())
        .sort((a, b) => {
            if (b.rrfScore !== a.rrfScore) {
                return b.rrfScore - a.rrfScore;
            }
            if (a.semanticRank !== null && b.semanticRank !== null) {
                return a.semanticRank - b.semanticRank;
            }
            if (a.semanticRank !== null) return -1;
            if (b.semanticRank !== null) return 1;
            return 0;
        });
}

export function calculateWeightedRRF(sources, k = 60) {
    if (!sources || sources.length === 0) return [];
    if (typeof k !== 'number' || k < 0) k = 60;

    const combined = new Map();

    sources.forEach(({ matches, weight = 1.0 }) => {
        if (!matches || matches.length === 0) return;
        matches.forEach((match, index) => {
            if (!match.classificationId) {
                logger.debug('Skipping match without classificationId in weighted RRF', { match });
                return;
            }
            const contribution = weight * (1 / (k + index + 1));
            if (combined.has(match.classificationId)) {
                combined.get(match.classificationId).rrfScore += contribution;
            } else {
                combined.set(match.classificationId, { ...match, rrfScore: contribution });
            }
        });
    });

    return Array.from(combined.values())
        .sort((a, b) => b.rrfScore - a.rrfScore);
}

export function legacyHybridCombine(semanticMatches, textMatches, limit = 5) {
    const combined = new Map();

    for (const match of semanticMatches) {
        combined.set(match.classificationId, {
            ...match,
            vectorScore: match.similarity,
            textScore: 0,
        });
    }

    for (const match of textMatches) {
        if (combined.has(match.classificationId)) {
            combined.get(match.classificationId).textScore = match.textScore;
        } else {
            combined.set(match.classificationId, {
                ...match,
                vectorScore: 0,
                textScore: match.textScore,
            });
        }
    }

    return Array.from(combined.values())
        .map((item) => ({
            ...item,
            combinedScore: (item.vectorScore * 0.7) + (item.textScore * 0.3),
        }))
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, limit);
}
