/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import dbModule from '../config/database.mjs';
import embeddingRouterModule from './embeddingRouter.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataList as _normalizeMetadataList, normalizeMetadataListLower as _normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';

class PatternSignalCollector {
    constructor(deps = {}) {
        this._db = deps.db || null;
        this._embeddingRouter = deps.embeddingRouter || null;
        this._logger = deps.logger || null;
        this._normalizeMetadataList = deps.normalizeMetadataList || null;
        this._normalizeMetadataListLower = deps.normalizeMetadataListLower || null;
    }

    get db() {
        if (!this._db) {
            this._db = dbModule;
        }
        return this._db;
    }

    get embeddingRouter() {
        if (!this._embeddingRouter) {
            this._embeddingRouter = embeddingRouterModule;
        }
        return this._embeddingRouter;
    }

    get logger() {
        if (!this._logger) {
            this._logger = createLogger('PatternSignalCollector');
        }
        return this._logger;
    }

    get normalizeMetadataList() {
        if (!this._normalizeMetadataList) {
            this._normalizeMetadataList = _normalizeMetadataList;
        }
        return this._normalizeMetadataList;
    }

    get normalizeMetadataListLower() {
        if (!this._normalizeMetadataListLower) {
            this._normalizeMetadataListLower = _normalizeMetadataListLower;
        }
        return this._normalizeMetadataListLower;
    }

    async isEnabled() {
        try {
            const config = await this.embeddingRouter.getConfig();
            return config?.pattern_mining_enabled === true;
        } catch (error) {
            this.logger.error('Failed to check pattern enabled status', { error: error.message });
            return false;
        }
    }

    async collectSignals(metadata, minConfidence = 50) {
        try {
            const enabled = await this.isEnabled();
            if (!enabled) {
                this.logger.debug('Pattern-based classification is disabled');
                return [];
            }

            if (!metadata) {
                this.logger.warn('No metadata provided for pattern signal collection');
                return [];
            }

            const signals = [];

            if (metadata.studios && metadata.studios.length > 0) {
                const studioSignals = await this.collectStudioPatterns(metadata.studios, minConfidence);
                signals.push(...studioSignals);
            }

            if (metadata.collection || this.normalizeMetadataList(metadata.keywords).length > 0) {
                const franchiseSignals = await this.collectFranchisePatterns(metadata, minConfidence);
                signals.push(...franchiseSignals);
            }

            const normalizedGenres = this.normalizeMetadataList(metadata.genres);
            if (normalizedGenres.length > 0) {
                const genreSignals = await this.collectGenrePatterns(normalizedGenres, minConfidence);
                signals.push(...genreSignals);
            }

            if (metadata.certification) {
                const certSignals = await this.collectCertificationPatterns(metadata.certification, minConfidence);
                signals.push(...certSignals);
            }

            signals.sort((a, b) => b.confidence - a.confidence);

            this.logger.debug('Collected pattern signals', {
                total: signals.length,
                topConfidence: signals.length > 0 ? signals[0].confidence : 0
            });

            return signals;
        } catch (error) {
            this.logger.error('Error collecting pattern signals', { error: error.message });
            return [];
        }
    }

    async collectStudioPatterns(studios, minConfidence) {
        const signals = [];

        if (!studios || studios.length === 0) {
            return signals;
        }

        try {
            const result = await this.db.query(`
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

            const patternMap = new Map();
            for (const row of result.rows) {
                patternMap.set(row.pattern_value, row);
            }

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
            this.logger.error('Error collecting studio patterns', { error: error.message });
        }

        return signals;
    }

    async collectFranchisePatterns(metadata, minConfidence) {
        const signals = [];

        try {
            const franchiseValues = [];
            
            if (metadata.collection?.name) {
                franchiseValues.push(metadata.collection.name);
            }

            const normalizedKeywords = this.normalizeMetadataListLower(metadata.keywords);
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

            const result = await this.db.query(`
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

            const patternMap = new Map();
            for (const row of result.rows) {
                patternMap.set(row.pattern_value, row);
            }

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
            this.logger.error('Error collecting franchise patterns', { error: error.message });
        }

        return signals;
    }

    async collectGenrePatterns(genres, minConfidence) {
        const signals = [];

        try {
            const sortedGenres = [...genres].sort((a, b) => a.localeCompare(b)).join(',');

            const result = await this.db.query(`
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
            this.logger.error('Error collecting genre patterns', { error: error.message });
        }

        return signals;
    }

    async collectCertificationPatterns(certification, minConfidence) {
        const signals = [];

        try {
            const result = await this.db.query(`
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
            this.logger.error('Error collecting certification patterns', { error: error.message });
        }

        return signals;
    }

    async getBestMatch(metadata) {
        const signals = await this.collectSignals(metadata, 50);
        return signals.length > 0 ? signals[0] : null;
    }
}

const singleton = new PatternSignalCollector();

export default singleton;
export { PatternSignalCollector };
