/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { jest } from '@jest/globals';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockEmbeddingService = {
    shouldIncludeImageEmbeddings: jest.fn(),
    getPendingCount: jest.fn(),
    getPendingEmbeddings: jest.fn(),
    generateAndStore: jest.fn(),
    generateImageEmbedding: jest.fn(),
    getProviderAvailabilityStatus: jest.fn(),
    isProviderBusyError: jest.fn()
};

const mockEmbeddingProvider = {
    warmup: jest.fn()
};

const mockEmbeddingRouter = {
    getCircuitStatus: jest.fn()
};

const mockPoolClient = {
    query: jest.fn(),
    release: jest.fn()
};

const mockDb = {
    query: jest.fn(),
    pool: {
        connect: jest.fn().mockResolvedValue(mockPoolClient)
    },
    DB_ADVISORY_LOCKS: { IDLE_BACKFILL: 1001, SCHEDULED_BACKFILL: 1002, MANUAL_BACKFILL: 1003, BACKFILL_OWNER: 1004 },
    _mockPoolClient: mockPoolClient
};

const mockLoggerModule = {
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
};

jest.unstable_mockModule('../services/embeddingService.mjs', () => createNamedMockModule('embeddingService', mockEmbeddingService));

jest.unstable_mockModule('../services/embeddingProvider.mjs', () => createNamedMockModule('embeddingProvider', mockEmbeddingProvider));

jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createNamedMockModule('embeddingRouter', mockEmbeddingRouter));

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLoggerModule));

const { manualBackfillService } = await import('../services/manualBackfillService.mjs');
const embeddingService = mockEmbeddingService;
const embeddingRouter = mockEmbeddingRouter;
const db = mockDb;

