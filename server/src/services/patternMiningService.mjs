import * as db from '../config/database.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { embeddingRouter } from './embeddingRouter.mjs';
import { createLogger } from '../utils/logger.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';
import { ragLogger } from '../utils/ragLogger.mjs';
import {
    extractPatternValue as _extractPatternValue,
    discoverStudioPatterns as _discoverStudioPatterns,
    discoverFranchisePatterns as _discoverFranchisePatterns,
    discoverGenrePatterns as _discoverGenrePatterns,
    discoverCertificationPatterns as _discoverCertificationPatterns,
} from './patternMiningDiscovery.mjs';

const logger = createLogger('PatternMining');

class PatternMiningService {
    extractPatternValue(rawValue) {
        return _extractPatternValue(rawValue);
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

            const upsert = (...args) => this.upsertPattern(...args);
            const extract = (...args) => this.extractPatternValue(...args);

            const results = {
                studio: await _discoverStudioPatterns(db, logger, extract, upsert),
                franchise: await _discoverFranchisePatterns(db, logger, upsert),
                genre: await _discoverGenrePatterns(db, logger, extract, upsert),
                certification: await _discoverCertificationPatterns(db, logger, upsert)
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
            throw error;
        }
    }

    async discoverStudioPatterns() {
        return _discoverStudioPatterns(db, logger, (...args) => this.extractPatternValue(...args), (...args) => this.upsertPattern(...args));
    }

    async discoverFranchisePatterns() {
        return _discoverFranchisePatterns(db, logger, (...args) => this.upsertPattern(...args));
    }

    async discoverGenrePatterns() {
        return _discoverGenrePatterns(db, logger, (...args) => this.extractPatternValue(...args), (...args) => this.upsertPattern(...args));
    }

    async discoverCertificationPatterns() {
        return _discoverCertificationPatterns(db, logger, (...args) => this.upsertPattern(...args));
    }

    async upsertPattern(patternType, patternValue, libraryId, libraryName, confidence, supportCount) {
        return withServiceCatch(logger, 'Failed to upsert pattern', { patternType, patternValue }, async () => {
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
        });
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
                throw new ValidationError('Invalid daysSinceLastSeen parameter');
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

export const patternMiningService = new PatternMiningService();
