/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { setTimeout as delay } from 'node:timers/promises';

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
const CAP_TRIM_LOOKBACK_HOURS = 24;
const BATCH = 5000;

function parseNonNegativeInt(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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

export async function getTaskQueueRetentionPolicy(db, logger) {
    const dbValues = new Map();

    try {
        const result = await db.query(
            `SELECT key, value
             FROM settings
             WHERE key = ANY($1::text[])`,
            [Object.values(TASK_QUEUE_RETENTION_SETTING_KEYS)]
        );

        for (const row of result.rows) {
            dbValues.set(row.key, row.value);
        }
    } catch (error) {
        logger.debug('Task queue retention settings lookup failed; falling back to env/default', {
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

export async function getTerminalRowCounts(db, retentionPolicy) {
    const result = await db.query(
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

export async function deleteStaleRowsByStatus(db, retentionPolicy, { pauseBetweenBatches = false } = {}) {
    let totalDeleted = 0;
    const deletedByStatus = createStatusMap(0);

    for (const status of TERMINAL_QUEUE_STATUSES) {
        const retentionDays = retentionPolicy[status];
        if (retentionDays <= 0) {
            continue;
        }

        let batchDeleted;
        do {
            const result = await db.query(
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

export async function trimCountCapByStatus(db, excessRows, { pauseBetweenBatches = false } = {}) {
    let remainingExcess = excessRows;
    let totalDeleted = 0;
    const deletedByStatus = createStatusMap(0);

    for (const status of TERMINAL_QUEUE_STATUSES) {
        while (remainingExcess > 0) {
            const batchSize = Math.min(BATCH, remainingExcess);
            const result = await db.query(
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

export async function getRecentCapTrimSummary(db, logger) {
    try {
        const result = await db.query(
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
        logger.debug('Task queue cleanup history lookup failed; continuing without recurrence telemetry', {
            error: error.message,
        });
        return {
            capTrimRunsLast24h: 0,
            capTrimRowsLast24h: 0,
            lastCapTrimAt: null,
        };
    }
}

export async function recordCleanupHistory(db, logger, {
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
        await db.query(
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
        await logger.warn('Failed to persist task_queue cleanup history', {
            cleanupType,
            trigger,
            error: error.message,
        }, {
            dedupeKey: 'task-queue-cleanup-history-persist-failed',
            dedupeWindowMs: 60 * 60 * 1000,
        });
    }
}