describe('ManualBackfillService', () => {
    beforeEach(async () => {
        jest.restoreAllMocks();
        jest.resetAllMocks();
        await manualBackfillService.clear();
        manualBackfillService._lockClient = null;
        embeddingRouter.getCircuitStatus.mockReturnValue({ state: 'CLOSED' });
        embeddingService.getProviderAvailabilityStatus.mockReturnValue({
            status: 'available',
            cooldownUntil: null
        });
        embeddingService.isProviderBusyError.mockReturnValue(false);

        // Default: advisory lock acquired (so existing tests pass)
        const mockPoolClientRef = db._mockPoolClient;
        db.pool.connect.mockResolvedValue(mockPoolClientRef);
        // First call: pg_try_advisory_lock (acquired), subsequent: pg_advisory_unlock / unlock on error
        mockPoolClientRef.query.mockResolvedValue({ rows: [{ acquired: true }] });
        mockPoolClientRef.release.mockReset();
    });

    it('rejects start when RAG is disabled', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ rag_enabled: false }] });

        await expect(manualBackfillService.start()).rejects.toThrow('RAG is not enabled');
        expect(db.query).toHaveBeenCalledWith(
            'SELECT rag_enabled, manual_backfill_batch_size FROM ai_provider_config WHERE id = 1'
        );
    });

    it('throws a configuration-not-found error on fresh install (no ai_provider_config row)', async () => {
        db.query.mockResolvedValueOnce({ rows: [] }); // no row yet

        const err = await manualBackfillService.start().catch(e => e);

        expect(err).toBeInstanceOf(Error);
        expect(err.message).toMatch(/configuration not found/i);
        // Must NOT say "RAG is not enabled" — that message implies a deliberate operator choice
        expect(err.message).not.toMatch(/not enabled/i);
    });

    it('starts with includeImage and total from pending count', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ rag_enabled: true, manual_backfill_batch_size: 40 }] })
            .mockResolvedValueOnce({ rows: [{ id: 99 }] });
        embeddingService.shouldIncludeImageEmbeddings.mockResolvedValue(true);
        embeddingService.getPendingCount.mockResolvedValue(5);

        const runSpy = jest.spyOn(manualBackfillService, 'runBackfill').mockResolvedValue();
        const status = await manualBackfillService.start({ batchSize: 25 });

        expect(status.status).toBe('running');
        expect(status.batchSize).toBe(25);
        expect(status.includeImage).toBe(true);
        expect(status.total).toBe(5);
        expect(runSpy).toHaveBeenCalled();
    });

    it('uses configured manual_backfill_batch_size when no explicit batch size is provided', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ rag_enabled: true, manual_backfill_batch_size: 37, primary_provider: 'ollama', embedding_provider_mode: 'same' }] })
            .mockResolvedValueOnce({ rows: [{ id: 100 }] });
        embeddingService.shouldIncludeImageEmbeddings.mockResolvedValue(false);
        embeddingService.getPendingCount.mockResolvedValue(2);

        const runSpy = jest.spyOn(manualBackfillService, 'runBackfill').mockResolvedValue();
        const status = await manualBackfillService.start({});

        expect(status.batchSize).toBe(37);
        expect(runSpy).toHaveBeenCalled();
    });

    it('calculates dynamic totals in getStatus', async () => {
        manualBackfillService.state = {
            status: 'running',
            processed: 3,
            total: 5,
            startTime: Date.now(),
            eta: null,
            batchSize: 10,
            error: null,
            runId: 1,
            includeImage: true
        };

        embeddingService.getPendingCount.mockResolvedValue(7);

        const status = await manualBackfillService.getStatus();

        expect(status.total).toBe(10);
        expect(status.progress).toBe(30);
        expect(db.query).toHaveBeenCalledWith(
            'UPDATE backfill_runs SET total = $1, processed = $2 WHERE id = $3',
            [10, 3, 1]
        );
    });

    it('passes includeImage through to getPendingCount', async () => {
        embeddingService.shouldIncludeImageEmbeddings.mockResolvedValue(false);
        embeddingService.getPendingCount.mockResolvedValue(4);

        const count = await manualBackfillService.getPendingCount(true);

        expect(count).toBe(4);
        expect(embeddingService.getPendingCount).toHaveBeenCalledWith({ includeImage: true });
    });

    it('resume sets status running and continues backfill', async () => {
        manualBackfillService.state = {
            status: 'paused',
            processed: 2,
            total: 10,
            startTime: Date.now(),
            eta: null,
            batchSize: 10,
            error: null,
            runId: 55,
            includeImage: true
        };

        db.query.mockResolvedValueOnce({ rows: [] });
        const runSpy = jest.spyOn(manualBackfillService, 'runBackfill').mockResolvedValue();

        await manualBackfillService.resume();

        expect(manualBackfillService.state.status).toBe('running');
        expect(runSpy).toHaveBeenCalled();
        expect(db.pool.connect).toHaveBeenCalledTimes(1);
        expect(db._mockPoolClient.query).toHaveBeenNthCalledWith(
            1,
            'SELECT pg_try_advisory_lock($1) AS acquired',
            [db.DB_ADVISORY_LOCKS.BACKFILL_OWNER]
        );
        expect(db._mockPoolClient.query).toHaveBeenNthCalledWith(
            2,
            'SELECT pg_try_advisory_lock($1) AS acquired',
            [db.DB_ADVISORY_LOCKS.MANUAL_BACKFILL]
        );
        expect(db.query).toHaveBeenCalledWith(
            'UPDATE backfill_runs SET status = $1 WHERE id = $2',
            ['running', 55]
        );
        expect(manualBackfillService._activeRunPromise).toBeTruthy();
    });

    it('clear waits for a resumed run to finish before resetting state', async () => {
        manualBackfillService.state = {
            status: 'paused',
            processed: 2,
            total: 10,
            startTime: Date.now(),
            eta: null,
            batchSize: 10,
            error: null,
            runId: 66,
            includeImage: true
        };

        db.query.mockResolvedValueOnce({ rows: [] });

        let resolveRun;
        const runDeferred = new Promise((resolve) => {
            resolveRun = resolve;
        });
        jest.spyOn(manualBackfillService, 'runBackfill').mockReturnValue(runDeferred);

        await manualBackfillService.resume();

        const clearPromise = manualBackfillService.clear();
        await Promise.resolve();

        expect(manualBackfillService.state.status).toBe('cancelling');
        expect(manualBackfillService._activeRunPromise).toBeTruthy();

        resolveRun();
        await clearPromise;

        expect(manualBackfillService.state.status).toBe('idle');
        expect(manualBackfillService.state.runId).toBeNull();
        expect(manualBackfillService._activeRunPromise).toBeNull();
    });

    it('resume rejects when another process holds the advisory lock', async () => {
        manualBackfillService.state = {
            status: 'paused',
            processed: 2,
            total: 10,
            startTime: Date.now(),
            eta: null,
            batchSize: 10,
            error: null,
            runId: 77,
            includeImage: true
        };

        db._mockPoolClient.query.mockResolvedValueOnce({ rows: [{ acquired: false }] });
        const runSpy = jest.spyOn(manualBackfillService, 'runBackfill').mockResolvedValue();

        await expect(manualBackfillService.resume()).rejects.toThrow('Another backfill mode is already running');

        expect(manualBackfillService.state.status).toBe('paused');
        expect(runSpy).not.toHaveBeenCalled();
        expect(db.query).not.toHaveBeenCalledWith(
            'UPDATE backfill_runs SET status = $1 WHERE id = $2',
            ['running', 77]
        );
        expect(db._mockPoolClient.release).toHaveBeenCalledTimes(1);
    });

    it('clear cancels paused backfill state safely before resetting', async () => {
        manualBackfillService.state = {
            status: 'paused',
            processed: 4,
            total: 10,
            startTime: Date.now(),
            eta: null,
            batchSize: 10,
            error: 'paused by operator',
            runId: 88,
            includeImage: true
        };

        db.query.mockResolvedValueOnce({ rows: [] });

        await manualBackfillService.clear();

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("SET status = 'cancelled'"),
            [4, 'paused by operator', 88]
        );
        expect(manualBackfillService.state.status).toBe('idle');
        expect(manualBackfillService.state.runId).toBeNull();
    });

    it('runBackfill processes text and image items', async () => {
        manualBackfillService.state = {
            status: 'running',
            processed: 0,
            total: 2,
            startTime: Date.now(),
            eta: null,
            batchSize: 10,
            error: null,
            runId: 10,
            includeImage: true
        };

        embeddingService.getPendingEmbeddings
            .mockResolvedValueOnce([
                { id: 1, needsText: true, needsImage: false, metadata: {}, title: 'A', media_type: 'movie', library_name: 'Movies' },
                { id: 2, needsText: false, needsImage: true, metadata: {}, title: 'B', media_type: 'tv', library_name: 'TV' }
            ])
            .mockResolvedValueOnce([]);
        embeddingService.generateAndStore.mockResolvedValue({});
        embeddingService.generateImageEmbedding.mockResolvedValue({});
        db.query.mockResolvedValue({ rows: [] });

        await manualBackfillService.runBackfill();

        expect(embeddingService.generateAndStore).toHaveBeenCalled();
        expect(embeddingService.generateImageEmbedding).toHaveBeenCalled();
        expect(manualBackfillService.state.status).toBe('completed');
        expect(manualBackfillService.state.processed).toBe(2);
    });

    it('runBackfill pauses when circuit breaker is open', async () => {
        manualBackfillService.state = {
            status: 'running',
            processed: 0,
            total: 5,
            startTime: Date.now(),
            eta: null,
            batchSize: 10,
            error: null,
            runId: 11,
            includeImage: true
        };

        embeddingRouter.getCircuitStatus.mockReturnValue({ state: 'OPEN' });

        await manualBackfillService.runBackfill();

        expect(manualBackfillService.state.status).toBe('paused');
        expect(manualBackfillService.state.error).toContain('Circuit breaker OPEN');
        expect(embeddingService.getPendingEmbeddings).not.toHaveBeenCalled();
    });

    it('start rejects when provider cooldown is active', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ rag_enabled: true, manual_backfill_batch_size: 40 }] });
        embeddingService.getProviderAvailabilityStatus.mockReturnValue({
            status: 'cooldown',
            cooldownUntil: new Date(Date.now() + 60000).toISOString()
        });

        await expect(manualBackfillService.start()).rejects.toThrow(/Embedding provider unavailable until/);
    });

    it('resume rejects when provider cooldown is active', async () => {
        manualBackfillService.state = {
            status: 'paused',
            processed: 2,
            total: 10,
            startTime: Date.now(),
            eta: null,
            batchSize: 10,
            error: null,
            runId: 55,
            includeImage: true
        };

        embeddingService.getProviderAvailabilityStatus.mockResolvedValue({
            status: 'cooldown',
            cooldownUntil: new Date(Date.now() + 60000).toISOString()
        });

        await expect(manualBackfillService.resume()).rejects.toThrow(/Embedding provider unavailable until/);
        expect(db.pool.connect).not.toHaveBeenCalled();
    });

    it('runBackfill pauses when provider becomes unavailable', async () => {
        manualBackfillService.state = {
            status: 'running',
            processed: 0,
            total: 5,
            startTime: Date.now(),
            eta: null,
            batchSize: 10,
            error: null,
            runId: 15,
            includeImage: true
        };

        embeddingService.getPendingCount.mockResolvedValueOnce(1);
        embeddingService.getPendingEmbeddings.mockResolvedValueOnce([
            { id: 1, needsText: true, needsImage: false, metadata: {}, title: 'Offline', media_type: 'movie', library_name: 'Movies' }
        ]);
        embeddingService.generateAndStore.mockRejectedValueOnce(new Error('PROVIDER_OFFLINE'));
        embeddingService.getProviderAvailabilityStatus.mockReturnValue({
            status: 'cooldown',
            cooldownUntil: new Date(Date.now() + 60000).toISOString()
        });
        db.query.mockResolvedValue({ rows: [] });

        await manualBackfillService.runBackfill();

        expect(manualBackfillService.state.status).toBe('paused');
        expect(manualBackfillService.state.error).toContain('Embedding provider unavailable until');
        expect(embeddingService.generateAndStore).toHaveBeenCalledTimes(1);
    });

    it('runBackfill pauses without incrementing processed when provider is busy', async () => {
        manualBackfillService.state = {
            status: 'running',
            processed: 0,
            total: 1,
            startTime: Date.now(),
            eta: null,
            batchSize: 10,
            error: null,
            runId: 115,
            includeImage: true
        };

        embeddingService.getPendingEmbeddings.mockResolvedValueOnce([
            { id: 11, needsText: true, needsImage: false, metadata: {}, title: 'Busy', media_type: 'movie', library_name: 'Movies' }
        ]);
        embeddingService.generateAndStore.mockRejectedValueOnce(Object.assign(new Error('PROVIDER_BUSY'), {
            code: 'EMBEDDING_PROVIDER_BUSY',
            lockHolder: 'classification',
            waitMs: 1600,
            activeModel: 'gemma3:12b'
        }));
        embeddingService.isProviderBusyError.mockReturnValue(true);
        db.query.mockResolvedValue({ rows: [] });

        await manualBackfillService.runBackfill();

        expect(manualBackfillService.state.status).toBe('paused');
        expect(manualBackfillService.state.processed).toBe(0);
        expect(manualBackfillService.state.error).toContain('Embedding provider busy held by classification');
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("SET status = 'paused'"),
            [manualBackfillService.state.error, 0, 1, 115]
        );
    });

    it('runBackfill completes when no pending items remain', async () => {
        manualBackfillService.state = {
            status: 'running',
            processed: 0,
            total: 1,
            startTime: Date.now(),
            eta: null,
            batchSize: 10,
            error: null,
            runId: 12,
            includeImage: true
        };

        embeddingService.getPendingEmbeddings.mockResolvedValueOnce([]);
        db.query.mockResolvedValue({ rows: [] });

        await manualBackfillService.runBackfill();

        expect(manualBackfillService.state.status).toBe('completed');
        expect(manualBackfillService.state.processed).toBe(0);
    });

    it('runBackfill persists expanded totals when new pending work appears mid-run', async () => {
        manualBackfillService.state = {
            status: 'running',
            processed: 0,
            total: 1,
            startTime: Date.now(),
            eta: null,
            batchSize: 10,
            error: null,
            runId: 14,
            includeImage: true
        };

        embeddingService.getPendingCount
            .mockResolvedValueOnce(3)
            .mockResolvedValueOnce(0);
        embeddingService.getPendingEmbeddings
            .mockResolvedValueOnce([
                { id: 1, needsText: true, needsImage: false, metadata: {}, title: 'One', media_type: 'movie', library_name: 'Movies' },
                { id: 2, needsText: true, needsImage: false, metadata: {}, title: 'Two', media_type: 'movie', library_name: 'Movies' },
                { id: 3, needsText: true, needsImage: false, metadata: {}, title: 'Three', media_type: 'movie', library_name: 'Movies' }
            ])
            .mockResolvedValueOnce([]);
        embeddingService.generateAndStore.mockResolvedValue({});
        db.query.mockResolvedValue({ rows: [] });

        await manualBackfillService.runBackfill();

        expect(manualBackfillService.state.total).toBe(3);
        expect(db.query).toHaveBeenCalledWith(
            'UPDATE backfill_runs SET total = $1, processed = $2 WHERE id = $3',
            [3, 0, 14]
        );
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("SET status = 'completed'"),
            [3, 3, 14]
        );
    });

    it('runBackfill records errors without incrementing processed', async () => {
        manualBackfillService.state = {
            status: 'running',
            processed: 0,
            total: 1,
            startTime: Date.now(),
            eta: null,
            batchSize: 10,
            error: null,
            runId: 13,
            includeImage: true
        };

        embeddingService.getPendingEmbeddings
            .mockResolvedValueOnce([
                { id: 99, needsText: true, needsImage: false, metadata: {}, title: 'Bad', media_type: 'movie', library_name: 'Movies' }
            ])
            .mockResolvedValueOnce([]);
        embeddingService.generateAndStore.mockRejectedValue(new Error('boom'));
        db.query.mockResolvedValue({ rows: [] });

        await manualBackfillService.runBackfill();

        expect(manualBackfillService.state.processed).toBe(0);
        expect(manualBackfillService.state.error).toContain('Item 99: boom');
    });
});
