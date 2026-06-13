/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { ratingNormalizer as defaultRatingNormalizer } from '../utils/ratingNormalizer.mjs';

const DEFAULT_STARTUP_BACKFILL_LIMIT = 1000;
const RATING_NORMALIZATION_TASK_TYPE = 'rating_normalization';

function parseCount(row) {
    const count = Number.parseInt(row?.count, 10);
    return Number.isFinite(count) ? count : 0;
}

function normalizeLimit(limit) {
    const parsedLimit = Number.parseInt(limit, 10);
    return Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
}

export class RatingNormalizationQueueService {
    constructor(deps = {}) {
        this.db = deps.db || defaultDb;
        this.ratingNormalizer = deps.ratingNormalizer || defaultRatingNormalizer;
        this.logger = deps.logger || createLogger('RatingNormalizationQueueService');
    }

    getNeedsNormalizationSQL() {
        return this.ratingNormalizer.getNeedsNormalizationSQL();
    }

    getRatingNormalizationFilterSQL() {
        const needsSQL = this.getNeedsNormalizationSQL();
        return `(
            (
                COALESCE(
                    NULLIF(NULLIF(metadata->'omdb'->'data'->>'rated', 'N/A'), ''),
                    NULLIF(metadata->'tmdb'->>'certification', '')
                ) IS NOT NULL 
                AND content_rating IS DISTINCT FROM COALESCE(
                    NULLIF(NULLIF(metadata->'omdb'->'data'->>'rated', 'N/A'), ''),
                    NULLIF(metadata->'tmdb'->>'certification', '')
                )
            ) OR (
                COALESCE(
                    NULLIF(NULLIF(metadata->'omdb'->'data'->>'rated', 'N/A'), ''),
                    NULLIF(metadata->'tmdb'->>'certification', '')
                ) IS NULL
                AND original_rating IS NULL 
                AND content_rating IS NOT NULL 
                AND ${needsSQL}
            )
        )`;
    }

    async countItemsNeedingNormalization() {
        const filterSQL = this.getRatingNormalizationFilterSQL();
        const result = await this.db.query(`
            SELECT COUNT(*) as count FROM media_server_items
            WHERE ${filterSQL}
        `);

        return parseCount(result.rows[0]);
    }

    async countAlreadyNormalized() {
        const result = await this.db.query(`
            SELECT COUNT(*) as count
            FROM media_server_items
            WHERE original_rating IS NOT NULL
        `);

        return parseCount(result.rows[0]);
    }

    async countQueuedTasks() {
        const result = await this.db.query(`
            SELECT COUNT(*) as count FROM task_queue
            WHERE task_type = $1 AND status IN ('pending', 'processing')
        `, [RATING_NORMALIZATION_TASK_TYPE]);

        return parseCount(result.rows[0]);
    }

    async countFailedTasks() {
        const result = await this.db.query(`
            SELECT COUNT(*) as count FROM task_queue
            WHERE task_type = $1 AND status = 'failed'
        `, [RATING_NORMALIZATION_TASK_TYPE]);

        return parseCount(result.rows[0]);
    }

    async getStats() {
        const [
            needsNormalization,
            alreadyNormalized,
            queuedTasks,
            failedTasks,
        ] = await Promise.all([
            this.countItemsNeedingNormalization(),
            this.countAlreadyNormalized(),
            this.countQueuedTasks(),
            this.countFailedTasks(),
        ]);

        return {
            needsNormalization,
            alreadyNormalized,
            queuedTasks,
            failedTasks,
        };
    }

    async queueBackfill({ limit = null } = {}) {
        const filterSQL = this.getRatingNormalizationFilterSQL();
        const normalizedLimit = normalizeLimit(limit);
        const limitClause = normalizedLimit === null ? '' : `LIMIT ${normalizedLimit}`;

        const result = await this.db.query(`
            INSERT INTO task_queue (task_type, priority, payload, status)
            SELECT $1, 5, jsonb_build_object('media_item_id', id), 'pending'
            FROM media_server_items
            WHERE ${filterSQL}
            ${limitClause}
            ON CONFLICT (task_type, (payload->>'media_item_id')) WHERE status IN ('pending', 'processing') DO NOTHING
            RETURNING id
        `, [RATING_NORMALIZATION_TASK_TYPE]);

        return { queued: result.rowCount || 0 };
    }

    async queueStartupBackfill({ limit = DEFAULT_STARTUP_BACKFILL_LIMIT } = {}) {
        try {
            const totalNeedingNormalization = await this.countItemsNeedingNormalization();

            if (totalNeedingNormalization === 0) {
                return { queued: 0, totalNeedingNormalization };
            }

            const normalizedLimit = normalizeLimit(limit) || DEFAULT_STARTUP_BACKFILL_LIMIT;
            this.logger.info(
                `Auto-queuing first ${normalizedLimit} items for rating normalization (${totalNeedingNormalization} total need normalization)`
            );

            const { queued } = await this.queueBackfill({ limit: normalizedLimit });
            return { queued, totalNeedingNormalization };
        } catch (error) {
            this.logger.warn('Startup rating normalization check failed:', { error: error.message });
            return { queued: 0, totalNeedingNormalization: 0, error };
        }
    }

    async queueDailyBackfill() {
        try {
            this.logger.info('Running daily rating normalization check');

            const totalNeedingNormalization = await this.countItemsNeedingNormalization();

            if (totalNeedingNormalization === 0) {
                return { queued: 0, totalNeedingNormalization };
            }

            this.logger.info(`Auto-queuing ${totalNeedingNormalization} items for normalization`);
            const { queued } = await this.queueBackfill();
            return { queued, totalNeedingNormalization };
        } catch (error) {
            this.logger.error('Daily normalization check failed', { error: error.message });
            return { queued: 0, totalNeedingNormalization: 0, error };
        }
    }
}

export const ratingNormalizationQueueService = new RatingNormalizationQueueService();
