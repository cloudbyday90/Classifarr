/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { assessRagEvidenceMatch } from './ragEvidenceQualityGate.mjs';

function getQualityAdjustedSimilarity(match) {
    return assessRagEvidenceMatch(match).adjusted_similarity;
}

export function calculateDynamicWeight(matches) {
    if (!matches || matches.length === 0) {
        return 0;
    }

    const topMatch = Math.max(...matches.map(getQualityAdjustedSimilarity));
    const libraryIds = matches.map((m) => m.libraryId);
    const uniqueLibraries = new Set(libraryIds);
    const unanimous = uniqueLibraries.size === 1;

    if (matches.length >= 3 && unanimous && topMatch > 0.90) {
        return 90;
    }
    if (matches.length >= 2 && unanimous && topMatch > 0.80) {
        return 80;
    }
    if (matches.length >= 1 && topMatch > 0.70) {
        return 70;
    }
    if (topMatch > 0.60) {
        return 60;
    }
    return 50;
}

function formatLibraryName(match) {
    if (typeof match?.libraryName === 'string' && match.libraryName.trim()) {
        return match.libraryName.trim();
    }
    if (typeof match?.library_name === 'string' && match.library_name.trim()) {
        return match.library_name.trim();
    }
    const libraryId = match?.libraryId ?? match?.library_id;
    return libraryId == null ? 'Unknown library' : `Library #${libraryId}`;
}

export function getSuggestedLibrary(matches) {
    if (!matches || matches.length === 0) {
        return null;
    }

    const votes = {};
    for (const match of matches) {
        if (!votes[match.libraryId]) {
            votes[match.libraryId] = {
                libraryId: match.libraryId,
                libraryName: formatLibraryName(match),
                count: 0,
                totalSimilarity: 0,
            };
        }
        votes[match.libraryId].count++;
        votes[match.libraryId].totalSimilarity += getQualityAdjustedSimilarity(match);
    }

    const winner = Object.values(votes)
        .sort((a, b) => b.totalSimilarity - a.totalSimilarity)[0];

    return {
        libraryId: winner.libraryId,
        libraryName: winner.libraryName,
        voteCount: winner.count,
        avgSimilarity: Math.round((winner.totalSimilarity / winner.count) * 100) / 100,
    };
}

export function formatForAIContext(matches) {
    if (!matches || matches.length === 0) {
        return '';
    }

    const lines = ['Similar past classifications:'];
    for (const match of matches.slice(0, 3)) {
        const similarity = match.similarity || 0;
        const libraryName = formatLibraryName(match);
        if (match.imageSimilarity !== null && match.imageSimilarity !== undefined) {
            const textPct = Math.round((match.textSimilarity || 0) * 100);
            const imagePct = Math.round(match.imageSimilarity * 100);
            lines.push(`- "${match.title}" → ${libraryName} (${Math.round(similarity * 100)}% combined; text ${textPct}%, image ${imagePct}%)`);
        } else {
            lines.push(`- "${match.title}" → ${libraryName} (${Math.round(similarity * 100)}% similar)`);
        }
    }

    const suggested = getSuggestedLibrary(matches);
    if (suggested) {
        lines.push(`\nRAG suggests: ${suggested.libraryName} (${suggested.voteCount} similar items)`);
    }

    return lines.join('\n');
}
