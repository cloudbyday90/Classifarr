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

            // Check last completed scheduler backfill run
            const lastBackfillResult = await db.query(`
                SELECT MAX(completed_at) as last_run 
                FROM backfill_runs 
                WHERE type = 'scheduler' AND status = 'completed'
            `);
            const lastRun = lastBackfillResult.rows[0]?.last_run;

            // Run every 5 minutes (or if never ran)
            const shouldRun = !lastRun || (Date.now() - new Date(lastRun).getTime()) > 5 * 60 * 1000;

            if (shouldRun) {
                logger.info(`RAG backfill: ${pendingCount} items pending. Processing batch...`);
                await this.runRagBackfill();
            }
        } catch (error) {
            logger.error('Error checking RAG backfill schedule', { error: error.message });
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

            for (const row of pending) {
                try {
                    const metadata = row.metadata || {};
                    if (row.needsText) {
                        await embeddingService.generateAndStore(row.id, {
                            ...metadata,
                            title: row.title,
                            media_type: row.media_type,
                            library_name: row.library_name
                        });
                    } else if (row.needsImage) {
                        await embeddingService.generateImageEmbedding(row.id, {
                            ...metadata,
                            title: row.title,
                            media_type: row.media_type,
                            library_name: row.library_name
                        });
                    }
                    processed++;
                } catch (error) {
                    failed++;
                    logger.debug('Backfill item failed', { id: row.id, error: error.message });
                }
            }

            await db.query(
                `UPDATE backfill_runs SET status = 'completed', completed_at = NOW(), processed = $1 WHERE id = $2`,
                [processed, runId]
            );

            if (processed > 0) {
                logger.info('RAG backfill batch complete', { processed, failed });
            }
        } catch (error) {
            logger.error('RAG backfill failed', { error: error.message });
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
