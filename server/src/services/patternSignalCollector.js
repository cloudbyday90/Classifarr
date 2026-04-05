/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const embeddingRouter = require('./embeddingRouter');
const { createLogger } = require('../utils/logger');
const { normalizeMetadataList, normalizeMetadataListLower } = require('../utils/metadataNormalization');

const logger = createLogger('PatternSignalCollector');

/**
 * Pattern Signal Collector Service — Legacy Read-Only Bridge (Phase 7 demotion)
 *
 * This service reads `discovered_patterns` to feed mined-candidate signals via
 * DiscoveredPatternEvidenceAdapter → ClassificationEvidenceService.
 *
 * Phase 7: Classification-time dependence on this path has been stopped
 * (includeDiscoveredPatterns defaults to false in collectRelatedEvidence).
 * This service is retained for:
 *   - explicit comparison flows (ClassificationEvidenceComparisonService)
 *   - operator diagnostics
 *   - future migration tooling
 *
 * DO NOT restore as a hot-path dependency before reviewing parity against
 * classification_evidence. Tables (discovered_patterns) will be retired
 * after a production observability review.
 */
class PatternSignalCollector {
    /**
     * Check if pattern-based classification is enabled
     */
    async isEnabled() {
        try {
            const config = await embeddingRouter.getConfig();
            return config?.pattern_mining_enabled === true;
        } catch (error) {
            logger.error('Failed to check pattern enabled status', { error: error.message });
            return false;
        }
    }

    /**
     * Collect pattern-based signals for a media item
     * @param {object} metadata - Media metadata (genres, keywords, studios, etc.)
     * @param {number} minConfidence - Minimum confidence threshold (0-100)
     * @returns {Array} Array of pattern signals sorted by confidence (descending)
     */
    async collectSignals(metadata, minConfidence = 50) {
        try {
            const enabled = await this.isEnabled();
            if (!enabled) {
                logger.debug('Pattern-based classification is disabled');
                return [];
            }

            if (!metadata) {
                logger.warn('No metadata provided for pattern signal collection');
                return [];
            }

            const signals = [];

            // Collect studio patterns
            if (metadata.studios && metadata.studios.length > 0) {
                const studioSignals = await this.collectStudioPatterns(metadata.studios, minConfidence);
                signals.push(...studioSignals);
            }

            // Collect franchise patterns (from collections, keywords)
            if (metadata.collection || normalizeMetadataList(metadata.keywords).length > 0) {
                const franchiseSignals = await this.collectFranchisePatterns(metadata, minConfidence);
                signals.push(...franchiseSignals);
            }

            // Collect genre combination patterns
            const normalizedGenres = normalizeMetadataList(metadata.genres);
            if (normalizedGenres.length > 0) {
                const genreSignals = await this.collectGenrePatterns(normalizedGenres, minConfidence);
                signals.push(...genreSignals);
            }

            // Collect certification patterns
            if (metadata.certification) {
                const certSignals = await this.collectCertificationPatterns(metadata.certification, minConfidence);
                signals.push(...certSignals);
            }

            // Sort by confidence descending
            signals.sort((a, b) => b.confidence - a.confidence);

            logger.debug('Collected pattern signals', {
                total: signals.length,
                topConfidence: signals.length > 0 ? signals[0].confidence : 0
            });

            return signals;
        } catch (error) {
            logger.error('Error collecting pattern signals', { error: error.message });
            return [];
        }
    }

    /**
     * Collect studio-based pattern signals
     */
    async collectStudioPatterns(studios, minConfidence) {
        const signals = [];

        if (!studios || studios.length === 0) {
            return signals;
        }

        try {
            // Fetch all matching patterns in a single query using ANY
            const result = await db.query(`
                SELECT DISTINCT ON (dp.pattern_value)
                    dp.*,
                    l.name as library_name,
                    l.id as library_id
                FROM discovered_patterns dp
                JOIN libraries l ON l.id = dp.library_id
                WHERE 
                    dp.pattern_type = 'studio'
                    AND dp.pattern_value = ANY($1)
                    AND dp.status IN ('discovered', 'approved')
                    AND dp.confidence >= $2
                ORDER BY dp.pattern_value, dp.confidence DESC
            `, [studios, minConfidence]);

            // Create a map for O(1) lookups
            const patternMap = new Map();
            for (const row of result.rows) {
                patternMap.set(row.pattern_value, row);
            }

            // Maintain original studio order
            for (const studio of studios) {
                const pattern = patternMap.get(studio);
                if (pattern) {
                    signals.push({
                        type: 'pattern_studio',
                        pattern_id: pattern.id,
                        pattern_type: 'studio',
                        pattern_value: studio,
                        library: {
                            id: pattern.library_id,
                            name: pattern.library_name
                        },
                        confidence: parseFloat(pattern.confidence),
                        sample_size: pattern.sample_size,
                        status: pattern.status
                    });
                }
            }
        } catch (error) {
            logger.error('Error collecting studio patterns', { error: error.message });
        }

        return signals;
    }

