/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import cron from 'node-cron';
import db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';
import ratingNormalizer from '../utils/ratingNormalizer.mjs';
import mediaSyncService from './mediaSync.mjs';
import classificationService from './classification.mjs';
import queueService from './queueService.mjs';
import { STALE_AWAITING_DECISION_DAYS } from '../constants/classificationFlow.mjs';

const { withSessionAdvisoryLock, DB_ADVISORY_LOCKS } = db;
const logger = createLogger('SchedulerService');
const DEFAULT_TASK_QUEUE_MAX_TOTAL_ROWS = 10000;

class SchedulerService {
    constructor() {
        this.tasks = new Map();
        this.ratingNormalizer = ratingNormalizer;
    }

    async loadRatingNormalizer() {
        return { default: this.ratingNormalizer };
    }

    /**
     * Initialize scheduled tasks
     */
    init() {
        logger.info('Initializing scheduler...');

        this.schedule('gap-analysis', '*/5 * * * *', () => this.runGapAnalysis(), DB_ADVISORY_LOCKS.GAP_ANALYSIS);

        setTimeout(() => this.runGapAnalysis(), 30000);

        this.schedule('library-watchdog', '*/5 * * * *', () => this.runLibraryWatchdog());

        setTimeout(() => this.runLibraryWatchdog(), 5000);

        // DISABLED: Auto-learn rules - feature removed as it creates duplicates
        // and makes assumptions that don't work for diverse library naming conventions.
        // Users should manage classification behavior via Policies, Presets, and Tuning.
        // this.schedule('auto-learn-rules', '*/30 * * * *', () => this.runAutoLearnRules());
        // setTimeout(() => this.runAutoLearnRules(), 120000);


        // Periodic library sync every 6 hours to keep Plex data fresh
        this.schedule('library-sync', '0 */6 * * *', () => this.runPeriodicLibrarySync(), DB_ADVISORY_LOCKS.LIBRARY_SYNC);

        setTimeout(() => this.runPeriodicLibrarySync(), 120000);

        // Process retry queue every 5 minutes for AI-unavailable retries
        this.schedule('retry-queue', '*/5 * * * *', () => this.processRetryQueue(), DB_ADVISORY_LOCKS.RETRY_QUEUE);

        setTimeout(() => this.processRetryQueue(), 60000);

        // Process enrichment retry queue every 6 hours as safety net for OMDb and Tavily
        this.schedule('enrichment-retry-queue', '0 */6 * * *', () => this.processEnrichmentRetryQueue(), DB_ADVISORY_LOCKS.ENRICHMENT_RETRY_QUEUE);

        // Daily rating normalization check at 3 AM
        this.schedule('rating-normalization-check', '0 3 * * *', () => this.runRatingNormalizationCheck(), DB_ADVISORY_LOCKS.RATING_NORMALIZATION_CHECK);

        // Daily cleanup of expired refresh tokens (3:05 AM)
        this.schedule('refresh-token-cleanup', '5 3 * * *', () => this.runRefreshTokenCleanup());

        // Daily pruning of old api_key_audit rows (3:10 AM)
        this.schedule('api-key-audit-prune', '10 3 * * *', () => this.runApiKeyAuditPrune());

        // Daily pruning of old error_log rows (3:12 AM)
        this.schedule('error-log-cleanup', '12 3 * * *', () => this.runErrorLogCleanup());

        // Daily cleanup of stale awaiting_decision rows (4 AM)
        this.schedule('stale-awaiting-cleanup', '0 4 * * *', () => this.cleanupStaleAwaitingDecisions(), DB_ADVISORY_LOCKS.STALE_CLEANUP);

        // Daily cleanup of old completed/failed task_queue rows (3:15 AM)
        this.schedule('task-queue-cleanup', '15 3 * * *', () => this.runTaskQueueCleanup());

        // Run initial task_queue cleanup after startup (5 min delay)
        setTimeout(() => this.runTaskQueueCleanup(), 300000);
    }

