/**
 * Plex Pattern Analyzer
 * 
 * Analyzes Plex metadata patterns from detected content groups to generate
 * intelligent rule suggestions based on actual library organization.
 */

const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PlexPatternAnalyzer');

class PlexPatternAnalyzer {
    /**
     * Analyze a group of items (by content type) and extract common patterns
     * @param {number} libraryId - Library ID
     * @param {string} contentType - Content type to analyze (e.g., 'holiday', 'anime')
     * @returns {Promise<Object>} Detected patterns with match statistics
     */
    async analyzeGroup(libraryId, contentType) {
        try {
            logger.info('Analyzing pattern for content group', { libraryId, contentType });

            // Get all items classified as this content type
            const items = await this.getItemsByContentType(libraryId, contentType);

            if (items.length === 0) {
                logger.warn('No items found for content type', { libraryId, contentType });
                return { patterns: [], totalItems: 0 };
            }

            // Extract patterns from the items
            const patterns = await this.extractPatterns(items);

            logger.info('Pattern analysis complete', {
                libraryId,
                contentType,
                itemCount: items.length,
                patternCount: patterns.length
            });

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

    /**
     * Get all items in library classified as specific content type
     * @param {number} libraryId 
     * @param {string} contentType 
     * @returns {Promise<Array>} Array of media items with metadata
     */
    async getItemsByContentType(libraryId, contentType) {
        const query = `
            SELECT 
                msi.id,
                msi.title,
                msi.year,
                msi.media_type,
                msi.content_rating,
                msi.genres,
                msi.metadata,
                msi.plex_data
            FROM media_server_items msi
            WHERE msi.library_id = $1
                AND msi.metadata->'content_analysis'->>'type' = $2
                AND msi.in_library = true
            ORDER BY msi.title
        `;

        const result = await db.query(query, [libraryId, contentType]);
        return result.rows;
    }

    /**
     * Extract common patterns from a set of items
     * @param {Array} items - Media items with metadata
     * @returns {Promise<Array>} Array of detected patterns
     */
    async extractPatterns(items) {
        const patterns = [];
        const totalCount = items.length;

        // 1. Content Rating Pattern
        const ratingPattern = this.extractFieldPattern(
            items,
            'content_rating',
            'equals',
            totalCount
        );
        if (ratingPattern) patterns.push(ratingPattern);

        // 2. Genre Pattern (from genres array)
        const genrePattern = this.extractArrayPattern(
            items,
            'genres',
            'is_one_of',
            totalCount
        );
        if (genrePattern) patterns.push(genrePattern);

        // 3. Collection Pattern (from plex_data)
        const collectionPattern = this.extractPlexDataPattern(
            items,
            'collections',
            'contains',
            totalCount
        );
        if (collectionPattern) patterns.push(collectionPattern);

        // 4. Label Pattern (from plex_data)
        const labelPattern = this.extractPlexDataPattern(
            items,
            'labels',
            'is_one_of',
            totalCount
        );
        if (labelPattern) patterns.push(labelPattern);

        // 5. Studio Pattern (from plex_data)
        const studioPattern = this.extractPlexDataPattern(
            items,
            'studio',
            'equals',
            totalCount
        );
        if (studioPattern) patterns.push(studioPattern);

        // 6. Year/Decade Pattern
        const yearPattern = this.extractYearPattern(items, totalCount);
        if (yearPattern) patterns.push(yearPattern);

        // Sort by match percentage (highest first)
        patterns.sort((a, b) => b.matchPercentage - a.matchPercentage);

        return patterns;
    }

    /**
     * Extract pattern for a simple field (e.g., content_rating)
     */
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

        const values = Object.keys(valueCounts);
        const matchPercentage = Math.round((matchCount / totalCount) * 100);

        return {
            field,
            operator: values.length > 1 ? 'is_one_of' : defaultOperator,
            values,
            valueCounts,
            matchCount,
            totalCount,
            matchPercentage,
            preSelected: matchPercentage >= 80,
            confidence: 100 // Plex data = 100% confidence
        };
    }

    /**
     * Extract pattern for array fields (e.g., genres)
     */
    extractArrayPattern(items, field, defaultOperator, totalCount) {
        const valueCounts = {};
        let itemsWithField = 0;

        items.forEach(item => {
            const array = item[field];
            if (Array.isArray(array) && array.length > 0) {
                itemsWithField++;
                array.forEach(val => {
                    const value = typeof val === 'string' ? val : val.tag;
                    if (value) {
                        valueCounts[value] = (valueCounts[value] || 0) + 1;
                    }
                });
            }
        });

        if (itemsWithField === 0) return null;

        // Only include values that appear in at least 20% of items
        const threshold = Math.ceil(totalCount * 0.2);
        const values = Object.keys(valueCounts).filter(v => valueCounts[v] >= threshold);

        if (values.length === 0) return null;

        const matchPercentage = Math.round((itemsWithField / totalCount) * 100);

        return {
            field,
            operator: defaultOperator,
            values,
            valueCounts,
            matchCount: itemsWithField,
            totalCount,
            matchPercentage,
            preSelected: matchPercentage >= 80,
            confidence: 100
        };
    }

    /**
     * Extract pattern from plex_data jsonb field
     */
    extractPlexDataPattern(items, plexField, defaultOperator, totalCount) {
        const valueCounts = {};
        let matchCount = 0;

        items.forEach(item => {
            if (!item.plex_data) return;

            const plexData = item.plex_data;
            let fieldValue = plexData[plexField];

            if (!fieldValue) return;

            // Handle array fields (collections, labels)
            if (Array.isArray(fieldValue)) {
                if (fieldValue.length > 0) {
                    matchCount++;
                    fieldValue.forEach(val => {
                        const value = typeof val === 'object' ? val.tag : val;
                        if (value) {
                            valueCounts[value] = (valueCounts[value] || 0) + 1;
                        }
                    });
                }
            } else {
                // Handle string fields (studio)
                matchCount++;
                valueCounts[fieldValue] = (valueCounts[fieldValue] || 0) + 1;
            }
        });

        if (matchCount === 0) return null;

        // For collections/labels, only include values appearing in at least 20% of items
        const threshold = Math.ceil(totalCount * 0.2);
        const values = Object.keys(valueCounts).filter(v => valueCounts[v] >= threshold);

        if (values.length === 0) return null;

        const matchPercentage = Math.round((matchCount / totalCount) * 100);

        return {
            field: plexField,
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

    /**
     * Extract year/decade pattern
     */
    extractYearPattern(items, totalCount) {
        const years = items
            .map(item => item.year)
            .filter(year => year != null);

        if (years.length === 0) return null;

        // Calculate decade distribution
        const decades = {};
        years.forEach(year => {
            const decade = Math.floor(year / 10) * 10;
            decades[decade] = (decades[decade] || 0) + 1;
        });

        // Find dominant decade (if any)
        const dominantDecade = Object.entries(decades)
            .sort((a, b) => b[1] - a[1])[0];

        const matchPercentage = Math.round((dominantDecade[1] / totalCount) * 100);

        // Only suggest if >50% of items are in same decade
        if (matchPercentage < 50) return null;

        return {
            field: 'year',
            operator: 'greater_than',
            values: [dominantDecade[0]], // Start of decade
            valueCounts: { [dominantDecade[0]]: dominantDecade[1] },
            matchCount: dominantDecade[1],
            totalCount,
            matchPercentage,
            preSelected: matchPercentage >= 80,
            confidence: 100
        };
    }

    /**
     * Calculate match percentage for a specific pattern
     * @param {Object} pattern - Pattern to test
     * @param {Array} items - Items to test against
     * @returns {number} Percentage of items matching pattern
     */
    calculateMatchPercentage(pattern, items) {
        let matches = 0;

        items.forEach(item => {
            if (this.itemMatchesPattern(item, pattern)) {
                matches++;
            }
        });

        return Math.round((matches / items.length) * 100);
    }

    /**
     * Check if an item matches a pattern
     */
    itemMatchesPattern(item, pattern) {
        const { field, operator, values } = pattern;

        let itemValue;
        if (field in item) {
            itemValue = item[field];
        } else if (item.plex_data && field in item.plex_data) {
            itemValue = item.plex_data[field];
        } else {
            return false;
        }

        switch (operator) {
            case 'equals':
                return values.includes(itemValue);
            case 'is_one_of':
                if (Array.isArray(itemValue)) {
                    return itemValue.some(v =>
                        values.includes(typeof v === 'object' ? v.tag : v)
                    );
                }
                return values.includes(itemValue);
            case 'contains':
                if (Array.isArray(itemValue)) {
                    return itemValue.some(v => {
                        const val = typeof v === 'object' ? v.tag : v;
                        return values.some(pattern => val.includes(pattern));
                    });
                }
                return values.some(pattern => String(itemValue).includes(pattern));
            case 'greater_than':
                return itemValue > values[0];
            default:
                return false;
        }
    }
}

module.exports = new PlexPatternAnalyzer();
