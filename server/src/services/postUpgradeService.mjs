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
import { persistRagAuditLog } from './ragAuditLogService.mjs';
import { libraryProfileService } from './libraryProfileService.mjs';
import { runPolicyPostUpgradeApplyGate as runPolicyPostUpgradeApplyGateService } from './policyPostUpgradeApplyGate.mjs';
import { runPolicyPostUpgradeDryRun } from './policyPostUpgradeDryRun.mjs';
import { createLogger } from '../utils/logger.mjs';
import { ratingNormalizer } from '../utils/ratingNormalizer.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';

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
    ],
    '0.47.2-beta': [
        {
            id: 'regenerate_library_profiles_rating_normalization_0472',
            action: 'regenerate_library_profiles',
            description: 'Regenerate library profiles with normalized rating distributions'
        }
    ],
    '0.47.5-beta': [
        {
            id: 'reset_stale_rating_normalization_0475',
            action: 'reset_stale_normalizations',
            description: 'Reset stale rating normalizations so items are re-processed with metadata-aware normalization'
        }
    ],
    '0.47.5a-beta': [
        {
            id: 'clear_logs_0475a',
            action: 'clear_logs',
            description: 'Clear logs for fresh start in v0.47.5a-beta'
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
        return withServiceCatch(logger, 'Failed to run post-upgrade tasks', async () => {
            logger.info('Checking for pending post-upgrade tasks...');

            await this.ensureTableExists();

            const allTasks = this.getAllTasks();

            if (allTasks.length === 0) {
                logger.info('No post-upgrade tasks defined');
                return { executed: 0, skipped: 0 };
            }

            const executedTaskIds = await this.getExecutedTaskIds();

            const pendingTasks = allTasks.filter(task => !executedTaskIds.includes(task.id));

            if (pendingTasks.length === 0) {
                logger.info('All post-upgrade tasks already completed');
                return { executed: 0, skipped: executedTaskIds.length };
            }

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
            let skippedByGuard = 0;
            for (const task of pendingTasks) {
                try {
                    logger.info(`Executing post-upgrade task: ${task.id} - ${task.description}`);
                    const result = await this.executeTask(task);
                    await this.markTaskComplete(task);
                    if (result?.skipped) {
                        skippedByGuard++;
                        logger.info(`Task skipped: ${task.id}`, { reason: result.reason });
                    } else {
                        executed++;
                        logger.info(`✓ Task completed: ${task.id}`);
                    }
                } catch (error) {
                    logger.error(`Failed to execute task ${task.id}:`, { error: error.message });
                    // Continue with other tasks even if one fails
                }
            }

            const skipped = executedTaskIds.length + skippedByGuard;
            logger.info(`Post-upgrade tasks complete: ${executed} executed, ${skipped} skipped`);
            return { executed, skipped };
        });
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
                return await this.clearLogs();

            case 'rebuild_embeddings':
                return await this.rebuildEmbeddings();

            case 'backfill_library_name':
                return await this.backfillLibraryName();

            case 'regenerate_library_profiles':
                return await this.regenerateLibraryProfiles();

            case 'reset_stale_normalizations':
                return await this.resetStaleNormalizations();

            case 'policy_native_intent_dry_run':
                return await this.runPolicyPostUpgradeDryRun();

            case 'policy_post_upgrade_apply_gate':
                return await this.runPolicyPostUpgradeApplyGate();

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
        if ((result.rowCount || 0) > 0) {
            await persistRagAuditLog({
                client: db,
                logger,
                level: 'info',
                type: 'upgrade',
                message: `Post-upgrade rebuild marked ${result.rowCount} classification_embeddings row(s) stale for regeneration.`,
            });
        }
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
     * Task Action: Regenerate library profiles after scoring-model changes
     */
    async regenerateLibraryProfiles() {
        const needsRegeneration = await this.needsLibraryProfileRatingRegeneration();
        if (!needsRegeneration) {
            logger.info('Library profile rating distributions are already normalized; skipping regeneration');
            return {
                skipped: true,
                reason: 'rating_profiles_already_normalized'
            };
        }

        logger.info('Regenerating library profiles...');

        const results = await libraryProfileService.generateAllProfiles();
        const successCount = results.filter(result => result.success).length;
        const failureCount = results.length - successCount;

        logger.info('Library profile regeneration complete', {
            total: results.length,
            success: successCount,
            failed: failureCount
        });

        return {
            skipped: false,
            total: results.length,
            success: successCount,
            failed: failureCount
        };
    }

    /**
     * Task Action: Reset stale rating normalizations
     */
    async resetStaleNormalizations() {
        logger.info('Resetting stale rating normalizations...');

        const metadataRatingExpr = `COALESCE(
            NULLIF(NULLIF(metadata->'omdb'->'data'->>'rated', 'N/A'), ''),
            NULLIF(metadata->'tmdb'->>'certification', '')
        )`;
        const normalizedMetadataRatingSQL = ratingNormalizer.getNormalizedMetadataRatingSQL(
            metadataRatingExpr,
            'media_type'
        );

        const result = await db.query(`
            UPDATE media_server_items
            SET original_rating = NULL
            WHERE original_rating IS NOT NULL
              AND content_rating = original_rating
              AND ${metadataRatingExpr} IS NOT NULL
              AND content_rating IS DISTINCT FROM (${normalizedMetadataRatingSQL})
        `);

        logger.info(`Reset original_rating to NULL for ${result.rowCount} stale items`);
        return { resetCount: result.rowCount };
    }

    /**
     * Task Action: report native intent conversion readiness without applying.
     */
    async runPolicyPostUpgradeDryRun() {
        logger.info('Running policy post-upgrade dry-run...');

        const dryRun = await runPolicyPostUpgradeDryRun({
            dbClient: db
        });

        logger.info('Policy post-upgrade dry-run complete', {
            statusId: dryRun.statusId,
            summary: dryRun.summary,
            operatorErrorIds: dryRun.operatorErrorIds
        });

        return {
            skipped: false,
            mode: dryRun.mode,
            statusId: dryRun.statusId,
            summary: dryRun.summary,
            operatorErrorIds: dryRun.operatorErrorIds,
            validation: {
                ok: dryRun.validation?.ok === true,
                issueCount: dryRun.validation?.issueCount ?? 0
            }
        };
    }

    /**
     * Task Action: apply native intent conversion only through the policy apply gate.
     */
    async runPolicyPostUpgradeApplyGate() {
        logger.info('Running policy post-upgrade apply gate...');

        const result = await runPolicyPostUpgradeApplyGateService({
            dbClient: db
        });

        logger.info('Policy post-upgrade apply gate complete', {
            statusId: result.statusId,
            appliedPolicyCount: result.appliedPolicyCount,
            alreadyConvertedCount: result.alreadyConvertedCount,
            operatorErrorIds: result.operatorErrorIds
        });

        return {
            skipped: result.applied !== true,
            reason: result.applied === true ? undefined : result.statusId,
            mode: result.mode,
            statusId: result.statusId,
            appliedPolicyCount: result.appliedPolicyCount,
            alreadyConvertedCount: result.alreadyConvertedCount,
            operatorErrorIds: result.operatorErrorIds,
            validation: {
                ok: result.validation?.ok === true,
                issueCount: result.validation?.issueCount ?? 0
            }
        };
    }

    async needsLibraryProfileRatingRegeneration() {
        const result = await db.query(`
            SELECT lp.library_id, l.media_type, lp.rating_distribution
            FROM library_profiles lp
            LEFT JOIN libraries l ON l.id = lp.library_id
            WHERE lp.rating_distribution IS NOT NULL
        `);

        return result.rows.some(row =>
            this.hasLegacyRatingDistributionBuckets(row.rating_distribution, row.media_type)
        );
    }

    hasLegacyRatingDistributionBuckets(distribution, mediaType = 'movie') {
        const ratingDistribution = this.parseRatingDistribution(distribution);

        return Object.keys(ratingDistribution).some(rating => {
            const normalizedRating = ratingNormalizer.normalizeRating(rating, mediaType || 'movie');
            return normalizedRating !== rating;
        });
    }

    parseRatingDistribution(distribution) {
        if (!distribution) return {};
        if (typeof distribution === 'string') {
            try {
                return JSON.parse(distribution);
            } catch {
                return {};
            }
        }
        return distribution;
    }

}

export const postUpgradeService = new PostUpgradeService();