    /**
     * Sync all active libraries from media server
     */
    async runPeriodicLibrarySync() {
        try {
            const libraries = await db.query('SELECT id, name FROM libraries WHERE is_active = true');

            if (libraries.rows.length === 0) {
                logger.debug('Periodic sync: No active libraries to sync');
                return;
            }

            logger.info(`Periodic sync: Syncing ${libraries.rows.length} libraries`);

            for (const library of libraries.rows) {
                try {
                    await mediaSyncService.syncLibrary(library.id);
                    logger.info(`Periodic sync: Completed ${library.name}`);
                } catch (libError) {
                    logger.warn(`Periodic sync: Failed ${library.name}`, { error: libError.message });
                }
            }
        } catch (error) {
            logger.error('Error running periodic library sync', { error: error.message });
        }
    }

    /**
     * Check for items needing rating normalization and queue them
     */
    async runRatingNormalizationCheck() {
        try {
            logger.info('Running daily rating normalization check');
            
            const { default: ratingNormalizer } = await this.loadRatingNormalizer();
            const needsSQL = ratingNormalizer.getNeedsNormalizationSQL();
            
            const result = await db.query(`
                SELECT COUNT(*) as count FROM media_server_items
                WHERE original_rating IS NULL
                  AND content_rating IS NOT NULL
                  AND ${needsSQL}
            `);
            
            const count = parseInt(result.rows[0].count);
            
            if (count > 0) {
                logger.info(`Auto-queuing ${count} items for normalization`);
                
                await db.query(`
                    INSERT INTO task_queue (task_type, priority, payload, status)
                    SELECT 'rating_normalization', 5, jsonb_build_object('media_item_id', id), 'pending'
                    FROM media_server_items
                    WHERE original_rating IS NULL
                      AND content_rating IS NOT NULL
                      AND ${needsSQL}
                    ON CONFLICT (task_type, (payload->>'media_item_id')) WHERE status IN ('pending', 'processing') DO NOTHING
                `);
            }
        } catch (error) {
            logger.error('Daily normalization check failed', { error: error.message });
        }
    }

    /**
     * Daily cleanup of expired and long-revoked refresh tokens.
     */
    async runRefreshTokenCleanup() {
        if (process.env.REFRESH_TOKEN_CLEANUP_ENABLED === 'false') return;
        try {
            const result = await db.query(
                `DELETE FROM refresh_tokens
                 WHERE id IN (
                     SELECT id FROM refresh_tokens
                     WHERE expires_at < NOW() OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')
                     LIMIT 1000
                 )`
            );
            logger.info('Refresh token cleanup complete', { deleted: result.rowCount });
        } catch (error) {
            logger.error('Refresh token cleanup failed', { error: error.message });
        }
    }

    /**
     * Daily pruning of old api_key_audit rows older than the configured retention window.
     */
    async runApiKeyAuditPrune() {
        const parsedRetentionDays = parseInt(process.env.API_AUDIT_RETENTION_DAYS, 10);
        const retentionDays = Number.isFinite(parsedRetentionDays) ? parsedRetentionDays : 90;
        try {
            const result = await db.query(
                `DELETE FROM api_key_audit
                 WHERE id IN (
                     SELECT id FROM api_key_audit
                     WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
                     LIMIT 1000
                 )`,
                [retentionDays]
            );
            logger.info('API key audit prune complete', { deleted: result.rowCount, retentionDays });
        } catch (error) {
            logger.error('API key audit prune failed', { error: error.message });
        }
    }

