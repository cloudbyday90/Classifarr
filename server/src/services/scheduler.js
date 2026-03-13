/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * 
 * Scheduler Service
 * Handles periodic background tasks
 */

const cron = require('node-cron');
const db = require('../config/database');
const { withSessionAdvisoryLock, DB_ADVISORY_LOCKS } = require('../config/database');
const { createLogger } = require('../utils/logger');
const queueService = require('./queueService');
const mediaSyncService = require('./mediaSync');
const classificationService = require('./classification');

const logger = createLogger('SchedulerService');

// Number of days after which an awaiting_decision row is considered stale.
// Matches the filter applied in GET /api/classification/pending/count.
const STALE_AWAITING_DECISION_DAYS = 7;

class SchedulerService {
    constructor() {
        this.tasks = new Map();
    }

    /**
     * Initialize scheduled tasks
     */
    init() {
        logger.info('Initializing scheduler...');

        // Run gap analysis every hour
        // This finds items that haven't been analyzed and queues them
        // Advisory lock: prevents two processes from running gap analysis in parallel
        // during a rolling restart overlap window.
        this.schedule('gap-analysis', '*/5 * * * *', () => this.runGapAnalysis(), DB_ADVISORY_LOCKS.GAP_ANALYSIS); // Every 5 minutes

        // Also run on startup after a delay
        setTimeout(() => this.runGapAnalysis(), 30000); // 30s delay

        // Run library watchdog every 5 minutes to catch empty libraries
        // No advisory lock: single-query, idempotent, harmless to run twice
        this.schedule('library-watchdog', '*/5 * * * *', () => this.runLibraryWatchdog());

        // Run watchdog shortly after startup
        setTimeout(() => this.runLibraryWatchdog(), 5000);

        // DISABLED: Auto-learn rules - feature removed as it creates duplicates
        // and makes assumptions that don't work for diverse library naming conventions.
        // Users should manage classification behavior via Policies, Presets, and Tuning.
        // this.schedule('auto-learn-rules', '*/30 * * * *', () => this.runAutoLearnRules());
        // setTimeout(() => this.runAutoLearnRules(), 120000);


        // Periodic library sync every 6 hours to keep Plex data fresh
        // This ensures TMDB IDs and other metadata stay up-to-date
        this.schedule('library-sync', '0 */6 * * *', () => this.runPeriodicLibrarySync(), DB_ADVISORY_LOCKS.LIBRARY_SYNC);

        // Also run initial sync after startup (2 min delay)
        setTimeout(() => this.runPeriodicLibrarySync(), 120000);

        // Process retry queue every 5 minutes for AI-unavailable retries
        this.schedule('retry-queue', '*/5 * * * *', () => this.processRetryQueue(), DB_ADVISORY_LOCKS.RETRY_QUEUE);

        // Also run initial retry queue check after startup (1 min delay)
        setTimeout(() => this.processRetryQueue(), 60000);

        // Process enrichment retry queue every 6 hours as safety net for OMDb and Tavily
        // Tavily monthly-quota deferred items remain pending and are automatically retried after month reset.
        this.schedule('enrichment-retry-queue', '0 */6 * * *', () => this.processEnrichmentRetryQueue(), DB_ADVISORY_LOCKS.ENRICHMENT_RETRY_QUEUE);

        // Daily rating normalization check at 3 AM
        this.schedule('rating-normalization-check', '0 3 * * *', () => this.runRatingNormalizationCheck(), DB_ADVISORY_LOCKS.RATING_NORMALIZATION_CHECK);

        // Daily cleanup of expired refresh tokens (3:05 AM — 5 min offset from rating normalization)
        // No advisory lock: idempotent batch DELETE, safe to run twice
        this.schedule('refresh-token-cleanup', '5 3 * * *', () => this.runRefreshTokenCleanup());

        // Daily pruning of old api_key_audit rows (3:10 AM)
        // No advisory lock: idempotent batch DELETE, safe to run twice
        this.schedule('api-key-audit-prune', '10 3 * * *', () => this.runApiKeyAuditPrune());

        // Daily cleanup of stale awaiting_decision rows (4 AM)
        // Re-queues items stuck waiting for Discord responses for more than 7 days
        this.schedule('stale-awaiting-cleanup', '0 4 * * *', () => this.cleanupStaleAwaitingDecisions(), DB_ADVISORY_LOCKS.STALE_CLEANUP);

        // Daily cleanup of old completed/failed task_queue rows (3:15 AM)
        // Prevents unbounded table growth that can cause OOM crashes
        // No advisory lock: idempotent batch DELETE, safe to run twice
        this.schedule('task-queue-cleanup', '15 3 * * *', () => this.runTaskQueueCleanup());

        // Run initial task_queue cleanup after startup (5 min delay) to catch any backlog
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
            
            const ratingNormalizer = require('../utils/ratingNormalizer');
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
     * Batch-deletes up to 1000 rows per run to avoid long lock holds.
     * Controlled by REFRESH_TOKEN_CLEANUP_ENABLED env var (default: true).
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
     * Batch-deletes up to 1000 rows per run.
     * Controlled by API_AUDIT_RETENTION_DAYS env var (default: 90).
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
     * Daily cleanup of old completed and failed task_queue rows.
     * Prevents unbounded table growth that can cause OOM crashes.
     *
     * Two complementary deletion strategies run in sequence:
     *   1. Age-based  — delete rows older than TASK_QUEUE_RETENTION_DAYS (default 7).
     *      Uses idx_task_queue_cleanup for O(log n) access.
     *   2. Count-based — if total completed/failed/cancelled rows still exceed
     *      TASK_QUEUE_MAX_TOTAL_ROWS (default 50 000) after the age pass, trim
     *      the oldest rows down to that cap. Prevents slow INSERT/index-maintenance
     *      on high-volume instances where all rows fall within the retention window.
     *
     * Controlled by:
     *   TASK_QUEUE_RETENTION_DAYS  (default 7)
     *   TASK_QUEUE_MAX_TOTAL_ROWS  (default 50 000)
     */
    async runTaskQueueCleanup() {
        const parsed = parseInt(process.env.TASK_QUEUE_RETENTION_DAYS, 10);
        const retentionDays = Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
        const MAX_TOTAL_ROWS = parseInt(process.env.TASK_QUEUE_MAX_TOTAL_ROWS, 10) || 50000;
        const BATCH = 5000;
        let totalDeleted = 0;
        let batchDeleted;
        try {
            // ── 1. Age-based drain ───────────────────────────────────────────────
            // Loop until all stale rows have been removed so a single scheduler
            // run fully clears any backlog rather than making partial progress.
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

            // ── 2. Count-based cap ──────────────────────────────────────────────
            // Check total after the age pass; trim oldest rows if still over cap.
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
                // Refresh query planner statistics after bulk delete.  VACUUM ANALYZE is safe
                // here because db.query() uses pool autocommit (not inside a transaction block).
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
     * Rows older than STALE_AWAITING_DECISION_DAYS days are reset to 'pending' and
     * re-queued for classification so the Command Center badge stays accurate.
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
     *   When provided, the job is wrapped with withSessionAdvisoryLock() so only
     *   one process runs the job at a time — preventing double-execution during
     *   rolling restarts where two containers briefly overlap.
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
     * NOTE: Items in Plex libraries are for LEARNING, not classification.
     * Gap analysis enriches metadata to help AI suggestions, not to route content.
     */
    async runGapAnalysis() {
        try {
            // Delegate to QueueService which now holds the logic
            // This allows triggering from both scheduler and API (manual ingestion)
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
            // Single query returns active libraries that are empty AND have no running sync,
            // replacing the previous 2N round-trips (COUNT per library + sync-status per library).
            // NOT EXISTS short-circuits on the first matching row, avoiding full table scans.
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
                // Run in background, don't await completion here
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
     * Runs automatically when libraries have 50+ items but no rules
     */
    async runAutoLearnRules() {
        try {
            // Find libraries with 50+ items but no rules
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

                    // Analyze library content patterns
                    const analysis = await db.query(`
                        SELECT 
                            array_agg(DISTINCT content_rating) FILTER (WHERE content_rating IS NOT NULL) as ratings,
                            array_agg(DISTINCT g) FILTER (WHERE g IS NOT NULL) as genres,
                            array_agg(DISTINCT msi.metadata->>'original_language') FILTER (WHERE msi.metadata->>'original_language' IS NOT NULL) as languages
                        FROM media_server_items msi
                            LEFT JOIN LATERAL UNNEST(msi.genres) as g ON true
                        WHERE msi.library_id = $1
                    `, [library.id]);

                    // Analyze keyword patterns
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

                    // Collect all candidate rules in memory, then bulk-insert in one round-trip
                    // using UNNEST. Previously each rule was a separate INSERT (up to 6+ queries
                    // per library). ON CONFLICT DO NOTHING semantics are preserved.
                    const rulesToInsert = [];

                    // Rating rule: if library has a consistent, narrow rating set
                    if (data.ratings && data.ratings.length > 0 && data.ratings.length <= 5) {
                        rulesToInsert.push({
                            rule_type: 'rating',
                            operator: 'includes',
                            value: data.ratings.join(','),
                            description: `Auto: Ratings ${data.ratings.join(', ')}`
                        });
                    }

                    // Genre rule: if dominant genres exist
                    if (data.genres && data.genres.length > 0 && data.genres.length <= 10) {
                        const topGenres = data.genres.slice(0, 5);
                        rulesToInsert.push({
                            rule_type: 'genre',
                            operator: 'includes',
                            value: topGenres.join(','),
                            description: `Auto: Genres ${topGenres.join(', ')}`
                        });
                    }

                    // Language rule: if non-English dominant
                    if (data.languages && data.languages.length === 1 && data.languages[0] !== 'en') {
                        rulesToInsert.push({
                            rule_type: 'language',
                            operator: 'equals',
                            value: data.languages[0],
                            description: `Auto: Language ${data.languages[0]}`
                        });
                    }

                    // Keyword rules
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

                    // Anime detection
                    const libraryName = library.name.toLowerCase();
                    const hasAnimeGenre = data.genres && (
                        data.genres.includes('Animation') ||
                        data.genres.includes('Anime') ||
                        data.genres.some(g => g && g.toLowerCase().includes('anime'))
                    );
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

                    // Bulk-insert all rules for this library in a single round-trip.
                    // UNNEST expands parallel arrays into rows; the scalar $1 is broadcast
                    // to every generated row via the SELECT projection.
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
     * Runs every 5 minutes to retry pending classifications
     */
    async processRetryQueue() {
        try {
            // Find items that are ready for retry
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
     * Runs every 10 minutes as a safety net, but also triggered on-demand
     * when items are queued (see enrichmentRetryService.scheduleProcessing)
     */
    async processEnrichmentRetryQueue() {
        try {
            const enrichmentRetryService = require('./enrichmentRetryService');
            await enrichmentRetryService.triggerProcessing();
        } catch (error) {
            logger.error('Error in enrichment retry queue processing', {
                error: error.message,
                stack: error.stack,
            });
        }
    }
}

module.exports = new SchedulerService();
