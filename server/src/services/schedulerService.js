/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Scheduler service for periodic tasks
 */

const db = require('../config/database');
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
                    result = await this.runPatternAnalysis(task.library_id);
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

    async runPatternAnalysis(libraryId) {
        const mediaPatternAnalyzer = require('./mediaPatternAnalyzer');

        // If specific library, analyze just that one
        if (libraryId) {
            const result = await mediaPatternAnalyzer.analyzeLibrary(libraryId);

            // Update library_pattern_suggestions with new patterns
            await db.query(
                `INSERT INTO library_pattern_suggestions (library_id, detected_patterns, pending_count, last_analyzed, notification_dismissed, updated_at)
                 VALUES ($1, $2, $3, NOW(), false, NOW())
                 ON CONFLICT (library_id) 
                 DO UPDATE SET 
                   detected_patterns = $2, 
                   pending_count = $3, 
                   last_analyzed = NOW(),
                   notification_dismissed = false,
                   updated_at = NOW()`,
                [libraryId, JSON.stringify(result.patterns), result.patterns.length]
            );

            return { libraryId, patternsDetected: result.patterns.length };
        } else {
            // Analyze all libraries
            const libraries = await db.query('SELECT id FROM libraries WHERE sync_enabled = true');
            const results = [];

            for (const lib of libraries.rows) {
                try {
                    const result = await mediaPatternAnalyzer.analyzeLibrary(lib.id);

                    await db.query(
                        `INSERT INTO library_pattern_suggestions (library_id, detected_patterns, pending_count, last_analyzed, notification_dismissed, updated_at)
                         VALUES ($1, $2, $3, NOW(), false, NOW())
                         ON CONFLICT (library_id) 
                         DO UPDATE SET 
                           detected_patterns = $2, 
                           pending_count = $3, 
                           last_analyzed = NOW(),
                           notification_dismissed = false,
                           updated_at = NOW()`,
                        [lib.id, JSON.stringify(result.patterns), result.patterns.length]
                    );

                    results.push({ libraryId: lib.id, patternsDetected: result.patterns.length });
                } catch (error) {
                    logger.error('Pattern analysis failed for library', { libraryId: lib.id, error: error.message });
                }
            }

            logger.info('Pattern analysis complete for all libraries', { analyzed: results.length });
            return { libraries: results };
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