    /**
     * Daily cleanup of old error_log rows using settings.error_log_retention_days.
     */
    async runErrorLogCleanup() {
        const BATCH_SIZE = 1000;

        try {
            const settingsResult = await db.query(
                `SELECT value
                 FROM settings
                 WHERE key = 'error_log_retention_days'
                 LIMIT 1`
            );

            const configuredValue = settingsResult.rows[0]?.value;
            const parsedRetentionDays = parseInt(configuredValue, 10);
            const retentionDays = Number.isFinite(parsedRetentionDays) && parsedRetentionDays > 0
                ? parsedRetentionDays
                : 30;

            let totalDeleted = 0;
            let deletedInBatch = 0;

            do {
                const result = await db.query(
                    `DELETE FROM error_log
                     WHERE id IN (
                         SELECT id FROM error_log
                         WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
                         LIMIT $2
                     )`,
                    [retentionDays, BATCH_SIZE]
                );

                deletedInBatch = result.rowCount;
                totalDeleted += deletedInBatch;
            } while (deletedInBatch === BATCH_SIZE);

            if (totalDeleted > 0) {
                logger.info('Error log cleanup complete', { deleted: totalDeleted, retentionDays });
            } else {
                logger.debug('Error log cleanup: no rows to delete', { retentionDays });
            }
        } catch (error) {
            logger.error('Error log cleanup failed', { error: error.message });
        }
    }

    /**
     * Daily cleanup of old completed and failed task_queue rows.
     */
    async runTaskQueueCleanup() {
        const parsed = parseInt(process.env.TASK_QUEUE_RETENTION_DAYS, 10);
        const retentionDays = Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
        const MAX_TOTAL_ROWS = parseInt(process.env.TASK_QUEUE_MAX_TOTAL_ROWS, 10) || DEFAULT_TASK_QUEUE_MAX_TOTAL_ROWS;
        const BATCH = 5000;
        let totalDeleted = 0;
        let batchDeleted;
        try {
            do {
                const result = await db.query(
                    `DELETE FROM task_queue
                     WHERE id IN (
                         SELECT id FROM task_queue
                         WHERE status IN ('completed', 'failed', 'cancelled')
                           AND created_at < NOW() - ($1 || ' days')::INTERVAL
                         LIMIT $2
                     )`,
                    [retentionDays, BATCH]
                );
                batchDeleted = result.rowCount;
                totalDeleted += batchDeleted;
            } while (batchDeleted === BATCH);

            const countResult = await db.query(
                `SELECT COUNT(*) AS n FROM task_queue
                 WHERE status IN ('completed', 'failed', 'cancelled')`
            );
            const remaining = parseInt(countResult.rows[0].n) || 0;
            if (remaining > MAX_TOTAL_ROWS) {
                const excess = remaining - MAX_TOTAL_ROWS;
                logger.warn('task_queue count cap exceeded during scheduled cleanup; trimming oldest rows', {
                    remaining,
                    maxTotalRows: MAX_TOTAL_ROWS,
                    toDelete: excess
                });
                let countDeleted = 0;
                do {
                    const batchSize = Math.min(BATCH, excess - countDeleted);
                    if (batchSize <= 0) break;
                    const result = await db.query(
                        `DELETE FROM task_queue
                         WHERE id IN (
                             SELECT id FROM task_queue
                             WHERE status IN ('completed', 'failed', 'cancelled')
                             ORDER BY created_at ASC
                             LIMIT $1
                         )`,
                        [batchSize]
                    );
                    batchDeleted = result.rowCount;
                    countDeleted += batchDeleted;
                    totalDeleted += batchDeleted;
                } while (batchDeleted > 0 && countDeleted < excess);
            }

            if (totalDeleted > 0) {
                logger.info('Task queue cleanup complete', { deleted: totalDeleted, retentionDays });
                try {
                    await db.query('VACUUM ANALYZE task_queue');
                    logger.info('task_queue VACUUM ANALYZE complete after scheduled cleanup');
                } catch (vacuumErr) {
                    logger.warn('task_queue VACUUM ANALYZE failed after scheduled cleanup (non-fatal)', {
                        error: vacuumErr.message
                    });
                }
            } else {
                logger.debug('Task queue cleanup: no rows to delete', { retentionDays, maxTotalRows: MAX_TOTAL_ROWS });
            }
        } catch (error) {
            logger.error('Task queue cleanup failed', { error: error.message });
        }
    }

