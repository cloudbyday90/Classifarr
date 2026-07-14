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
import { webSearchProviderRetentionService as defaultWebSearchProviderRetentionService } from './webSearchProviderRetentionService.mjs';
import {
    webSearchProviderRouteDecisionRetentionService as defaultWebSearchProviderRouteDecisionRetentionService,
} from './webSearchProviderRouteDecisionRetention.mjs';
import {
    webSearchProviderHealthRetentionService as defaultWebSearchProviderHealthRetentionService,
} from './webSearchProviderHealthRetention.mjs';
import {
    policyRollbackSnapshotRetentionService as defaultPolicyRollbackSnapshotRetentionService,
} from './policyRollbackSnapshotRetentionService.mjs';

const ERROR_LOG_BATCH_SIZE = 1000;

export class SchedulerRetentionService {
    constructor(deps = {}) {
        this.db = deps.db || defaultDb;
        this.logger = deps.logger || createLogger('SchedulerRetentionService');
        this.webSearchProviderRetentionService = deps.webSearchProviderRetentionService || defaultWebSearchProviderRetentionService;
        this.webSearchProviderRouteDecisionRetentionService = deps.webSearchProviderRouteDecisionRetentionService
            || defaultWebSearchProviderRouteDecisionRetentionService;
        this.webSearchProviderHealthRetentionService = deps.webSearchProviderHealthRetentionService
            || defaultWebSearchProviderHealthRetentionService;
        this.policyRollbackSnapshotRetentionService = deps.policyRollbackSnapshotRetentionService
            || defaultPolicyRollbackSnapshotRetentionService;
    }

    async _runCleanupTask(label, task) {
        try {
            await task();
        } catch (error) {
            this.logger.error(`${label} failed`, { error: error.message });
        }
    }

    async runRefreshTokenCleanup() {
        if (process.env.REFRESH_TOKEN_CLEANUP_ENABLED === 'false') return;
        return this._runCleanupTask('Refresh token cleanup', async () => {
            const result = await this.db.query(
                `DELETE FROM refresh_tokens
                 WHERE id IN (
                     SELECT id FROM refresh_tokens
                     WHERE expires_at < NOW() OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')
                     LIMIT 1000
                 )`
            );
            this.logger.info('Refresh token cleanup complete', { deleted: result.rowCount });
        });
    }

    async runApiKeyAuditPrune() {
        const parsedRetentionDays = parseInt(process.env.API_AUDIT_RETENTION_DAYS, 10);
        const retentionDays = Number.isFinite(parsedRetentionDays) ? parsedRetentionDays : 90;
        return this._runCleanupTask('API key audit prune', async () => {
            const result = await this.db.query(
                `DELETE FROM api_key_audit
                 WHERE id IN (
                     SELECT id FROM api_key_audit
                     WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
                     LIMIT 1000
                 )`,
                [retentionDays]
            );
            this.logger.info('API key audit prune complete', { deleted: result.rowCount, retentionDays });
        });
    }

    async runErrorLogCleanup() {
        return this._runCleanupTask('Error log cleanup', async () => {
            const settingsResult = await this.db.query(
                `SELECT value
                 FROM settings
                 WHERE key = 'error_log_retention_days'
                 LIMIT 1`
            );

            const configuredValue = settingsResult.rows[0]?.value;
            const parsedRetentionDays = parseInt(configuredValue, 10);
            const retentionDays = Number.isFinite(parsedRetentionDays) && parsedRetentionDays > 0
                ? parsedRetentionDays
                : 30;

            let totalDeleted = 0;
            let deletedInBatch = 0;

            do {
                const result = await this.db.query(
                    `DELETE FROM error_log
                     WHERE id IN (
                         SELECT id FROM error_log
                         WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
                         LIMIT $2
                     )`,
                    [retentionDays, ERROR_LOG_BATCH_SIZE]
                );

                deletedInBatch = result.rowCount;
                totalDeleted += deletedInBatch;
            } while (deletedInBatch === ERROR_LOG_BATCH_SIZE);

            if (totalDeleted > 0) {
                this.logger.info('Error log cleanup complete', { deleted: totalDeleted, retentionDays });
            } else {
                this.logger.debug('Error log cleanup: no rows to delete', { retentionDays });
            }
        });
    }

    async runWebSearchProviderRetentionCleanup() {
        const providerRetention = await this.webSearchProviderRetentionService.cleanup();
        const routeDecisionRetention = await this.webSearchProviderRouteDecisionRetentionService.cleanup();
        const healthRetention = await this.webSearchProviderHealthRetentionService.cleanup();
        return {
            ...providerRetention,
            ...routeDecisionRetention,
            ...healthRetention,
        };
    }

    async runPolicyRollbackSnapshotRetentionCleanup() {
        return this.policyRollbackSnapshotRetentionService.cleanup();
    }
}

export const schedulerRetentionService = new SchedulerRetentionService();
