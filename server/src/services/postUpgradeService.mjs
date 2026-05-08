/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/* eslint-disable security/detect-non-literal-fs-filename -- paths come from trusted internal config, not user input */
import fs from 'node:fs/promises';
import path from 'node:path';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

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
        }
    ],
    '0.41.2': [
        {
            id: 'clear_logs_0412',
            action: 'clear_logs',
            description: 'Clear logs for fresh start in v0.41.2-alpha'
        }
    ],
    '0.41.3': [
        {
            id: 'clear_logs_0413',
            action: 'clear_logs',
            description: 'Clear logs for fresh start in v0.41.3-alpha'
        }
    ],
    '0.42.7': [
        {
            id: 'clear_logs_0427',
            action: 'clear_logs',
            description: 'Clear logs for fresh start in v0.42.7-alpha'
        }
    ],
    '0.43.1b': [
        {
            id: 'clear_logs_0431b',
            action: 'clear_logs',
            description: 'Clear logs for fresh start in v0.43.1b-alpha'
        }
    ],
    '0.43.9': [
        {
            id: 'clear_logs_0439',
            action: 'clear_logs',
            description: 'Clear logs for fresh start in v0.43.9-beta'
        }
    ]
};

class PostUpgradeService {
    /**
     * Detect whether this is a brand-new installation (no users exist yet).
     * On a fresh install, post-upgrade tasks should be pre-seeded as complete
     * rather than executed — they exist to migrate/clean up data from prior
     * versions, which doesn't apply when there's no prior data.
     */
    async isFreshInstall() {
        try {
            const result = await db.query('SELECT COUNT(*) FROM users');
            return parseInt(result.rows[0].count, 10) === 0;
        } catch (_err) {
            return false;
        }
    }

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

            // On a fresh install there is no prior-version data to clean up or
            // transform.  Mark every task as done without running it so that the
            // service is quiet and future upgrade tasks work correctly.
            if (await this.isFreshInstall()) {
                logger.info('Fresh install detected — pre-seeding all post-upgrade tasks as complete (no prior data to process)');
                for (const task of pendingTasks) {
                    await this.markTaskComplete(task);
                }
                return { executed: 0, skipped: allTasks.length };
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

            case 'rebuild_embeddings':
                await this.rebuildEmbeddings();
                break;

            case 'backfill_library_name':
                await this.backfillLibraryName();
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

        // Clear database log tables.
        // error_log: delete only unresolved rows so resolved (operator-reviewed) entries are preserved.
        // app_log: has no resolved concept — delete all rows.
        await db.query('DELETE FROM error_log WHERE resolved = false');
        await db.query('DELETE FROM app_log');

        // Clear log files if they exist (destructive: truncates contents)
        const logDir = path.join(import.meta.dirname, '../../logs');
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

}

export const postUpgradeService = new PostUpgradeService();