    /**
     * Daily cleanup of stale awaiting_decision classification rows.
     */
    async cleanupStaleAwaitingDecisions() {
        try {
            const result = await db.query(`
                UPDATE classification_history
                SET status = 'pending',
                    pending_reason = 'Re-queued after stale awaiting_decision (>7 days)'
                WHERE status = 'awaiting_decision'
                  AND created_at < NOW() - ($1 || ' days')::INTERVAL
                RETURNING id, title, tmdb_id, media_type
            `, [STALE_AWAITING_DECISION_DAYS]);

            if (result.rowCount === 0) return;

            logger.info('Stale awaiting_decision cleanup: reset rows', { count: result.rowCount });

            for (const row of result.rows) {
                try {
                    await db.query(
                        `INSERT INTO task_queue (task_type, priority, payload, status)
                         VALUES ('classification', 5, $1::jsonb, 'pending')
                         ON CONFLICT DO NOTHING`,
                        [JSON.stringify({
                            tmdb_id: row.tmdb_id,
                            media_type: row.media_type,
                            title: row.title,
                            source: 'stale_cleanup'
                        })]
                    );
                } catch (queueErr) {
                    logger.warn('Stale cleanup: failed to re-queue item', { id: row.id, error: queueErr.message });
                }
            }
        } catch (error) {
            logger.error('Stale awaiting_decision cleanup failed', { error: error.message });
        }
    }

    /**
     * @param {string} name - Task name
     * @param {string} cronExpression - Cron expression
     * @param {Function} handler - Task handler
     * @param {number|null} [lockKey=null] - Optional DB_ADVISORY_LOCKS key.
     */
    schedule(name, cronExpression, handler, lockKey = null) {
        if (this.tasks.has(name)) {
            this.tasks.get(name).stop();
        }

        const task = cron.schedule(cronExpression, async () => {
            logger.info(`Starting scheduled task: ${name}`);
            try {
                if (lockKey !== null) {
                    const acquired = await withSessionAdvisoryLock(lockKey, handler);
                    if (!acquired) {
                        logger.debug(`Scheduled task ${name} skipped — advisory lock held by another process`, { lockKey });
                        return;
                    }
                } else {
                    await handler();
                }
                logger.info(`Completed scheduled task: ${name}`);
            } catch (error) {
                logger.error(`Failed scheduled task: ${name}`, { error: error.message });
            }
        });

        this.tasks.set(name, task);
        logger.info(`Scheduled task registered: ${name} (${cronExpression})`);
    }

    /**
     * Run Gap Analysis specifically
     */
    async runGapAnalysis() {
        try {
            await queueService.refillQueue();
        } catch (error) {
            logger.error('Error running gap analysis', { error: error.message });
        }
    }

    /**
     * Check for empty libraries and trigger sync
     */
    async runLibraryWatchdog() {
        try {
            const result = await db.query(`
                SELECT l.id, l.name
                FROM libraries l
                WHERE l.is_active = true
                  AND NOT EXISTS (
                      SELECT 1 FROM media_server_items msi WHERE msi.library_id = l.id
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM media_server_sync_status ss
                       WHERE ss.library_id = l.id AND ss.status = 'running'
                  )
            `);

            for (const library of result.rows) {
                logger.info(`Watchdog: Library ${library.name} (${library.id}) is empty. Triggering auto-sync...`);
                mediaSyncService.syncLibrary(library.id).catch(err => {
                    logger.error(`Watchdog: Auto-sync failed for ${library.name}`, { error: err.message });
                });
            }
        } catch (error) {
            logger.error('Error running library watchdog', { error: error.message });
        }
    }

