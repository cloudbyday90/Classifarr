/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { formatDaysConfig as defaultFormatDaysConfig, parseDaysConfig as defaultParseDaysConfig } from '../../utils/backfillHelpers.mjs';
import { ValidationError } from '../../utils/appError.mjs';
import {
    getRagBackfillConfigDefaults,
    validateRagBackfillConfigUpdate
} from './ragConfigDefaults.mjs';
import {
    buildRagErrorResponse,
    createRagRoute
} from './ragRouteResponseSupport.mjs';

export const parseManualBackfillStartOptions = (body = {}) => {
    const rawBatchSize = body.batchSize ?? body.limit;
    if (rawBatchSize === undefined || rawBatchSize === null || rawBatchSize === '') {
        return {};
    }

    const batchSize = Number(rawBatchSize);
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
        throw new ValidationError('batchSize must be a positive integer');
    }

    return { batchSize };
};

export function createRagBackfillHelpers({
    db,
    embeddingService,
    manualBackfillService,
    scheduledBackfillService,
    idleBackfillService,
    formatDaysConfig = defaultFormatDaysConfig,
    parseDaysConfig = defaultParseDaysConfig,
    presentEmbeddingAvailability,
    presentManualBackfillStatus,
    presentIdleBackfillStatus,
    presentScheduledBackfillStatus
}) {
    const resolveEmbeddingAvailability = async () => {
        const availability = await embeddingService.getProviderAvailabilityStatus({ refresh: true });
        return presentEmbeddingAvailability({
            ...availability,
            retryAt: availability.cooldownUntil
        });
    };

    const resolvePresentedBackfillStatuses = async () => {
        const embeddingAvailability = await resolveEmbeddingAvailability();
        const manual = presentManualBackfillStatus(await manualBackfillService.getStatus());
        const idle = presentIdleBackfillStatus(idleBackfillService.getStatus(), embeddingAvailability);
        const scheduled = presentScheduledBackfillStatus(scheduledBackfillService.getStatus(), embeddingAvailability);

        return {
            embeddingAvailability,
            manual,
            idle,
            scheduled
        };
    };

    const getBackfillConfigPayload = async () => {
        const result = await db.query(`
            SELECT
                realtime_embedding_enabled,
                idle_backfill_enabled,
                idle_threshold,
                idle_batch_size,
                scheduled_backfill_enabled,
                scheduled_backfill_time,
                scheduled_backfill_days,
                scheduled_backfill_batch_size,
                scheduled_backfill_max_duration
            FROM ai_provider_config
            WHERE id = 1
        `);

        if (result.rows.length === 0) {
            return getRagBackfillConfigDefaults();
        }

        return result.rows[0];
    };

    const getBackfillHistoryPayload = async () => {
        const history = await db.query(`
            SELECT * FROM backfill_runs
            ORDER BY created_at DESC
            LIMIT 20
        `);

        return { history: history.rows };
    };

    const updateBackfillConfig = async ({
        realtimeEnabled,
        idleEnabled,
        idleThreshold,
        idleBatchSize,
        scheduledEnabled,
        scheduledTime,
        scheduledDays,
        scheduledBatchSize,
        scheduledMaxDuration
    }) => {
        validateRagBackfillConfigUpdate({
            idle_threshold: idleThreshold,
            idle_batch_size: idleBatchSize,
            scheduled_backfill_batch_size: scheduledBatchSize,
            scheduled_backfill_max_duration: scheduledMaxDuration
        });

        const normalizedScheduledDays = typeof scheduledDays === 'string'
            ? scheduledDays
            : formatDaysConfig(scheduledDays);

        await db.query(`
            UPDATE ai_provider_config SET
                realtime_embedding_enabled = $1,
                idle_backfill_enabled = $2,
                idle_threshold = $3,
                idle_batch_size = $4,
                scheduled_backfill_enabled = $5,
                scheduled_backfill_time = $6,
                scheduled_backfill_days = $7,
                scheduled_backfill_batch_size = $8,
                scheduled_backfill_max_duration = $9
            WHERE id = 1
        `, [
            realtimeEnabled,
            idleEnabled,
            idleThreshold,
            idleBatchSize,
            scheduledEnabled,
            scheduledTime,
            normalizedScheduledDays,
            scheduledBatchSize,
            scheduledMaxDuration
        ]);

        await idleBackfillService.loadConfig();
        scheduledBackfillService.updateSchedule({
            enabled: scheduledEnabled,
            time: scheduledTime,
            days: parseDaysConfig(normalizedScheduledDays),
            batchSize: scheduledBatchSize,
            maxDuration: scheduledMaxDuration
        });
    };

    return {
        getBackfillConfigPayload,
        getBackfillHistoryPayload,
        parseManualBackfillStartOptions,
        resolveEmbeddingAvailability,
        resolvePresentedBackfillStatuses,
        updateBackfillConfig
    };
}

