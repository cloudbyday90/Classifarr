/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { persistRagAuditLog } from './ragAuditLogService.mjs';

export function isForeignKeyConstraintError(error) {
    const code = typeof error?.code === 'string' ? error.code.trim() : '';
    const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
    return code === '23503' || message.includes('violates foreign key constraint');
}

export function normalizeClearAndResyncError(error) {
    if (error?.code === 'CARSA_DEPENDENCY_CONFLICT' || error?.code === 'CARSA_RESET_FAILED') {
        return error;
    }

    if (isForeignKeyConstraintError(error)) {
        const constraint = (error.message || '').match(/constraint "([^"]+)"/i)?.[1] || null;
        const table = (error.message || '').match(/on table "([^"]+)"/i)?.[1] || null;
        const dependencyError = new Error(
            `CARSA blocked by dependent rows${table ? ` on ${table}` : ''}${constraint ? ` (${constraint})` : ''}`
        );
        dependencyError.code = 'CARSA_DEPENDENCY_CONFLICT';
        dependencyError.details = {
            table,
            constraint,
            originalError: error.message || null
        };
        return dependencyError;
    }

    const resetError = new Error(error?.message || 'Failed to clear and resync');
    resetError.code = 'CARSA_RESET_FAILED';
    resetError.details = {
        originalError: error?.message || null
    };
    return resetError;
}

export async function performClearAndResyncCleanup(db, syncStatus, evidenceService, logger) {
    const transact = typeof db.withTransaction === 'function'
        ? (fn) => db.withTransaction(fn)
        : (fn) => db.withTransaction(fn).catch((error) => {
            logger.warn('Transaction failed', { context: 'clear_and_resync', error: error.message });
            throw error;
        });

    return transact(async (dbClient) => {
        await dbClient.query('LOCK TABLE libraries, media_server_sync_status IN SHARE ROW EXCLUSIVE MODE');

        syncStatus.updateProgress(20, 'Clearing task queue...');
        const queueResult = await dbClient.query('DELETE FROM task_queue RETURNING id');

        await dbClient.query('DELETE FROM content_analysis_log');

        const embeddingsResult = await dbClient.query('DELETE FROM classification_embeddings RETURNING id');
        if ((embeddingsResult.rowCount || 0) > 0) {
            await persistRagAuditLog({
                client: dbClient,
                logger,
                type: 'system',
                message: `CARSA clear-and-resync deleted ${embeddingsResult.rowCount} classification_embeddings row(s) before library rebuild.`,
            });
        }

        syncStatus.updateProgress(30, 'Clearing embeddings...');

        const historyResult = await dbClient.query('DELETE FROM classification_history RETURNING id');

        syncStatus.updateProgress(40, 'Clearing classification history...');

        const patternsResult = await evidenceService.purgeAllLegacyPatterns({
            client: dbClient,
            actor: 'carsa',
            reason: 'clear_and_resync'
        });
        const correctionsResult = await dbClient.query('DELETE FROM classification_corrections RETURNING id');

        syncStatus.updateProgress(50, 'Clearing learning data...');

        const rulesV2Result = await dbClient.query('DELETE FROM library_rules_v2 RETURNING id');
        await dbClient.query('DELETE FROM library_custom_rules');
        await dbClient.query('DELETE FROM library_pattern_suggestions');

        syncStatus.updateProgress(60, 'Clearing library rules...');

        await dbClient.query('DELETE FROM library_profiles');

        let feedbackLibraryRefsCleared = 0;
        try {
            const feedbackResult = await dbClient.query(`
                UPDATE policy_feedback_log
                SET selected_library_id = NULL
                WHERE selected_library_id IS NOT NULL
            `);
            feedbackLibraryRefsCleared = feedbackResult.rowCount || 0;
        } catch (error) {
            if (error.code !== '42P01') {
                throw error;
            }
            logger.debug('policy_feedback_log not present; skipping selected_library_id cleanup');
        }

        const syncStatusRowsResult = await dbClient.query('DELETE FROM media_server_sync_status RETURNING id');
        const collectionsResult = await dbClient.query('DELETE FROM media_server_collections RETURNING id');
        const itemsResult = await dbClient.query('DELETE FROM media_server_items RETURNING id');

        syncStatus.updateProgress(70, 'Clearing media items...');

        const librariesResult = await dbClient.query('DELETE FROM libraries RETURNING id');

        return {
            queueResult,
            embeddingsResult,
            historyResult,
            patternsResult,
            correctionsResult,
            rulesV2Result,
            syncStatusRowsResult,
            collectionsResult,
            itemsResult,
            librariesResult,
            feedbackLibraryRefsCleared
        };
    });
}
