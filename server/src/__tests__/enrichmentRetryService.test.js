/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for EnrichmentRetryService
 */

const mockDb = {
    query: jest.fn()
};
jest.mock('../config/database', () => mockDb);

const mockTavilyService = {
    search: jest.fn()
};
jest.mock('../services/tavily', () => mockTavilyService);

const mockOmdbService = {
    getByIMDBId: jest.fn(),
    getByTitle: jest.fn(),
    hasRemainingQuota: jest.fn()
};
jest.mock('../services/omdb', () => mockOmdbService);

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};
jest.mock('../utils/logger', () => ({
    createLogger: jest.fn(() => mockLogger)
}));

describe('EnrichmentRetryService', () => {
    let service;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDb.query.mockReset();
        mockTavilyService.search.mockReset();
        mockOmdbService.getByIMDBId.mockReset();
        mockOmdbService.getByTitle.mockReset();
        mockOmdbService.hasRemainingQuota.mockReset();
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();

        jest.resetModules();
        service = require('../services/enrichmentRetryService');
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
                [123, 'tavily', 'OMDb not found', 5]
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

            await service.triggerProcessing();

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Enrichment retry queue: OMDb daily limit reached, pausing until next day',
                expect.objectContaining({ used: 1000, limit: 1000 })
            );
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
                .mockResolvedValueOnce({ available: true, used: 50, limit: 1000 })
                .mockResolvedValueOnce({ available: true, used: 55, limit: 1000 });
            mockDb.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({
                    rows: [
                        { enrichment_type: 'omdb', status: 'pending', count: '5' }
                    ]
                })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            mockOmdbService.getByIMDBId.mockResolvedValue({ Title: 'Test' });

            await service.triggerProcessing();

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Enrichment retry queue: Processing 5 OMDb items (5 pending, 950 quota remaining)'
            );
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
            mockOmdbService.hasRemainingQuota = jest.fn()
                .mockResolvedValueOnce({ available: true, used: 995, limit: 1000 })
                .mockResolvedValueOnce({ available: true, used: 998, limit: 1000 });
            mockDb.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({
                    rows: [
                        { enrichment_type: 'omdb', status: 'pending', count: '50' }
                    ]
                })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            mockOmdbService.getByIMDBId.mockResolvedValue({ Title: 'Test' });

            await service.triggerProcessing();

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Enrichment retry queue: Processing 5 OMDb items (50 pending, 5 quota remaining)'
            );
        });
    });

    describe('processRetryQueue', () => {
        it('should skip processing if Tavily is not configured', async () => {
            mockDb.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rows: [] });

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
            mockDb.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ api_key: 'test-key', is_active: true }] })
                .mockResolvedValueOnce({ rows: [] });

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

            mockDb.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ api_key: 'test-key', is_active: true }] })
                .mockResolvedValueOnce({ rows: [mockItem] })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ api_key: 'test-key' }] })
                .mockResolvedValueOnce({ rowCount: 1 });

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

            mockDb.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rows: [mockItem] })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 1 });

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

            mockDb.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rows: [mockItem] })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 1 });

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

            mockDb.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rows: [mockItem] })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 1 });

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

            mockDb.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rows: [mockItem] })
                .mockResolvedValueOnce({ rowCount: 1 });

            mockOmdbService.getByIMDBId.mockRejectedValue(new Error('OMDb API error'));

            const result = await service.processRetryQueue(50, 'omdb');

            expect(result.failed).toBe(1);
        });

        it('should auto-fail exhausted pending retries before selecting work', async () => {
            mockDb.query
                .mockResolvedValueOnce({ rowCount: 3 })
                .mockResolvedValueOnce({ rows: [] });

            const result = await service.processRetryQueue(50, 'omdb');

            expect(result).toEqual({
                processed: 0,
                success: 0,
                failed: 0,
                autoFailed: 3,
                skipped: false
            });
            expect(mockDb.query).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining('attempts >= max_attempts'),
                ['omdb']
            );
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

            mockDb.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rows: [mockItem] })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 1 });

            const result = await service.processRetryQueue(50, 'omdb');

            expect(result.failed).toBe(1);
            expect(mockDb.query).toHaveBeenNthCalledWith(
                4,
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

            expect(result.queued).toBe(25);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO enrichment_retry_queue')
            );
        });

        it('should return zero when no items to backfill', async () => {
            mockDb.query.mockResolvedValue({ rowCount: 0 });

            const result = await service.backfillRetryQueue();

            expect(result.queued).toBe(0);
        });
    });
});
