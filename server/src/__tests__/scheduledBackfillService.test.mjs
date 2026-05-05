/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

const mockDb = {
    query: jest.fn(),
    withSessionAdvisoryLock: jest.fn(),
    DB_ADVISORY_LOCKS: { IDLE_BACKFILL: 1001, SCHEDULED_BACKFILL: 1002, MANUAL_BACKFILL: 1003, BACKFILL_OWNER: 1004 }
};

const mockEmbeddingService = {
    shouldIncludeImageEmbeddings: jest.fn(),
    getPendingEmbeddings: jest.fn(),
    generateAndStore: jest.fn(),
    generateImageEmbedding: jest.fn(),
    getProviderAvailabilityStatus: jest.fn(),
    isProviderBusyError: jest.fn()
};

const mockLogger = {
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
};

jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.unstable_mockModule('../services/embeddingService.mjs', () => ({ ...mockEmbeddingService, default: mockEmbeddingService }));

jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLogger, default: mockLogger }));

const { default: scheduledBackfillService } = await import('../services/scheduledBackfillService.mjs');
const db = mockDb;
const embeddingService = mockEmbeddingService;

describe('ScheduledBackfillService', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        scheduledBackfillService.isRunning = false;
        scheduledBackfillService.shouldContinueRunning = false;
        scheduledBackfillService.schedulerInterval = null;
        scheduledBackfillService.schedule = {
            enabled: true,
            ragEnabled: true,
            time: '02:00',
            days: [0, 1, 2, 3, 4, 5, 6],
            batchSize: 25,
            maxDuration: 60000
        };
        jest.spyOn(scheduledBackfillService, 'loadScheduleConfig').mockResolvedValue(scheduledBackfillService.schedule);
        db.withSessionAdvisoryLock.mockResolvedValue(false);
        embeddingService.shouldIncludeImageEmbeddings.mockResolvedValue(false);
        embeddingService.getPendingEmbeddings.mockResolvedValue([]);
        embeddingService.getProviderAvailabilityStatus.mockReturnValue({
            status: 'available',
            cooldownUntil: null
        });
        embeddingService.isProviderBusyError.mockReturnValue(false);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('uses the shared backfill owner lock before running scheduled work', async () => {
        await scheduledBackfillService.runScheduledBackfill();

        expect(db.withSessionAdvisoryLock).toHaveBeenCalledWith(
            db.DB_ADVISORY_LOCKS.BACKFILL_OWNER,
            expect.any(Function)
        );
    });

    it('reports live runtime status separately from schedule config', () => {
        scheduledBackfillService.isRunning = true;
        scheduledBackfillService.lastCheckTime = '02:00';
        scheduledBackfillService.shouldContinueRunning = true;

        expect(scheduledBackfillService.getStatus()).toEqual({
            enabled: true,
            ragEnabled: true,
            time: '02:00',
            days: [0, 1, 2, 3, 4, 5, 6],
            batchSize: 25,
            maxDuration: 60000,
            status: 'running',
            isRunning: true,
            lastCheckTime: '02:00',
            stopRequested: false
        });
    });

    it('stop interrupts an active scheduled run instead of only clearing the interval', async () => {
        db.withSessionAdvisoryLock.mockImplementation(async (_lockKey, fn) => {
            await fn();
            return true;
        });

        db.query
            .mockResolvedValueOnce({ rows: [{ id: 14 }] })
            .mockResolvedValueOnce({ rows: [] });

        embeddingService.shouldIncludeImageEmbeddings.mockResolvedValue(false);
        let markFirstItemStarted;
        const firstItemStarted = new Promise((resolve) => {
            markFirstItemStarted = resolve;
        });
        let resolveFirstItem;
        embeddingService.getPendingEmbeddings
            .mockResolvedValueOnce([
                { id: 1, needsText: true, needsImage: false, metadata: {}, title: 'A', media_type: 'movie', library_name: 'Movies' },
                { id: 2, needsText: true, needsImage: false, metadata: {}, title: 'B', media_type: 'movie', library_name: 'Movies' }
            ])
            .mockResolvedValueOnce([]);
        embeddingService.generateAndStore.mockImplementationOnce(() => new Promise((resolve) => {
            markFirstItemStarted();
            resolveFirstItem = () => resolve({});
        }));

        const runPromise = scheduledBackfillService.runScheduledBackfill();
        await firstItemStarted;

        expect(scheduledBackfillService.isRunning).toBe(true);
        scheduledBackfillService.stop();
        resolveFirstItem();
        await runPromise;

        expect(scheduledBackfillService.isRunning).toBe(false);
        expect(scheduledBackfillService.shouldContinueRunning).toBe(false);
        expect(embeddingService.generateAndStore).toHaveBeenCalledTimes(1);
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('SET status = $1'),
            ['cancelled', 1, 14]
        );
    });

    it('skips scheduled runs while provider cooldown is active', async () => {
        embeddingService.getProviderAvailabilityStatus.mockReturnValue({
            status: 'cooldown',
            cooldownUntil: new Date(Date.now() + 60000).toISOString()
        });

        await scheduledBackfillService.runScheduledBackfill();

        expect(db.withSessionAdvisoryLock).not.toHaveBeenCalled();
    });

    it('yields without counting progress when provider is busy', async () => {
        db.withSessionAdvisoryLock.mockImplementation(async (_lockKey, fn) => {
            await fn();
            return true;
        });

        db.query
            .mockResolvedValueOnce({ rows: [{ id: 25 }] })
            .mockResolvedValueOnce({ rows: [] });

        embeddingService.shouldIncludeImageEmbeddings.mockResolvedValue(false);
        embeddingService.getPendingEmbeddings.mockResolvedValueOnce([
            { id: 1, needsText: true, needsImage: false, metadata: {}, title: 'Busy', media_type: 'movie', library_name: 'Movies' },
            { id: 2, needsText: true, needsImage: false, metadata: {}, title: 'Later', media_type: 'movie', library_name: 'Movies' }
        ]);
        embeddingService.generateAndStore.mockRejectedValueOnce(Object.assign(new Error('PROVIDER_BUSY'), {
            code: 'EMBEDDING_PROVIDER_BUSY',
            lockHolder: 'classification',
            waitMs: 1400,
            activeModel: 'gemma3:12b'
        }));
        embeddingService.isProviderBusyError.mockReturnValue(true);

        await scheduledBackfillService.runScheduledBackfill();

        expect(embeddingService.generateAndStore).toHaveBeenCalledTimes(1);
        expect(scheduledBackfillService.isRunning).toBe(false);
        expect(db.query).toHaveBeenLastCalledWith(
            expect.stringContaining('SET status = $1'),
            ['cancelled', 0, 25]
        );
    });
});