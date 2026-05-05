/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Integration tests for metadata enrichment pipeline
 * Tests the full flow: TVDB→TMDB, IMDB→TMDB, title search, classification_history
 * 
 * ============================================================================
 * DEPENDENCY INJECTION PATTERN FOR TESTS
 * ============================================================================
 * 
 * This test uses dependency injection (DI) to create isolated QueueService
 * instances, preventing singleton pollution from other test files.
 * 
 * IMPORTANT: If you add new external dependencies to QueueService, you MUST:
 * 1. Add them to the jest.mock() calls below
 * 2. Import the mocked module
 * 3. Add them to the QueueService constructor call in beforeEach()
 * 
 * This ensures tests are fully isolated and won't have flaky failures.
 * See queueService.js header for full DI documentation.
 * 
 * ============================================================================
 * 
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const mockDb = { query: jest.fn() };

const mockOmdbService = { getByTitle: jest.fn() };

const mockTavilyService = {
    getContentAdvisory: jest.fn(),
    search: jest.fn()
};

const mockTmdbService = {
    findByExternalId: jest.fn(),
    search: jest.fn()
};

const mockContentTypeAnalyzer = { analyze: jest.fn() };

const mockClassificationService = { classify: jest.fn() };

const mockOllamaService = {
    isAvailable: jest.fn().mockResolvedValue(true)
};

const mockAiRouterService = {
    checkAvailability: jest.fn().mockResolvedValue(true)
};

const mockSyncStatus = {
    start: jest.fn(),
    stop: jest.fn(),
    update: jest.fn()
};

const mockLoggerModule = {
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
};

jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb, DB_ADVISORY_LOCKS: { STARTUP_RESET: 9001 } }));

jest.unstable_mockModule('../services/omdb.mjs', () => ({ ...mockOmdbService, default: mockOmdbService }));

jest.unstable_mockModule('../services/tavily.mjs', () => ({ ...mockTavilyService, default: mockTavilyService }));

jest.unstable_mockModule('../services/tmdb.mjs', () => ({ ...mockTmdbService, default: mockTmdbService }));

jest.unstable_mockModule('../services/contentTypeAnalyzer.mjs', () => ({ ...mockContentTypeAnalyzer, default: mockContentTypeAnalyzer }));

jest.unstable_mockModule('../services/classification.mjs', () => ({ ...mockClassificationService, default: mockClassificationService }));

jest.unstable_mockModule('../services/ollama.mjs', () => ({ ...mockOllamaService, default: mockOllamaService }));

jest.unstable_mockModule('../services/aiRouter.mjs', () => ({ ...mockAiRouterService, default: mockAiRouterService }));

jest.unstable_mockModule('../services/syncStatus.mjs', () => ({ ...mockSyncStatus, default: mockSyncStatus }));

jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLoggerModule, default: mockLoggerModule }));

const { QueueService } = await import('../services/queueService.mjs');
const db = mockDb;
const omdbService = mockOmdbService;
const tavilyService = mockTavilyService;
const tmdbService = mockTmdbService;
const classificationService = mockClassificationService;
const ollamaService = mockOllamaService;
const aiRouterService = mockAiRouterService;
const syncStatus = mockSyncStatus;
const { createLogger } = mockLoggerModule;

let queueService;

