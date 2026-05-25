import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';
import {
    getPatternValue as _getPatternValue,
    extractPatterns as _extractPatterns,
    extractFieldPattern as _extractFieldPattern,
    extractArrayPattern as _extractArrayPattern,
    extractServerDataPattern as _extractServerDataPattern,
    extractYearPattern as _extractYearPattern,
    calculateMatchPercentage as _calculateMatchPercentage,
    itemMatchesPattern as _itemMatchesPattern,
} from './mediaPatternExtraction.mjs';

const logger = createLogger('MediaPatternAnalyzer');

export class MediaPatternAnalyzer {
    getPatternValue(value) {
        return _getPatternValue(value);
    }

    async analyzeLibrary(libraryId) {
        return withServiceCatch(logger, 'Failed to analyze library', { libraryId }, async () => {
            logger.info('Analyzing library patterns from media server metadata', { libraryId });

            const items = await this.getAllLibraryItems(libraryId);

            if (items.length === 0) {
                logger.warn('No items found in library', { libraryId });
                return { patterns: [], totalItems: 0 };
            }

            const patterns = _extractPatterns(items);

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
        });
    }

    async analyzeGroup(libraryId, contentType) {
        if (!contentType || contentType === 'all') {
            return this.analyzeLibrary(libraryId);
        }

        return withServiceCatch(logger, 'Failed to analyze group', { libraryId, contentType }, async () => {
            logger.info('Analyzing pattern for content group', { libraryId, contentType });

            const items = await this.getItemsByContentType(libraryId, contentType);

            if (items.length === 0) {
                return this.analyzeLibrary(libraryId);
            }

            const patterns = _extractPatterns(items);

            return {
                contentType,
                totalItems: items.length,
                patterns,
                analyzedAt: new Date().toISOString()
            };
        });
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
            INNER JOIN media_servers ms ON ms.id = l.media_server_id
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
            INNER JOIN media_servers ms ON ms.id = l.media_server_id
            WHERE msi.library_id = $1
                AND msi.metadata->'content_analysis'->>'type' = $2
            ORDER BY msi.title
        `;

        const result = await db.query(query, [libraryId, contentType]);
        return result.rows;
    }

    extractPatterns(items) {
        return _extractPatterns(items);
    }

    extractFieldPattern(items, field, defaultOperator, totalCount) {
        return _extractFieldPattern(items, field, defaultOperator, totalCount);
    }

    extractArrayPattern(items, field, defaultOperator, totalCount) {
        return _extractArrayPattern(items, field, defaultOperator, totalCount);
    }

    extractServerDataPattern(items, serverField, defaultOperator, totalCount) {
        return _extractServerDataPattern(items, serverField, defaultOperator, totalCount);
    }

    extractYearPattern(items, totalCount) {
        return _extractYearPattern(items, totalCount);
    }

    calculateMatchPercentage(pattern, items) {
        return _calculateMatchPercentage(pattern, items);
    }

    itemMatchesPattern(item, pattern) {
        return _itemMatchesPattern(item, pattern);
    }
}

export const mediaPatternAnalyzer = new MediaPatternAnalyzer();