export function registerRagBackfillRoutes({
    router,
    logger,
    embeddingService,
    manualBackfillService,
    presentManualBackfillStatus,
    helpers
}) {
    const {
        getBackfillConfigPayload,
        getBackfillHistoryPayload,
        parseManualBackfillStartOptions,
        resolvePresentedBackfillStatuses,
        updateBackfillConfig
    } = helpers;

    const resolveManualBackfillStatusPayload = async () => {
        const { embeddingAvailability } = await resolvePresentedBackfillStatuses();
        return {
            success: true,
            status: presentManualBackfillStatus(await manualBackfillService.getStatus(), embeddingAvailability)
        };
    };

    router.post('/backfill/manual/start', createRagRoute(
        async (req) => {
            const options = parseManualBackfillStartOptions(req.body);
            await manualBackfillService.start(options);
            return resolveManualBackfillStatusPayload();
        },
        {
            logger,
            logMessage: 'Failed to start manual backfill',
            fallbackStatus: 400
        }
    ));

    router.post('/backfill/manual/pause', createRagRoute(
        async () => {
            manualBackfillService.pause();
            return resolveManualBackfillStatusPayload();
        },
        {
            logger,
            logMessage: 'Failed to pause manual backfill'
        }
    ));

    router.post('/backfill/manual/resume', createRagRoute(
        async () => {
            await manualBackfillService.resume();
            return resolveManualBackfillStatusPayload();
        },
        {
            logger,
            logMessage: 'Failed to resume manual backfill'
        }
    ));

    router.post('/backfill/manual/clear', createRagRoute(
        async () => {
            await manualBackfillService.clear();
            return resolveManualBackfillStatusPayload();
        },
        {
            logger,
            logMessage: 'Failed to clear manual backfill'
        }
    ));

    router.get('/backfill/status', createRagRoute(
        async () => {
            const pending = await manualBackfillService.getPendingCount();
            const pendingBreakdown = await embeddingService.getPendingBreakdown();
            const {
                manual: manualStatus,
                idle: idleStatus,
                scheduled: scheduledStatus,
                embeddingAvailability
            } = await resolvePresentedBackfillStatuses();

            return {
                manual: manualStatus,
                idle: idleStatus,
                scheduled: scheduledStatus,
                embeddingAvailability,
                pending,
                pendingBreakdown
            };
        },
        {
            logger,
            logMessage: 'Failed to get backfill status'
        }
    ));

    router.get('/backfill/config', createRagRoute(
        async () => getBackfillConfigPayload(),
        {
            logger,
            logMessage: 'Failed to get backfill config'
        }
    ));

    router.put('/backfill/config', createRagRoute(
        async (req) => {
            const payload = req.body || {};
            await updateBackfillConfig({
                realtimeEnabled: payload.realtime_embedding_enabled,
                idleEnabled: payload.idle_backfill_enabled,
                idleThreshold: payload.idle_threshold,
                idleBatchSize: payload.idle_batch_size,
                scheduledEnabled: payload.scheduled_backfill_enabled,
                scheduledTime: payload.scheduled_backfill_time,
                scheduledDays: payload.scheduled_backfill_days,
                scheduledBatchSize: payload.scheduled_backfill_batch_size,
                scheduledMaxDuration: payload.scheduled_backfill_max_duration
            });

            return { success: true, config: await getBackfillConfigPayload() };
        },
        {
            logger,
            logMessage: 'Failed to update backfill config',
            shouldLogError: (error) => !error?.status && !error?.statusCode && !error?.httpStatus,
            resolveErrorResponse: (error) => buildRagErrorResponse(error, {
                fallbackStatus: 500,
                includeDetails: true
            })
        }
    ));

    router.get('/backfill/history', createRagRoute(
        async () => getBackfillHistoryPayload(),
        {
            logger,
            logMessage: 'Failed to get backfill history'
        }
    ));
}
