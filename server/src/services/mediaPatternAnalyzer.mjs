/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { coerceMetadataArray } from '../utils/metadataNormalization.mjs';

const logger = createLogger('MediaPatternAnalyzer');

class MediaPatternAnalyzer {
    getPatternValue(value) {
        if (typeof value === 'string') {
            return value;
        }

        if (value && typeof value === 'object') {
            return value.name || value.tag || value.title || null;
        }

        return null;
    }

    async analyzeLibrary(libraryId) {
        try {
            logger.info('Analyzing library patterns from media server metadata', { libraryId });

            const items = await this.getAllLibraryItems(libraryId);

            if (items.length === 0) {
                logger.warn('No items found in library', { libraryId });
                return { patterns: [], totalItems: 0 };
            }

            const patterns = await this.extractPatterns(items);

            logger.info('Pattern analysis complete', {
                libraryId,
                itemCount: items.length,
                patternCount: patterns.length
            });

            return {
                totalItems: items.length,
                patterns,
                analyzedAt: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Failed to analyze library', { error: error.message, libraryId });
            throw error;
        }
    }

    async analyzeGroup(libraryId, contentType) {
        if (!contentType || contentType === 'all') {
            return this.analyzeLibrary(libraryId);
        }

        try {
            logger.info('Analyzing pattern for content group', { libraryId, contentType });

            const items = await this.getItemsByContentType(libraryId, contentType);

            if (items.length === 0) {
                return this.analyzeLibrary(libraryId);
            }

            const patterns = await this.extractPatterns(items);

            return {
                contentType,
                totalItems: items.length,
                patterns,
                analyzedAt: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Failed to analyze group', { error: error.message, libraryId, contentType });
            throw error;
        }
    }

    async getAllLibraryItems(libraryId) {
        const query = `
            SELECT 
                msi.id,
                msi.title,
                msi.year,
                msi.media_type,
                msi.content_rating,
                msi.genres,
                msi.collections,
                msi.tags,
                msi.studio,
                msi.metadata,
                ms.type as media_server_type
            FROM media_server_items msi
            INNER JOIN libraries l ON l.id = msi.library_id
            INNER JOIN media_server ms ON ms.id = l.media_server_id
            WHERE msi.library_id = $1
            ORDER BY msi.title
        `;

        const result = await db.query(query, [libraryId]);
        return result.rows;
    }

    async getItemsByContentType(libraryId, contentType) {
        const query = `
            SELECT 
                msi.id,
                msi.title,
                msi.year,
                msi.media_type,
                msi.content_rating,
                msi.genres,
                msi.collections,
                msi.tags,
                msi.studio,
                msi.metadata,
                ms.type as media_server_type
            FROM media_server_items msi
            INNER JOIN libraries l ON l.id = msi.library_id
            INNER JOIN media_server ms ON ms.id = l.media_server_id
            WHERE msi.library_id = $1
                AND msi.metadata->'content_analysis'->>'type' = $2
            ORDER BY msi.title
        `;

        const result = await db.query(query, [libraryId, contentType]);
        return result.rows;
    }

    async extractPatterns(items) {
        const patterns = [];
        const totalCount = items.length;

        const ratingPattern = this.extractFieldPattern(
            items,
            'content_rating',
            'equals',
            totalCount
        );
        if (ratingPattern) patterns.push(ratingPattern);

        const genrePattern = this.extractArrayPattern(
            items,
            'genres',
            'is_one_of',
            totalCount
        );
        if (genrePattern) patterns.push(genrePattern);

        const collectionPattern = this.extractArrayPattern(
            items,
            'collections',
            'contains',
            totalCount
        );
        if (collectionPattern) patterns.push(collectionPattern);

        const tagsPattern = this.extractArrayPattern(
            items,
            'tags',
            'is_one_of',
            totalCount
        );
        if (tagsPattern) patterns.push(tagsPattern);

        patterns.sort((a, b) => b.matchPercentage - a.matchPercentage);

        return patterns;
    }

    extractFieldPattern(items, field, defaultOperator, totalCount) {
        const valueCounts = {};
        let matchCount = 0;

        items.forEach(item => {
            const value = item[field];
            if (value) {
                valueCounts[value] = (valueCounts[value] || 0) + 1;
                matchCount++;
            }
        });

        if (matchCount === 0) return null;

        const threshold = Math.max(5, Math.ceil(totalCount * 0.05));
        const values = Object.keys(valueCounts)
            .filter(v => valueCounts[v] >= threshold)
            .sort((a, b) => valueCounts[b] - valueCounts[a]);

        if (values.length === 0) return null;

        const filteredValueCounts = {};
        values.forEach(v => { filteredValueCounts[v] = valueCounts[v]; });

        const matchPercentage = Math.round((matchCount / totalCount) * 100);

        return {
            field,
            operator: values.length > 1 ? 'is_one_of' : defaultOperator,
            values,
            valueCounts: filteredValueCounts,
            matchCount,
            totalCount,
            matchPercentage,
            preSelected: matchPercentage >= 80,
            confidence: 100
        };
    }

    extractArrayPattern(items, field, defaultOperator, totalCount) {
        const valueCounts = {};
        let itemsWithField = 0;

        items.forEach(item => {
            const array = coerceMetadataArray(item[field]);
            if (array.length > 0) {
                itemsWithField++;
                array.forEach(val => {
                    const value = this.getPatternValue(val);
                    if (value) {
                        valueCounts[value] = (valueCounts[value] || 0) + 1;
                    }
                });
            }
        });

        if (itemsWithField === 0) return null;

        const threshold = Math.max(5, Math.ceil(totalCount * 0.05));
        const values = Object.keys(valueCounts)
            .filter(v => valueCounts[v] >= threshold)
            .sort((a, b) => valueCounts[b] - valueCounts[a]);

        if (values.length === 0) return null;

        const filteredValueCounts = {};
        values.forEach(v => { filteredValueCounts[v] = valueCounts[v]; });

        const matchPercentage = Math.round((itemsWithField / totalCount) * 100);

        return {
            field,
            operator: defaultOperator,
            values,
            valueCounts: filteredValueCounts,
            matchCount: itemsWithField,
            totalCount,
            matchPercentage,
            preSelected: matchPercentage >= 80,
            confidence: 100
        };
    }

    extractServerDataPattern(items, serverField, defaultOperator, totalCount) {
        const valueCounts = {};
        let matchCount = 0;

        items.forEach(item => {
            const serverData = item.plex_data || item.emby_data || item.jellyfin_data;
            if (!serverData) return;

            const fieldValue = serverData[serverField];
            if (!fieldValue) return;

            if (Array.isArray(fieldValue)) {
                if (fieldValue.length > 0) {
                    matchCount++;
                    fieldValue.forEach(val => {
                        const value = this.getPatternValue(val);
                        if (value) {
                            valueCounts[value] = (valueCounts[value] || 0) + 1;
                        }
                    });
                }
            } else {
                matchCount++;
                valueCounts[fieldValue] = (valueCounts[fieldValue] || 0) + 1;
            }
        });

        if (matchCount === 0) return null;

        const threshold = Math.ceil(totalCount * 0.2);
        const values = Object.keys(valueCounts).filter(v => valueCounts[v] >= threshold);

        if (values.length === 0) return null;

        const matchPercentage = Math.round((matchCount / totalCount) * 100);

        return {
            field: serverField,
            operator: values.length > 1 ? 'is_one_of' : defaultOperator,
            values,
            valueCounts,
            matchCount,
            totalCount,
            matchPercentage,
            preSelected: matchPercentage >= 80,
            confidence: 100
        };
    }

    extractYearPattern(items, totalCount) {
        const years = items
            .map(item => item.year)
            .filter(year => year != null);

        if (years.length === 0) return null;

        const decades = {};
        years.forEach(year => {
            const decade = Math.floor(year / 10) * 10;
            decades[decade] = (decades[decade] || 0) + 1;
        });

        const dominantDecade = Object.entries(decades)
            .sort((a, b) => b[1] - a[1])[0];

        const matchPercentage = Math.round((dominantDecade[1] / totalCount) * 100);

        if (matchPercentage < 50) return null;

        return {
            field: 'year',
            operator: 'greater_than',
            values: [dominantDecade[0]],
            valueCounts: { [dominantDecade[0]]: dominantDecade[1] },
            matchCount: dominantDecade[1],
            totalCount,
            matchPercentage,
            preSelected: matchPercentage >= 80,
            confidence: 100
        };
    }

    calculateMatchPercentage(pattern, items) {
        let matches = 0;

        items.forEach(item => {
            if (this.itemMatchesPattern(item, pattern)) {
                matches++;
            }
        });

        return Math.round((matches / items.length) * 100);
    }

    itemMatchesPattern(item, pattern) {
        const { field, operator, values } = pattern;

        let itemValue;
        if (field in item) {
            itemValue = item[field];
        } else {
            const serverData = item.plex_data || item.emby_data || item.jellyfin_data;
            if (serverData && field in serverData) {
                itemValue = serverData[field];
            } else {
                return false;
            }
        }

        switch (operator) {
            case 'equals':
                return values.includes(itemValue);
            case 'is_one_of':
                if (Array.isArray(itemValue)) {
                    return itemValue.some(v =>
                        values.includes(this.getPatternValue(v))
                    );
                }
                return values.includes(itemValue);
            case 'contains':
                if (Array.isArray(itemValue)) {
                    return itemValue.some(v => {
                        const val = this.getPatternValue(v);
                        if (!val) {
                            return false;
                        }
                        return values.some(patternValue => val.includes(patternValue));
                    });
                }
                return values.some(patternValue => String(itemValue).includes(patternValue));
            case 'greater_than':
                return itemValue > values[0];
            default:
                return false;
        }
    }
}

function createMediaPatternAnalyzer() {
    return new MediaPatternAnalyzer();
}

const mediaPatternAnalyzer = new MediaPatternAnalyzer();

export default mediaPatternAnalyzer;
export { MediaPatternAnalyzer, createMediaPatternAnalyzer };
