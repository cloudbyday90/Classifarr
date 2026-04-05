/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Scheduler service for periodic tasks
 */

const db = require('../config/database');
const embeddingService = require('./embeddingService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('SchedulerService');

class SchedulerService {
    constructor() {
        this.isRunning = false;
        this.pollInterval = null;
        this.checkIntervalMs = 60000; // Check every minute
    }

    async start() {
        if (this.isRunning) {
            logger.info('Scheduler already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting scheduler service');

        // Check immediately on start
        await this.checkDueTasks();

        // Auto-backfill enrichment retry queue on startup
        // This queues any items missing OMDb data for Tavily fallback
        try {
            const enrichmentRetryService = require('./enrichmentRetryService');
            const backfillResult = await enrichmentRetryService.backfillRetryQueue();
            if (backfillResult.queued > 0) {
                logger.info('Enrichment retry queue backfill complete', { queued: backfillResult.queued });
            }
        } catch (err) {
            // Table may not exist yet on first run before migration
            logger.debug('Enrichment retry queue backfill skipped', { error: err.message });
        }

        // Seed built-in recurring tasks (idempotent — guarded by SELECT before INSERT)
        try {
            await this.ensureDefaultTasks();
        } catch (err) {
            // scheduled_tasks table may not exist yet on first boot before migrations apply
            logger.debug('Could not seed default tasks', { error: err.message });
        }

        // Then poll periodically
        this.pollInterval = setInterval(() => this.checkDueTasks(), this.checkIntervalMs);
    }

    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.isRunning = false;
        logger.info('Scheduler service stopped');
    }

    async checkDueTasks() {
        try {
            const dueTasks = await this.getDueTasks();

            for (const task of dueTasks) {
                await this.executeTask(task);
            }



            // Check for RAG embedding backfill
            await this.checkRagBackfillSchedule();
        } catch (error) {
            logger.error('Error checking due tasks', { error: error.message });
        }
    }

    async getDueTasks() {
        const result = await db.query(`
      SELECT * FROM scheduled_tasks
      WHERE enabled = true
        AND (next_run_at IS NULL OR next_run_at <= NOW())
      ORDER BY next_run_at ASC
      LIMIT 10
    `);
        return result.rows;
    }

    // checkPatternAnalysisSchedule removed (Legacy Pattern Discovery Deprecated v0.38.0)

    /**
     * Check if RAG backfill should run
     * Runs every 5 minutes when enabled, processing 10 items per batch
     */
    async checkRagBackfillSchedule() {
        try {
            // Check if RAG is enabled
            const configResult = await db.query(
                'SELECT rag_enabled FROM ai_provider_config WHERE id = 1'
            );
            const ragEnabled = configResult.rows[0]?.rag_enabled === true;

            if (!ragEnabled) return;

            // Check how many items still need embeddings
            const includeImage = await embeddingService.shouldIncludeImageEmbeddings();
            const pendingCount = await embeddingService.getPendingCount({ includeImage });

            if (pendingCount === 0) return;

            const availability = await embeddingService.getProviderAvailabilityStatus({ refresh: true });
            if (availability.status === 'cooldown' || availability.status === 'probing') {
                logger.debug('RAG backfill: skipped because embedding provider is unavailable', {
                    retryAt: availability.cooldownUntil
                });
                return;
            }

            // Check if a scheduler backfill is already running, and when the last one completed.
            // Checking is_running prevents overlapping executions when a batch takes longer
            // than the poll interval or longer than the 5-minute throttle window.
            const statusResult = await db.query(`
                SELECT
                    EXISTS(
                        SELECT 1 FROM backfill_runs
                        WHERE type = 'scheduler' AND status = 'running'
                    ) AS is_running,
                    (
                        SELECT MAX(completed_at)
                        FROM backfill_runs
                        WHERE type = 'scheduler' AND status = 'completed'
                    ) AS last_run
            `);
            const { is_running: isRunning, last_run: lastRun } = statusResult.rows[0];

            if (isRunning) {
                logger.debug('RAG backfill: skipped (run already in progress)');
                return;
            }

            // Run every 5 minutes (or if never ran)
            const shouldRun = !lastRun || (Date.now() - new Date(lastRun).getTime()) > 5 * 60 * 1000;

            if (shouldRun) {
                logger.info(`RAG backfill: ${pendingCount} items pending. Processing batch...`);
                await this.runRagBackfill();
            }
        } catch (error) {
            logger.error('Error checking RAG backfill schedule', { error: error.message }, { error });
        }
    }

    /**
     * Run a batch of RAG embedding backfills
     */
    async runRagBackfill() {
        let runId = null;
        try {
            const includeImage = await embeddingService.shouldIncludeImageEmbeddings();
            const pending = await embeddingService.getPendingEmbeddings({
                limit: 10,
                includeImage
            });

            if (pending.length === 0) return;

            const runResult = await db.query(
                `INSERT INTO backfill_runs (type, status, total) VALUES ('scheduler', 'running', $1) RETURNING id`,
                [pending.length]
            );
            runId = runResult.rows[0].id;

            let processed = 0;
            let failed = 0;
            let providerUnavailable = false;
            let providerBusy = false;

            for (const row of pending) {
                try {
                    const metadata = row.metadata || {};
                    let generationResult = null;
                    if (row.needsText) {
                        generationResult = await embeddingService.generateAndStore(row.id, {
                            ...metadata,
                            title: row.title,
                            media_type: row.media_type,
                            library_name: row.library_name
                        });
                    } else if (row.needsImage) {
                        generationResult = await embeddingService.generateImageEmbedding(row.id, {
                            ...metadata,
                            title: row.title,
                            media_type: row.media_type,
                            library_name: row.library_name
                        });
                    }

                    if (!generationResult) {
                        logger.debug('RAG backfill item was not stored; leaving it pending', {
                            id: row.id,
                            title: row.title
                        });
                        continue;
                    }

                    processed++;
                } catch (error) {
                    if (error.message === 'PROVIDER_OFFLINE') {
                        providerUnavailable = true;
                        const availability = embeddingService.getProviderAvailabilityStatus();
                        logger.debug('RAG backfill batch paused: embedding provider unavailable', {
                            retryAt: availability.cooldownUntil
                        });
                        break;
                    }

                    if (embeddingService.isProviderBusyError(error)) {
                        providerBusy = true;
                        logger.debug('RAG backfill batch yielded to active provider traffic', {
                            id: row.id,
                            lockHolder: error.lockHolder || null,
                            waitMs: error.waitMs || null,
                            activeModel: error.activeModel || null
                        });
                        break;
                    }

                    failed++;
                    logger.debug('Backfill item failed', { id: row.id, error: error.message });
                }
            }

            await db.query(
                `UPDATE backfill_runs SET status = 'completed', completed_at = NOW(), processed = $1 WHERE id = $2`,
                [processed, runId]
            );

            if (processed > 0 || providerUnavailable || providerBusy) {
                logger.info('RAG backfill batch complete', { processed, failed, providerBusy });
            }
        } catch (error) {
            logger.error('RAG backfill failed', { error: error.message }, { error });
            if (runId) {
                await db.query(
                    `UPDATE backfill_runs SET status = 'failed', completed_at = NOW(), error = $1 WHERE id = $2`,
                    [error.message, runId]
                ).catch(() => {});
            }
        }
    }

    async executeTask(task) {
        logger.info('Executing scheduled task', { id: task.id, name: task.name, type: task.task_type });

        try {
            let result;

            switch (task.task_type) {
                case 'library_scan':
                    result = await this.runLibraryScan(task.library_id);
                    break;
                case 'full_rescan':
                    result = await this.runFullRescan(task.library_id);
                    break;
                case 'cleanup_logs':
                    result = await this.runLogCleanup();
                    break;
                case 'pattern_analysis':
                    // Deprecated v0.38.0
                    result = { message: 'Pattern analysis is deprecated' };
                    break;
                default:
                    result = { error: 'Unknown task type' };
            }

            // Update task with success
            await this.updateTaskAfterRun(task.id, 'success', result);
        } catch (error) {
            logger.error('Task execution failed', { id: task.id, error: error.message });
            await this.updateTaskAfterRun(task.id, 'failed', { error: error.message });
        }
    }

    async runLibraryScan(libraryId) {
        // Import here to avoid circular dependency
        const mediaSyncService = require('./mediaSync');

        if (libraryId) {
            return await mediaSyncService.syncLibrary(libraryId);
        } else {
            return { message: 'No library specified' };
        }
    }

    async runFullRescan(libraryId) {
        const mediaSyncService = require('./mediaSync');

        if (libraryId) {
            return await mediaSyncService.syncLibrary(libraryId, { fullRescan: true });
        } else {
            return { message: 'No library specified' };
        }
    }

    // runPatternAnalysis removed (Legacy Pattern Discovery Deprecated v0.38.0)

    /**
     * Delete expired rows from error_log and app_log using the operator-configured
     * retention windows stored in the `settings` table. Mirrors the logic in
     * POST /api/logs/cleanup so both manual and scheduled cleanups apply the same policy.
     */
    async runLogCleanup() {
        const settingsResult = await db.query(
            `SELECT key, value FROM settings WHERE key IN ('log_retention_days', 'error_log_retention_days', 'rag_log_retention_days')`
        );
        const settings = {};
        for (const row of settingsResult.rows) {
            settings[row.key] = parseInt(row.value, 10);
        }
        const errorRetentionDays = settings.error_log_retention_days || 90;
        const appLogRetentionDays = settings.log_retention_days || 30;
        const ragLogRetentionDays = settings.rag_log_retention_days || 30;

        const errorLogResult = await db.query(
            `DELETE FROM error_log WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
            [errorRetentionDays]
        );
        const appLogResult = await db.query(
            `DELETE FROM app_log WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
            [appLogRetentionDays]
        );
        const ragLogResult = await db.query(
            `DELETE FROM rag_logs WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
            [ragLogRetentionDays]
        );

        const errorDeleted = errorLogResult.rowCount ?? 0;
        const appDeleted = appLogResult.rowCount ?? 0;
        const ragDeleted = ragLogResult.rowCount ?? 0;

        if (errorDeleted > 0 || appDeleted > 0 || ragDeleted > 0) {
            logger.info('Log cleanup complete', { errorLogsDeleted: errorDeleted, appLogsDeleted: appDeleted, ragLogsDeleted: ragDeleted });
        }

        return { errorLogsDeleted: errorDeleted, appLogsDeleted: appDeleted, ragLogsDeleted: ragDeleted };
    }

    /**
     * Seed built-in recurring scheduled tasks if they do not already exist.
     * Safe to call on every boot — uses a SELECT guard before any INSERT.
     */
    async ensureDefaultTasks() {
        const existing = await db.query(
            `SELECT id FROM scheduled_tasks WHERE task_type = 'cleanup_logs' LIMIT 1`
        );
        if (existing.rows.length === 0) {
            // Schedule first run for tomorrow at 02:30 so it does not fire on every restart
            const firstRun = new Date();
            firstRun.setDate(firstRun.getDate() + 1);
            firstRun.setHours(2, 30, 0, 0);
            await db.query(`
                INSERT INTO scheduled_tasks (name, task_type, enabled, interval_minutes, next_run_at)
                VALUES ('Log Cleanup', 'cleanup_logs', true, 1440, $1)
            `, [firstRun]);
            logger.info('Seeded default log cleanup task');
        }
    }

    async updateTaskAfterRun(taskId, status, result) {
        const intervalMinutes = await this.getTaskInterval(taskId);
        const nextRun = intervalMinutes
            ? new Date(Date.now() + intervalMinutes * 60000)
            : null;

        await db.query(`
      UPDATE scheduled_tasks
      SET last_run_at = NOW(),
          next_run_at = $2,
          run_count = run_count + 1,
          last_result = $3,
          updated_at = NOW()
      WHERE id = $1
    `, [taskId, nextRun, JSON.stringify({ status, result: result })]);
    }

    async getTaskInterval(taskId) {
        const result = await db.query(
            'SELECT interval_minutes FROM scheduled_tasks WHERE id = $1',
            [taskId]
        );
        return result.rows[0]?.interval_minutes;
    }

    // CRUD operations
    async getAllTasks() {
        const result = await db.query(`
      SELECT st.*, l.name as library_name
      FROM scheduled_tasks st
      LEFT JOIN libraries l ON st.library_id = l.id
      ORDER BY st.created_at DESC
    `);
        return result.rows;
    }

    async getTaskById(id) {
        const result = await db.query(
            'SELECT * FROM scheduled_tasks WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    async createTask(data) {
        const { name, task_type, library_id, interval_minutes, enabled = true } = data;

        // Calculate first run time
        const next_run_at = interval_minutes
            ? new Date(Date.now() + interval_minutes * 60000)
            : null;

        const result = await db.query(`
      INSERT INTO scheduled_tasks (name, task_type, library_id, interval_minutes, enabled, next_run_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, task_type, library_id, interval_minutes, enabled, next_run_at]);

        logger.info('Created scheduled task', { id: result.rows[0].id, name });
        return result.rows[0];
    }

    async updateTask(id, data) {
        const { name, task_type, library_id, interval_minutes, enabled } = data;

        const result = await db.query(`
      UPDATE scheduled_tasks
      SET name = COALESCE($2, name),
          task_type = COALESCE($3, task_type),
          library_id = COALESCE($4, library_id),
          interval_minutes = COALESCE($5, interval_minutes),
          enabled = COALESCE($6, enabled),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, name, task_type, library_id, interval_minutes, enabled]);

        return result.rows[0];
    }

    async deleteTask(id) {
        await db.query('DELETE FROM scheduled_tasks WHERE id = $1', [id]);
        logger.info('Deleted scheduled task', { id });
    }

    async runNow(id) {
        const task = await this.getTaskById(id);
        if (!task) {
            throw new Error('Task not found');
        }
        await this.executeTask(task);
        return { message: 'Task executed' };
    }
}

module.exports = new SchedulerService();
