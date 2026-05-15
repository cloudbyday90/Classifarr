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

import { setTimeout as delay } from 'node:timers/promises';
import * as defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const BLOAT_THRESHOLD = 1000;
const TERMINAL_QUEUE_STATUSES = Object.freeze(['cancelled', 'completed', 'failed']);
const TASK_QUEUE_RETENTION_SETTING_KEYS = Object.freeze({
    completed: 'task_queue_retention_days',
    failed: 'task_queue_failed_retention_days',
    cancelled: 'task_queue_cancelled_retention_days',
});
const TASK_QUEUE_RETENTION_ENV_KEYS = Object.freeze({
    completed: 'TASK_QUEUE_RETENTION_DAYS',
    failed: 'TASK_QUEUE_FAILED_RETENTION_DAYS',
    cancelled: 'TASK_QUEUE_CANCELLED_RETENTION_DAYS',
});
const DEFAULT_TASK_QUEUE_RETENTION_DAYS = Object.freeze({
    completed: 7,
    failed: 30,
    cancelled: 3,
});
const DEFAULT_TASK_QUEUE_MAX_TOTAL_ROWS = 10000;
const CAP_TRIM_LOOKBACK_HOURS = 24;
const BATCH = 5000;

function parseNonNegativeInt(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

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

function toIsoTimestamp(value) {
    if (!value) return null;
    const timestamp = value instanceof Date ? value : new Date(value);
    return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
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
        const dbValues = new Map();

        try {
            const result = await this.db.query(
                `SELECT key, value
                 FROM settings
                 WHERE key = ANY($1::text[])`,
                [Object.values(TASK_QUEUE_RETENTION_SETTING_KEYS)]
            );

            for (const row of result.rows) {
                dbValues.set(row.key, row.value);
            }
        } catch (error) {
            this.logger.debug('Task queue retention settings lookup failed; falling back to env/default', {
                error: error.message
            });
        }

        return {
            completed:
                parseNonNegativeInt(dbValues.get(TASK_QUEUE_RETENTION_SETTING_KEYS.completed))
                ?? parseNonNegativeInt(process.env[TASK_QUEUE_RETENTION_ENV_KEYS.completed])
                ?? DEFAULT_TASK_QUEUE_RETENTION_DAYS.completed,
            failed:
                parseNonNegativeInt(dbValues.get(TASK_QUEUE_RETENTION_SETTING_KEYS.failed))
                ?? parseNonNegativeInt(process.env[TASK_QUEUE_RETENTION_ENV_KEYS.failed])
                ?? DEFAULT_TASK_QUEUE_RETENTION_DAYS.failed,
            cancelled:
                parseNonNegativeInt(dbValues.get(TASK_QUEUE_RETENTION_SETTING_KEYS.cancelled))
                ?? parseNonNegativeInt(process.env[TASK_QUEUE_RETENTION_ENV_KEYS.cancelled])
                ?? DEFAULT_TASK_QUEUE_RETENTION_DAYS.cancelled,
        };
    }

    getTaskQueueMaxTotalRows() {
        return parsePositiveInt(process.env.TASK_QUEUE_MAX_TOTAL_ROWS) ?? DEFAULT_TASK_QUEUE_MAX_TOTAL_ROWS;
    }

    async getTerminalRowCounts(retentionPolicy) {
        const result = await this.db.query(
            `SELECT
               COUNT(*) FILTER (
                   WHERE status = 'completed'
                     AND $1 > 0
                     AND created_at < NOW() - make_interval(days => $1)
               ) AS stale_completed,
               COUNT(*) FILTER (WHERE status = 'completed') AS total_completed,
               MIN(created_at) FILTER (WHERE status = 'completed') AS oldest_completed,
               COUNT(*) FILTER (
                   WHERE status = 'failed'
                     AND $2 > 0
                     AND created_at < NOW() - make_interval(days => $2)
               ) AS stale_failed,
               COUNT(*) FILTER (WHERE status = 'failed') AS total_failed,
               MIN(created_at) FILTER (WHERE status = 'failed') AS oldest_failed,
               COUNT(*) FILTER (
                   WHERE status = 'cancelled'
                     AND $3 > 0
                     AND created_at < NOW() - make_interval(days => $3)
               ) AS stale_cancelled,
               COUNT(*) FILTER (WHERE status = 'cancelled') AS total_cancelled,
               MIN(created_at) FILTER (WHERE status = 'cancelled') AS oldest_cancelled
             FROM task_queue
             WHERE status = ANY($4::text[])`,
            [
                retentionPolicy.completed,
                retentionPolicy.failed,
                retentionPolicy.cancelled,
                TERMINAL_QUEUE_STATUSES,
            ]
        );

        const row = result.rows[0] || {};
        const perStatus = {
            completed: {
                stale: parseInt(row.stale_completed, 10) || 0,
                total: parseInt(row.total_completed, 10) || 0,
                oldestCreatedAt: toIsoTimestamp(row.oldest_completed),
            },
            failed: {
                stale: parseInt(row.stale_failed, 10) || 0,
                total: parseInt(row.total_failed, 10) || 0,
                oldestCreatedAt: toIsoTimestamp(row.oldest_failed),
            },
            cancelled: {
                stale: parseInt(row.stale_cancelled, 10) || 0,
                total: parseInt(row.total_cancelled, 10) || 0,
                oldestCreatedAt: toIsoTimestamp(row.oldest_cancelled),
            },
        };

        return {
            staleCount: perStatus.completed.stale + perStatus.failed.stale + perStatus.cancelled.stale,
            totalCount: perStatus.completed.total + perStatus.failed.total + perStatus.cancelled.total,
            perStatus,
        };
    }

    async deleteStaleRowsByStatus(retentionPolicy, { pauseBetweenBatches = false } = {}) {
        let totalDeleted = 0;
        const deletedByStatus = createStatusMap(0);

        for (const status of TERMINAL_QUEUE_STATUSES) {
            const retentionDays = retentionPolicy[status];
            if (retentionDays <= 0) {
                continue;
            }

            let batchDeleted;
            do {
                const result = await this.db.query(
                    `DELETE FROM task_queue
                     WHERE id IN (
                         SELECT id FROM task_queue
                         WHERE status = $1
                           AND created_at < NOW() - make_interval(days => $2)
                         ORDER BY created_at ASC
                         LIMIT $3
                     )`,
                    [status, retentionDays, BATCH]
                );
                batchDeleted = result.rowCount;
                totalDeleted += batchDeleted;
                deletedByStatus[status] += batchDeleted;

                if (pauseBetweenBatches && batchDeleted === BATCH) {
                    await delay(50);
                }
            } while (batchDeleted === BATCH);
        }

        return {
            totalDeleted,
            deletedByStatus,
        };
    }

    async trimCountCapByStatus(excessRows, { pauseBetweenBatches = false } = {}) {
        let remainingExcess = excessRows;
        let totalDeleted = 0;
        const deletedByStatus = createStatusMap(0);

        for (const status of TERMINAL_QUEUE_STATUSES) {
            while (remainingExcess > 0) {
                const batchSize = Math.min(BATCH, remainingExcess);
                const result = await this.db.query(
                    `DELETE FROM task_queue
                     WHERE id IN (
                         SELECT id FROM task_queue
                         WHERE status = $1
                         ORDER BY created_at ASC
                         LIMIT $2
                     )`,
                    [status, batchSize]
                );
                const batchDeleted = result.rowCount;
                if (batchDeleted <= 0) {
                    break;
                }

                remainingExcess -= batchDeleted;
                totalDeleted += batchDeleted;
                deletedByStatus[status] += batchDeleted;

                if (pauseBetweenBatches && remainingExcess > 0) {
                    await delay(50);
                }
            }
        }

        return {
            totalDeleted,
            deletedByStatus,
            remainingExcess,
        };
    }

    async getRecentCapTrimSummary() {
        try {
            const result = await this.db.query(
                `SELECT
                   COUNT(*) AS cap_trim_runs_last_24h,
                   COALESCE(SUM(count_cap_deleted), 0) AS cap_trim_rows_last_24h,
                   MAX(created_at) AS last_cap_trim_at
                 FROM task_queue_cleanup_history
                 WHERE count_cap_deleted > 0
                   AND created_at >= NOW() - make_interval(hours => $1)`,
                [CAP_TRIM_LOOKBACK_HOURS]
            );
            const row = result.rows[0] || {};
            return {
                capTrimRunsLast24h: parseInt(row.cap_trim_runs_last_24h, 10) || 0,
                capTrimRowsLast24h: parseInt(row.cap_trim_rows_last_24h, 10) || 0,
                lastCapTrimAt: toIsoTimestamp(row.last_cap_trim_at),
            };
        } catch (error) {
            this.logger.debug('Task queue cleanup history lookup failed; continuing without recurrence telemetry', {
                error: error.message,
            });
            return {
                capTrimRunsLast24h: 0,
                capTrimRowsLast24h: 0,
                lastCapTrimAt: null,
            };
        }
    }

    async recordCleanupHistory({
        cleanupType,
        trigger,
        retentionPolicy,
        maxTotalRows,
        countsBefore,
        countsAfter,
        totalDeleted,
        ageDeleted,
        countCapDeleted,
        deletedByStatus,
        ageDeletedByStatus,
        countCapDeletedByStatus,
        capExcessBefore,
    }) {
        try {
            await this.db.query(
                `INSERT INTO task_queue_cleanup_history (
                     cleanup_type,
                     trigger,
                     retention_policy,
                     max_total_rows,
                     stale_rows_before,
                     total_rows_before,
                     total_rows_after,
                     cap_excess_before,
                     total_deleted,
                     age_deleted,
                     count_cap_deleted,
                     terminal_rows_before,
                     terminal_rows_after,
                     deleted_by_status,
                     oldest_remaining_by_status
                 )
                 VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb)`,
                [
                    cleanupType,
                    trigger,
                    JSON.stringify(retentionPolicy),
                    maxTotalRows,
                    countsBefore.staleCount,
                    countsBefore.totalCount,
                    countsAfter.totalCount,
                    capExcessBefore,
                    totalDeleted,
                    ageDeleted,
                    countCapDeleted,
                    JSON.stringify(countsBefore.perStatus),
                    JSON.stringify(countsAfter.perStatus),
                    JSON.stringify({
                        total: deletedByStatus,
                        age: ageDeletedByStatus,
                        countCap: countCapDeletedByStatus,
                    }),
                    JSON.stringify(summarizeOldestByStatus(countsAfter.perStatus)),
                ]
            );
        } catch (error) {
            await this.logger.warn('Failed to persist task_queue cleanup history', {
                cleanupType,
                trigger,
                error: error.message,
            }, {
                dedupeKey: 'task-queue-cleanup-history-persist-failed',
                dedupeWindowMs: 60 * 60 * 1000,
            });
        }
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
