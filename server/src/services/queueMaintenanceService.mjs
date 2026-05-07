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

const BLOAT_THRESHOLD = 1000;
const DEFAULT_TASK_QUEUE_MAX_TOTAL_ROWS = 10000;
const BATCH = 5000;

export class QueueMaintenanceService {
    constructor(deps = {}) {
        this.db = deps.db || defaultDb;
        this.logger = deps.logger || createLogger('QueueMaintenance');
    }

    async backgroundDrainIfBloated() {
        const MAX_TOTAL_ROWS = parseInt(process.env.TASK_QUEUE_MAX_TOTAL_ROWS, 10) || DEFAULT_TASK_QUEUE_MAX_TOTAL_ROWS;

        const parsed = parseInt(process.env.TASK_QUEUE_RETENTION_DAYS, 10);
        const retentionDays = Number.isFinite(parsed) && parsed > 0 ? parsed : 7;

        const countResult = await this.db.query(
            `SELECT
               COUNT(*) FILTER (WHERE created_at < NOW() - ($1 || ' days')::INTERVAL) AS stale_count,
               COUNT(*) AS total_count
             FROM task_queue
             WHERE status IN ('completed', 'failed', 'cancelled')`,
            [retentionDays]
        );
        const staleCount = parseInt(countResult.rows[0].stale_count) || 0;
        const totalCount = parseInt(countResult.rows[0].total_count) || 0;

        const ageBloated = staleCount > BLOAT_THRESHOLD;
        const countBloated = totalCount > MAX_TOTAL_ROWS;

        if (!ageBloated && !countBloated) return;

        this.logger.warn('task_queue bloat detected at startup; running background drain', {
            staleRows: staleCount,
            totalRows: totalCount,
            retentionDays,
            maxTotalRows: MAX_TOTAL_ROWS,
            trigger: ageBloated && countBloated ? 'age+count' : ageBloated ? 'age' : 'count'
        });

        let totalDeleted = 0;
        let batchDeleted;

        if (ageBloated) {
            do {
                const result = await this.db.query(
                    `DELETE FROM task_queue
                     WHERE id IN (
                         SELECT id FROM task_queue
                         WHERE status IN ('completed', 'failed', 'cancelled')
                           AND created_at < NOW() - ($1 || ' days')::INTERVAL
                         LIMIT $2
                     )`,
                    [retentionDays, BATCH]
                );
                batchDeleted = result.rowCount;
                totalDeleted += batchDeleted;
                await new Promise(resolve => setTimeout(resolve, 50));
            } while (batchDeleted === BATCH);
        }

        const remainingAfterAge = totalCount - totalDeleted;
        if (countBloated && remainingAfterAge > MAX_TOTAL_ROWS) {
            const excess = remainingAfterAge - MAX_TOTAL_ROWS;
            this.logger.warn('task_queue count cap exceeded; trimming oldest rows', {
                remaining: remainingAfterAge,
                maxTotalRows: MAX_TOTAL_ROWS,
                toDelete: excess
            });
            let countDeleted = 0;
            do {
                const batchSize = Math.min(BATCH, excess - countDeleted);
                if (batchSize <= 0) break;
                const result = await this.db.query(
                    `DELETE FROM task_queue
                     WHERE id IN (
                         SELECT id FROM task_queue
                         WHERE status IN ('completed', 'failed', 'cancelled')
                         ORDER BY created_at ASC
                         LIMIT $1
                     )`,
                    [batchSize]
                );
                batchDeleted = result.rowCount;
                countDeleted += batchDeleted;
                totalDeleted += batchDeleted;
                await new Promise(resolve => setTimeout(resolve, 50));
            } while (batchDeleted > 0 && countDeleted < excess);
        }

        this.logger.info('Background task_queue drain complete', { deleted: totalDeleted, retentionDays });

        try {
            await this.db.query('VACUUM ANALYZE task_queue');
            this.logger.info('task_queue VACUUM ANALYZE complete after background drain');
        } catch (vacuumErr) {
            this.logger.warn('task_queue VACUUM ANALYZE failed after background drain (non-fatal)', {
                error: vacuumErr.message
            });
        }
    }
}

const queueMaintenanceService = new QueueMaintenanceService();
export default queueMaintenanceService;