    /**
     * Auto-learn rules for libraries with enough analyzed content
     */
    async runAutoLearnRules() {
        try {
            const result = await db.query(`
                SELECT l.id, l.name, l.media_type, COUNT(msi.id) as item_count
                FROM libraries l
                LEFT JOIN media_server_items msi ON l.id = msi.library_id
                LEFT JOIN library_rules lr ON l.id = lr.library_id
                WHERE l.is_active = true
                GROUP BY l.id, l.name, l.media_type
                HAVING COUNT(msi.id) >= 50 AND COUNT(lr.id) = 0
            `);

            if (result.rows.length === 0) {
                logger.debug('Auto-learn: No libraries need rule learning');
                return;
            }

            logger.info(`Auto-learn: Found ${result.rows.length} libraries ready for rule learning`);

            for (const library of result.rows) {
                try {
                    logger.info(`Auto-learn: Learning rules for library "${library.name}" (${library.item_count} items)`);

                    const analysis = await db.query(`
                        SELECT 
                            array_agg(DISTINCT content_rating) FILTER (WHERE content_rating IS NOT NULL) as ratings,
                            array_agg(DISTINCT g) FILTER (WHERE g IS NOT NULL) as genres,
                            array_agg(DISTINCT msi.metadata->>'original_language') FILTER (WHERE msi.metadata->>'original_language' IS NOT NULL) as languages
                        FROM media_server_items msi
                            LEFT JOIN LATERAL UNNEST(msi.genres) as g ON true
                        WHERE msi.library_id = $1
                    `, [library.id]);

                    const keywordAnalysis = await db.query(`
                        SELECT 
                            COUNT(*) FILTER (WHERE LOWER(title) LIKE '%christmas%' OR LOWER(title) LIKE '%xmas%') as christmas_count,
                            COUNT(*) FILTER (WHERE LOWER(title) LIKE '%holiday%') as holiday_count,
                            COUNT(*) FILTER (WHERE LOWER(title) LIKE '%hallmark%' OR LOWER(msi.studio) LIKE '%hallmark%') as hallmark_count,
                            COUNT(*) as total
                        FROM media_server_items msi
                        WHERE msi.library_id = $1
                    `, [library.id]);

                    const data = analysis.rows[0];
                    const kw = keywordAnalysis.rows[0];
                    const total = parseInt(kw.total) || 1;

                    const rulesToInsert = [];

                    if (data.ratings && data.ratings.length > 0 && data.ratings.length <= 5) {
                        rulesToInsert.push({
                            rule_type: 'rating',
                            operator: 'includes',
                            value: data.ratings.join(','),
                            description: `Auto: Ratings ${data.ratings.join(', ')}`
                        });
                    }

                    if (data.genres && data.genres.length > 0 && data.genres.length <= 10) {
                        const topGenres = data.genres.slice(0, 5);
                        rulesToInsert.push({
                            rule_type: 'genre',
                            operator: 'includes',
                            value: topGenres.join(','),
                            description: `Auto: Genres ${topGenres.join(', ')}`
                        });
                    }

                    if (data.languages && data.languages.length === 1 && data.languages[0] !== 'en') {
                        rulesToInsert.push({
                            rule_type: 'language',
                            operator: 'equals',
                            value: data.languages[0],
                            description: `Auto: Language ${data.languages[0]}`
                        });
                    }

                    const christmasRatio = parseInt(kw.christmas_count) / total;
                    const holidayRatio = parseInt(kw.holiday_count) / total;
                    const hallmarkRatio = parseInt(kw.hallmark_count) / total;

                    if (christmasRatio >= 0.3) {
                        rulesToInsert.push({
                            rule_type: 'keyword',
                            operator: 'contains',
                            value: 'christmas,xmas,holiday,santa,snowman,elf',
                            description: 'Auto: Christmas Content'
                        });
                    } else if (holidayRatio >= 0.3) {
                        rulesToInsert.push({
                            rule_type: 'keyword',
                            operator: 'contains',
                            value: 'holiday,christmas,seasonal',
                            description: 'Auto: Holiday Content'
                        });
                    }

                    if (hallmarkRatio >= 0.3) {
                        rulesToInsert.push({
                            rule_type: 'keyword',
                            operator: 'contains',
                            value: 'hallmark',
                            description: 'Auto: Hallmark Productions'
                        });
                    }

                    const libraryName = library.name.toLowerCase();
                    const normalizedGenres = normalizeMetadataListLower(data.genres);
                    const hasAnimeGenre = normalizedGenres.includes('animation') ||
                        normalizedGenres.includes('anime') ||
                        normalizedGenres.some(g => g.includes('anime'));
                    const isJapanese = data.languages && data.languages.includes('ja');
                    const libraryIsAnime = libraryName.includes('anime');

                    if ((hasAnimeGenre && isJapanese) || (hasAnimeGenre && libraryIsAnime)) {
                        rulesToInsert.push({
                            rule_type: 'language',
                            operator: 'equals',
                            value: 'ja',
                            description: 'Auto: Japanese Anime Content'
                        });
                        rulesToInsert.push({
                            rule_type: 'genre',
                            operator: 'includes',
                            value: 'Animation,Anime',
                            description: 'Auto: Anime/Animation'
                        });
                    }

                    const rulesCreated = rulesToInsert.length;
                    if (rulesCreated > 0) {
                        await db.query(`
                            INSERT INTO library_rules
                                (library_id, rule_type, operator, value, description, is_exception, is_active, priority)
                            SELECT $1,
                                   UNNEST($2::text[]),
                                   UNNEST($3::text[]),
                                   UNNEST($4::text[]),
                                   UNNEST($5::text[]),
                                   false, true, 10
                            ON CONFLICT DO NOTHING
                        `, [
                            library.id,
                            rulesToInsert.map(r => r.rule_type),
                            rulesToInsert.map(r => r.operator),
                            rulesToInsert.map(r => r.value),
                            rulesToInsert.map(r => r.description)
                        ]);
                    }

                    logger.info(`Auto-learn: Created ${rulesCreated} rules for "${library.name}"`);
                } catch (libError) {
                    logger.error(`Auto-learn: Failed to learn rules for ${library.name}`, { error: libError.message });
                }
            }
        } catch (error) {
            logger.error('Error running auto-learn rules', { error: error.message });
        }
    }

