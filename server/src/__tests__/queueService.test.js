/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const queueService = require('../services/queueService');
const db = require('../config/database');
const classificationService = require('../services/classification');

jest.mock('../config/database');
jest.mock('../services/classification');
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

// Mock dynamic requires
jest.mock('../services/omdb', () => ({
    getByTitle: jest.fn()
}), { virtual: true });

jest.mock('../services/tavily', () => ({
    getContentAdvisory: jest.fn(),
    search: jest.fn(),
    searchAnimeInfo: jest.fn()
}), { virtual: true });

jest.mock('../utils/rateLimiter', () => ({
    rateLimiters: {
        omdb: { execute: jest.fn(fn => fn()) },
        tavily: { execute: jest.fn(fn => fn()) }
    }
}));

describe('QueueService', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        queueService.processing = 0;
        queueService.running = false;
    });

    describe('enqueue', () => {
        it('should insert task into database', async () => {
            db.query.mockResolvedValue({ rows: [{ id: 123 }] });

            const taskId = await queueService.enqueue('classification', { title: 'Test' });

            expect(taskId).toBe(123);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO task_queue'),
                expect.arrayContaining(['classification', expect.stringContaining('Test')])
            );
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('DB Error'));

            await expect(queueService.enqueue('test', {})).rejects.toThrow('DB Error');
        });
    });

    describe('processTask', () => {
        it('should process classification task success', async () => {
            const task = {
                id: 1,
                task_type: 'classification',
                payload: JSON.stringify({ title: 'Test Movie' })
            };

            classificationService.classify.mockResolvedValue({
                library: { name: 'Movies' },
                bestMatch: { type: 'movie', confidence: 90 }
            });

            // Mock db.query for completeTask
            db.query.mockResolvedValue({});

            await queueService.processTask(task);

            expect(classificationService.classify).toHaveBeenCalled();
            // Use regex to match query ignoring whitespace
            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue\s+SET status = 'completed'/),
                expect.any(Array)
            );
        });

        it('should process metadata_enrichment task (OMDb+Tavily)', async () => {
            const task = {
                id: 2,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify({
                    title: 'Test Movie',
                    year: 2024,
                    itemId: 55,
                    source_library_id: 1,
                    source_library_name: 'Movies'
                })
            };

            // Mock OMDb configuration query AND update query
            db.query.mockImplementation((query) => {
                if (query.includes('SELECT * FROM omdb_config')) {
                    return Promise.resolve({ rows: [{ api_key: 'test_key', is_active: true }] });
                }
                if (query.includes('SELECT * FROM tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            await queueService.processTask(task);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE media_server_items/),
                expect.any(Array)
            );
        });
    });

    describe('startWorker', () => {
        it('should start worker loop', async () => {
            // Mock internal methods to avoid loop and DB calls
            jest.spyOn(queueService, 'resetStaleProcessingTasks').mockResolvedValue();
            jest.spyOn(queueService, 'dequeue').mockResolvedValue(null);

            // Mock setTimeout to "fast forward" or just return immediately if needed
            // But since we just want to check state change, we can call it.
            // NOTE: useFakeTimers is complex here due to loop.
            // We'll rely on running state check.

            const workerPromise = queueService.startWorker();

            // Wait for async start logic (resetStaleProcessingTasks) to resolve
            await new Promise(resolve => setImmediate(resolve));

            expect(queueService.running).toBe(true);

            // Stop it to break the loop
            queueService.stopWorker();

            await workerPromise; // Should resolve now that running is false

            expect(queueService.running).toBe(false);
        });

        it('should not start if already running', async () => {
            queueService.running = true;
            jest.spyOn(queueService, 'resetStaleProcessingTasks').mockResolvedValue();

            await queueService.startWorker();

            // Should exit immediately without calling resetStale
            expect(queueService.resetStaleProcessingTasks).not.toHaveBeenCalled();
        });
    });

    describe('dequeue', () => {
        it('should return next pending task', async () => {
            const mockTask = { id: 1, task_type: 'classification', payload: '{}' };
            // Use mockImplementation to handle the UPDATE...RETURNING query
            db.query.mockImplementation((query) => {
                if (query.includes('RETURNING')) {
                    return Promise.resolve({ rows: [mockTask] });
                }
                return Promise.resolve({ rows: [] });
            });

            const task = await queueService.dequeue();

            expect(task).toEqual(mockTask);
        });

        it('should return null when queue is empty', async () => {
            db.query.mockImplementation(() => Promise.resolve({ rows: [] }));

            const task = await queueService.dequeue();

            expect(task).toBeNull();
        });
    });

    describe('completeTask', () => {
        it('should mark task as completed', async () => {
            db.query.mockResolvedValue({});

            await queueService.completeTask(123, { success: true });

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'completed'/s),
                expect.arrayContaining([123])
            );
        });
    });

    describe('failTask', () => {
        it('should mark task as failed when max attempts reached', async () => {
            db.query.mockResolvedValue({});

            await queueService.failTask(123, 'Error message', 3, 3);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'failed'/s),
                expect.arrayContaining([123, 'Error message'])
            );
        });

        it('should reschedule task for retry when attempts remain', async () => {
            db.query.mockResolvedValue({});

            await queueService.failTask(123, 'Temporary error', 1, 3);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'pending'/s),
                expect.any(Array)
            );
        });
    });

    describe('getStats', () => {
        it('should return queue statistics', async () => {
            // getStats runs a GROUP BY query and builds stats object
            db.query.mockResolvedValueOnce({
                rows: [
                    { status: 'pending', count: '5' },
                    { status: 'processing', count: '2' },
                    { status: 'completed', count: '100' },
                    { status: 'failed', count: '3' }
                ]
            });

            const stats = await queueService.getStats();

            expect(stats.pending).toBe(5);
            expect(stats.processing).toBe(2);
            expect(stats.completed).toBe(100);
            expect(stats.failed).toBe(3);
            expect(stats.total).toBe(110);
            expect(stats).toHaveProperty('aiAvailable');
            expect(stats).toHaveProperty('workerRunning');
        });
    });

    describe('retryTask', () => {
        it('should reset failed task to pending', async () => {
            db.query.mockResolvedValue({ rowCount: 1 });

            await queueService.retryTask(123);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'pending'/s),
                expect.arrayContaining([123])
            );
        });
    });

    describe('cancelTask', () => {
        it('should mark task as cancelled', async () => {
            db.query.mockResolvedValue({ rowCount: 1 });

            await queueService.cancelTask(123);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'cancelled'/s),
                expect.arrayContaining([123])
            );
        });
    });
});
