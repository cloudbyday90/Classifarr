/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import db from '../config/database.mjs';
import embeddingRouter from './embeddingRouter.mjs';
import { createLogger } from '../utils/logger.mjs';
import ragLogger from '../utils/ragLogger.mjs';

const logger = createLogger('PatternMining');

class PatternMiningService {
    extractPatternValue(rawValue) {
        if (!rawValue) {
            return null;
        }

        if (typeof rawValue !== 'string') {
            return rawValue;
        }

        try {
            const parsed = JSON.parse(rawValue);
            if (parsed && typeof parsed === 'object') {
                return parsed.name || parsed.tag || parsed.title || null;
            }
            return parsed;
        } catch {
            return rawValue;
        }
    }

    async isEnabled() {
        try {
            const config = await embeddingRouter.getConfig();
            return config?.pattern_mining_enabled === true;
        } catch (_error) {
            return false;
        }
    }

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

            const totalDiscovered = Object.values(results).reduce((sum, result) => sum + (result.discovered || 0), 0);

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

    async discoverStudioPatterns() {
        try {
            const result = await db.query(`
                WITH normalized_studios AS (
                    SELECT
                        CASE
                            WHEN jsonb_typeof(company) = 'object'
                                THEN COALESCE(company->>'name', company->>'tag', company->>'title')
                            WHEN jsonb_typeof(company) = 'string'
                                THEN trim(both '"' from company::text)
                            ELSE NULL
                        END AS studio,
                        ch.library_id,
                        ch.library_name
                    FROM classification_history ch
                    CROSS JOIN LATERAL jsonb_array_elements(
                        CASE
                            WHEN jsonb_typeof(ch.metadata->'production_companies') = 'array'
                                THEN ch.metadata->'production_companies'
                            ELSE '[]'::jsonb
                        END
                    ) AS company
                    WHERE ch.library_id IS NOT NULL
                    AND ch.metadata->'production_companies' IS NOT NULL
                )
                SELECT
                    studio,
                    library_id,
                    library_name,
                    COUNT(*) as support_count,
                    COUNT(*) * 100.0 / NULLIF((
                        SELECT COUNT(*)
                        FROM classification_history ch2
                        WHERE ch2.library_id = normalized_studios.library_id
                    ), 0) as confidence
                FROM normalized_studios
                WHERE studio IS NOT NULL
                GROUP BY studio, library_id, library_name
                HAVING COUNT(*) >= 3
                AND COUNT(*) * 100.0 / NULLIF((
                    SELECT COUNT(*)
                    FROM classification_history ch2
                    WHERE ch2.library_id = normalized_studios.library_id
                ), 0) >= 70.0
            `);

            let discovered = 0;
            for (const row of result.rows) {
                try {
                    const studioName = this.extractPatternValue(row.studio);
                    if (!studioName) {
                        continue;
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

    async discoverGenrePatterns() {
        try {
            const result = await db.query(`
                WITH normalized_genres AS (
                    SELECT
                        CASE
                            WHEN jsonb_typeof(genre_item) = 'object'
                                THEN COALESCE(genre_item->>'name', genre_item->>'tag', genre_item->>'title')
                            WHEN jsonb_typeof(genre_item) = 'string'
                                THEN trim(both '"' from genre_item::text)
                            ELSE NULL
                        END AS genre,
                        ch.library_id,
                        ch.library_name
                    FROM classification_history ch
                    CROSS JOIN LATERAL jsonb_array_elements(
                        CASE
                            WHEN jsonb_typeof(ch.metadata->'genres') = 'array'
                                THEN ch.metadata->'genres'
                            ELSE '[]'::jsonb
                        END
                    ) AS genre_item
                    WHERE ch.library_id IS NOT NULL
                    AND ch.metadata->'genres' IS NOT NULL
                )
                SELECT
                    genre,
                    library_id,
                    library_name,
                    COUNT(*) as support_count,
                    COUNT(*) * 100.0 / NULLIF((
                        SELECT COUNT(*)
                        FROM classification_history ch2
                        WHERE ch2.library_id = normalized_genres.library_id
                    ), 0) as confidence
                FROM normalized_genres
                WHERE genre IS NOT NULL
                GROUP BY genre, library_id, library_name
                HAVING COUNT(*) >= 5
                AND COUNT(*) * 100.0 / NULLIF((
                    SELECT COUNT(*)
                    FROM classification_history ch2
                    WHERE ch2.library_id = normalized_genres.library_id
                ), 0) >= 60.0
            `);

            let discovered = 0;
            for (const row of result.rows) {
                try {
                    const genreName = this.extractPatternValue(row.genre);
                    if (!genreName) {
                        continue;
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

    async upsertPattern(patternType, patternValue, libraryId, libraryName, confidence, supportCount) {
        try {
            if (!libraryName) {
                const libraryResult = await db.query('SELECT name FROM libraries WHERE id = $1', [libraryId]);
                if (libraryResult.rows.length > 0) {
                    libraryName = libraryResult.rows[0].name;
                } else {
                    logger.debug('Skipping pattern - library name not found', { patternType, patternValue, libraryId });
                    return null;
                }
            }

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

            if (result.rows[0] && confidence >= 85) {
                await this.autoApprovePattern(result.rows[0].id);
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to upsert pattern', { error: error.message, patternType, patternValue });
            throw error;
        }
    }

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

    async decayStalePatterns(daysSinceLastSeen = 90) {
        try {
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

            return result.rows.map((row) => ({
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

export default new PatternMiningService();
