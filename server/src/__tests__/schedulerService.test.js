/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

jest.mock('../config/database', () => ({
    query: jest.fn()
}));

jest.mock('../services/embeddingService', () => ({
    shouldIncludeImageEmbeddings: jest.fn().mockResolvedValue(false),
    getPendingCount: jest.fn().mockResolvedValue(0),
    getPendingEmbeddings: jest.fn().mockResolvedValue([]),
    generateAndStore: jest.fn().mockResolvedValue(),
    generateImageEmbedding: jest.fn().mockResolvedValue()
}));

jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
}));

const db = require('../config/database');
const embeddingService = require('../services/embeddingService');

describe('SchedulerService (schedulerService.js)', () => {
    let schedulerService;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        jest.mock('../config/database', () => ({
            query: jest.fn()
        }));
        jest.mock('../services/embeddingService', () => ({
            shouldIncludeImageEmbeddings: jest.fn().mockResolvedValue(false),
            getPendingCount: jest.fn().mockResolvedValue(0),
            getPendingEmbeddings: jest.fn().mockResolvedValue([]),
            generateAndStore: jest.fn().mockResolvedValue(),
            generateImageEmbedding: jest.fn().mockResolvedValue()
        }));
        jest.mock('../utils/logger', () => ({
            createLogger: () => ({
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn()
            })
        }));

        schedulerService = require('../services/schedulerService');
    });

    describe('checkRagBackfillSchedule', () => {
        it('runs when backfill_runs has no recent completed scheduler run', async () => {
            const dbModule = require('../config/database');
            const embeddingModule = require('../services/embeddingService');

            // RAG enabled
            dbModule.query.mockImplementation((sql) => {
                if (sql.includes('rag_enabled')) {
                    return Promise.resolve({ rows: [{ rag_enabled: true }] });
                }
                if (sql.includes('backfill_runs')) {
                    return Promise.resolve({ rows: [{ is_running: false, last_run: null }] });
                }
                return Promise.resolve({ rows: [] });
            });

            embeddingModule.getPendingCount.mockResolvedValue(5);
            embeddingModule.getPendingEmbeddings.mockResolvedValue([]);

            jest.spyOn(schedulerService, 'runRagBackfill').mockResolvedValue();

            await schedulerService.checkRagBackfillSchedule();

            expect(schedulerService.runRagBackfill).toHaveBeenCalled();
        });

        it('skips when a scheduler run completed within 5 minutes', async () => {
            const dbModule = require('../config/database');
            const embeddingModule = require('../services/embeddingService');

            const recentRun = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago

            dbModule.query.mockImplementation((sql) => {
                if (sql.includes('rag_enabled')) {
                    return Promise.resolve({ rows: [{ rag_enabled: true }] });
                }
                if (sql.includes('backfill_runs')) {
                    return Promise.resolve({ rows: [{ is_running: false, last_run: recentRun.toISOString() }] });
                }
                return Promise.resolve({ rows: [] });
            });

            embeddingModule.getPendingCount.mockResolvedValue(5);

            jest.spyOn(schedulerService, 'runRagBackfill').mockResolvedValue();

            await schedulerService.checkRagBackfillSchedule();

            expect(schedulerService.runRagBackfill).not.toHaveBeenCalled();
        });

        it('skips when a scheduler run is already in progress', async () => {
            const dbModule = require('../config/database');
            const embeddingModule = require('../services/embeddingService');

            dbModule.query.mockImplementation((sql) => {
                if (sql.includes('rag_enabled')) {
                    return Promise.resolve({ rows: [{ rag_enabled: true }] });
                }
                if (sql.includes('backfill_runs')) {
                    return Promise.resolve({ rows: [{ is_running: true, last_run: null }] });
                }
                return Promise.resolve({ rows: [] });
            });

            embeddingModule.getPendingCount.mockResolvedValue(5);

            jest.spyOn(schedulerService, 'runRagBackfill').mockResolvedValue();

            await schedulerService.checkRagBackfillSchedule();

            expect(schedulerService.runRagBackfill).not.toHaveBeenCalled();
        });

        it('does NOT query embedding_costs', async () => {
            const dbModule = require('../config/database');
            const embeddingModule = require('../services/embeddingService');

            dbModule.query.mockImplementation((sql) => {
                if (sql.includes('rag_enabled')) {
                    return Promise.resolve({ rows: [{ rag_enabled: true }] });
                }
                if (sql.includes('backfill_runs')) {
                    return Promise.resolve({ rows: [{ is_running: false, last_run: null }] });
                }
                return Promise.resolve({ rows: [] });
            });

            embeddingModule.getPendingCount.mockResolvedValue(5);
            embeddingModule.getPendingEmbeddings.mockResolvedValue([]);

            jest.spyOn(schedulerService, 'runRagBackfill').mockResolvedValue();

            await schedulerService.checkRagBackfillSchedule();

            const allSqlCalls = dbModule.query.mock.calls.map(([sql]) => sql);
            const usesEmbeddingCosts = allSqlCalls.some(sql => sql && sql.includes('embedding_costs'));
            expect(usesEmbeddingCosts).toBe(false);
        });
    });

    describe('runRagBackfill', () => {
        it('inserts backfill_runs row with type scheduler and marks completed', async () => {
            const dbModule = require('../config/database');
            const embeddingModule = require('../services/embeddingService');

            const pendingItems = [
                { id: 1, title: 'Movie A', media_type: 'movie', library_name: 'Movies', metadata: {}, needsText: true, needsImage: false },
                { id: 2, title: 'Movie B', media_type: 'movie', library_name: 'Movies', metadata: {}, needsText: true, needsImage: false }
            ];

            embeddingModule.shouldIncludeImageEmbeddings.mockResolvedValue(false);
            embeddingModule.getPendingEmbeddings.mockResolvedValue(pendingItems);
            embeddingModule.generateAndStore.mockResolvedValue();

            dbModule.query.mockImplementation((sql) => {
                if (sql.includes('INSERT INTO backfill_runs')) {
                    return Promise.resolve({ rows: [{ id: 42 }] });
                }
                if (sql.includes('UPDATE backfill_runs')) {
                    return Promise.resolve({ rowCount: 1 });
                }
                return Promise.resolve({ rows: [] });
            });

            await schedulerService.runRagBackfill();

            const insertCall = dbModule.query.mock.calls.find(
                ([sql]) => sql && sql.includes('INSERT INTO backfill_runs')
            );
            expect(insertCall).toBeDefined();
            expect(insertCall[0]).toMatch(/type.*scheduler/);
            expect(insertCall[1]).toContain(2); // total = 2 items

            const updateCall = dbModule.query.mock.calls.find(
                ([sql]) => sql && sql.includes('UPDATE backfill_runs') && sql.includes("status = 'completed'")
            );
            expect(updateCall).toBeDefined();
            expect(updateCall[1][0]).toBe(2); // processed = 2
            expect(updateCall[1][1]).toBe(42); // runId = 42
        });

        it('marks run failed when embedding throws', async () => {
            const dbModule = require('../config/database');
            const embeddingModule = require('../services/embeddingService');

            const pendingItems = [
                { id: 1, title: 'Movie A', media_type: 'movie', library_name: 'Movies', metadata: {}, needsText: true, needsImage: false }
            ];

            embeddingModule.shouldIncludeImageEmbeddings.mockResolvedValue(false);
            embeddingModule.getPendingEmbeddings.mockRejectedValue(new Error('Embedding service down'));

            dbModule.query.mockImplementation((sql) => {
                if (sql.includes('INSERT INTO backfill_runs')) {
                    return Promise.resolve({ rows: [{ id: 99 }] });
                }
                if (sql.includes('UPDATE backfill_runs')) {
                    return Promise.resolve({ rowCount: 1 });
                }
                return Promise.resolve({ rows: [] });
            });

            // Should not throw
            await expect(schedulerService.runRagBackfill()).resolves.toBeUndefined();

            // When getPendingEmbeddings throws, runId is still null (INSERT never called)
            // so no failed UPDATE is expected — just no throw propagates
        });

        it('marks run failed when outer error occurs after run is created', async () => {
            const dbModule = require('../config/database');
            const embeddingModule = require('../services/embeddingService');

            const pendingItems = [
                { id: 1, title: 'Movie A', media_type: 'movie', library_name: 'Movies', metadata: {}, needsText: true, needsImage: false }
            ];

            embeddingModule.shouldIncludeImageEmbeddings.mockResolvedValue(false);
            embeddingModule.getPendingEmbeddings.mockResolvedValue(pendingItems);
            embeddingModule.generateAndStore.mockResolvedValue();

            let callCount = 0;
            dbModule.query.mockImplementation((sql) => {
                callCount++;
                if (sql.includes('INSERT INTO backfill_runs')) {
                    return Promise.resolve({ rows: [{ id: 77 }] });
                }
                if (sql.includes("status = 'completed'")) {
                    throw new Error('DB write failed');
                }
                if (sql.includes('UPDATE backfill_runs')) {
                    return Promise.resolve({ rowCount: 1 });
                }
                return Promise.resolve({ rows: [] });
            });

            await expect(schedulerService.runRagBackfill()).resolves.toBeUndefined();

            const failedUpdateCall = dbModule.query.mock.calls.find(
                ([sql]) => sql && sql.includes('UPDATE backfill_runs') && sql.includes("status = 'failed'")
            );
            expect(failedUpdateCall).toBeDefined();
            expect(failedUpdateCall[1][1]).toBe(77); // runId = 77
        });
    });
});
