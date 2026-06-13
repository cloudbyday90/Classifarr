/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { parsePayload } from '../utils/queueHelpers.mjs';

export class QueueMutationService {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
        this.enqueueTask = deps.enqueueTask;
        this.enrichmentItemStateService = deps.enrichmentItemStateService;
    }

    async _withCatch(label, context, fn) {
        try {
            return await fn();
        } catch (error) {
            this.logger.error(`Failed to ${label}`, { error: error.message, ...context });
            throw error;
        }
    }

    async retryTask(taskId) {
        return this._withCatch('retry task', { taskId }, async () => {
            const task = await this.getTaskById(taskId);
            if (!task) {
                return { success: false, code: 'not_found' };
            }

            if (task.status !== 'failed') {
                return { success: false, code: 'invalid_state', currentStatus: task.status };
            }

            const result = await this.db.query(
                `UPDATE task_queue
         SET status = 'pending', attempts = 0, error_message = NULL, next_retry_at = NOW()
         WHERE id = $1 AND status = 'failed'
         RETURNING id, task_type, payload`,
                [taskId]
            );
            if (result.rowCount === 0) {
                return { success: false, code: 'invalid_state' };
            }
            this.logger.info('Task queued for retry', { taskId });

            const updatedTask = result.rows?.[0] || {};
            if (updatedTask.task_type === 'metadata_enrichment' && this.enrichmentItemStateService) {
                const parsedPayload = parsePayload(updatedTask.payload);
                const itemId = parsedPayload?.itemId || parsedPayload?.media_item_id || parsedPayload?.mediaItemId;
                if (itemId) {
                    await this.enrichmentItemStateService.syncItemState(itemId);
                }
            }

            return { success: true };
        });
    }

    async dismissFailedTask(taskId) {
        return this._withCatch('dismiss task', { taskId }, async () => {
            const task = await this.getTaskById(taskId);
            if (!task) {
                return { success: false, code: 'not_found' };
            }

            if (task.status !== 'failed') {
                return { success: false, code: 'invalid_state', currentStatus: task.status };
            }

            const result = await this.db.query(
                `DELETE FROM task_queue
         WHERE id = $1 AND status = 'failed'
         RETURNING id, task_type, payload`,
                [taskId]
            );
            if (result.rowCount === 0) {
                return { success: false, code: 'invalid_state' };
            }
            this.logger.info('Failed task dismissed', { taskId, dismissed: true });

            const updatedTask = result.rows?.[0] || {};
            if (updatedTask.task_type === 'metadata_enrichment' && this.enrichmentItemStateService) {
                const parsedPayload = parsePayload(updatedTask.payload);
                const itemId = parsedPayload?.itemId || parsedPayload?.media_item_id || parsedPayload?.mediaItemId;
                if (itemId) {
                    await this.enrichmentItemStateService.syncItemState(itemId);
                }
            }

            return { success: true };
        });
    }

    async cancelTask(taskId) {
        return this._withCatch('cancel task', { taskId }, async () => {
            const task = await this.getTaskById(taskId);
            if (!task) {
                return { success: false, code: 'not_found' };
            }

            if (task.status !== 'pending') {
                return { success: false, code: 'invalid_state', currentStatus: task.status };
            }

            const result = await this.db.query(
                `UPDATE task_queue
         SET status = 'cancelled', completed_at = NOW()
         WHERE id = $1 AND status = 'pending'
         RETURNING id, task_type, payload`,
                [taskId]
            );
            if (result.rowCount === 0) {
                return { success: false, code: 'invalid_state' };
            }
            this.logger.info('Task cancelled', { taskId });

            const updatedTask = result.rows?.[0] || {};
            if (updatedTask.task_type === 'metadata_enrichment' && this.enrichmentItemStateService) {
                const parsedPayload = parsePayload(updatedTask.payload);
                const itemId = parsedPayload?.itemId || parsedPayload?.media_item_id || parsedPayload?.mediaItemId;
                if (itemId) {
                    await this.enrichmentItemStateService.syncItemState(itemId);
                }
            }

            return { success: true };
        });
    }

    async clearCompletedTasks() {
        try {
            const result = await this.db.query(
                `DELETE FROM task_queue WHERE status = 'completed'`
            );
            this.logger.info('Cleared completed tasks', { count: result.rowCount });
            return { success: true, count: result.rowCount || 0 };
        } catch (error) {
            this.logger.error('Failed to clear completed tasks', { error: error.message });
            return {
                success: false,
                code: 'bulk_action_failed',
                action: 'clear_completed',
            };
        }
    }

    async clearFailedTasks() {
        try {
            const result = await this.db.query(
                `DELETE FROM task_queue WHERE status = 'failed'
                 RETURNING task_type, payload`
            );
            this.logger.info('Cleared failed tasks', { count: result.rowCount });

            if (this.enrichmentItemStateService) {
                const itemIds = (result.rows || [])
                    .filter(row => row.task_type === 'metadata_enrichment')
                    .map(row => {
                        const payload = parsePayload(row.payload);
                        return payload?.itemId || payload?.media_item_id || payload?.mediaItemId;
                    });
                if (itemIds.length > 0) {
                    await this.enrichmentItemStateService.syncItemStates(itemIds);
                }
            }

            return { success: true, count: result.rowCount || 0 };
        } catch (error) {
            this.logger.error('Failed to clear failed tasks', { error: error.message });
            return {
                success: false,
                code: 'bulk_action_failed',
                action: 'clear_failed',
            };
        }
    }

    async retryAllFailedTasks() {
        try {
            const result = await this.db.query(
                `UPDATE task_queue
         SET status = 'pending', attempts = 0, error_message = NULL, next_retry_at = NOW()
         WHERE status = 'failed'
         RETURNING id, task_type, payload`
            );
            this.logger.info('Retrying all failed tasks', { count: result.rowCount });

            if (this.enrichmentItemStateService) {
                const itemIds = (result.rows || [])
                    .filter(row => row.task_type === 'metadata_enrichment')
                    .map(row => {
                        const payload = parsePayload(row.payload);
                        return payload?.itemId || payload?.media_item_id || payload?.mediaItemId;
                    });
                if (itemIds.length > 0) {
                    await this.enrichmentItemStateService.syncItemStates(itemIds);
                }
            }

            return { success: true, count: result.rowCount || 0 };
        } catch (error) {
            this.logger.error('Failed to retry all tasks', { error: error.message });
            return {
                success: false,
                code: 'bulk_action_failed',
                action: 'retry_all_failed',
            };
        }
    }

    async cancelAllPendingTasks() {
        try {
            const result = await this.db.query(
                `UPDATE task_queue
         SET status = 'cancelled', completed_at = NOW()
         WHERE status = 'pending'
         RETURNING id, task_type, payload`
            );
            this.logger.info('Cancelled all pending tasks', { count: result.rowCount });

            if (this.enrichmentItemStateService) {
                const itemIds = (result.rows || [])
                    .filter(row => row.task_type === 'metadata_enrichment')
                    .map(row => {
                        const payload = parsePayload(row.payload);
                        return payload?.itemId || payload?.media_item_id || payload?.mediaItemId;
                    });
                if (itemIds.length > 0) {
                    await this.enrichmentItemStateService.syncItemStates(itemIds);
                }
            }

            return { success: true, count: result.rowCount || 0 };
        } catch (error) {
            this.logger.error('Failed to cancel all tasks', { error: error.message });
            return {
                success: false,
                code: 'bulk_action_failed',
                action: 'cancel_all_pending',
            };
        }
    }

    async reprocessCompleted() {
        try {
            const historyResult = await this.db.query(
                `SELECT ch.id, ch.tmdb_id, ch.media_type, ch.title, ch.year, ch.metadata
                 FROM classification_history ch
                 WHERE ch.status = 'completed'`
            );

            let count = 0;
            for (const item of historyResult.rows) {
                const metadata = parsePayload(item.metadata);

                await this.enqueueTask('classification', {
                    title: item.title,
                    overview: metadata.overview || '',
                    genres: normalizeMetadataList(metadata.genres),
                    keywords: normalizeMetadataList(metadata.keywords),
                    content_rating: metadata.certification,
                    original_language: metadata.original_language || 'en',
                    tmdb_id: item.tmdb_id,
                    media: { media_type: item.media_type || 'movie' }
                }, {
                    priority: 5,
                    source: 'reprocess'
                });
                count++;
            }

            this.logger.info('Queued completed items for reprocessing', { count });
            return { success: true, count };
        } catch (error) {
            this.logger.error('Failed to reprocess completed', { error: error.message });
            return {
                success: false,
                code: 'bulk_action_failed',
                action: 'reprocess_completed',
            };
        }
    }

    async getTaskById(taskId) {
        const result = await this.db.query(
            'SELECT id, status FROM task_queue WHERE id = $1',
            [taskId]
        );
        return result.rows[0] || null;
    }
}
