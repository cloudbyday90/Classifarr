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

const manualBackfillService = require('../services/manualBackfillService');
const embeddingService = require('../services/embeddingService');
const embeddingProvider = require('../services/embeddingProvider');
const db = require('../config/database');

jest.mock('../services/embeddingService', () => ({
    shouldIncludeImageEmbeddings: jest.fn(),
    getPendingCount: jest.fn(),
    getPendingEmbeddings: jest.fn(),
    generateAndStore: jest.fn(),
    generateImageEmbedding: jest.fn()
}));
jest.mock('../services/embeddingProvider', () => ({
    warmup: jest.fn(),
    circuitBreaker: {
        getStatus: jest.fn()
    }
}));
jest.mock('../config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
    tryAdvisoryLock: jest.fn(),
    DB_ADVISORY_LOCKS: { IDLE_BACKFILL: 1001, SCHEDULED_BACKFILL: 1002, MANUAL_BACKFILL: 1003 }
}));
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

describe('ManualBackfillService', () => {
    beforeEach(async () => {
        jest.restoreAllMocks();
        jest.resetAllMocks();
        await manualBackfillService.clear();
        embeddingProvider.circuitBreaker.getStatus.mockReturnValue({ state: 'CLOSED' });

        // Default: advisory lock acquired (so existing tests pass)
        db.withTransaction.mockImplementation(async (fn) => {
            const mockClient = { query: jest.fn() };
            return fn(mockClient);
        });
        db.tryAdvisoryLock.mockResolvedValue(true);
    });

    it('rejects start when RAG is disabled', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ rag_enabled: false }] });

        await expect(manualBackfillService.start()).rejects.toThrow('RAG is not enabled');
        expect(db.query).toHaveBeenCalledWith(
            'SELECT rag_enabled FROM ai_provider_config WHERE id = 1'
        );
    });

    it('starts with includeImage and total from pending count', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ rag_enabled: true }] })
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
        expect(db.query).toHaveBeenCalledWith(
            'UPDATE backfill_runs SET status = $1 WHERE id = $2',
            ['running', 55]
        );
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

        embeddingProvider.circuitBreaker.getStatus.mockReturnValue({ state: 'OPEN' });

        await manualBackfillService.runBackfill();

        expect(manualBackfillService.state.status).toBe('paused');
        expect(manualBackfillService.state.error).toContain('Circuit breaker OPEN');
        expect(embeddingService.getPendingEmbeddings).not.toHaveBeenCalled();
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
