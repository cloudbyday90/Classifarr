import * as db from '../config/database.mjs';
import { mediaSyncService } from './mediaSync.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('SchedulerTasks');

export async function executeTask(task, { runLibraryScan, runFullRescan, runLogCleanup, updateTaskAfterRun }) {
    logger.info('Executing scheduled task', { id: task.id, name: task.name, type: task.task_type });

    try {
        let result;

        switch (task.task_type) {
            case 'library_scan':
                result = await runLibraryScan(task.library_id);
                break;
            case 'full_rescan':
                result = await runFullRescan(task.library_id);
                break;
            case 'cleanup_logs':
                result = await runLogCleanup();
                break;
            case 'pattern_analysis':
                result = { message: 'Pattern analysis is deprecated' };
                break;
            default:
                result = { error: 'Unknown task type' };
        }

        await updateTaskAfterRun(task.id, 'success', result);
    } catch (error) {
        logger.error('Task execution failed', { id: task.id, error: error.message });
        await updateTaskAfterRun(task.id, 'failed', { error: error.message });
    }
}

export async function runLibraryScan(libraryId) {
    if (libraryId) {
        return await mediaSyncService.syncLibrary(libraryId);
    } else {
        return { message: 'No library specified' };
    }
}

export async function runFullRescan(libraryId) {
    if (libraryId) {
        return await mediaSyncService.syncLibrary(libraryId, { fullRescan: true });
    } else {
        return { message: 'No library specified' };
    }
}

export async function runLogCleanup() {
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
