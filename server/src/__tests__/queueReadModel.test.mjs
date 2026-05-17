/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

import { QueueReadModel } from '../services/queueReadModel.mjs';

describe('QueueReadModel', () => {
    let db;
    let logger;
    let readModel;
    let getDispatchBlockers;
    let getRuntimeState;
    let getSyncStatus;

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
        getSyncStatus = jest.fn().mockReturnValue({
            isRunning: false,
            type: null,
            progress: 0,
            currentLibrary: null,
            startedAt: null,
            duration: 0,
            canInterrupt: true,
        });
        readModel = new QueueReadModel({
            db,
            logger,
            getDispatchBlockers,
            getRuntimeState,
            getSyncStatus,
            enrichmentRetryService: {
                getStats: jest.fn().mockResolvedValue({
                    tavily: { pending: 2, deferred: 1, actionablePending: 1 },
                    omdb: { pending: 3, actionablePending: 3 },
                    total: { pending: 5, deferred: 1, actionablePending: 4 },
                }),
            },
        });
    });

    it('builds queue stats with runtime and pause state', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                pending: '5',
                processing: '2',
            }],
        }).mockResolvedValueOnce({
            rows: [{
                successful_count: '100',
                failed_count: '3',
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
            }],
        }).mockResolvedValueOnce({
            rows: [{
                successful_count: '2',
                failed_count: '0',
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
            }],
        }).mockResolvedValueOnce({
            rows: [{
                successful_count: '2',
                failed_count: '0',
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

    it('builds explicit enrichment item/provider state into live stats', async () => {
        db.query.mockImplementation(async (sql) => {
            if (sql.includes("FROM task_queue") && sql.includes("WHERE task_type = 'classification'")) {
                return { rows: [{ pending: '2', processing: '1' }] };
            }
            if (sql.includes('FROM classification_history_totals')) {
                return { rows: [{ successful_count: '3', failed_count: '0' }] };
            }
            if (sql.includes("WHERE metadata->'content_analysis' IS NULL")) {
                return { rows: [{ count: '4' }] };
            }
            if (sql.includes('SELECT COUNT(*) as count FROM media_server_items')) {
                return { rows: [{ count: '10' }] };
            }
            if (sql.includes('WITH latest_sync AS')) {
                return { rows: [{ synced_items: '10', total_items: '12', running_libraries: '0', tracked_libraries: '2' }] };
            }
            if (sql.includes('FROM classification_history')) {
                return { rows: [{ new_classified: '1', all_classified: '2', new_avg_confidence: '80', all_avg_confidence: '85' }] };
            }
            if (sql.includes('FROM media_server_items') && sql.includes('completed_items')) {
                return {
                    rows: [{
                        total_items: '10',
                        completed_items: '6',
                        processing_items: '1',
                        pending_items: '2',
                        deferred_items: '1',
                        failed_items: '1',
                        tavily_enriched: '3',
                        omdb_enriched: '5'
                    }]
                };
            }
            if (sql.includes("task_type = 'metadata_enrichment'")) {
                return { rows: [{ pending: '4' }] };
            }
            throw new Error(`Unexpected query: ${sql}`);
        });

        const liveStats = await readModel.getLiveStats();

        expect(liveStats.enrichment).toEqual(expect.objectContaining({
            totalItems: 10,
            tavilyEnriched: 3,
            omdbEnriched: 5,
            pending: 4,
            actionablePending: 8,
            completedItems: 6,
            processingItems: 1,
            pendingItems: 2,
            deferredItems: 1,
            failedItems: 1,
            progress: 60,
            coreProgress: 50,
        }));
        expect(liveStats.librarySync).toEqual({
            syncedItems: 10,
            totalItems: 12,
            remainingItems: 2,
            percentComplete: 83,
            isRunning: false,
            type: null,
            progress: 0,
            currentLibrary: null,
            startedAt: null,
            duration: 0,
            canInterrupt: true,
            runningLibraries: 0,
            trackedLibraries: 2,
        });
    });
});