describe('Enrichment Pipeline Integration', () => {
    beforeEach(() => {
        jest.resetAllMocks();

        queueService = new QueueService({
            db: db,
            classificationService: classificationService,
            ollamaService: ollamaService,
            aiRouterService: aiRouterService,
            syncStatus: syncStatus,
            tmdbService: tmdbService,
            omdbService: omdbService,
            logger: createLogger('QueueService-Test')
        });

        db.query.mockImplementation(() => Promise.resolve({ rows: [] }));
        omdbService.getByTitle.mockImplementation(() => Promise.resolve(null));
        tavilyService.getContentAdvisory.mockImplementation(() => Promise.resolve(null));
        tavilyService.search.mockImplementation(() => Promise.resolve(null));
        tmdbService.findByExternalId.mockImplementation(() => Promise.resolve({ movie_results: [], tv_results: [] }));
        tmdbService.search.mockImplementation(() => Promise.resolve([]));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
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

            const task = {
                id: 1,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify(taskPayload),
                attempts: 0,
                max_attempts: 3
            };

            tmdbService.findByExternalId.mockResolvedValue({
                tv_results: [{ id: 1396, name: 'Breaking Bad' }],
                movie_results: []
            });

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

            await queueService.processTask(task);

            expect(tmdbService.findByExternalId).toHaveBeenCalledWith(81189, 'tvdb_id');
        });
    });

    describe('IMDB to TMDB Conversion', () => {
        it('should convert IMDB ID to TMDB ID from OMDb response', async () => {
            db.query.mockReset();
            omdbService.getByTitle.mockReset();
            tmdbService.findByExternalId.mockReset();

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

            omdbService.getByTitle.mockResolvedValue({
                imdbID: 'tt0111161',
                Title: 'The Shawshank Redemption',
                rated: 'R',
                genre: 'Drama'
            });

            tmdbService.findByExternalId.mockResolvedValue({
                movie_results: [{ id: 278, title: 'The Shawshank Redemption' }],
                tv_results: []
            });

            await queueService.processTask(task);

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

            db.query.mockImplementation((query) => {
                if (query.includes('omdb_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            tmdbService.search.mockResolvedValue([
                { id: 771, title: 'Home Alone', year: '1990' }
            ]);

            await queueService.processTask(task);

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

            tmdbService.search.mockResolvedValue([
                { id: 999, title: 'Home Alone 2', year: '1992' },
                { id: 771, title: 'Home Alone', year: '1990' },
                { id: 888, title: 'Home Alone 3', year: '1997' }
            ]);

            await queueService.processTask(task);

            expect(tmdbService.search).toHaveBeenCalled();
        });
    });

    describe('Classification History Logging', () => {
        it('should persist source-library identity in enriched metadata for later classification fast paths', async () => {
            const taskPayload = {
                title: 'Source Library Carryover',
                year: 2024,
                source_library_id: 12,
                source_library_name: 'Imported Movies',
                itemId: 710,
                media: { media_type: 'movie' }
            };

            const task = {
                id: 9,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify(taskPayload),
                attempts: 0,
                max_attempts: 3
            };

            let capturedMetadata = null;

            db.query.mockImplementation((query, params) => {
                if (query.includes('omdb_config') || query.includes('tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('UPDATE media_server_items') && query.includes('SET metadata')) {
                    capturedMetadata = typeof params[0] === 'string' ? JSON.parse(params[0]) : params[0];
                    return Promise.resolve({ rows: [], rowCount: 1 });
                }
                if (query.includes('SELECT 1 FROM libraries WHERE id')) {
                    return Promise.resolve({ rows: [{ id: 12 }] });
                }
                if (query.includes('SELECT 1 FROM classification_history')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [], rowCount: 1 });
            });

            await queueService.processTask(task);

            expect(capturedMetadata).toBeTruthy();
            expect(capturedMetadata.source_library_id).toBe(12);
            expect(capturedMetadata.source_library_name).toBe('Imported Movies');
            expect(capturedMetadata.content_analysis.source_library_id).toBe(12);
            expect(capturedMetadata.content_analysis.source_library_name).toBe('Imported Movies');
        });

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
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('SELECT 1 FROM libraries WHERE id')) {
                    return Promise.resolve({ rows: [{ id: 1 }] });
                }
                return Promise.resolve({ rows: [] });
            });

            await queueService.processTask(task);

            expect(classificationInsertCalled).toHaveBeenCalled();
        });

        it('should log items WITHOUT TMDB ID to classification_history', async () => {
            const taskPayload = {
                title: 'My Home Video',
                year: 2020,
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

            tmdbService.search.mockResolvedValue([]);

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
                if (query.includes('SELECT 1 FROM libraries WHERE id')) {
                    return Promise.resolve({ rows: [{ id: 1 }] });
                }
                return Promise.resolve({ rows: [] });
            });

            await queueService.processTask(task);

            expect(classificationInsertCalled).toHaveBeenCalled();

            expect(capturedInsertParams).toBeDefined();
            expect(capturedInsertParams[0]).toBeNull();
            expect(capturedInsertParams[2]).toBe('My Home Video');
            expect(capturedInsertParams[4]).toBe(5);
            expect(capturedInsertParams[7]).toBe('source_library');
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
                if (query.includes('SELECT 1 FROM libraries WHERE id')) {
                    return Promise.resolve({ rows: [{ id: 1 }] });
                }
                if (query.includes('SELECT 1 FROM classification_history')) {
                    return Promise.resolve({ rows: [{ id: 1 }] });
                }
                if (query.includes('INSERT INTO classification_history')) {
                    classificationInsertCalled();
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            await queueService.processTask(task);

            expect(classificationInsertCalled).not.toHaveBeenCalled();
        });

        it('should skip classification_history insert when library was deleted during sync', async () => {
            const taskPayload = {
                title: 'Movie from Deleted Library',
                year: 2024,
                tmdb_id: 99999,
                source_library_id: 999,
                source_library_name: 'Deleted Movies',
                itemId: 700,
                media: { media_type: 'movie' }
            };

            const task = {
                id: 8,
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
                if (query.includes('SELECT 1 FROM libraries WHERE id')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('SELECT 1 FROM classification_history')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('INSERT INTO classification_history')) {
                    classificationInsertCalled();
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            await queueService.processTask(task);

            expect(classificationInsertCalled).not.toHaveBeenCalled();
        });

        it('should use a recovered library name when classification_history is written with only source_library_id', async () => {
            const taskPayload = {
                title: 'Recovered Library History Name',
                year: 2024,
                tmdb_id: 424242,
                source_library_id: 15,
                source_library_name: null,
                itemId: 701,
                media: { media_type: 'movie' }
            };

            const task = {
                id: 10,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify(taskPayload),
                attempts: 0,
                max_attempts: 3
            };

            let capturedInsertParams = null;

            db.query.mockImplementation((query, params) => {
                if (query.includes('FROM media_server_items msi')) {
                    return Promise.resolve({
                        rows: [{
                            tmdb_id: 424242,
                            library_id: 15,
                            metadata: {},
                            library_name: null
                        }]
                    });
                }
                if (query === 'SELECT name FROM libraries WHERE id = $1') {
                    return Promise.resolve({ rows: [{ name: 'Recovered History Library' }] });
                }
                if (query.includes('omdb_config') || query.includes('tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('SELECT 1 FROM libraries WHERE id')) {
                    return Promise.resolve({ rows: [{ id: 15 }] });
                }
                if (query.includes('SELECT 1 FROM classification_history')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('INSERT INTO classification_history')) {
                    capturedInsertParams = params;
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [], rowCount: 1 });
            });

            await queueService.processTask(task);

            expect(capturedInsertParams).toBeDefined();
            expect(capturedInsertParams[8]).toBe('Already in library: Recovered History Library');
            expect(capturedInsertParams[9]).toEqual(expect.stringContaining('"source_library_name":"Recovered History Library"'));
        });
    });

    describe('TMDB ID Backfill', () => {
        it('should backfill discovered TMDB ID to media_server_items', async () => {
            const taskPayload = {
                title: 'Game of Thrones',
                year: 2011,
                tvdb_id: 121361,
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

            tmdbService.findByExternalId.mockResolvedValue({
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

            expect(backfillCalled).toHaveBeenCalled();
        });
    });
});