    /**
     * Process retry queue for classifications that failed due to AI unavailability
     */
    async processRetryQueue() {
        try {
            const result = await db.query(`
                SELECT id, title, retry_count, max_retries
                FROM classification_history
                WHERE status = 'pending_retry'
                  AND retry_after <= NOW()
                  AND retry_count < max_retries
                ORDER BY retry_after ASC
                LIMIT 50
            `);

            if (result.rows.length === 0) {
                logger.debug('Retry queue: No items ready for retry');
                return;
            }

            logger.info(`Retry queue: Processing ${result.rows.length} items`);

            for (const item of result.rows) {
                try {
                    await classificationService.retryClassification(item.id);
                } catch (itemError) {
                    logger.error(`Retry queue: Failed to retry classification ${item.id}`, {
                        error: itemError.message,
                        title: item.title,
                    });
                }
            }

            logger.info(`Retry queue: Completed processing ${result.rows.length} items`);
        } catch (error) {
            logger.error('Error processing retry queue', {
                error: error.message,
                stack: error.stack,
            });
        }
    }

    /**
     * Process enrichment retry queue for OMDb/Tavily enrichment failures
     */
    async processEnrichmentRetryQueue() {
        try {
            const enrichmentRetryServiceModule = await import('./enrichmentRetryService.mjs');
            const enrichmentRetryService = enrichmentRetryServiceModule.default || enrichmentRetryServiceModule;
            await enrichmentRetryService.triggerProcessing();
        } catch (error) {
            logger.error('Error in enrichment retry queue processing', {
                error: error.message,
                stack: error.stack,
            });
        }
    }
}

export default new SchedulerService();
