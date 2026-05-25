/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import * as db from '../config/database.mjs';
import { withSessionAdvisoryLock, DB_ADVISORY_LOCKS } from '../config/database.mjs';

export function parseDaysConfig(days) {
    if (!days) {
        return [0, 1, 2, 3, 4, 5, 6];
    }

    if (Array.isArray(days)) {
        return days.map((day) => Number.parseInt(day, 10));
    }

    if (typeof days === 'string') {
        return days.split(',').map((day) => Number.parseInt(day, 10));
    }

    return [0, 1, 2, 3, 4, 5, 6];
}

export function formatDaysConfig(days) {
    if (!days || !Array.isArray(days)) {
        return '0,1,2,3,4,5,6';
    }

    return days.join(',');
}

export async function runWithBackfillLock({ type, total, logger, onRunning, loopFn }) {
    let runId = null;

    const lockAcquired = await withSessionAdvisoryLock(
        DB_ADVISORY_LOCKS.BACKFILL_OWNER,
        async () => {
            const insertQuery = total !== undefined
                ? `INSERT INTO backfill_runs (type, status, total) VALUES ($1, 'running', $2) RETURNING id`
                : `INSERT INTO backfill_runs (type, status) VALUES ($1, 'running') RETURNING id`;
            const insertParams = total !== undefined ? [type, total] : [type];

            const runResult = await db.query(insertQuery, insertParams);
            runId = runResult.rows[0].id;

            onRunning(runId);

            let processed = 0;
            try {
                const loopResult = await loopFn(runId);
                processed = loopResult.processed;

                return { success: true, processed, runId, loopResult };
            } catch (error) {
                logger.error(`${type} backfill error`, { error: error.message }, { error });

                await db.query(`
                    UPDATE backfill_runs
                    SET status = 'failed',
                        completed_at = NOW(),
                        error = $1,
                        processed = $2
                    WHERE id = $3
                `, [error.message, processed, runId]);

                return { success: false, processed, runId, error };
            }
        }
    );

    if (!lockAcquired) {
        logger.info(`${type} backfill skipped: another backfill mode already owns the worker`);
    }

    return lockAcquired;
}

export async function completeBackfillRun(runId, status, processed) {
    await db.query(`
        UPDATE backfill_runs
        SET status = $1,
            completed_at = NOW(),
            processed = $2
        WHERE id = $3
    `, [status, processed, runId]);
}
