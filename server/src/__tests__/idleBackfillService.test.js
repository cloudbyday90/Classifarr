/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');

// Mock all dependencies
jest.mock('../config/database', () => ({
    query: jest.fn()
}));

jest.mock('../services/embeddingService', () => ({
    generateAndStore: jest.fn()
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

describe('IdleBackfillService', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset service state
        idleBackfillService.isRunning = false;
        idleBackfillService.config = null;
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
                .mockResolvedValueOnce({ // getPendingCount for initial count
                    rows: [{ count: '5' }]
                })
                .mockResolvedValueOnce({ // INSERT backfill_runs
                    rows: [{ id: 1 }]
                })
                .mockResolvedValueOnce({ // getPendingEmbeddings - empty to end loop
                    rows: []
                })
                .mockResolvedValueOnce({ // UPDATE backfill_runs completed
                    rows: []
                });

            idleDetector.isIdle.mockReturnValue(true);

            await idleBackfillService.startIdleBackfill();

            // Verify it started
            expect(db.query).toHaveBeenCalled();
        });
    });

    describe('Bug #2: Early exit should not leave isRunning = true', () => {
        test('should not set isRunning when config load fails', async () => {
            db.query.mockResolvedValueOnce({
                rows: [] // No config returned
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
                .mockResolvedValueOnce({ // getPendingCount
                    rows: [{ count: '0' }]
                });

            await idleBackfillService.startIdleBackfill();

            expect(idleBackfillService.isRunning).toBe(false);
        });
    });

    describe('Bug #4: Config load failure handling', () => {
        test('should handle null config from loadConfig', async () => {
            db.query.mockResolvedValueOnce({
                rows: [] // Empty result, loadConfig returns null
            });

            await idleBackfillService.startIdleBackfill();

            expect(idleBackfillService.isRunning).toBe(false);
        });

        test('should handle config load error gracefully', async () => {
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
                .mockResolvedValueOnce({ // getPendingCount
                    rows: [{ count: '5' }]
                })
                .mockRejectedValueOnce(new Error('Database error')); // INSERT backfill_runs fails

            idleDetector.isIdle.mockReturnValue(true);

            await idleBackfillService.startIdleBackfill();

            // Should have reset isRunning despite error
            expect(idleBackfillService.isRunning).toBe(false);
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

    describe('getStatus', () => {
        test('should return current status', () => {
            idleBackfillService.isRunning = true;
            idleBackfillService.config = { idle_batch_size: 20 };

            const status = idleBackfillService.getStatus();

            expect(status).toEqual({
                isRunning: true,
                config: { idle_batch_size: 20 }
            });
        });
    });
});
