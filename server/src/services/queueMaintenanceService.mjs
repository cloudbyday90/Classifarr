/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import * as defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
    getTaskQueueRetentionPolicy as _getTaskQueueRetentionPolicy,
    getTerminalRowCounts as _getTerminalRowCounts,
    deleteStaleRowsByStatus as _deleteStaleRowsByStatus,
    trimCountCapByStatus as _trimCountCapByStatus,
    getRecentCapTrimSummary as _getRecentCapTrimSummary,
    recordCleanupHistory as _recordCleanupHistory
} from './queueMaintenanceQueries.mjs';

const BLOAT_THRESHOLD = 1000;
const TERMINAL_QUEUE_STATUSES = Object.freeze(['cancelled', 'completed', 'failed']);
const DEFAULT_TASK_QUEUE_MAX_TOTAL_ROWS = 200000;

function parsePositiveInt(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function createStatusMap(initialValue) {
    return {
        cancelled: initialValue,
        completed: initialValue,
        failed: initialValue,
    };
}

function summarizeOldestByStatus(perStatus) {
    return {
        cancelled: perStatus.cancelled.oldestCreatedAt,
        completed: perStatus.completed.oldestCreatedAt,
        failed: perStatus.failed.oldestCreatedAt,
    };
}

export class QueueMaintenanceService {
    constructor(deps = {}) {
        this.db = deps.db || defaultDb;
        this.logger = deps.logger || createLogger('QueueMaintenance');
    }

    async getTaskQueueRetentionPolicy() {
        return _getTaskQueueRetentionPolicy(this.db, this.logger);
    }

    getTaskQueueMaxTotalRows() {
        return parsePositiveInt(process.env.TASK_QUEUE_MAX_TOTAL_ROWS) ?? DEFAULT_TASK_QUEUE_MAX_TOTAL_ROWS;
    }

    async getTerminalRowCounts(retentionPolicy) {
        return _getTerminalRowCounts(this.db, retentionPolicy);
    }

    async deleteStaleRowsByStatus(retentionPolicy, opts) {
        return _deleteStaleRowsByStatus(this.db, retentionPolicy, opts);
    }

    async trimCountCapByStatus(excessRows, opts) {
        return _trimCountCapByStatus(this.db, excessRows, opts);
    }

    async getRecentCapTrimSummary() {
        return _getRecentCapTrimSummary(this.db, this.logger);
    }

    async recordCleanupHistory(params) {
        return _recordCleanupHistory(this.db, this.logger, params);
    }

    async backgroundDrainIfBloated() {
        const cleanupType = 'startup';
        const MAX_TOTAL_ROWS = this.getTaskQueueMaxTotalRows();
        const retentionPolicy = await this.getTaskQueueRetentionPolicy();
        const counts = await this.getTerminalRowCounts(retentionPolicy);
        const staleCount = counts.staleCount;
        const totalCount = counts.totalCount;

        const ageBloated = staleCount > BLOAT_THRESHOLD;
        const countBloated = totalCount > MAX_TOTAL_ROWS;

        if (!ageBloated && !countBloated) return;

        this.logger.warn('task_queue bloat detected at startup; running background drain', {
            staleRows: staleCount,
            totalRows: totalCount,
            retentionDays: retentionPolicy,
            maxTotalRows: MAX_TOTAL_ROWS,
            terminalRowsByStatus: counts.perStatus,
            oldestRowsByStatus: summarizeOldestByStatus(counts.perStatus),
            trigger: ageBloated && countBloated ? 'age+count' : ageBloated ? 'age' : 'count'
        });

        let totalDeleted = 0;
        let ageDeleted = 0;
        let countCapDeleted = 0;
        const deletedByStatus = createStatusMap(0);
        const ageDeletedByStatus = createStatusMap(0);
        const countCapDeletedByStatus = createStatusMap(0);

        if (ageBloated) {
            const staleDeleteResult = await this.deleteStaleRowsByStatus(retentionPolicy, { pauseBetweenBatches: true });
            ageDeleted += staleDeleteResult.totalDeleted;
            totalDeleted += staleDeleteResult.totalDeleted;
            for (const status of TERMINAL_QUEUE_STATUSES) {
                ageDeletedByStatus[status] += staleDeleteResult.deletedByStatus[status];
                deletedByStatus[status] += staleDeleteResult.deletedByStatus[status];
            }
        }

        const postAgeCounts = ageBloated
            ? await this.getTerminalRowCounts(retentionPolicy)
            : counts;
        const remainingAfterAge = postAgeCounts.totalCount;
        let finalCounts = postAgeCounts;
        if (countBloated && remainingAfterAge > MAX_TOTAL_ROWS) {
            const excess = remainingAfterAge - MAX_TOTAL_ROWS;
            const recentCapTrimSummary = await this.getRecentCapTrimSummary();
            this.logger.warn('task_queue count cap exceeded; trimming oldest rows', {
                remaining: remainingAfterAge,
                maxTotalRows: MAX_TOTAL_ROWS,
                toDelete: excess,
                terminalRowsByStatus: postAgeCounts.perStatus,
                oldestRowsByStatus: summarizeOldestByStatus(postAgeCounts.perStatus),
                ...recentCapTrimSummary,
            });
            const countTrimResult = await this.trimCountCapByStatus(excess, { pauseBetweenBatches: true });
            countCapDeleted += countTrimResult.totalDeleted;
            totalDeleted += countTrimResult.totalDeleted;
            for (const status of TERMINAL_QUEUE_STATUSES) {
                countCapDeletedByStatus[status] += countTrimResult.deletedByStatus[status];
                deletedByStatus[status] += countTrimResult.deletedByStatus[status];
            }
            finalCounts = await this.getTerminalRowCounts(retentionPolicy);
        }

        this.logger.info('Background task_queue drain complete', {
            deleted: totalDeleted,
            ageDeleted,
            countCapDeleted,
            deletedByStatus,
            ageDeletedByStatus,
            countCapDeletedByStatus,
            retentionDays: retentionPolicy,
            rowsBefore: {
                stale: counts.staleCount,
                total: counts.totalCount,
            },
            rowsAfter: {
                total: finalCounts.totalCount,
                terminalRowsByStatus: finalCounts.perStatus,
                oldestRowsByStatus: summarizeOldestByStatus(finalCounts.perStatus),
            },
        });

        if (totalDeleted > 0) {
            await this.recordCleanupHistory({
                cleanupType,
                trigger: ageBloated && countBloated ? 'age+count' : ageBloated ? 'age' : 'count',
                retentionPolicy,
                maxTotalRows: MAX_TOTAL_ROWS,
                countsBefore: counts,
                countsAfter: finalCounts,
                totalDeleted,
                ageDeleted,
                countCapDeleted,
                deletedByStatus,
                ageDeletedByStatus,
                countCapDeletedByStatus,
                capExcessBefore: Math.max(remainingAfterAge - MAX_TOTAL_ROWS, 0),
            });
        }

        try {
            await this.db.query('VACUUM ANALYZE task_queue');
            this.logger.info('task_queue VACUUM ANALYZE complete after background drain');
        } catch (vacuumErr) {
            this.logger.warn('task_queue VACUUM ANALYZE failed after background drain (non-fatal)', {
                error: vacuumErr.message
            });
        }
    }

    async runScheduledTaskQueueCleanup() {
        const cleanupType = 'scheduled';
        const retentionPolicy = await this.getTaskQueueRetentionPolicy();
        const MAX_TOTAL_ROWS = this.getTaskQueueMaxTotalRows();
        const initialCounts = await this.getTerminalRowCounts(retentionPolicy);
        let totalDeleted = 0;
        let ageDeleted = 0;
        let countCapDeleted = 0;
        const deletedByStatus = createStatusMap(0);
        const ageDeletedByStatus = createStatusMap(0);
        const countCapDeletedByStatus = createStatusMap(0);
        try {
            const staleDeleteResult = await this.deleteStaleRowsByStatus(retentionPolicy);
            ageDeleted += staleDeleteResult.totalDeleted;
            totalDeleted += staleDeleteResult.totalDeleted;
            for (const status of TERMINAL_QUEUE_STATUSES) {
                ageDeletedByStatus[status] += staleDeleteResult.deletedByStatus[status];
                deletedByStatus[status] += staleDeleteResult.deletedByStatus[status];
            }

            const postAgeCounts = await this.getTerminalRowCounts(retentionPolicy);
            const remaining = postAgeCounts.totalCount;
            let finalCounts = postAgeCounts;
            if (remaining > MAX_TOTAL_ROWS) {
                const excess = remaining - MAX_TOTAL_ROWS;
                const recentCapTrimSummary = await this.getRecentCapTrimSummary();
                this.logger.warn('task_queue count cap exceeded during scheduled cleanup; trimming oldest rows', {
                    remaining,
                    maxTotalRows: MAX_TOTAL_ROWS,
                    toDelete: excess,
                    terminalRowsByStatus: postAgeCounts.perStatus,
                    oldestRowsByStatus: summarizeOldestByStatus(postAgeCounts.perStatus),
                    ...recentCapTrimSummary,
                });
                const countTrimResult = await this.trimCountCapByStatus(excess);
                countCapDeleted += countTrimResult.totalDeleted;
                totalDeleted += countTrimResult.totalDeleted;
                for (const status of TERMINAL_QUEUE_STATUSES) {
                    countCapDeletedByStatus[status] += countTrimResult.deletedByStatus[status];
                    deletedByStatus[status] += countTrimResult.deletedByStatus[status];
                }
                finalCounts = await this.getTerminalRowCounts(retentionPolicy);
            }

            if (totalDeleted > 0) {
                this.logger.info('Task queue cleanup complete', {
                    deleted: totalDeleted,
                    ageDeleted,
                    countCapDeleted,
                    deletedByStatus,
                    ageDeletedByStatus,
                    countCapDeletedByStatus,
                    retentionDays: retentionPolicy,
                    rowsBefore: {
                        stale: initialCounts.staleCount,
                        total: initialCounts.totalCount,
                    },
                    rowsAfter: {
                        total: finalCounts.totalCount,
                        terminalRowsByStatus: finalCounts.perStatus,
                        oldestRowsByStatus: summarizeOldestByStatus(finalCounts.perStatus),
                    },
                });
                await this.recordCleanupHistory({
                    cleanupType,
                    trigger: ageDeleted > 0 && countCapDeleted > 0 ? 'age+count' : ageDeleted > 0 ? 'age' : 'count',
                    retentionPolicy,
                    maxTotalRows: MAX_TOTAL_ROWS,
                    countsBefore: initialCounts,
                    countsAfter: finalCounts,
                    totalDeleted,
                    ageDeleted,
                    countCapDeleted,
                    deletedByStatus,
                    ageDeletedByStatus,
                    countCapDeletedByStatus,
                    capExcessBefore: Math.max(remaining - MAX_TOTAL_ROWS, 0),
                });
                try {
                    await this.db.query('VACUUM ANALYZE task_queue');
                    this.logger.info('task_queue VACUUM ANALYZE complete after scheduled cleanup');
                } catch (vacuumErr) {
                    this.logger.warn('task_queue VACUUM ANALYZE failed after scheduled cleanup (non-fatal)', {
                        error: vacuumErr.message
                    });
                }
            } else {
                this.logger.debug('Task queue cleanup: no rows to delete', {
                    retentionDays: retentionPolicy,
                    maxTotalRows: MAX_TOTAL_ROWS,
                    terminalRowsByStatus: postAgeCounts.perStatus,
                    oldestRowsByStatus: summarizeOldestByStatus(postAgeCounts.perStatus),
                });
            }
        } catch (error) {
            this.logger.error('Task queue cleanup failed', { error: error.message });
        }
    }
}

export const queueMaintenanceService = new QueueMaintenanceService();
