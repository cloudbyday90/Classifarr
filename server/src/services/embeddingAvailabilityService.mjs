/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const { withSessionAdvisoryLock, DB_ADVISORY_LOCKS } = db;

const logger = createLogger('EmbeddingAvailabilityService');

class EmbeddingAvailabilityService {
    constructor() {
        this.cachedStatus = this.buildDefaultStatus();
    }

    buildDefaultStatus(overrides = {}) {
        return {
            status: 'available',
            isOffline: false,
            cooldownUntil: null,
            lastError: null,
            failureCount: 0,
            lastFailureAt: null,
            lastFailureSource: null,
            probeStartedAt: null,
            lastProbeAt: null,
            lastRecoveredAt: null,
            updatedAt: null,
            ...overrides
        };
    }

    getOfflineCooldownMs(failureCount = 0) {
        const schedule = [
            5 * 60 * 1000,
            15 * 60 * 1000,
            30 * 60 * 1000,
            60 * 60 * 1000,
            3 * 60 * 60 * 1000,
            6 * 60 * 60 * 1000
        ];

        const index = Math.max(0, Math.min(Number(failureCount) || 0, schedule.length) - 1);
        return schedule[index] || schedule[schedule.length - 1];
    }

    normalizeTimestamp(value) {
        return value ? new Date(value).toISOString() : null;
    }

    mapRowToStatus(row) {
        if (!row) {
            return this.buildDefaultStatus();
        }

        const cooldownUntil = this.normalizeTimestamp(row.cooldown_until);
        const cooldownActive = cooldownUntil && new Date(cooldownUntil).getTime() > Date.now();
        const rawStatus = row.availability_status || 'available';
        const status = rawStatus === 'available'
            ? 'available'
            : rawStatus === 'probing'
                ? 'probing'
                : cooldownActive
                    ? 'cooldown'
                    : 'probe_due';

        return this.buildDefaultStatus({
            status,
            isOffline: status !== 'available',
            cooldownUntil,
            lastError: row.last_error || null,
            failureCount: Number(row.failure_count) || 0,
            lastFailureAt: this.normalizeTimestamp(row.last_failure_at),
            lastFailureSource: row.last_failure_source || null,
            probeStartedAt: this.normalizeTimestamp(row.probe_started_at),
            lastProbeAt: this.normalizeTimestamp(row.last_probe_at),
            lastRecoveredAt: this.normalizeTimestamp(row.last_recovered_at),
            updatedAt: this.normalizeTimestamp(row.updated_at)
        });
    }

    updateCache(row) {
        this.cachedStatus = this.mapRowToStatus(row);
        return this.getStatus();
    }

    getStatus() {
        return { ...this.cachedStatus };
    }

    async ensureSingletonRow() {
        await db.query(`
            INSERT INTO embedding_provider_availability (id)
            VALUES (1)
            ON CONFLICT (id) DO NOTHING
        `);
    }

    async getStatusFresh() {
        try {
            await this.ensureSingletonRow();
            const result = await db.query(`
                SELECT
                    availability_status,
                    failure_count,
                    last_error,
                    last_failure_source,
                    last_failure_at,
                    cooldown_until,
                    probe_started_at,
                    last_probe_at,
                    last_recovered_at,
                    updated_at
                FROM embedding_provider_availability
                WHERE id = 1
            `);

            return this.updateCache(result.rows[0] || null);
        } catch (error) {
            logger.warn('Failed to load embedding availability state; using cached state', {
                error: error.message
            }, { skipDbPersist: true });
            return this.getStatus();
        }
    }

    async resetAvailability({ logRecovery = false, probe = null } = {}) {
        try {
            await this.ensureSingletonRow();
            const result = await db.query(`
                UPDATE embedding_provider_availability
                SET availability_status = 'available',
                    failure_count = 0,
                    last_error = NULL,
                    last_failure_source = NULL,
                    cooldown_until = NULL,
                    probe_started_at = NULL,
                    last_probe_at = COALESCE($1::timestamptz, last_probe_at),
                    last_recovered_at = NOW(),
                    updated_at = NOW()
                WHERE id = 1
                RETURNING *
            `, [probe ? new Date().toISOString() : null]);

            const status = this.updateCache(result.rows[0] || null);
            if (logRecovery) {
                logger.info('Embedding provider recovered; resuming queued embedding work', {
                    provider: probe?.provider || null,
                    model: probe?.model || null
                }, { skipDbPersist: true });
            }
            return status;
        } catch (error) {
            logger.warn('Failed to persist embedding availability recovery; using cached state', {
                error: error.message
            }, { skipDbPersist: true });
            this.cachedStatus = this.buildDefaultStatus({
                lastRecoveredAt: new Date().toISOString()
            });
            return this.getStatus();
        }
    }

