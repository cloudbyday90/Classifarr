/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for EnrichmentRetryService
 */

import { jest } from '@jest/globals';
import { createMockModule } from './helpers/mockFactory.mjs';

const mockDb = {
    query: jest.fn()
};
jest.unstable_mockModule('../config/database.mjs', () => createMockModule(mockDb));

const mockTavilyService = {
    search: jest.fn()
};
jest.unstable_mockModule('../services/tavily.mjs', () => createMockModule(mockTavilyService));

const mockOmdbService = {
    getByIMDBId: jest.fn(),
    getByTitle: jest.fn(),
    hasRemainingQuota: jest.fn()
};
jest.unstable_mockModule('../services/omdb.mjs', () => createMockModule(mockOmdbService));

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};
jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: jest.fn(() => mockLogger)
}));

describe('EnrichmentRetryService', () => {
    let service;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockDb.query.mockReset();
        mockDb.query.mockResolvedValue({ rowCount: 0, rows: [] });
        mockTavilyService.search.mockReset();
        mockOmdbService.getByIMDBId.mockReset();
        mockOmdbService.getByTitle.mockReset();
        mockOmdbService.hasRemainingQuota.mockReset();
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();

        jest.resetModules();
        ({ default: service } = await import('../services/enrichmentRetryService.mjs'));
        service.cancelScheduledProcessing();
    });

    afterEach(() => {
        service.cancelScheduledProcessing();
    });

    describe('queueForRetry', () => {
        it('should queue an item for retry', async () => {
            mockDb.query.mockResolvedValue({ rowCount: 1 });

            await service.queueForRetry(123, 'tavily', 'OMDb not found', 5);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO enrichment_retry_queue'),
                [123, 'tavily', 'OMDb not found', 5, 'tavily_monthly_quota_deferred']
            );
        });

        it('should handle foreign key violation for deleted items', async () => {
            mockDb.query.mockRejectedValue({ code: '23503', message: 'foreign_key_violation' });

            await service.queueForRetry(999, 'tavily', 'Item deleted', 5);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Skipping retry queue for deleted item',
                { mediaItemId: 999 }
            );
        });

        it('should log error on database failure', async () => {
            mockDb.query.mockRejectedValue(new Error('Connection failed'));

            await service.queueForRetry(123, 'tavily', 'Test', 5);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to queue item for retry',
                expect.objectContaining({ mediaItemId: 123 })
            );
        });
    });

    describe('getStats', () => {
        it('should auto-resolve stale rows before aggregating stats', async () => {
            const normalizeSpy = jest.spyOn(service, 'normalizeTavilyMonthlyDeferredRows').mockResolvedValue(0);
            const resolveSpy = jest.spyOn(service, 'resolveRetriesWithExistingMetadata').mockResolvedValue(4);
            const failSpy = jest.spyOn(service, 'failExhaustedPendingRetries').mockResolvedValue(0);

            mockDb.query.mockResolvedValue({
                rows: [
                    { enrichment_type: 'tavily', status: 'pending', count: '2' }
                ]
            });

            const stats = await service.getStats();

            expect(normalizeSpy).toHaveBeenCalled();
            expect(resolveSpy).toHaveBeenCalledWith();
            expect(failSpy).toHaveBeenCalledWith();
            expect(stats.tavily.pending).toBe(2);

            normalizeSpy.mockRestore();
            resolveSpy.mockRestore();
            failSpy.mockRestore();
        });

        it('should return stats grouped by enrichment type and status', async () => {
            mockDb.query.mockResolvedValue({
                rows: [
                    { enrichment_type: 'tavily', status: 'pending', count: '10' },
                    { enrichment_type: 'tavily', status: 'completed', count: '5' },
                    { enrichment_type: 'omdb', status: 'pending', count: '3' },
                    { enrichment_type: 'omdb', status: 'failed', count: '2' }
                ]
            });

            const stats = await service.getStats();

            expect(stats.tavily.pending).toBe(10);
            expect(stats.tavily.completed).toBe(5);
            expect(stats.omdb.pending).toBe(3);
            expect(stats.omdb.failed).toBe(2);
            expect(stats.total.pending).toBe(13);
            expect(stats.total.completed).toBe(5);
        });

        it('should return zero stats when no items', async () => {
            mockDb.query.mockResolvedValue({ rows: [] });

            const stats = await service.getStats();

            expect(stats.tavily.pending).toBe(0);
            expect(stats.omdb.pending).toBe(0);
            expect(stats.total.pending).toBe(0);
        });

        it('should handle null enrichment_type', async () => {
            mockDb.query.mockResolvedValue({
                rows: [
                    { enrichment_type: null, status: 'pending', count: '5' }
                ]
            });

            const stats = await service.getStats();

            expect(stats.total.pending).toBe(5);
        });
    });

    describe('resolveRetriesWithExistingMetadata', () => {
        it('should resolve stale rows for a specific enrichment type', async () => {
            mockDb.query.mockResolvedValue({
                rowCount: 3,
                rows: [
                    { id: 1, media_item_id: 10, enrichment_type: 'tavily' },
                    { id: 2, media_item_id: 11, enrichment_type: 'tavily' },
                    { id: 3, media_item_id: 12, enrichment_type: 'tavily' }
                ]
            });

            const resolved = await service.resolveRetriesWithExistingMetadata('tavily');

            expect(resolved).toBe(3);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining("AND erq.enrichment_type = $1"),
                ['tavily']
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Auto-resolved stale enrichment retry rows',
                expect.objectContaining({ enrichmentType: 'tavily', resolved: 3 })
            );
        });

        it('should return zero when no stale rows were resolved', async () => {
            mockDb.query.mockResolvedValue({ rowCount: 0, rows: [] });

            const resolved = await service.resolveRetriesWithExistingMetadata();

            expect(resolved).toBe(0);
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                'Auto-resolved stale enrichment retry rows',
                expect.any(Object)
            );
        });
    });

    describe('recoverStaleProcessingRetries', () => {
        it('should recover stale processing rows for a specific enrichment type', async () => {
            mockDb.query.mockResolvedValue({
                rowCount: 2,
                rows: [
                    { id: 11, media_item_id: 101, enrichment_type: 'omdb' },
                    { id: 12, media_item_id: 102, enrichment_type: 'omdb' }
                ]
            });

            const recovered = await service.recoverStaleProcessingRetries('omdb');

            expect(recovered).toBe(2);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining("WHERE status = 'processing'"),
                [20 * 60 * 1000, 'omdb']
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Recovered stale enrichment retry rows',
                expect.objectContaining({ count: 2, enrichmentType: 'omdb' })
            );
        });

        it('should return zero and not log warning when no stale rows exist', async () => {
            mockDb.query.mockResolvedValue({ rowCount: 0, rows: [] });

            const recovered = await service.recoverStaleProcessingRetries();

            expect(recovered).toBe(0);
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                'Recovered stale enrichment retry rows',
                expect.any(Object)
            );
        });
    });

    describe('scheduleProcessing', () => {
        it('should schedule processing when called', () => {
            jest.useFakeTimers();
            
            service.scheduleProcessing();
            
            expect(service.processingScheduled).toBe(true);
            
            jest.advanceTimersByTime(5000);
            
            expect(service.processingScheduled).toBe(false);
            
            jest.useRealTimers();
        });

        it('should not schedule if already scheduled', () => {
            service.processingScheduled = true;
            
            service.scheduleProcessing();
            
            expect(service.scheduledTimeout).toBeNull();
        });

        it('should not schedule if processing in progress', () => {
            service.processingInProgress = true;
            
            service.scheduleProcessing();
            
            expect(service.scheduledTimeout).toBeNull();
        });
    });

    describe('cancelScheduledProcessing', () => {
        it('should cancel scheduled timeout', () => {
            jest.useFakeTimers();
            
            service.scheduleProcessing();
            expect(service.scheduledTimeout).not.toBeNull();
            
            service.cancelScheduledProcessing();
            
            expect(service.scheduledTimeout).toBeNull();
            expect(service.processingScheduled).toBe(false);
            
            jest.useRealTimers();
        });
    });

    describe('triggerProcessing', () => {
        it('should skip if already processing', async () => {
            service.processingInProgress = true;
            
            await service.triggerProcessing();
            
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Enrichment processing already in progress, skipping'
            );
        });

        it('should skip if OMDb daily limit reached', async () => {
            mockOmdbService.hasRemainingQuota = jest.fn().mockResolvedValue({
                available: false,
                used: 1000,
                limit: 1000
            });
            const getStatsSpy = jest.spyOn(service, 'getStats')
                .mockResolvedValueOnce({ omdb: { pending: 10 }, tavily: { pending: 0 } });

            await service.triggerProcessing();

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Enrichment retry queue: OMDb daily limit reached, pausing until next day',
                expect.objectContaining({ used: 1000, limit: 1000 })
            );
            getStatsSpy.mockRestore();
        });

        it('should skip if no pending items', async () => {
            mockOmdbService.hasRemainingQuota = jest.fn().mockResolvedValue({
                available: true,
                used: 50,
                limit: 1000
            });
            mockDb.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rows: [] });
            
            await service.triggerProcessing();
            
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Enrichment retry queue: No pending OMDb items'
            );
        });

        it('should process OMDb items when pending and quota available', async () => {
            mockOmdbService.hasRemainingQuota = jest.fn()
                .mockResolvedValue({ available: true, used: 50, limit: 1000 });
            const getStatsSpy = jest.spyOn(service, 'getStats')
                .mockResolvedValueOnce({ omdb: { pending: 5 } })
                .mockResolvedValueOnce({ omdb: { pending: 0 } });
            const processSpy = jest.spyOn(service, 'processRetryQueue')
                .mockResolvedValue({ processed: 5, success: 5, failed: 0 });

            await service.triggerProcessing();

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Enrichment retry queue: Processing 5 OMDb items (5 pending, 950 quota remaining)'
            );
            expect(processSpy).toHaveBeenCalledWith(5, 'omdb');

            processSpy.mockRestore();
            getStatsSpy.mockRestore();
        });

        it('should NOT process Tavily items (monthly credits)', async () => {
            mockOmdbService.hasRemainingQuota = jest.fn().mockResolvedValue({
                available: true,
                used: 50,
                limit: 1000
            });
            mockDb.query.mockResolvedValueOnce({
                rowCount: 0
            }).mockResolvedValueOnce({
                rows: [
                    { enrichment_type: 'tavily', status: 'pending', count: '10' }
                ]
            });

            await service.triggerProcessing();

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Enrichment retry queue: No pending OMDb items'
            );
            expect(mockOmdbService.getByIMDBId).not.toHaveBeenCalled();
        });

        it('should limit processing to remaining quota', async () => {
            mockOmdbService.hasRemainingQuota = jest.fn().mockResolvedValue({ available: true, used: 995, limit: 1000 });
            const getStatsSpy = jest.spyOn(service, 'getStats')
                .mockResolvedValueOnce({ omdb: { pending: 50 } })
                .mockResolvedValueOnce({ omdb: { pending: 45 } });
            const processSpy = jest.spyOn(service, 'processRetryQueue')
                .mockResolvedValue({ processed: 5, success: 5, failed: 0 });

            await service.triggerProcessing();

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Enrichment retry queue: Processing 5 OMDb items (50 pending, 5 quota remaining)'
            );
            expect(processSpy).toHaveBeenCalledWith(5, 'omdb');

            processSpy.mockRestore();
            getStatsSpy.mockRestore();
        });
    });

    describe('processRetryQueue', () => {
        const configureRetryDbMock = ({
            pendingRows = [],
            tavilyConfigured = true,
            autoFailed = 0,
            tavilyFallbackRow = null
        } = {}) => {
            mockDb.query.mockImplementation(async (sql) => {
                const text = String(sql);

                if (text.includes('attempts >= max_attempts')) {
                    return { rowCount: autoFailed, rows: [] };
                }

                if (text.includes('SELECT api_key, is_active FROM tavily_config')) {
                    return tavilyConfigured
                        ? { rows: [{ api_key: 'test-key', is_active: true }] }
                        : { rows: [] };
                }

                if (text.includes('SELECT api_key FROM tavily_config WHERE is_active = true LIMIT 1')) {
                    return { rows: [{ api_key: 'test-key' }] };
                }

                if (text.includes('FROM enrichment_retry_queue erq')) {
                    return { rows: pendingRows };
                }

                if (text.includes('FROM enrichment_retry_queue') &&
                    text.includes("enrichment_type = 'tavily'")) {
                    return { rows: tavilyFallbackRow ? [tavilyFallbackRow] : [] };
                }

                if (text.includes('SELECT') && text.includes('FROM enrichment_retry_queue')) {
                    return { rows: [] };
                }

                return { rowCount: 1, rows: [] };
            });
        };

        it('should skip processing if Tavily is not configured', async () => {
            configureRetryDbMock({ tavilyConfigured: false });

            const result = await service.processRetryQueue(50, 'tavily');

            expect(result).toEqual({
                processed: 0,
                success: 0,
                failed: 0,
                autoFailed: 0,
                skipped: true,
                reason: 'Tavily not configured'
            });
        });

        it('should return early if no pending items', async () => {
            configureRetryDbMock({ tavilyConfigured: true, pendingRows: [] });

            const result = await service.processRetryQueue(50, 'tavily');

            expect(result).toEqual({
                processed: 0,
                success: 0,
                failed: 0,
                autoFailed: 0,
                skipped: false
            });
        });

        it('should process pending Tavily items successfully', async () => {
            const mockItem = {
                queue_id: 1,
                media_item_id: 100,
                attempts: 0,
                max_attempts: 3,
                title: 'Test Movie',
                year: 2020,
                tmdb_id: 12345,
                imdb_id: 'tt1234567',
                media_type: 'movie'
            };

            configureRetryDbMock({ tavilyConfigured: true, pendingRows: [mockItem] });

            mockTavilyService.search.mockResolvedValue({
                results: [{
                    url: 'https://www.imdb.com/title/tt1234567/',
                    content: 'Test Movie (2020) - IMDb rating: 7.5/10'
                }]
            });

            const result = await service.processRetryQueue(50, 'tavily');

            expect(result.processed).toBe(1);
            expect(result.success).toBe(1);
            expect(result.failed).toBe(0);
        });

        it('should defer Tavily item when monthly quota is exhausted (432)', async () => {
            const mockItem = {
                queue_id: 11,
                media_item_id: 211,
                attempts: 1,
                max_attempts: 3,
                title: 'Deferred Movie',
                year: 2021,
                imdb_id: 'tt0111111',
                media_type: 'movie'
            };

            const quotaError = new Error('Tavily search failed: Request failed with status code 432');
            quotaError.status = 432;

            configureRetryDbMock({ tavilyConfigured: true, pendingRows: [mockItem] });

            mockTavilyService.search.mockRejectedValue(quotaError);

            const result = await service.processRetryQueue(50, 'tavily');

            expect(result.processed).toBe(1);
            expect(result.success).toBe(0);
            expect(result.failed).toBe(0);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining("SET status = 'pending'"),
                [11, 'tavily_monthly_quota_deferred', 'Tavily monthly quota reached; deferred until next month reset']
            );
        });

        it('should process OMDb items with getByIMDBId when imdb_id exists', async () => {
            const mockItem = {
                queue_id: 2,
                media_item_id: 101,
                attempts: 0,
                max_attempts: 3,
                title: 'Test Movie 2',
                year: 2021,
                tmdb_id: 54321,
                imdb_id: 'tt7654321',
                media_type: 'movie'
            };

            configureRetryDbMock({ pendingRows: [mockItem] });

            mockOmdbService.getByIMDBId.mockResolvedValue({
                Title: 'Test Movie 2',
                Year: '2021',
                imdbRating: '8.0'
            });

            const result = await service.processRetryQueue(50, 'omdb');

            expect(mockOmdbService.getByIMDBId).toHaveBeenCalledWith('tt7654321');
            expect(mockOmdbService.getByTitle).not.toHaveBeenCalled();
            expect(result.success).toBe(1);
        });

        it('should fallback to getByTitle when getByIMDBId returns null', async () => {
            const mockItem = {
                queue_id: 3,
                media_item_id: 102,
                attempts: 0,
                max_attempts: 3,
                title: 'Test Movie 3',
                year: 2022,
                tmdb_id: 11111,
                imdb_id: 'tt1111111',
                media_type: 'movie'
            };

            configureRetryDbMock({ pendingRows: [mockItem] });

            mockOmdbService.getByIMDBId.mockResolvedValue(null);
            mockOmdbService.getByTitle.mockResolvedValue({
                Title: 'Test Movie 3',
                Year: '2022',
                imdbRating: '7.0'
            });

            const result = await service.processRetryQueue(50, 'omdb');

            expect(mockOmdbService.getByIMDBId).toHaveBeenCalledWith('tt1111111');
            expect(mockOmdbService.getByTitle).toHaveBeenCalledWith('Test Movie 3', 2022, 'movie');
            expect(result.success).toBe(1);
        });

        it('should use getByTitle when imdb_id is missing', async () => {
            const mockItem = {
                queue_id: 4,
                media_item_id: 103,
                attempts: 0,
                max_attempts: 3,
                title: 'Test Movie 4',
                year: 2023,
                tmdb_id: 22222,
                imdb_id: null,
                media_type: 'movie'
            };

            configureRetryDbMock({ pendingRows: [mockItem] });

            mockOmdbService.getByTitle.mockResolvedValue({
                Title: 'Test Movie 4',
                Year: '2023',
                imdbRating: '6.5'
            });

            const result = await service.processRetryQueue(50, 'omdb');

            expect(mockOmdbService.getByIMDBId).not.toHaveBeenCalled();
            expect(mockOmdbService.getByTitle).toHaveBeenCalledWith('Test Movie 4', 2023, 'movie');
            expect(result.success).toBe(1);
        });

        it('should mark as failed when max attempts reached', async () => {
            const mockItem = {
                queue_id: 5,
                media_item_id: 104,
                attempts: 2,
                max_attempts: 3,
                title: 'Test Movie 5',
                year: 2020,
                tmdb_id: 33333,
                imdb_id: 'tt3333333',
                media_type: 'movie'
            };

            configureRetryDbMock({ pendingRows: [mockItem] });

            mockOmdbService.getByIMDBId.mockRejectedValue(new Error('OMDb API error'));

            const result = await service.processRetryQueue(50, 'omdb');

            expect(result.failed).toBe(1);
        });

        it('should hand off exhausted OMDb not-found item to Tavily fallback and skip OMDb row', async () => {
            const mockItem = {
                queue_id: 71,
                media_item_id: 171,
                attempts: 2,
                max_attempts: 3,
                title: 'No OMDb Match',
                year: 2024,
                tmdb_id: 73111,
                imdb_id: 'tt7311111',
                media_type: 'movie'
            };

            configureRetryDbMock({
                pendingRows: [mockItem],
                tavilyFallbackRow: { id: 99, status: 'pending', reason: 'OMDb not found' }
            });

            mockOmdbService.getByIMDBId.mockResolvedValue(null);
            mockOmdbService.getByTitle.mockResolvedValue(null);

            const result = await service.processRetryQueue(50, 'omdb');

            expect(result.processed).toBe(1);
            expect(result.failed).toBe(0);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining("SET status = 'skipped'"),
                [71, 'OMDb not found', 'omdb_exhausted_fallback_to_tavily']
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                'OMDb metadata miss; item moved to Tavily fallback',
                expect.objectContaining({
                    queueId: 71,
                    mediaItemId: 171,
                    tavilyQueueId: 99
                })
            );
            expect(mockLogger.error).not.toHaveBeenCalledWith(
                'Enrichment retry exhausted without required metadata',
                expect.any(Object)
            );
        });

        it('should hand off OMDb not-found item to Tavily fallback before max attempts', async () => {
            const mockItem = {
                queue_id: 73,
                media_item_id: 173,
                attempts: 1,
                max_attempts: 3,
                title: 'Immediate Fallback Item',
                year: 2024,
                tmdb_id: 73113,
                imdb_id: 'tt7311333',
                media_type: 'movie'
            };

            configureRetryDbMock({
                pendingRows: [mockItem],
                tavilyFallbackRow: { id: 101, status: 'pending', reason: 'OMDb not found' }
            });

            mockOmdbService.getByIMDBId.mockResolvedValue(null);
            mockOmdbService.getByTitle.mockResolvedValue(null);

            const result = await service.processRetryQueue(50, 'omdb');

            expect(result.processed).toBe(1);
            expect(result.failed).toBe(0);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining("SET status = 'skipped'"),
                [73, 'OMDb not found', 'omdb_exhausted_fallback_to_tavily']
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                'OMDb metadata miss; item moved to Tavily fallback',
                expect.objectContaining({
                    queueId: 73,
                    mediaItemId: 173,
                    tavilyQueueId: 101
                })
            );
        });

        it('should hand off exhausted OMDb operational errors to Tavily fallback with warning severity', async () => {
            const mockItem = {
                queue_id: 72,
                media_item_id: 172,
                attempts: 2,
                max_attempts: 3,
                title: 'OMDb Timeout Item',
                year: 2024,
                tmdb_id: 73112,
                imdb_id: 'tt7311222',
                media_type: 'movie'
            };

            configureRetryDbMock({
                pendingRows: [mockItem],
                tavilyFallbackRow: { id: 100, status: 'pending', reason: 'OMDb retry exhausted: timeout' }
            });

            mockOmdbService.getByIMDBId.mockRejectedValue(new Error('timeout of 15000ms exceeded'));

            const result = await service.processRetryQueue(50, 'omdb');

            expect(result.processed).toBe(1);
            expect(result.failed).toBe(0);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'OMDb retry exhausted after operational errors; item moved to Tavily fallback',
                expect.objectContaining({
                    queueId: 72,
                    mediaItemId: 172,
                    tavilyQueueId: 100
                })
            );
        });

        it('should auto-fail exhausted pending retries before selecting work', async () => {
            configureRetryDbMock({ pendingRows: [], autoFailed: 3 });

            const result = await service.processRetryQueue(50, 'omdb');

            expect(result).toEqual({
                processed: 0,
                success: 0,
                failed: 0,
                autoFailed: 3,
                skipped: false
            });
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('attempts >= max_attempts'),
                ['tavily_monthly_quota_deferred', 'omdb']
            );
        });

        it('should resolve stale rows before processing selected enrichment type', async () => {
            const resolveSpy = jest.spyOn(service, 'resolveRetriesWithExistingMetadata').mockResolvedValue(2);
            configureRetryDbMock({ pendingRows: [] });

            await service.processRetryQueue(50, 'omdb');

            expect(resolveSpy).toHaveBeenCalledWith('omdb');
            resolveSpy.mockRestore();
        });

        it('should move item to failed in catch path when attempts are exhausted', async () => {
            const mockItem = {
                queue_id: 55,
                media_item_id: 155,
                attempts: 2,
                max_attempts: 3,
                title: 'Catch Path Item',
                year: 2024,
                imdb_id: 'tt1234555',
                media_type: 'tv'
            };

            const enrichSpy = jest.spyOn(service, 'enrichWithOmdb').mockRejectedValue(new Error('boom'));

            configureRetryDbMock({ pendingRows: [mockItem] });

            const result = await service.processRetryQueue(50, 'omdb');

            expect(result.failed).toBe(1);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining("CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END"),
                [55, 'boom']
            );

            enrichSpy.mockRestore();
        });
    });

    describe('enrichWithOmdb', () => {
        it('should call getByIMDBId with correct parameter', async () => {
            const item = {
                media_item_id: 100,
                imdb_id: 'tt0133093',
                title: 'The Matrix',
                year: 1999,
                media_type: 'movie'
            };

            mockDb.query.mockResolvedValue({ rowCount: 1 });
            mockOmdbService.getByIMDBId.mockResolvedValue({
                Title: 'The Matrix',
                Year: '1999',
                imdbRating: '8.7'
            });

            const result = await service.enrichWithOmdb(item);

            expect(mockOmdbService.getByIMDBId).toHaveBeenCalledWith('tt0133093');
            expect(result.success).toBe(true);
        });

        it('should fallback to getByTitle when no imdb_id', async () => {
            const item = {
                media_item_id: 101,
                imdb_id: null,
                title: 'Inception',
                year: 2010,
                media_type: 'movie'
            };

            mockDb.query.mockResolvedValue({ rowCount: 1 });
            mockOmdbService.getByTitle.mockResolvedValue({
                Title: 'Inception',
                Year: '2010',
                imdbRating: '8.8'
            });

            const result = await service.enrichWithOmdb(item);

            expect(mockOmdbService.getByIMDBId).not.toHaveBeenCalled();
            expect(mockOmdbService.getByTitle).toHaveBeenCalledWith('Inception', 2010, 'movie');
            expect(result.success).toBe(true);
        });

        it('should return failure when OMDb returns no data', async () => {
            const item = {
                media_item_id: 102,
                imdb_id: 'tt9999999',
                title: 'Unknown Movie',
                year: 2020,
                media_type: 'movie'
            };

            mockOmdbService.getByIMDBId.mockResolvedValue(null);
            mockOmdbService.getByTitle.mockResolvedValue(null);

            const result = await service.enrichWithOmdb(item);

            expect(result.success).toBe(false);
            expect(result.error).toBe('OMDb not found');
        });

        it('should handle OMDb service errors', async () => {
            const item = {
                media_item_id: 103,
                imdb_id: 'tt1234567',
                title: 'Test Movie',
                year: 2020,
                media_type: 'movie'
            };

            mockOmdbService.getByIMDBId.mockRejectedValue(new Error('OMDb API timeout'));

            const result = await service.enrichWithOmdb(item);

            expect(result.success).toBe(false);
            expect(result.error).toBe('OMDb API timeout');
        });
    });

    describe('enrichWithTavily', () => {
        it('should search with IMDb ID when available', async () => {
            const item = {
                media_item_id: 100,
                imdb_id: 'tt0133093',
                title: 'The Matrix',
                year: 1999
            };

            mockTavilyService.search.mockResolvedValue({
                results: [{
                    url: 'https://www.imdb.com/title/tt0133093/',
                    content: 'The Matrix (1999) - IMDb rating: 8.7/10'
                }]
            });

            mockDb.query.mockResolvedValue({ rowCount: 1 });

            const result = await service.enrichWithTavily(item, 'test-api-key');

            expect(mockTavilyService.search).toHaveBeenCalledWith(
                'IMDb tt0133093',
                expect.objectContaining({ apiKey: 'test-api-key' })
            );
            expect(result.success).toBe(true);
        });

        it('should search with title and year when no IMDb ID', async () => {
            const item = {
                media_item_id: 101,
                imdb_id: null,
                title: 'Inception',
                year: 2010
            };

            mockTavilyService.search.mockResolvedValue({
                results: [{
                    url: 'https://www.imdb.com/title/tt1375666/',
                    content: 'Inception (2010) - IMDb rating: 8.8/10'
                }]
            });

            mockDb.query.mockResolvedValue({ rowCount: 1 });

            const result = await service.enrichWithTavily(item, 'test-api-key');

            expect(mockTavilyService.search).toHaveBeenCalledWith(
                'Inception 2010 IMDb rating',
                expect.objectContaining({ apiKey: 'test-api-key' })
            );
            expect(result.success).toBe(true);
        });

        it('should return failure when no results found', async () => {
            const item = {
                media_item_id: 102,
                title: 'Unknown Movie',
                year: 2020
            };

            mockTavilyService.search.mockResolvedValue({ results: [] });

            const result = await service.enrichWithTavily(item, 'test-api-key');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No results found');
        });

        it('should return failure when IMDb data cannot be extracted', async () => {
            const item = {
                media_item_id: 103,
                title: 'Test Movie',
                year: 2020
            };

            mockTavilyService.search.mockResolvedValue({
                results: [{
                    url: 'https://example.com/movie',
                    content: 'Some content without IMDb link'
                }]
            });

            const result = await service.enrichWithTavily(item, 'test-api-key');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Could not extract IMDb data');
        });

        it('should defer until monthly reset on Tavily 432 quota errors', async () => {
            const item = {
                media_item_id: 104,
                title: 'Quota Limited Item',
                year: 2025
            };
            const quotaError = new Error('Tavily search failed: Request failed with status code 432');
            quotaError.status = 432;
            mockTavilyService.search.mockRejectedValue(quotaError);

            const result = await service.enrichWithTavily(item, 'test-api-key');

            expect(result.success).toBe(false);
            expect(result.deferUntilMonthlyReset).toBe(true);
            expect(result.error).toContain('status code 432');
        });
    });

    describe('extractImdbData', () => {
        it('should extract IMDb ID from URL', () => {
            const results = [{
                url: 'https://www.imdb.com/title/tt0133093/',
                content: 'The Matrix'
            }];

            const data = service.extractImdbData(results, 'The Matrix');

            expect(data).not.toBeNull();
            expect(data.imdb_id).toBe('tt0133093');
            expect(data.source).toBe('tavily');
        });

        it('should extract rating from content', () => {
            const results = [{
                url: 'https://www.imdb.com/title/tt0133093/',
                content: 'The Matrix (1999) - IMDb rating: 8.7/10'
            }];

            const data = service.extractImdbData(results, 'The Matrix');

            expect(data.rating).toBe(8.7);
        });

        it('should extract genres from content (case-insensitive)', () => {
            const results = [{
                url: 'https://www.imdb.com/title/tt0133093/',
                content: 'The Matrix - Action, Sci-Fi, Thriller'
            }];

            const data = service.extractImdbData(results, 'The Matrix');

            expect(data.genres).toBeDefined();
            expect(data.genres.length).toBe(3);
            expect(data.genres).toContain('Action');
        });

        it('should return null when no IMDb URL found', () => {
            const results = [{
                url: 'https://example.com/movie',
                content: 'Some movie content'
            }];

            const data = service.extractImdbData(results, 'Test Movie');

            expect(data).toBeNull();
        });

        it('should handle results using snippet instead of content', () => {
            const results = [{
                url: 'https://www.imdb.com/title/tt1375666/',
                snippet: 'Inception - 8.8/10 rating'
            }];

            const data = service.extractImdbData(results, 'Inception');

            expect(data).not.toBeNull();
            expect(data.imdb_id).toBe('tt1375666');
        });
    });

    describe('backfillRetryQueue', () => {
        it('should queue items missing OMDb data', async () => {
            mockDb.query.mockResolvedValue({ rowCount: 25 });

            const result = await service.backfillRetryQueue();

            expect(result.success).toBe(true);
            expect(result.queued).toBe(25);
            expect(result.enrichmentType).toBe('tavily');
            expect(result.reason).toBe('items_missing_omdb_data');
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO enrichment_retry_queue')
            );
        });

        it('should return zero when no items to backfill', async () => {
            mockDb.query.mockResolvedValue({ rowCount: 0 });

            const result = await service.backfillRetryQueue();

            expect(result.success).toBe(true);
            expect(result.queued).toBe(0);
            expect(result.enrichmentType).toBe('tavily');
        });
    });

    describe('isTransientOmdbTransportError', () => {
        const httpError = (status) => {
            const err = new Error(`Request failed with status code ${status}`);
            err.response = { status };
            return err;
        };

        const nodeError = (code, message = 'network error') => {
            const err = new Error(message);
            err.code = code;
            return err;
        };

        // Cloudflare 52x range — the exact class of error that triggered this bug
        it.each([520, 521, 522, 523, 524, 525, 526, 527, 530])(
            'should return true for Cloudflare HTTP %i',
            (status) => {
                expect(service.isTransientOmdbTransportError(httpError(status))).toBe(true);
            }
        );

        it.each([408, 429, 502, 503, 504])(
            'should return true for standard transient HTTP %i',
            (status) => {
                expect(service.isTransientOmdbTransportError(httpError(status))).toBe(true);
            }
        );

        it.each([400, 401, 403, 404, 422])(
            'should return false for non-transient HTTP %i',
            (status) => {
                expect(service.isTransientOmdbTransportError(httpError(status))).toBe(false);
            }
        );

        it.each(['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'])(
            'should return true for Node.js code %s',
            (code) => {
                expect(service.isTransientOmdbTransportError(nodeError(code))).toBe(true);
            }
        );

        it('should return true when message contains "timeout"', () => {
            expect(service.isTransientOmdbTransportError(new Error('OMDb API timeout'))).toBe(true);
        });

        it('should return true when message contains "cloudflare"', () => {
            expect(service.isTransientOmdbTransportError(new Error('cloudflare error'))).toBe(true);
        });

        it('should return true when message contains "socket hang up"', () => {
            expect(service.isTransientOmdbTransportError(new Error('socket hang up'))).toBe(true);
        });

        it('should return false for a plain non-transient error', () => {
            expect(service.isTransientOmdbTransportError(new Error('OMDb not found'))).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(service.isTransientOmdbTransportError(null)).toBe(false);
            expect(service.isTransientOmdbTransportError(undefined)).toBe(false);
        });
    });
});
