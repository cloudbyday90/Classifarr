/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { QueueMutationService } = require('../services/queueMutationService');

describe('QueueMutationService', () => {
    let db;
    let logger;
    let enqueueTask;
    let mutationService;

    beforeEach(() => {
        db = { query: jest.fn() };
        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
        enqueueTask = jest.fn().mockResolvedValue(1);
        mutationService = new QueueMutationService({
            db,
            logger,
            enqueueTask,
        });
    });

    it('retries a failed task', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 123, status: 'failed' }] })
            .mockResolvedValueOnce({ rowCount: 1 });

        const result = await mutationService.retryTask(123);

        expect(result).toEqual({ success: true });
        expect(db.query).toHaveBeenCalledWith(
            expect.stringMatching(/UPDATE task_queue.*SET status = 'pending'/s),
            [123]
        );
    });

    it('returns typed outcomes for dismissing failed tasks', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 456, status: 'failed' }] })
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 790, status: 'pending' }] });

        await expect(mutationService.dismissFailedTask(456)).resolves.toEqual({ success: true });
        await expect(mutationService.dismissFailedTask(789)).resolves.toEqual({ success: false, code: 'not_found' });
        await expect(mutationService.dismissFailedTask(790)).resolves.toEqual({
            success: false,
            code: 'invalid_state',
            currentStatus: 'pending',
        });
    });

    it('returns typed outcomes for cancelling tasks', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 99, status: 'pending' }] })
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ id: 100, status: 'failed' }] });

        await expect(mutationService.cancelTask(99)).resolves.toEqual({ success: true });
        await expect(mutationService.cancelTask(100)).resolves.toEqual({
            success: false,
            code: 'invalid_state',
            currentStatus: 'failed',
        });
    });

    it('returns typed bulk outcomes for clear/retry/cancel operations', async () => {
        db.query
            .mockResolvedValueOnce({ rowCount: 2 })
            .mockResolvedValueOnce({ rowCount: 3 })
            .mockResolvedValueOnce({ rowCount: 4 });

        await expect(mutationService.clearFailedTasks()).resolves.toEqual({ success: true, count: 2 });
        await expect(mutationService.retryAllFailedTasks()).resolves.toEqual({ success: true, count: 3 });
        await expect(mutationService.cancelAllPendingTasks()).resolves.toEqual({ success: true, count: 4 });
    });

    it('returns typed bulk failures instead of flattening database errors to zero', async () => {
        db.query
            .mockRejectedValueOnce(new Error('delete failed'))
            .mockRejectedValueOnce(new Error('retry failed'))
            .mockRejectedValueOnce(new Error('cancel failed'))
            .mockRejectedValueOnce(new Error('completed failed'));

        await expect(mutationService.clearFailedTasks()).resolves.toEqual({
            success: false,
            code: 'bulk_action_failed',
            action: 'clear_failed',
        });
        await expect(mutationService.retryAllFailedTasks()).resolves.toEqual({
            success: false,
            code: 'bulk_action_failed',
            action: 'retry_all_failed',
        });
        await expect(mutationService.cancelAllPendingTasks()).resolves.toEqual({
            success: false,
            code: 'bulk_action_failed',
            action: 'cancel_all_pending',
        });
        await expect(mutationService.clearCompletedTasks()).resolves.toEqual({
            success: false,
            code: 'bulk_action_failed',
            action: 'clear_completed',
        });
    });

    it('requeues completed history entries for reprocessing', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 10,
                tmdb_id: 27205,
                media_type: 'movie',
                title: 'Inception',
                year: 2010,
                metadata: JSON.stringify({
                    overview: 'Dream thieves',
                    genres: [{ name: 'Sci-Fi' }],
                    keywords: [{ name: 'dream' }],
                    certification: 'PG-13',
                    original_language: 'en',
                }),
            }],
        });

        const result = await mutationService.reprocessCompleted();

        expect(result).toEqual({ success: true, count: 1 });
        expect(enqueueTask).toHaveBeenCalledWith(
            'classification',
            expect.objectContaining({
                title: 'Inception',
                overview: 'Dream thieves',
                genres: ['Sci-Fi'],
                keywords: ['dream'],
                content_rating: 'PG-13',
                tmdb_id: 27205,
                media: { media_type: 'movie' },
            }),
            expect.objectContaining({
                priority: 5,
                source: 'reprocess',
            })
        );
    });

    it('returns a typed bulk failure when reprocess completed fails', async () => {
        db.query.mockRejectedValueOnce(new Error('history select failed'));

        await expect(mutationService.reprocessCompleted()).resolves.toEqual({
            success: false,
            code: 'bulk_action_failed',
            action: 'reprocess_completed',
        });
    });
});