    async markUnavailable(error, { source = 'embedding' } = {}) {
        const current = await this.getStatusFresh();
        const nextFailureCount = Math.max(1, (Number(current.failureCount) || 0) + 1);
        const cooldownUntil = new Date(Date.now() + this.getOfflineCooldownMs(nextFailureCount)).toISOString();

        try {
            await this.ensureSingletonRow();
            const result = await db.query(`
                UPDATE embedding_provider_availability
                SET availability_status = 'cooldown',
                    failure_count = $1,
                    last_error = $2,
                    last_failure_source = $3,
                    last_failure_at = NOW(),
                    cooldown_until = $4,
                    probe_started_at = NULL,
                    updated_at = NOW()
                WHERE id = 1
                RETURNING *
            `, [nextFailureCount, error.message, source, cooldownUntil]);

            const status = this.updateCache(result.rows[0] || null);
            const logPayload = {
                source,
                error: error.message,
                retryAt: status.cooldownUntil,
                failureCount: status.failureCount
            };

            if (current.isOffline) {
                logger.info('Embedding provider still unavailable; extending cooldown', logPayload, { skipDbPersist: true });
            } else {
                logger.warn('Embedding provider is unavailable', logPayload, { skipDbPersist: true });
            }
            return status;
        } catch (persistError) {
            logger.warn('Failed to persist embedding availability cooldown; using cached state', {
                error: persistError.message
            }, { skipDbPersist: true });
            this.cachedStatus = this.buildDefaultStatus({
                status: 'cooldown',
                isOffline: true,
                cooldownUntil,
                lastError: error.message,
                failureCount: nextFailureCount,
                lastFailureAt: new Date().toISOString(),
                lastFailureSource: source
            });
            return this.getStatus();
        }
    }

    async markProbing() {
        try {
            await this.ensureSingletonRow();
            const result = await db.query(`
                UPDATE embedding_provider_availability
                SET availability_status = 'probing',
                    probe_started_at = NOW(),
                    last_probe_at = NOW(),
                    updated_at = NOW()
                WHERE id = 1
                RETURNING *
            `);

            return this.updateCache(result.rows[0] || null);
        } catch (error) {
            logger.warn('Failed to persist embedding probe state; using cached state', {
                error: error.message
            }, { skipDbPersist: true });
            this.cachedStatus = this.buildDefaultStatus({
                ...this.cachedStatus,
                status: 'probing',
                isOffline: true,
                probeStartedAt: new Date().toISOString(),
                lastProbeAt: new Date().toISOString()
            });
            return this.getStatus();
        }
    }

    async runRecoveryProbe(probeFn) {
        const status = await this.getStatusFresh();
        if (status.status === 'available') {
            return true;
        }

        if (status.status === 'cooldown' && status.cooldownUntil && new Date(status.cooldownUntil).getTime() > Date.now()) {
            return false;
        }

        let recovered = false;
        const lockAcquired = await withSessionAdvisoryLock(
            DB_ADVISORY_LOCKS.EMBEDDING_PROVIDER_PROBE,
            async () => {
                const latest = await this.getStatusFresh();
                if (latest.status === 'available') {
                    recovered = true;
                    return;
                }

                if (latest.status === 'cooldown' && latest.cooldownUntil && new Date(latest.cooldownUntil).getTime() > Date.now()) {
                    return;
                }

                await this.markProbing();

                try {
                    const probe = await probeFn();
                    if (probe?.success) {
                        await this.resetAvailability({ logRecovery: true, probe });
                        recovered = true;
                        return;
                    }

                    const probeError = new Error(probe?.error || 'Embedding provider probe failed');
                    await this.markUnavailable(probeError, { source: 'probe' });
                } catch (error) {
                    await this.markUnavailable(error, { source: 'probe' });
                }
            }
        );

        if (!lockAcquired) {
            const latest = await this.getStatusFresh();
            return latest.status === 'available';
        }

        return recovered;
    }
}

export const embeddingAvailabilityService = new EmbeddingAvailabilityService();

export { EmbeddingAvailabilityService };
