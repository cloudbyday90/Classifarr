/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const { createLogger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const logger = createLogger('PostUpgradeService');

/**
 * Post-Upgrade Task Definitions
 * Add version-specific tasks here that need to run once after upgrade
 */
const POST_UPGRADE_TASKS = {
    '0.39.3': [
        {
            id: 'clear_logs_0393',
            action: 'clear_logs',
            description: 'Clear logs for fresh start in v0.39.3'
        },
        {
            id: 'backfill_library_name_0393',
            action: 'backfill_library_name',
            description: 'Populate library_name where missing'
        },
        {
            id: 'clear_stale_retry_queue_0393',
            action: 'clear_stale_retry_queue',
            description: 'Remove orphaned entries from embedding retry queue'
        }
    ]
};

class PostUpgradeService {
    /**
     * Run all pending post-upgrade tasks
     */
    async runPendingTasks() {
        try {
            logger.info('Checking for pending post-upgrade tasks...');

            // Ensure table exists (it should from migration)
            await this.ensureTableExists();

            // Get all tasks for all versions
            const allTasks = this.getAllTasks();

            if (allTasks.length === 0) {
                logger.info('No post-upgrade tasks defined');
                return { executed: 0, skipped: 0 };
            }

            // Check which tasks have already been executed
            const executedTaskIds = await this.getExecutedTaskIds();

            // Filter to only pending tasks
            const pendingTasks = allTasks.filter(task => !executedTaskIds.includes(task.id));

            if (pendingTasks.length === 0) {
                logger.info('All post-upgrade tasks already completed');
                return { executed: 0, skipped: executedTaskIds.length };
            }

            logger.info(`Found ${pendingTasks.length} pending post-upgrade tasks`);

            // Execute each pending task
            let executed = 0;
            for (const task of pendingTasks) {
                try {
                    logger.info(`Executing post-upgrade task: ${task.id} - ${task.description}`);
                    await this.executeTask(task);
                    await this.markTaskComplete(task);
                    executed++;
                    logger.info(`✓ Task completed: ${task.id}`);
                } catch (error) {
                    logger.error(`Failed to execute task ${task.id}:`, { error: error.message });
                    // Continue with other tasks even if one fails
                }
            }

            logger.info(`Post-upgrade tasks complete: ${executed} executed, ${executedTaskIds.length} already done`);
            return { executed, skipped: executedTaskIds.length };

        } catch (error) {
            logger.error('Failed to run post-upgrade tasks', { error: error.message });
            throw error;
        }
    }

    /**
     * Get all defined tasks across all versions
     */
    getAllTasks() {
        const tasks = [];
        for (const [version, versionTasks] of Object.entries(POST_UPGRADE_TASKS)) {
            for (const task of versionTasks) {
                tasks.push({
                    ...task,
                    version
                });
            }
        }
        return tasks;
    }

    /**
     * Get list of task IDs that have already been executed
     */
    async getExecutedTaskIds() {
        try {
            const result = await db.query(
                'SELECT task_id FROM post_upgrade_tasks ORDER BY executed_at'
            );
            return result.rows.map(row => row.task_id);
        } catch (error) {
            // If table doesn't exist yet, return empty array
            if (error.code === '42P01') {
                return [];
            }
            throw error;
        }
    }

    /**
     * Ensure the post_upgrade_tasks table exists
     */
    async ensureTableExists() {
        try {
            await db.query('SELECT 1 FROM post_upgrade_tasks LIMIT 1');
        } catch (error) {
            if (error.code === '42P01') {
                logger.warn('post_upgrade_tasks table does not exist yet - will be created by migration');
            }
        }
    }

    /**
     * Execute a specific task based on its action type
     */
    async executeTask(task) {
        switch (task.action) {
            case 'clear_logs':
                await this.clearLogs();
                break;

            case 'clear_embedding_queue':
                await this.clearEmbeddingQueue();
                break;

            case 'rebuild_embeddings':
                await this.rebuildEmbeddings();
                break;

            case 'backfill_library_name':
                await this.backfillLibraryName();
                break;

            case 'clear_stale_retry_queue':
                await this.clearStaleRetryQueue();
                break;

            default:
                throw new Error(`Unknown task action: ${task.action}`);
        }
    }

    /**
     * Mark a task as complete
     */
    async markTaskComplete(task) {
        await db.query(
            `INSERT INTO post_upgrade_tasks (task_id, version, description, executed_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (task_id) DO NOTHING`,
            [task.id, task.version, task.description]
        );
    }

    /**
     * Task Action: Clear logs (app_log and error_log tables, plus log files)
     * 
     * WARNING: This operation permanently removes all application and error logs
     * from the database and truncates all .log files on disk. Any unreviewed
     * production errors or audit information stored in these locations will be
     * irrecoverably lost unless they have been archived elsewhere beforehand.
     * 
     * Only enable or run this task when you explicitly intend to start with a
     * clean logging state (for example, immediately after an upgrade) and are
     * confident that critical logs have already been collected or backed up.
     */
    async clearLogs() {
        logger.info('Clearing logs...');
        logger.warn('All application and error logs will now be permanently deleted from the database and log files.');

        // Clear database log tables (destructive: removes all history)
        await db.query('TRUNCATE TABLE error_log');
        await db.query('TRUNCATE TABLE app_log');

        // Clear log files if they exist (destructive: truncates contents)
        const logDir = path.join(__dirname, '../../logs');
        try {
            // Check if directory exists first
            await fs.access(logDir);

            const files = await fs.readdir(logDir);
            for (const file of files) {
                if (file.endsWith('.log')) {
                    const filePath = path.join(logDir, file);
                    await fs.writeFile(filePath, '');
                    logger.info(`Cleared log file: ${file}`);
                }
            }
        } catch (error) {
            // Log directory might not exist, that's expected in containerized environments
            if (error.code === 'ENOENT') {
                logger.debug('Log directory does not exist, skipping file cleanup');
            } else {
                logger.warn('Could not clear log files:', { error: error.message });
            }
        }

        logger.info('Logs cleared successfully');
    }

    /**
     * Task Action: Clear embedding retry queue
     */
    async clearEmbeddingQueue() {
        logger.info('Clearing embedding retry queue...');
        const result = await db.query('DELETE FROM embedding_retry_queue');
        logger.info(`Cleared ${result.rowCount} items from embedding retry queue`);
    }

    /**
     * Task Action: Rebuild embeddings (mark all as stale)
     */
    async rebuildEmbeddings() {
        logger.info('Marking all embeddings as stale for regeneration...');
        const result = await db.query('UPDATE classification_embeddings SET is_stale = true');
        logger.info(`Marked ${result.rowCount} embeddings as stale`);
    }

    /**
     * Task Action: Backfill library_name where it's NULL but library_id exists
     */
    async backfillLibraryName() {
        logger.info('Backfilling library_name in classification_history...');

        const result = await db.query(`
            UPDATE classification_history ch
            SET library_name = l.name
            FROM libraries l
            WHERE ch.library_id = l.id
              AND ch.library_name IS NULL
        `);

        logger.info(`Backfilled library_name for ${result.rowCount} classifications`);
    }

    /**
     * Task Action: Clear stale entries from embedding retry queue
     * Removes items that are marked as 'pending' but already have embeddings
     */
    async clearStaleRetryQueue() {
        logger.info('Clearing stale entries from embedding retry queue...');

        // Delete retry queue entries where the classification already has an embedding
        const result = await db.query(`
            DELETE FROM embedding_retry_queue erq
            WHERE EXISTS (
                SELECT 1 FROM classification_embeddings ce
                WHERE ce.classification_id = erq.classification_id
            )
        `);

        logger.info(`Cleared ${result.rowCount} stale entries from retry queue`);
    }
}

module.exports = new PostUpgradeService();
