/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { parseDaysConfig, formatDaysConfig } = require('../../utils/backfillHelpers');

const parseManualBackfillStartOptions = (body = {}) => {
    const rawBatchSize = body.batchSize ?? body.limit;
    if (rawBatchSize === undefined || rawBatchSize === null || rawBatchSize === '') {
        return {};
    }

    const batchSize = Number(rawBatchSize);
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
        const error = new Error('batchSize must be a positive integer');
        error.status = 400;
        throw error;
    }

    return { batchSize };
};

function createRagBackfillHelpers({
    db,
    embeddingService,
    manualBackfillService,
    scheduledBackfillService,
    idleBackfillService,
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
            return {
                realtime_embedding_enabled: true,
                idle_backfill_enabled: true,
                idle_threshold: 30000,
                idle_batch_size: 10,
                scheduled_backfill_enabled: true,
                scheduled_backfill_time: '02:00',
                scheduled_backfill_days: '0,1,2,3,4,5,6',
                scheduled_backfill_batch_size: 100,
                scheduled_backfill_max_duration: 3600000
            };
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

function registerRagBackfillRoutes({
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

    router.post('/backfill/manual/start', async (req, res) => {
        try {
            const options = parseManualBackfillStartOptions(req.body);
            await manualBackfillService.start(options);
            const { embeddingAvailability } = await resolvePresentedBackfillStatuses();
            res.json({ success: true, status: presentManualBackfillStatus(await manualBackfillService.getStatus(), embeddingAvailability) });
        } catch (error) {
            logger.error('Failed to start manual backfill', { error: error.message });
            res.status(error.status || 400).json({ error: error.message });
        }
    });

    router.post('/backfill/manual/pause', async (req, res) => {
        try {
            manualBackfillService.pause();
            const { embeddingAvailability } = await resolvePresentedBackfillStatuses();
            res.json({ success: true, status: presentManualBackfillStatus(await manualBackfillService.getStatus(), embeddingAvailability) });
        } catch (error) {
            logger.error('Failed to pause manual backfill', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/backfill/manual/resume', async (req, res) => {
        try {
            await manualBackfillService.resume();
            const { embeddingAvailability } = await resolvePresentedBackfillStatuses();
            res.json({ success: true, status: presentManualBackfillStatus(await manualBackfillService.getStatus(), embeddingAvailability) });
        } catch (error) {
            logger.error('Failed to resume manual backfill', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/backfill/manual/clear', async (req, res) => {
        try {
            await manualBackfillService.clear();
            const { embeddingAvailability } = await resolvePresentedBackfillStatuses();
            res.json({ success: true, status: presentManualBackfillStatus(await manualBackfillService.getStatus(), embeddingAvailability) });
        } catch (error) {
            logger.error('Failed to clear manual backfill', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/backfill/status', async (req, res) => {
        try {
            const pending = await manualBackfillService.getPendingCount();
            const pendingBreakdown = await embeddingService.getPendingBreakdown();
            const {
                manual: manualStatus,
                idle: idleStatus,
                scheduled: scheduledStatus,
                embeddingAvailability
            } = await resolvePresentedBackfillStatuses();

            res.json({
                manual: manualStatus,
                idle: idleStatus,
                scheduled: scheduledStatus,
                embeddingAvailability,
                pending,
                pendingBreakdown
            });
        } catch (error) {
            logger.error('Failed to get backfill status', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/backfill/config', async (req, res) => {
        try {
            res.json(await getBackfillConfigPayload());
        } catch (error) {
            logger.error('Failed to get backfill config', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/backfill/config', async (req, res) => {
        try {
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

            res.json({ success: true, config: await getBackfillConfigPayload() });
        } catch (error) {
            logger.error('Failed to update backfill config', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/backfill/history', async (req, res) => {
        try {
            res.json(await getBackfillHistoryPayload());
        } catch (error) {
            logger.error('Failed to get backfill history', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });
}

module.exports = {
    createRagBackfillHelpers,
    parseManualBackfillStartOptions,
    registerRagBackfillRoutes
};
