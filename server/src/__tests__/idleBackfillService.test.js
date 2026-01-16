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

jest.mock('../services/ollama', () => ({
    isModelLoaded: jest.fn(),
    preloadModel: jest.fn()
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

const ollamaService = require('../services/ollama');
const idleDetector = require('../utils/idleDetector');
const idleBackfillService = require('../services/idleBackfillService');

describe('IdleBackfillService', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset service state
        idleBackfillService.isRunning = false;
        idleBackfillService.config = null;
    });

    describe('Model Preloading', () => {
        test('should check if embedding model is loaded when using same mode', async () => {
            // Setup mocks for full flow
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
                .mockResolvedValueOnce({ // embedding config query
                    rows: [{
                        embedding_model: 'mxbai-embed-large',
                        embedding_provider_mode: 'same',
                        embedding_ollama_host: null
                    }]
                })
                .mockResolvedValueOnce({ // getPendingEmbeddings - empty to end loop
                    rows: []
                })
                .mockResolvedValueOnce({ // UPDATE backfill_runs completed
                    rows: []
                });

            ollamaService.isModelLoaded.mockResolvedValue(false);
            ollamaService.preloadModel.mockResolvedValue(true);
            idleDetector.isIdle.mockReturnValue(true);

            await idleBackfillService.startIdleBackfill();

            // Verify model loaded check was called
            expect(ollamaService.isModelLoaded).toHaveBeenCalledWith('mxbai-embed-large');
        });

        test('should preload model when not already loaded', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{
                        rag_enabled: true,
                        idle_backfill_enabled: true,
                        idle_threshold: 30000,
                        idle_batch_size: 10
                    }]
                })
                .mockResolvedValueOnce({
                    rows: [{ count: '5' }]
                })
                .mockResolvedValueOnce({
                    rows: [{ id: 1 }]
                })
                .mockResolvedValueOnce({
                    rows: [{
                        embedding_model: 'nomic-embed-text',
                        embedding_provider_mode: 'same',
                        embedding_ollama_host: null
                    }]
                })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            ollamaService.isModelLoaded.mockResolvedValue(false);
            ollamaService.preloadModel.mockResolvedValue(true);
            idleDetector.isIdle.mockReturnValue(true);

            await idleBackfillService.startIdleBackfill();

            expect(ollamaService.preloadModel).toHaveBeenCalledWith('nomic-embed-text', '30m');
        });

        test('should skip preload when model is already loaded', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{
                        rag_enabled: true,
                        idle_backfill_enabled: true,
                        idle_threshold: 30000,
                        idle_batch_size: 10
                    }]
                })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // No pending items
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                .mockResolvedValueOnce({
                    rows: [{
                        embedding_model: 'mxbai-embed-large',
                        embedding_provider_mode: 'same',
                        embedding_ollama_host: null
                    }]
                })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            ollamaService.isModelLoaded.mockResolvedValue(true); // Already loaded
            idleDetector.isIdle.mockReturnValue(true);

            await idleBackfillService.startIdleBackfill();

            expect(ollamaService.isModelLoaded).toHaveBeenCalled();
            expect(ollamaService.preloadModel).not.toHaveBeenCalled();
        });

        test('should skip preload when using separate_ollama mode', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{
                        rag_enabled: true,
                        idle_backfill_enabled: true,
                        idle_threshold: 30000,
                        idle_batch_size: 10
                    }]
                })
                .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                .mockResolvedValueOnce({
                    rows: [{
                        embedding_model: 'mxbai-embed-large',
                        embedding_provider_mode: 'separate_ollama',
                        embedding_ollama_host: '192.168.1.100'
                    }]
                })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            idleDetector.isIdle.mockReturnValue(true);

            await idleBackfillService.startIdleBackfill();

            expect(ollamaService.isModelLoaded).not.toHaveBeenCalled();
            expect(ollamaService.preloadModel).not.toHaveBeenCalled();
        });

        test('should continue processing even if preload fails', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{
                        rag_enabled: true,
                        idle_backfill_enabled: true,
                        idle_threshold: 30000,
                        idle_batch_size: 10
                    }]
                })
                .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                .mockResolvedValueOnce({
                    rows: [{
                        embedding_model: 'mxbai-embed-large',
                        embedding_provider_mode: 'same',
                        embedding_ollama_host: null
                    }]
                })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            ollamaService.isModelLoaded.mockResolvedValue(false);
            ollamaService.preloadModel.mockResolvedValue(false); // Preload fails
            idleDetector.isIdle.mockReturnValue(true);

            // Should not throw
            await expect(idleBackfillService.startIdleBackfill()).resolves.not.toThrow();
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

            await idleBackfillService.startIdleBackfill();

            // isRunning should still be true and no new backfill should have started
            expect(idleBackfillService.isRunning).toBe(true);
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
