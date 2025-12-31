/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Integration tests for metadata enrichment pipeline
 * Tests the full flow: TVDB→TMDB, IMDB→TMDB, title search, classification_history
 */

// Mock all external dependencies
jest.mock('../config/database', () => ({
    query: jest.fn()
}));

jest.mock('../services/omdb', () => ({
    getByTitle: jest.fn()
}));

jest.mock('../services/tavily', () => ({
    getContentAdvisory: jest.fn(),
    search: jest.fn()
}));

jest.mock('../services/tmdb', () => ({
    findByExternalId: jest.fn(),
    search: jest.fn()
}));

jest.mock('../services/contentTypeAnalyzer', () => ({
    analyze: jest.fn()
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
const omdbService = require('../services/omdb');
const tavilyService = require('../services/tavily');
const tmdbService = require('../services/tmdb');
const queueService = require('../services/queueService');

describe('Enrichment Pipeline Integration', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        queueService.processing = 0;
        queueService.running = false;
    });

    describe('TVDB to TMDB Conversion', () => {
        it('should convert TVDB ID to TMDB ID for TV shows', async () => {
            const taskPayload = {
                title: 'Breaking Bad',
                year: 2008,
                tvdb_id: 81189,
                source_library_id: 1,
                source_library_name: 'TV Shows',
                itemId: 100,
                media: { media_type: 'tv' }
            };

            // Mock task dequeue
            const task = {
                id: 1,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify(taskPayload),
                attempts: 0,
                max_attempts: 3
            };

            // Mock TMDB findByExternalId response
            tmdbService.findByExternalId.mockResolvedValueOnce({
                tv_results: [{ id: 1396, name: 'Breaking Bad' }],
                movie_results: []
            });

            // Mock OMDb config (disabled)
            db.query.mockImplementation((query) => {
                if (query.includes('omdb_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('UPDATE media_server_items SET tmdb_id')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('UPDATE media_server_items SET metadata')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('classification_history')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('UPDATE task_queue')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            // Process the task
            await queueService.processTask(task);

            // Verify TVDB→TMDB conversion was attempted
            expect(tmdbService.findByExternalId).toHaveBeenCalledWith(81189, 'tvdb_id');
        });
    });

    describe('IMDB to TMDB Conversion', () => {
        it('should convert IMDB ID to TMDB ID from OMDb response', async () => {
            const taskPayload = {
                title: 'The Shawshank Redemption',
                year: 1994,
                source_library_id: 2,
                source_library_name: 'Movies',
                itemId: 200,
                media: { media_type: 'movie' }
            };

            const task = {
                id: 2,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify(taskPayload),
                attempts: 0,
                max_attempts: 3
            };

            // Mock OMDb returning IMDB ID
            db.query.mockImplementation((query) => {
                if (query.includes('omdb_config')) {
                    return Promise.resolve({
                        rows: [{ api_key: 'omdb-key', is_active: true }]
                    });
                }
                if (query.includes('tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            omdbService.getByTitle.mockResolvedValueOnce({
                imdbID: 'tt0111161',
                Title: 'The Shawshank Redemption',
                rated: 'R',
                genre: 'Drama'
            });

            // Mock TMDB find by IMDB
            tmdbService.findByExternalId.mockResolvedValueOnce({
                movie_results: [{ id: 278, title: 'The Shawshank Redemption' }],
                tv_results: []
            });

            await queueService.processTask(task);

            // Verify IMDB→TMDB conversion was attempted
            expect(tmdbService.findByExternalId).toHaveBeenCalledWith('tt0111161', 'imdb_id');
        });
    });

    describe('TMDB Title Search Fallback', () => {
        it('should search TMDB by title when no provider IDs exist', async () => {
            const taskPayload = {
                title: 'Home Alone',
                year: 1990,
                source_library_id: 3,
                source_library_name: 'Family',
                itemId: 300,
                media: { media_type: 'movie' }
            };

            const task = {
                id: 3,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify(taskPayload),
                attempts: 0,
                max_attempts: 3
            };

            // No OMDb, no Tavily
            db.query.mockImplementation((query) => {
                if (query.includes('omdb_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            // Mock TMDB title search
            tmdbService.search.mockResolvedValueOnce([
                { id: 771, title: 'Home Alone', year: '1990' }
            ]);

            await queueService.processTask(task);

            // Verify title search was attempted
            expect(tmdbService.search).toHaveBeenCalledWith(
                expect.stringContaining('Home Alone'),
                'movie'
            );
        });

        it('should match best result when multiple search results', async () => {
            const taskPayload = {
                title: 'Home Alone',
                year: 1990,
                source_library_id: 3,
                source_library_name: 'Family',
                itemId: 301,
                media: { media_type: 'movie' }
            };

            const task = {
                id: 4,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify(taskPayload),
                attempts: 0,
                max_attempts: 3
            };

            db.query.mockImplementation(() => Promise.resolve({ rows: [] }));

            // Return multiple results
            tmdbService.search.mockResolvedValueOnce([
                { id: 999, title: 'Home Alone 2', year: '1992' },
                { id: 771, title: 'Home Alone', year: '1990' },  // Exact match
                { id: 888, title: 'Home Alone 3', year: '1997' }
            ]);

            await queueService.processTask(task);

            expect(tmdbService.search).toHaveBeenCalled();
        });
    });

    describe('Classification History Logging', () => {
        it('should log items with TMDB ID to classification_history', async () => {
            const taskPayload = {
                title: 'Inception',
                year: 2010,
                tmdb_id: 27205,
                source_library_id: 2,
                source_library_name: 'Movies',
                itemId: 400,
                media: { media_type: 'movie' }
            };

            const task = {
                id: 5,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify(taskPayload),
                attempts: 0,
                max_attempts: 3
            };

            const classificationInsertCalled = jest.fn();

            db.query.mockImplementation((query) => {
                if (query.includes('omdb_config') || query.includes('tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('INSERT INTO classification_history')) {
                    classificationInsertCalled();
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('SELECT 1 FROM classification_history')) {
                    return Promise.resolve({ rows: [] }); // No existing entry
                }
                return Promise.resolve({ rows: [] });
            });

            await queueService.processTask(task);

            expect(classificationInsertCalled).toHaveBeenCalled();
        });

        it('should log items WITHOUT TMDB ID to classification_history', async () => {
            // REGRESSION TEST: Prevents reintroduction of NOT NULL constraint on tmdb_id
            // This test ensures items without TMDB matches are still logged to history
            // See migration: 032_allow_null_tmdb_in_classification_history.sql
            const taskPayload = {
                title: 'My Home Video',
                year: 2020,
                // No tmdb_id, tvdb_id, or imdb_id
                source_library_id: 5,
                source_library_name: 'Personal',
                itemId: 500,
                media: { media_type: 'movie' }
            };

            const task = {
                id: 6,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify(taskPayload),
                attempts: 0,
                max_attempts: 3
            };

            // TMDB search returns nothing - no match found
            tmdbService.search.mockResolvedValueOnce([]);

            const classificationInsertCalled = jest.fn();
            let capturedInsertParams = null;

            db.query.mockImplementation((query, params) => {
                if (query.includes('omdb_config') || query.includes('tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('INSERT INTO classification_history')) {
                    classificationInsertCalled();
                    capturedInsertParams = params;
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('SELECT 1 FROM classification_history')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            await queueService.processTask(task);

            // Should still log to history even without TMDB ID
            expect(classificationInsertCalled).toHaveBeenCalled();

            // CRITICAL: Verify tmdb_id is NULL (first parameter)
            // This is the key regression test for migration 032
            expect(capturedInsertParams).toBeDefined();
            expect(capturedInsertParams[0]).toBeNull(); // tmdb_id should be null
            expect(capturedInsertParams[2]).toBe('My Home Video'); // title
            expect(capturedInsertParams[4]).toBe(5); // library_id
            expect(capturedInsertParams[7]).toBe('source_library'); // method
        });


        it('should skip duplicate entries in classification_history', async () => {
            const taskPayload = {
                title: 'Already Logged Movie',
                year: 2023,
                tmdb_id: 12345,
                source_library_id: 2,
                source_library_name: 'Movies',
                itemId: 600,
                media: { media_type: 'movie' }
            };

            const task = {
                id: 7,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify(taskPayload),
                attempts: 0,
                max_attempts: 3
            };

            const classificationInsertCalled = jest.fn();

            db.query.mockImplementation((query) => {
                if (query.includes('omdb_config') || query.includes('tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('SELECT 1 FROM classification_history')) {
                    // Return existing entry
                    return Promise.resolve({ rows: [{ id: 1 }] });
                }
                if (query.includes('INSERT INTO classification_history')) {
                    classificationInsertCalled();
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            await queueService.processTask(task);

            // Should NOT insert duplicate
            expect(classificationInsertCalled).not.toHaveBeenCalled();
        });
    });

    describe('TMDB ID Backfill', () => {
        it('should backfill discovered TMDB ID to media_server_items', async () => {
            const taskPayload = {
                title: 'Game of Thrones',
                year: 2011,
                tvdb_id: 121361,
                // No tmdb_id initially
                source_library_id: 1,
                source_library_name: 'TV Shows',
                itemId: 700,
                media: { media_type: 'tv' }
            };

            const task = {
                id: 8,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify(taskPayload),
                attempts: 0,
                max_attempts: 3
            };

            // Mock TVDB→TMDB conversion
            tmdbService.findByExternalId.mockResolvedValueOnce({
                tv_results: [{ id: 1399, name: 'Game of Thrones' }],
                movie_results: []
            });

            const backfillCalled = jest.fn();

            db.query.mockImplementation((query) => {
                if (query.includes('omdb_config') || query.includes('tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('UPDATE media_server_items SET tmdb_id')) {
                    backfillCalled();
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            await queueService.processTask(task);

            // Verify TMDB ID was backfilled
            expect(backfillCalled).toHaveBeenCalled();
        });
    });
});
