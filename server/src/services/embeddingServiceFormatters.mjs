/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';

export function safeGet(obj, path, defaultValue = null) {
    if (!obj) return defaultValue;

    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
        if (result === null || result === undefined || typeof result !== 'object') {
            return defaultValue;
        }
        result = result[key];
    }

    return result !== undefined ? result : defaultValue;
}

export function extractNames(items, limit = 3) {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    return items
        .slice(0, limit)
        .map(item => {
            if (typeof item === 'string') {
                return item;
            }
            if (item && typeof item === 'object') {
                return item.name || item.title || null;
            }
            return null;
        })
        .filter(Boolean);
}

export function formatForEmbedding(metadata) {
    const parts = [];

    if (metadata.title) {
        parts.push(`Title: ${metadata.title}`);
    }
    if (metadata.year) {
        parts.push(`Year: ${metadata.year}`);
    }

    if (metadata.media_type) {
        const typeLabel = metadata.media_type === 'movie' ? 'Movie' : 'TV Series';
        parts.push(`Type: ${typeLabel}`);
    }

    const genreNames = normalizeMetadataList(metadata.genres).slice(0, 5);
    if (genreNames.length > 0) {
        parts.push(`Genres: ${genreNames.join(', ')}`);
    }

    const certification = safeGet(metadata, 'certification') ||
        safeGet(metadata, 'content_rating');
    if (certification) {
        parts.push(`Rating: ${certification}`);
    }

    if (metadata.original_language) {
        parts.push(`Language: ${metadata.original_language}`);
    }

    const studios = safeGet(metadata, 'production_companies', []);
    if (studios && studios.length > 0) {
        const studioNames = extractNames(studios, 3);
        if (studioNames.length > 0) {
            parts.push(`Studio: ${studioNames.join(', ')}`);
        }
    }

    const collection = safeGet(metadata, 'belongs_to_collection');
    if (collection) {
        const franchiseName = typeof collection === 'object'
            ? collection.name
            : collection;
        if (franchiseName) {
            parts.push(`Franchise: ${franchiseName}`);
        }
    }

    const cast = safeGet(metadata, 'cast', []);
    if (cast && cast.length > 0) {
        const castNames = extractNames(cast, 3);
        if (castNames.length > 0) {
            parts.push(`Cast: ${castNames.join(', ')}`);
        }
    }

    const keywordNames = normalizeMetadataList(metadata.keywords).slice(0, 8);
    if (keywordNames.length > 0) {
        parts.push(`Keywords: ${keywordNames.join(', ')}`);
    }

    const voteAverage = safeGet(metadata, 'vote_average');
    if (voteAverage !== null && voteAverage !== undefined && !isNaN(parseFloat(voteAverage))) {
        parts.push(`Score: ${parseFloat(voteAverage).toFixed(1)}/10`);
    }

    if (metadata.library_name) {
        parts.push(`Classified: ${metadata.library_name}`);
    }

    if (metadata.overview) {
        const truncatedOverview = metadata.overview.length > 300
            ? metadata.overview.slice(0, 300) + '...'
            : metadata.overview;
        parts.push(`Synopsis: ${truncatedOverview}`);
    }

    return parts.join(' | ').trim();
}
