/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const embeddingRouter = require('./embeddingRouter');
const { createLogger } = require('../utils/logger');
const ragLogger = require('../utils/ragLogger');

const logger = createLogger('PatternMining');

/**
 * Pattern Mining Service
 * Discovers classification patterns from history
 */
class PatternMiningService {
    /**
     * Check if pattern mining is enabled
     */
    async isEnabled() {
        try {
            const config = await embeddingRouter.getConfig();
            // Pattern mining is enabled by default (as of v0.37.0)
            return config?.pattern_mining_enabled === true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Main pattern discovery function
     * Discovers patterns across all types
     */
    async discoverPatterns() {
        const startTime = Date.now();
        
        try {
            const enabled = await this.isEnabled();
            if (!enabled) {
                logger.debug('Pattern mining is disabled');
                return { discovered: 0, message: 'Pattern mining is disabled' };
            }

            logger.info('Starting pattern discovery');

            const results = {
                studio: await this.discoverStudioPatterns(),
                franchise: await this.discoverFranchisePatterns(),
                genre: await this.discoverGenrePatterns(),
                certification: await this.discoverCertificationPatterns()
            };

            const totalDiscovered = Object.values(results).reduce((sum, r) => sum + (r.discovered || 0), 0);

            // Log the operation
            const duration = Date.now() - startTime;
            await ragLogger.logOperation('pattern_mining', duration, true, {
                itemsProcessed: totalDiscovered,
                metadata: results
            });

            logger.info('Pattern discovery completed', {
                totalDiscovered,
                results
            });

            return {
                discovered: totalDiscovered,
                results
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            await ragLogger.logError(error, 'pattern_mining', { duration_ms: duration });
            logger.error('Pattern discovery failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Discover studio/production company patterns
     */
    async discoverStudioPatterns() {
        try {
            const result = await db.query(`
                SELECT 
                    jsonb_array_elements_text(
                        CASE 
                            WHEN jsonb_typeof(metadata->'production_companies') = 'array' 
                            THEN metadata->'production_companies'
                            ELSE '[]'::jsonb
                        END
                    ) as studio,
                    library_id,
                    library_name,
                    COUNT(*) as support_count,
                    COUNT(*) * 100.0 / NULLIF((
                        SELECT COUNT(*) 
                        FROM classification_history ch2 
                        WHERE ch2.library_id = ch.library_id
                    ), 0) as confidence
                FROM classification_history ch
                WHERE library_id IS NOT NULL
                AND metadata->'production_companies' IS NOT NULL
                GROUP BY studio, library_id, library_name
                HAVING COUNT(*) >= 3
                AND COUNT(*) * 100.0 / NULLIF((
                    SELECT COUNT(*) 
                    FROM classification_history ch2 
                    WHERE ch2.library_id = ch.library_id
                ), 0) >= 70.0
            `);

            let discovered = 0;
            for (const row of result.rows) {
                try {
                    // Extract studio name from JSON if needed
                    let studioName = row.studio;
                    try {
                        const parsed = JSON.parse(row.studio);
                        studioName = parsed.name || parsed;
                    } catch {
                        // Already a string
                    }

                    await this.upsertPattern(
                        'studio',
                        studioName,
                        row.library_id,
                        row.library_name,
                        parseFloat(row.confidence),
                        parseInt(row.support_count)
                    );
                    discovered++;
                } catch (error) {
                    logger.debug('Failed to upsert studio pattern', { error: error.message });
                }
            }

            return { discovered };
        } catch (error) {
            logger.error('Studio pattern discovery failed', { error: error.message });
            return { discovered: 0, error: error.message };
        }
    }

    /**
     * Discover franchise/collection patterns
     */
    async discoverFranchisePatterns() {
        try {
            const result = await db.query(`
                SELECT 
                    CASE 
                        WHEN jsonb_typeof(metadata->'belongs_to_collection') = 'object' 
                        THEN metadata->'belongs_to_collection'->>'name'
                        ELSE metadata->>'belongs_to_collection'
                    END as franchise,
                    library_id,
                    library_name,
                    COUNT(*) as support_count,
                    COUNT(*) * 100.0 / NULLIF((
                        SELECT COUNT(*) 
                        FROM classification_history ch2 
                        WHERE ch2.library_id = ch.library_id
                    ), 0) as confidence
                FROM classification_history ch
                WHERE library_id IS NOT NULL
                AND metadata->'belongs_to_collection' IS NOT NULL
                GROUP BY franchise, library_id, library_name
                HAVING COUNT(*) >= 2
                AND COUNT(*) * 100.0 / NULLIF((
                    SELECT COUNT(*) 
                    FROM classification_history ch2 
                    WHERE ch2.library_id = ch.library_id
                ), 0) >= 80.0
            `);

            let discovered = 0;
            for (const row of result.rows) {
                if (row.franchise) {
                    try {
                        await this.upsertPattern(
                            'franchise',
                            row.franchise,
                            row.library_id,
                            row.library_name,
                            parseFloat(row.confidence),
                            parseInt(row.support_count)
                        );
                        discovered++;
                    } catch (error) {
                        logger.debug('Failed to upsert franchise pattern', { error: error.message });
                    }
                }
            }

            return { discovered };
        } catch (error) {
            logger.error('Franchise pattern discovery failed', { error: error.message });
            return { discovered: 0, error: error.message };
        }
    }

    /**
     * Discover genre patterns
     */
    async discoverGenrePatterns() {
        try {
            const result = await db.query(`
                SELECT 
                    jsonb_array_elements_text(
                        CASE 
                            WHEN jsonb_typeof(metadata->'genres') = 'array' 
                            THEN metadata->'genres'
                            ELSE '[]'::jsonb
                        END
                    ) as genre,
                    library_id,
                    library_name,
                    COUNT(*) as support_count,
                    COUNT(*) * 100.0 / NULLIF((
                        SELECT COUNT(*) 
                        FROM classification_history ch2 
                        WHERE ch2.library_id = ch.library_id
                    ), 0) as confidence
                FROM classification_history ch
                WHERE library_id IS NOT NULL
                AND metadata->'genres' IS NOT NULL
                GROUP BY genre, library_id, library_name
                HAVING COUNT(*) >= 5
                AND COUNT(*) * 100.0 / NULLIF((
                    SELECT COUNT(*) 
                    FROM classification_history ch2 
                    WHERE ch2.library_id = ch.library_id
                ), 0) >= 60.0
            `);

            let discovered = 0;
            for (const row of result.rows) {
                try {
                    // Extract genre name from JSON if needed
                    let genreName = row.genre;
                    try {
                        const parsed = JSON.parse(row.genre);
                        genreName = parsed.name || parsed;
                    } catch {
                        // Already a string
                    }

                    await this.upsertPattern(
                        'genre',
                        genreName,
                        row.library_id,
                        row.library_name,
                        parseFloat(row.confidence),
                        parseInt(row.support_count)
                    );
                    discovered++;
                } catch (error) {
                    logger.debug('Failed to upsert genre pattern', { error: error.message });
                }
            }

            return { discovered };
        } catch (error) {
            logger.error('Genre pattern discovery failed', { error: error.message });
            return { discovered: 0, error: error.message };
        }
    }

    /**
     * Discover certification patterns
     */
    async discoverCertificationPatterns() {
        try {
            const result = await db.query(`
                SELECT 
                    metadata->>'certification' as certification,
                    library_id,
                    library_name,
                    COUNT(*) as support_count,
                    COUNT(*) * 100.0 / NULLIF((
                        SELECT COUNT(*) 
                        FROM classification_history ch2 
                        WHERE ch2.library_id = ch.library_id
                    ), 0) as confidence
                FROM classification_history ch
                WHERE library_id IS NOT NULL
                AND metadata->>'certification' IS NOT NULL
                AND metadata->>'certification' != ''
                GROUP BY certification, library_id, library_name
                HAVING COUNT(*) >= 5
                AND COUNT(*) * 100.0 / NULLIF((
                    SELECT COUNT(*) 
                    FROM classification_history ch2 
                    WHERE ch2.library_id = ch.library_id
                ), 0) >= 65.0
            `);

            let discovered = 0;
            for (const row of result.rows) {
                try {
                    await this.upsertPattern(
                        'certification',
                        row.certification,
                        row.library_id,
                        row.library_name,
                        parseFloat(row.confidence),
                        parseInt(row.support_count)
                    );
                    discovered++;
                } catch (error) {
                    logger.debug('Failed to upsert certification pattern', { error: error.message });
                }
            }

            return { discovered };
        } catch (error) {
            logger.error('Certification pattern discovery failed', { error: error.message });
            return { discovered: 0, error: error.message };
        }
    }

    /**
     * Upsert a discovered pattern
     */
    async upsertPattern(patternType, patternValue, libraryId, libraryName, confidence, supportCount) {
        try {
            const result = await db.query(`
                INSERT INTO discovered_patterns 
                (pattern_type, pattern_value, library_id, library_name, confidence, support_count, sample_size, last_seen_at)
                VALUES ($1, $2, $3, $4, $5, $6, $6, NOW())
                ON CONFLICT (pattern_type, pattern_value, library_id)
                DO UPDATE SET
                    confidence = EXCLUDED.confidence,
                    support_count = EXCLUDED.support_count,
                    sample_size = EXCLUDED.sample_size,
                    last_seen_at = NOW(),
                    updated_at = NOW()
                RETURNING id, confidence
            `, [patternType, patternValue, libraryId, libraryName, confidence, supportCount]);

            // Auto-approve high-confidence patterns
            if (result.rows[0] && confidence >= 85) {
                await this.autoApprovePattern(result.rows[0].id);
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to upsert pattern', { error: error.message, patternType, patternValue });
            throw error;
        }
    }

    /**
     * Auto-approve high-confidence patterns
     */
    async autoApprovePattern(patternId) {
        try {
            await db.query(`
                UPDATE discovered_patterns
                SET status = 'approved',
                    auto_approved = true,
                    approved_at = NOW(),
                    approved_by = 'system'
                WHERE id = $1
                AND status = 'discovered'
            `, [patternId]);
        } catch (error) {
            logger.warn('Failed to auto-approve pattern', { error: error.message });
        }
    }

    /**
     * Decay stale patterns (not seen recently)
     */
    async decayStalePatterns(daysSinceLastSeen = 90) {
        try {
            // Validate input to prevent SQL injection
            const days = parseInt(daysSinceLastSeen);
            if (isNaN(days) || days < 0) {
                throw new Error('Invalid daysSinceLastSeen parameter');
            }

            const result = await db.query(`
                UPDATE discovered_patterns
                SET status = 'decayed',
                    updated_at = NOW()
                WHERE last_seen_at < NOW() - INTERVAL '1 day' * $1
                AND status NOT IN ('rejected', 'decayed')
            `, [days]);

            logger.info('Decayed stale patterns', { count: result.rowCount });
            return result.rowCount;
        } catch (error) {
            logger.error('Failed to decay stale patterns', { error: error.message });
            return 0;
        }
    }

    /**
     * Get active patterns for a library
     */
    async getActivePatterns(libraryId = null) {
        try {
            let query = `
                SELECT * FROM discovered_patterns
                WHERE status = 'approved'
            `;
            const params = [];

            if (libraryId) {
                query += ' AND library_id = $1';
                params.push(libraryId);
            }

            query += ' ORDER BY confidence DESC, support_count DESC';

            const result = await db.query(query, params);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get active patterns', { error: error.message });
            return [];
        }
    }

    /**
     * Get patterns summary
     */
    async getPatternsSummary() {
        try {
            const result = await db.query(`
                SELECT 
                    pattern_type,
                    status,
                    COUNT(*) as count,
                    AVG(confidence) as avg_confidence
                FROM discovered_patterns
                GROUP BY pattern_type, status
                ORDER BY pattern_type, status
            `);

            return result.rows.map(row => ({
                patternType: row.pattern_type,
                status: row.status,
                count: parseInt(row.count),
                avgConfidence: Math.round(parseFloat(row.avg_confidence) * 100) / 100
            }));
        } catch (error) {
            logger.error('Failed to get patterns summary', { error: error.message });
            return [];
        }
    }
}

module.exports = new PatternMiningService();
