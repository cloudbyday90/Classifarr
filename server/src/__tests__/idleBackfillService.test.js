/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');

// Mock all dependencies
jest.mock('../config/database', () => ({
    query: jest.fn(),
    withSessionAdvisoryLock: jest.fn(),
    DB_ADVISORY_LOCKS: { IDLE_BACKFILL: 1001, SCHEDULED_BACKFILL: 1002, MANUAL_BACKFILL: 1003, BACKFILL_OWNER: 1004 }
}));

jest.mock('../services/embeddingService', () => ({
    generateAndStore: jest.fn(),
    generateImageEmbedding: jest.fn(),
    getPendingCount: jest.fn(),
    getPendingEmbeddings: jest.fn(),
    shouldIncludeImageEmbeddings: jest.fn()
}));

jest.mock('../utils/idleDetector', () => ({
    isIdle: jest.fn(),
    setIdleThreshold: jest.fn()
}));

jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
}));

const idleDetector = require('../utils/idleDetector');
const idleBackfillService = require('../services/idleBackfillService');
const embeddingService = require('../services/embeddingService');

describe('IdleBackfillService', () => {
    beforeEach(() => {
        jest.resetAllMocks();

        // Reset service state
        idleBackfillService.isRunning = false;
        idleBackfillService.config = null;
        idleBackfillService.includeImage = false;
        idleBackfillService.providerOfflineUntil = null;
        embeddingService.shouldIncludeImageEmbeddings.mockResolvedValue(false);
        embeddingService.getPendingCount.mockResolvedValue(0);
        embeddingService.getPendingEmbeddings.mockResolvedValue([]);

        // Default: advisory lock acquired — fn() is called and returns true
        db.withSessionAdvisoryLock.mockImplementation(async (lockKey, fn) => {
            await fn();
            return true;
        });
    });

    describe('Configuration', () => {
        test('should not start when RAG is disabled', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{
                    rag_enabled: false,
                    idle_backfill_enabled: true
                }]
            });

            await idleBackfillService.startIdleBackfill();

            expect(idleBackfillService.isRunning).toBe(false);
        });

        test('should not start when idle backfill is disabled', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{
                    rag_enabled: true,
                    idle_backfill_enabled: false
                }]
            });

            await idleBackfillService.startIdleBackfill();

            expect(idleBackfillService.isRunning).toBe(false);
        });

        test('should not start if already running', async () => {
            idleBackfillService.isRunning = true;
            idleBackfillService.config = { rag_enabled: true, idle_backfill_enabled: true };

            db.query.mockResolvedValueOnce({
                rows: [{
                    rag_enabled: true,
                    idle_backfill_enabled: true
                }]
            });

            await idleBackfillService.startIdleBackfill();

            // isRunning should still be true and no new backfill should have started
            expect(idleBackfillService.isRunning).toBe(true);
            // Should not have called getPendingCount
            expect(db.query).toHaveBeenCalledTimes(1); // only loadConfig
        });

        test('should start processing when enabled and idle', async () => {
            db.query
                .mockResolvedValueOnce({ // loadConfig
                    rows: [{
                        rag_enabled: true,
                        idle_backfill_enabled: true,
                        idle_threshold: 30000,
                        idle_batch_size: 10
                    }]
                })
                .mockResolvedValueOnce({ // INSERT backfill_runs
                    rows: [{ id: 1 }]
                })
                .mockResolvedValueOnce({ // UPDATE backfill_runs completed
                    rows: []
                });

            embeddingService.getPendingCount.mockResolvedValueOnce(5);
            embeddingService.getPendingEmbeddings.mockResolvedValueOnce([]);
            idleDetector.isIdle.mockReturnValue(true);

            await idleBackfillService.startIdleBackfill();

            // Verify it started
            expect(db.query).toHaveBeenCalled();
        });
    });

    describe('Bug #2: Early exit should not leave isRunning = true', () => {
        test('should not set isRunning when no config row exists (uses disabled defaults)', async () => {
            // Empty rows → loadConfig returns { rag_enabled: false, idle_backfill_enabled: false }
            // Service exits via the "RAG is disabled" path, never setting isRunning
            db.query.mockResolvedValueOnce({
                rows: []
            });

            await idleBackfillService.startIdleBackfill();

            expect(idleBackfillService.isRunning).toBe(false);
        });

        test('should not set isRunning when no pending embeddings', async () => {
            db.query
                .mockResolvedValueOnce({ // loadConfig
                    rows: [{
                        rag_enabled: true,
                        idle_backfill_enabled: true,
                        idle_threshold: 30000,
                        idle_batch_size: 10
                    }]
                })
                .mockResolvedValueOnce({ rows: [] });

            embeddingService.getPendingCount.mockResolvedValueOnce(0);

            await idleBackfillService.startIdleBackfill();

            expect(idleBackfillService.isRunning).toBe(false);
        });
    });

    describe('Bug #4: Config load failure handling', () => {
        test('should return disabled defaults when no config row exists (fresh install)', async () => {
            // Fresh install: ai_provider_config has no row yet.
            // loadConfig() must return a safe disabled object, NOT null, so the
            // service exits quietly via the RAG-disabled path instead of logging an error.
            db.query.mockResolvedValueOnce({ rows: [] });

            const config = await idleBackfillService.loadConfig();

            expect(config).not.toBeNull();
            expect(config.rag_enabled).toBe(false);
            expect(config.idle_backfill_enabled).toBe(false);
            expect(idleBackfillService.isRunning).toBe(false);
        });

        test('should not throw when DB query errors', async () => {
            db.query.mockRejectedValueOnce(new Error('Database connection failed'));

            // Should resolve (not throw/reject) — catch block absorbs the error
            await idleBackfillService.loadConfig();
            expect(idleBackfillService.isRunning).toBe(false);
        });

        test('should not set isRunning when DB errors during config load', async () => {
            db.query.mockRejectedValueOnce(new Error('Database connection failed'));

            await idleBackfillService.startIdleBackfill();

            expect(idleBackfillService.isRunning).toBe(false);
        });
    });

    describe('Bug #6: isRunning state reset on errors', () => {
        test('should reset isRunning on database error during backfill', async () => {
            db.query
                .mockResolvedValueOnce({ // loadConfig
                    rows: [{
                        rag_enabled: true,
                        idle_backfill_enabled: true,
                        idle_threshold: 30000,
                        idle_batch_size: 10
                    }]
                })
                .mockRejectedValueOnce(new Error('Database error')); // INSERT backfill_runs fails

            embeddingService.getPendingCount.mockResolvedValueOnce(5);
            idleDetector.isIdle.mockReturnValue(true);

            await idleBackfillService.startIdleBackfill();

            // Should have reset isRunning despite error
            expect(idleBackfillService.isRunning).toBe(false);
        });

        test('should clean up database record on startup errors after INSERT', async () => {
            const runId = 123;
            
            idleDetector.isIdle.mockReturnValue(true);
            
            db.query
                .mockResolvedValueOnce({ // loadConfig
                    rows: [{
                        rag_enabled: true,
                        idle_backfill_enabled: true,
                        idle_threshold: 30000,
                        idle_batch_size: 10
                    }]
                })
                .mockResolvedValueOnce({ // INSERT backfill_runs
                    rows: [{ id: runId }]
                })
                .mockResolvedValueOnce({ rows: [] }); // UPDATE to mark as failed

            embeddingService.getPendingCount.mockResolvedValueOnce(5);
            const pendingSpy = jest.spyOn(idleBackfillService, 'getPendingEmbeddings')
                .mockRejectedValueOnce(new Error('Unexpected error fetching pending'));
            await idleBackfillService.startIdleBackfill();
            pendingSpy.mockRestore();

            // Should have reset isRunning
            expect(idleBackfillService.isRunning).toBe(false);
            // Should have created the run record
            const insertCall = db.query.mock.calls.find(call => call[0].includes('INSERT INTO backfill_runs'));
            expect(insertCall).toBeDefined();
        });
    });

    describe('stopIdleBackfill', () => {
        test('should set isRunning to false', () => {
            idleBackfillService.isRunning = true;

            idleBackfillService.stopIdleBackfill();

            expect(idleBackfillService.isRunning).toBe(false);
        });

        test('should do nothing if not running', () => {
            idleBackfillService.isRunning = false;

            idleBackfillService.stopIdleBackfill();

            expect(idleBackfillService.isRunning).toBe(false);
        });
    });

    describe('provider offline cooldown', () => {
        test('releases the run immediately and records a cooldown instead of sleeping under the lock', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{
                        rag_enabled: true,
                        idle_backfill_enabled: true,
                        idle_threshold: 30000,
                        idle_batch_size: 10
                    }]
                })
                .mockResolvedValueOnce({ rows: [{ id: 51 }] })
                .mockResolvedValueOnce({ rows: [] });

            embeddingService.getPendingCount.mockResolvedValueOnce(1);
            embeddingService.getPendingEmbeddings.mockResolvedValueOnce([
                { id: 5, needsText: true, needsImage: false, metadata: {}, title: 'Offline', media_type: 'movie', library_name: 'Movies' }
            ]);
            embeddingService.generateAndStore.mockRejectedValueOnce(new Error('PROVIDER_OFFLINE'));
            idleDetector.isIdle.mockReturnValue(true);
            const sleepSpy = jest.spyOn(idleBackfillService, 'sleep');

            await idleBackfillService.startIdleBackfill();

            expect(sleepSpy).not.toHaveBeenCalledWith(300000);
            expect(idleBackfillService.isRunning).toBe(false);
            expect(idleBackfillService.providerOfflineUntil).toEqual(expect.any(Number));
        });

        test('skips restart attempts while provider offline cooldown is active', async () => {
            idleBackfillService.providerOfflineUntil = Date.now() + 60000;
            const lockBodySpy = jest.fn();
            db.withSessionAdvisoryLock.mockImplementation(async (_lockKey, fn) => {
                lockBodySpy.mockImplementation(fn);
                await fn();
                return true;
            });

            db.query.mockResolvedValueOnce({
                rows: [{
                    rag_enabled: true,
                    idle_backfill_enabled: true,
                    idle_threshold: 30000,
                    idle_batch_size: 10
                }]
            });

            await idleBackfillService.startIdleBackfill();

            expect(db.withSessionAdvisoryLock).not.toHaveBeenCalled();
            expect(lockBodySpy).not.toHaveBeenCalled();
        });
    });

    describe('getStatus', () => {
        test('should return current status', () => {
            idleBackfillService.isRunning = true;
            idleBackfillService.config = { idle_batch_size: 20 };

            const status = idleBackfillService.getStatus();

            expect(status).toEqual({
                status: 'running',
                enabled: false,
                isRunning: true,
                batchSize: 10,
                includeImage: false,
                cooldownUntil: null,
                config: { idle_batch_size: 20 }
            });
        });

        test('reports cooldown status when provider cooldown is active', () => {
            idleBackfillService.config = { idle_backfill_enabled: true, idle_batch_size: 20 };
            idleBackfillService.providerOfflineUntil = Date.now() + 60000;

            const status = idleBackfillService.getStatus();

            expect(status.status).toBe('cooldown');
            expect(status.enabled).toBe(true);
            expect(status.isRunning).toBe(false);
            expect(status.cooldownUntil).toEqual(expect.any(String));
        });
    });

    describe('Advisory lock guard', () => {
        test('skips backfill when advisory lock is not acquired', async () => {
            // Set up config so the service would normally proceed
            db.query.mockResolvedValueOnce({
                rows: [{
                    rag_enabled: true,
                    idle_backfill_enabled: true,
                    idle_threshold: 300,
                    idle_batch_size: 10
                }]
            });
            idleDetector.isIdle.mockReturnValue(true);

            // Advisory lock not acquired — withSessionAdvisoryLock returns false without calling fn
            db.withSessionAdvisoryLock.mockResolvedValue(false);

            await idleBackfillService.startIdleBackfill();

            // isRunning should remain false — no backfill was started
            expect(idleBackfillService.isRunning).toBe(false);
            expect(db.withSessionAdvisoryLock).toHaveBeenCalledWith(
                db.DB_ADVISORY_LOCKS.BACKFILL_OWNER,
                expect.any(Function)
            );
        });
    });
});
