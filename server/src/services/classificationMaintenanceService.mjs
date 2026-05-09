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
import { STALE_AWAITING_DECISION_DAYS } from '../constants/classificationFlow.mjs';
import { createLogger } from '../utils/logger.mjs';

export class ClassificationMaintenanceService {
    constructor(deps = {}) {
        this.db = deps.db || defaultDb;
        this.logger = deps.logger || createLogger('ClassificationMaintenanceService');
    }

    async cleanupStaleAwaitingDecisions() {
        try {
            const result = await this.db.query(`
                UPDATE classification_history
                SET status = 'pending',
                    pending_reason = 'Re-queued after stale awaiting_decision (>7 days)'
                WHERE status = 'awaiting_decision'
                  AND created_at < NOW() - ($1 || ' days')::INTERVAL
                RETURNING id, title, tmdb_id, media_type
            `, [STALE_AWAITING_DECISION_DAYS]);

            if (result.rowCount === 0) return;

            this.logger.info('Stale awaiting_decision cleanup: reset rows', { count: result.rowCount });

            for (const row of result.rows) {
                try {
                    await this.db.query(
                        `INSERT INTO task_queue (task_type, priority, payload, status)
                         VALUES ('classification', 5, $1::jsonb, 'pending')
                         ON CONFLICT DO NOTHING`,
                        [JSON.stringify({
                            tmdb_id: row.tmdb_id,
                            media_type: row.media_type,
                            title: row.title,
                            source: 'stale_cleanup'
                        })]
                    );
                } catch (queueErr) {
                    this.logger.warn('Stale cleanup: failed to re-queue item', {
                        id: row.id,
                        error: queueErr.message
                    });
                }
            }
        } catch (error) {
            this.logger.error('Stale awaiting_decision cleanup failed', { error: error.message });
        }
    }
}

export const classificationMaintenanceService = new ClassificationMaintenanceService();
