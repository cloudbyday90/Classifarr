/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import {
    createRagBackfillHelpers,
    parseManualBackfillStartOptions,
    registerRagBackfillRoutes
} from '../routes/helpers/ragBackfillHelpers.mjs';

describe('ragBackfillHelpers', () => {
    const buildHelpers = (overrides = {}) => createRagBackfillHelpers({
        db: {
            query: jest.fn()
        },
        embeddingService: {
            getProviderAvailabilityStatus: jest.fn()
        },
        manualBackfillService: {
            getStatus: jest.fn()
        },
        scheduledBackfillService: {
            getStatus: jest.fn(),
            updateSchedule: jest.fn()
        },
        idleBackfillService: {
            getStatus: jest.fn(),
            loadConfig: jest.fn()
        },
        presentEmbeddingAvailability: jest.fn((payload) => ({ presented: true, ...payload })),
        presentManualBackfillStatus: jest.fn((status) => ({ type: 'manual', ...status })),
        presentIdleBackfillStatus: jest.fn((status, availability) => ({ type: 'idle', status, availability })),
        presentScheduledBackfillStatus: jest.fn((status, availability) => ({ type: 'scheduled', status, availability })),
        ...overrides
    });

    test('parseManualBackfillStartOptions accepts limit as batchSize alias', () => {
        expect(parseManualBackfillStartOptions({ limit: '25' })).toEqual({ batchSize: 25 });
    });

    test('parseManualBackfillStartOptions rejects non-positive batch sizes', () => {
        expect(() => parseManualBackfillStartOptions({ batchSize: 0 }))
            .toThrow('batchSize must be a positive integer');
    });

    test('resolvePresentedBackfillStatuses refreshes availability and passes it into idle and scheduled presenters', async () => {
        const embeddingService = {
            getProviderAvailabilityStatus: jest.fn().mockResolvedValue({
                available: false,
                cooldownUntil: '2026-03-28T05:00:00.000Z'
            })
        };
        const manualBackfillService = {
            getStatus: jest.fn().mockResolvedValue({ state: 'paused' })
        };
        const idleBackfillService = {
            getStatus: jest.fn(() => ({ enabled: true }))
        };
        const scheduledBackfillService = {
            getStatus: jest.fn(() => ({ enabled: false })),
            updateSchedule: jest.fn()
        };
        const presentEmbeddingAvailability = jest.fn((payload) => ({
            state: 'offline',
            retryAt: payload.retryAt
        }));
        const presentIdleBackfillStatus = jest.fn((status, availability) => ({
            status,
            availability
        }));
        const presentScheduledBackfillStatus = jest.fn((status, availability) => ({
            status,
            availability
        }));

        const helpers = buildHelpers({
            embeddingService,
            manualBackfillService,
            idleBackfillService,
            scheduledBackfillService,
            presentEmbeddingAvailability,
            presentIdleBackfillStatus,
            presentScheduledBackfillStatus
        });

        const result = await helpers.resolvePresentedBackfillStatuses();

        expect(embeddingService.getProviderAvailabilityStatus).toHaveBeenCalledWith({ refresh: true });
        expect(presentEmbeddingAvailability).toHaveBeenCalledWith({
            available: false,
            cooldownUntil: '2026-03-28T05:00:00.000Z',
            retryAt: '2026-03-28T05:00:00.000Z'
        });
        expect(presentIdleBackfillStatus).toHaveBeenCalledWith(
            { enabled: true },
            { state: 'offline', retryAt: '2026-03-28T05:00:00.000Z' }
        );
        expect(presentScheduledBackfillStatus).toHaveBeenCalledWith(
            { enabled: false },
            { state: 'offline', retryAt: '2026-03-28T05:00:00.000Z' }
        );
        expect(result).toMatchObject({
            embeddingAvailability: { state: 'offline', retryAt: '2026-03-28T05:00:00.000Z' },
            manual: { type: 'manual', state: 'paused' }
        });
    });

    test('getBackfillConfigPayload returns defaults when config row is missing', async () => {
        const db = {
            query: jest.fn().mockResolvedValue({ rows: [] })
        };
        const helpers = buildHelpers({ db });

        await expect(helpers.getBackfillConfigPayload()).resolves.toEqual({
            realtime_embedding_enabled: true,
            idle_backfill_enabled: true,
            idle_threshold: 30000,
            idle_batch_size: 10,
            scheduled_backfill_enabled: true,
            scheduled_backfill_time: '02:00',
            scheduled_backfill_days: '0,1,2,3,4,5,6',
            scheduled_backfill_batch_size: 100,
            scheduled_backfill_max_duration: 3600000
        });
    });

    test('getBackfillHistoryPayload returns the last 20 runs in the route response shape', async () => {
        const db = {
            query: jest.fn().mockResolvedValue({
                rows: [
                    { id: 2, status: 'completed' },
                    { id: 1, status: 'cancelled' }
                ]
            })
        };
        const helpers = buildHelpers({ db });

        await expect(helpers.getBackfillHistoryPayload()).resolves.toEqual({
            history: [
                { id: 2, status: 'completed' },
                { id: 1, status: 'cancelled' }
            ]
        });
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM backfill_runs'));
    });

    test('updateBackfillConfig normalizes day arrays and reloads the dependent services', async () => {
        const db = {
            query: jest.fn().mockResolvedValue({ rows: [] })
        };
        const idleBackfillService = {
            getStatus: jest.fn(),
            loadConfig: jest.fn().mockResolvedValue(undefined)
        };
        const scheduledBackfillService = {
            getStatus: jest.fn(),
            updateSchedule: jest.fn()
        };
        const helpers = buildHelpers({
            db,
            idleBackfillService,
            scheduledBackfillService
        });

        await helpers.updateBackfillConfig({
            realtimeEnabled: false,
            idleEnabled: true,
            idleThreshold: 45000,
            idleBatchSize: 15,
            scheduledEnabled: true,
            scheduledTime: '03:15',
            scheduledDays: [1, 3, 5],
            scheduledBatchSize: 200,
            scheduledMaxDuration: 7200000
        });

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE ai_provider_config SET'), [
            false,
            true,
            45000,
            15,
            true,
            '03:15',
            '1,3,5',
            200,
            7200000
        ]);
        expect(idleBackfillService.loadConfig).toHaveBeenCalled();
        expect(scheduledBackfillService.updateSchedule).toHaveBeenCalledWith({
            enabled: true,
            time: '03:15',
            days: [1, 3, 5],
            batchSize: 200,
            maxDuration: 7200000
        });
    });

    test('updateBackfillConfig rejects invalid numeric values with a structured validation error', async () => {
        const helpers = buildHelpers();

        await expect(helpers.updateBackfillConfig({
            idleThreshold: 0,
            idleBatchSize: 'bad',
            scheduledBatchSize: -5,
            scheduledMaxDuration: 'NaN'
        })).rejects.toMatchObject({
            status: 400,
            message: 'Validation failed',
            details: [
                'idle_threshold must be a positive integer',
                'idle_batch_size must be a positive integer',
                'scheduled_backfill_batch_size must be a positive integer',
                'scheduled_backfill_max_duration must be a positive integer'
            ]
        });
    });

    test('registerRagBackfillRoutes covers success, validation, and failure responses across the backfill route surface', async () => {
        const logger = {
            error: jest.fn()
        };
        const manualBackfillService = {
            start: jest.fn()
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('start failed')),
            pause: jest.fn()
                .mockImplementationOnce(() => undefined)
                .mockImplementationOnce(() => {
                    throw new Error('pause failed');
                }),
            resume: jest.fn()
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('resume failed')),
            clear: jest.fn()
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('clear failed')),
            getPendingCount: jest.fn()
                .mockResolvedValueOnce(12)
                .mockRejectedValueOnce(new Error('status failed')),
            getStatus: jest.fn().mockResolvedValue({ state: 'running' })
        };
        const embeddingService = {
            getPendingBreakdown: jest.fn().mockResolvedValue({ text: 3, image: 4, total: 7 })
        };
        const helpers = {
            getBackfillConfigPayload: jest.fn()
                .mockResolvedValueOnce({ idle_backfill_enabled: true })
                .mockRejectedValueOnce(new Error('config failed'))
                .mockResolvedValueOnce({ idle_backfill_enabled: false })
                .mockRejectedValueOnce(new Error('history config failed')),
            getBackfillHistoryPayload: jest.fn()
                .mockResolvedValueOnce({ history: [] })
                .mockRejectedValueOnce(new Error('history failed')),
            parseManualBackfillStartOptions,
            resolvePresentedBackfillStatuses: jest.fn().mockResolvedValue({
                embeddingAvailability: { status: 'online' },
                manual: { state: 'running' },
                idle: { state: 'idle' },
                scheduled: { state: 'scheduled' }
            }),
            updateBackfillConfig: jest.fn()
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(Object.assign(new Error('Validation failed'), {
                    statusCode: 400,
                    details: ['idle_threshold must be a positive integer']
                }))
                .mockRejectedValueOnce(new Error('update failed'))
        };
        const presentManualBackfillStatus = jest.fn((status, availability) => ({
            state: status.state,
            availability
        }));

        const app = express();
        const router = express.Router();
        app.use(express.json());
        registerRagBackfillRoutes({
            router,
            logger,
            embeddingService,
            manualBackfillService,
            presentManualBackfillStatus,
            helpers
        });
        app.use('/rag', router);

        await request(app).post('/rag/backfill/manual/start').send({ batchSize: 5 }).expect(200, {
            success: true,
            status: { state: 'running', availability: { status: 'online' } }
        });
        await request(app).post('/rag/backfill/manual/start').send({ batchSize: 0 }).expect(400, {
            error: 'batchSize must be a positive integer'
        });
        await request(app).post('/rag/backfill/manual/start').send({ batchSize: 6 }).expect(400, {
            error: 'start failed'
        });

        await request(app).post('/rag/backfill/manual/pause').expect(200, {
            success: true,
            status: { state: 'running', availability: { status: 'online' } }
        });
        await request(app).post('/rag/backfill/manual/pause').expect(500, { error: 'pause failed' });

        await request(app).post('/rag/backfill/manual/resume').expect(200, {
            success: true,
            status: { state: 'running', availability: { status: 'online' } }
        });
        await request(app).post('/rag/backfill/manual/resume').expect(500, { error: 'resume failed' });

        await request(app).post('/rag/backfill/manual/clear').expect(200, {
            success: true,
            status: { state: 'running', availability: { status: 'online' } }
        });
        await request(app).post('/rag/backfill/manual/clear').expect(500, { error: 'clear failed' });

        await request(app).get('/rag/backfill/status').expect(200, {
            manual: { state: 'running' },
            idle: { state: 'idle' },
            scheduled: { state: 'scheduled' },
            embeddingAvailability: { status: 'online' },
            pending: 12,
            pendingBreakdown: { text: 3, image: 4, total: 7 }
        });
        await request(app).get('/rag/backfill/status').expect(500, { error: 'status failed' });

        await request(app).get('/rag/backfill/config').expect(200, { idle_backfill_enabled: true });
        await request(app).get('/rag/backfill/config').expect(500, { error: 'config failed' });

        await request(app).put('/rag/backfill/config').send({ idle_backfill_enabled: false }).expect(200, {
            success: true,
            config: { idle_backfill_enabled: false }
        });
        await request(app).put('/rag/backfill/config').send({ idle_threshold: 0 }).expect(400, {
            error: 'Validation failed',
            details: ['idle_threshold must be a positive integer']
        });
        await request(app).put('/rag/backfill/config').send({ idle_backfill_enabled: true }).expect(500, {
            error: 'update failed'
        });

        await request(app).get('/rag/backfill/history').expect(200, { history: [] });
        await request(app).get('/rag/backfill/history').expect(500, { error: 'history failed' });

        expect(logger.error).toHaveBeenCalledWith('Failed to start manual backfill', { error: 'batchSize must be a positive integer' });
        expect(logger.error).toHaveBeenCalledWith('Failed to start manual backfill', { error: 'start failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to pause manual backfill', { error: 'pause failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to resume manual backfill', { error: 'resume failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to clear manual backfill', { error: 'clear failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get backfill status', { error: 'status failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get backfill config', { error: 'config failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to update backfill config', { error: 'update failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get backfill history', { error: 'history failed' });
    });
});
