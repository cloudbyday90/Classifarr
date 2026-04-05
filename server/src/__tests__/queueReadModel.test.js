/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { QueueReadModel } = require('../services/queueReadModel');

describe('QueueReadModel', () => {
    let db;
    let logger;
    let readModel;
    let getDispatchBlockers;
    let getRuntimeState;

    beforeEach(() => {
        db = { query: jest.fn() };
        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
        getDispatchBlockers = jest.fn().mockResolvedValue({
            hasProcessingClassification: false,
            lookupFailed: false,
        });
        getRuntimeState = jest.fn().mockReturnValue({
            aiAvailable: true,
            workerRunning: true,
        });

        readModel = new QueueReadModel({
            db,
            logger,
            getDispatchBlockers,
            getRuntimeState,
        });
    });

    it('builds queue stats with runtime and pause state', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                pending: '5',
                processing: '2',
                completed: '100',
                failed: '3',
            }],
        });

        const stats = await readModel.getStats();

        expect(stats).toEqual(expect.objectContaining({
            pending: 5,
            processing: 2,
            completed: 100,
            failed: 3,
            total: 110,
            aiAvailable: true,
            workerRunning: true,
            classificationPaused: false,
            classificationPauseReason: null,
        }));
    });

    it('marks classification as paused when the dispatch check fails', async () => {
        getDispatchBlockers.mockResolvedValueOnce({
            hasProcessingClassification: false,
            lookupFailed: true,
        });
        db.query.mockResolvedValueOnce({
            rows: [{
                pending: '1',
                processing: '0',
                completed: '2',
                failed: '0',
            }],
        });

        const stats = await readModel.getStats();

        expect(stats.classificationPaused).toBe(true);
        expect(stats.classificationPauseReason).toBe('dispatch_check_failed');
    });

    it('marks classification as paused when AI is unavailable while the worker is running', async () => {
        getRuntimeState.mockReturnValueOnce({
            aiAvailable: false,
            workerRunning: true,
        });
        db.query.mockResolvedValueOnce({
            rows: [{
                pending: '1',
                processing: '0',
                completed: '2',
                failed: '0',
            }],
        });

        const stats = await readModel.getStats();

        expect(stats.aiAvailable).toBe(false);
        expect(stats.workerRunning).toBe(true);
        expect(stats.classificationPaused).toBe(true);
        expect(stats.classificationPauseReason).toBe('ai_unavailable');
    });

    it('calculates gap analysis progress and ETA', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ count: '750' }] })
            .mockResolvedValueOnce({ rows: [{ count: '1000' }] });

        const stats = await readModel.getGapAnalysisStats();

        expect(stats).toEqual(expect.objectContaining({
            unprocessedCount: 750,
            processedCount: 250,
            totalCount: 1000,
            percentComplete: 25,
            batchSize: 500,
            batchesRemaining: 2,
            intervalMinutes: 5,
            estimatedMinutesRemaining: 10,
            estimatedCompletion: '~10 min (2 batches)',
        }));
    });

    it('returns pending and processing tasks ordered by priority and creation time', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

        const rows = await readModel.getPendingTasks(5);

        expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("WHERE status IN ('pending', 'processing')"),
            [5]
        );
    });

    it('returns failed tasks newest first', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 9 }] });

        const rows = await readModel.getFailedTasks(7);

        expect(rows).toEqual([{ id: 9 }]);
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("WHERE status = 'failed'"),
            [7]
        );
    });

    it('rethrows stats query failures after logging', async () => {
        db.query.mockRejectedValueOnce(new Error('stats blew up'));

        await expect(readModel.getStats()).rejects.toThrow('stats blew up');
        expect(logger.error).toHaveBeenCalledWith(
            'Failed to get queue stats',
            expect.objectContaining({ error: 'stats blew up' })
        );
    });

    it('rethrows gap-analysis failures after logging', async () => {
        db.query.mockRejectedValueOnce(new Error('gap blew up'));

        await expect(readModel.getGapAnalysisStats()).rejects.toThrow('gap blew up');
        expect(logger.error).toHaveBeenCalledWith(
            'Failed to get gap analysis stats',
            expect.objectContaining({ error: 'gap blew up' })
        );
    });

    it('rethrows pending task query failures after logging', async () => {
        db.query.mockRejectedValueOnce(new Error('pending blew up'));

        await expect(readModel.getPendingTasks(5)).rejects.toThrow('pending blew up');
        expect(logger.error).toHaveBeenCalledWith(
            'Failed to get pending tasks',
            expect.objectContaining({ error: 'pending blew up' })
        );
    });

    it('rethrows failed task query failures after logging', async () => {
        db.query.mockRejectedValueOnce(new Error('failed blew up'));

        await expect(readModel.getFailedTasks(7)).rejects.toThrow('failed blew up');
        expect(logger.error).toHaveBeenCalledWith(
            'Failed to get failed tasks',
            expect.objectContaining({ error: 'failed blew up' })
        );
    });
});