    /**
     * Collect franchise-based pattern signals
     */
    async collectFranchisePatterns(metadata, minConfidence) {
        const signals = [];

        try {
            // Collect all franchise values to search
            const franchiseValues = [];
            
            if (metadata.collection?.name) {
                franchiseValues.push(metadata.collection.name);
            }

            const normalizedKeywords = normalizeMetadataListLower(metadata.keywords);
            if (normalizedKeywords.length > 0) {
                const franchiseKeywords = normalizedKeywords.filter(k => 
                    k.includes('universe') || 
                    k.includes('series') ||
                    k.includes('franchise')
                );
                franchiseValues.push(...franchiseKeywords);
            }

            if (franchiseValues.length === 0) {
                return signals;
            }

            // Fetch all matching patterns in a single query
            const result = await db.query(`
                SELECT DISTINCT ON (dp.pattern_value)
                    dp.*,
                    l.name as library_name,
                    l.id as library_id
                FROM discovered_patterns dp
                JOIN libraries l ON l.id = dp.library_id
                WHERE 
                    dp.pattern_type = 'franchise'
                    AND dp.pattern_value = ANY($1)
                    AND dp.status IN ('discovered', 'approved')
                    AND dp.confidence >= $2
                ORDER BY dp.pattern_value, dp.confidence DESC
            `, [franchiseValues, minConfidence]);

            // Create a map for O(1) lookups
            const patternMap = new Map();
            for (const row of result.rows) {
                patternMap.set(row.pattern_value, row);
            }

            // Maintain original order
            for (const value of franchiseValues) {
                const pattern = patternMap.get(value);
                if (pattern) {
                    signals.push({
                        type: 'pattern_franchise',
                        pattern_id: pattern.id,
                        pattern_type: 'franchise',
                        pattern_value: value,
                        library: {
                            id: pattern.library_id,
                            name: pattern.library_name
                        },
                        confidence: parseFloat(pattern.confidence),
                        sample_size: pattern.sample_size,
                        status: pattern.status
                    });
                }
            }
        } catch (error) {
            logger.error('Error collecting franchise patterns', { error: error.message });
        }

        return signals;
    }

    /**
     * Collect genre combination pattern signals
     */
    async collectGenrePatterns(genres, minConfidence) {
        const signals = [];

        try {
            // Sort genres using locale-aware comparison for consistent cross-platform behavior
            const sortedGenres = [...genres].sort((a, b) => a.localeCompare(b)).join(',');

            const result = await db.query(`
                SELECT 
                    dp.*,
                    l.name as library_name,
                    l.id as library_id
                FROM discovered_patterns dp
                JOIN libraries l ON l.id = dp.library_id
                WHERE 
                    dp.pattern_type = 'genre'
                    AND dp.pattern_value = $1
                    AND dp.status IN ('discovered', 'approved')
                    AND dp.confidence >= $2
                ORDER BY dp.confidence DESC
                LIMIT 1
            `, [sortedGenres, minConfidence]);

            if (result.rows.length > 0) {
                const pattern = result.rows[0];
                signals.push({
                    type: 'pattern_genre',
                    pattern_id: pattern.id,
                    pattern_type: 'genre',
                    pattern_value: sortedGenres,
                    library: {
                        id: pattern.library_id,
                        name: pattern.library_name
                    },
                    confidence: parseFloat(pattern.confidence),
                    sample_size: pattern.sample_size,
                    status: pattern.status
                });
            }
        } catch (error) {
            logger.error('Error collecting genre patterns', { error: error.message });
        }

        return signals;
    }

    /**
     * Collect certification-based pattern signals
     */
    async collectCertificationPatterns(certification, minConfidence) {
        const signals = [];

        try {
            const result = await db.query(`
                SELECT 
                    dp.*,
                    l.name as library_name,
                    l.id as library_id
                FROM discovered_patterns dp
                JOIN libraries l ON l.id = dp.library_id
                WHERE 
                    dp.pattern_type = 'certification'
                    AND dp.pattern_value = $1
                    AND dp.status IN ('discovered', 'approved')
                    AND dp.confidence >= $2
                ORDER BY dp.confidence DESC
                LIMIT 1
            `, [certification, minConfidence]);

            if (result.rows.length > 0) {
                const pattern = result.rows[0];
                signals.push({
                    type: 'pattern_certification',
                    pattern_id: pattern.id,
                    pattern_type: 'certification',
                    pattern_value: certification,
                    library: {
                        id: pattern.library_id,
                        name: pattern.library_name
                    },
                    confidence: parseFloat(pattern.confidence),
                    sample_size: pattern.sample_size,
                    status: pattern.status
                });
            }
        } catch (error) {
            logger.error('Error collecting certification patterns', { error: error.message });
        }

        return signals;
    }

    /**
     * Get the best matching pattern for given metadata
     * @param {object} metadata - Media metadata
     * @returns {object|null} Best pattern signal or null
     */
    async getBestMatch(metadata) {
        const signals = await this.collectSignals(metadata, 50);
        return signals.length > 0 ? signals[0] : null;
    }
}

module.exports = new PatternSignalCollector();
