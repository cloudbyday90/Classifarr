/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

const DB_ADVISORY_LOCKS = {
    IDLE_BACKFILL: 1001,
    SCHEDULED_BACKFILL: 1002,
    MANUAL_BACKFILL: 1003,
    BACKFILL_OWNER: 1004,
    EMBEDDING_PROVIDER_PROBE: 1005,
    STARTUP_RESET: 1234567890,
    GAP_ANALYSIS: 2001,
    LIBRARY_SYNC: 2002,
    RETRY_QUEUE: 2003,
    ENRICHMENT_RETRY_QUEUE: 2004,
    RATING_NORMALIZATION_CHECK: 2005,
    STALE_CLEANUP: 2006,
};

const mockDb = {
    query: jest.fn(),
    pool: { connect: jest.fn() },
    withTransaction: jest.fn(),
    connect: jest.fn(),
    DB_ADVISORY_LOCKS,
};

const mockClassification = { classify: jest.fn() };

const mockOmdb = {
    getByTitle: jest.fn(),
    checkHealth: jest.fn(),
};

const mockTavily = {
    getContentAdvisory: jest.fn(),
    search: jest.fn(),
    searchAnimeInfo: jest.fn(),
    searchIMDB: jest.fn(),
    formatForAI: jest.fn(),
};

const mockEnrichmentRetryService = {
    queueForRetry: jest.fn().mockResolvedValue(),
    getStats: jest.fn().mockResolvedValue({ tavily: { pending: 0 }, total: { pending: 0 } }),
    processRetryQueue: jest.fn().mockResolvedValue({ processed: 0 }),
    backfillRetryQueue: jest.fn().mockResolvedValue({
        success: true,
        queued: 0,
        enrichmentType: 'tavily',
        reason: 'items_missing_omdb_data',
    }),
};

const mockMediaSync = {
    syncLibrary: jest.fn().mockResolvedValue({}),
    syncLibrariesFromMediaServer: jest.fn().mockResolvedValue([]),
    syncAllLibraries: jest.fn().mockResolvedValue(),
};

const mockScheduler = {
    runGapAnalysis: jest.fn().mockResolvedValue({}),
};

const mockLogger = {
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    }),
};

jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.unstable_mockModule('../services/classification.mjs', () => ({ ...mockClassification, default: mockClassification }));

jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLogger, default: mockLogger }));

jest.unstable_mockModule('../services/omdb.mjs', () => ({ ...mockOmdb, default: mockOmdb }));

jest.unstable_mockModule('../services/tavily.mjs', () => ({ ...mockTavily, default: mockTavily }));

jest.unstable_mockModule('../services/enrichmentRetryService.mjs', () => ({ ...mockEnrichmentRetryService, default: mockEnrichmentRetryService }));

jest.unstable_mockModule('../services/mediaSync.mjs', () => ({ ...mockMediaSync, default: mockMediaSync }));

jest.unstable_mockModule('../services/scheduler.mjs', () => ({ ...mockScheduler, default: mockScheduler }));

const { default: queueService } = await import('../services/queueService.mjs');
const db = mockDb;
const classificationService = mockClassification;

describe('QueueService', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.resetAllMocks();

        queueService.processing = 0;
        queueService.running = false;
        queueService.aiAvailable = true;
        queueService.queueTaskProcessorService.omdbLimitHit = false;
        queueService.queueTaskProcessorService.lastOmdbCircuitWarnAt = 0;
        queueService.queueTaskProcessorService.lastOmdbSslWarnAt = 0;
        queueService.queueTaskProcessorService.omdbSslBlockedUntil = 0;
        queueService.queueTaskProcessorService.lastOmdbSslProbeAt = 0;
        queueService.lastAiAvailabilityProbeAt = 0;
        queueService._blockerCache = null;
        queueService._blockerCacheExpiresAt = 0;

        queueService.omdbService = mockOmdb;
        queueService.queueTaskProcessorService.omdbService = queueService.omdbService;
        queueService.enrichmentRetryService = mockEnrichmentRetryService;
        queueService.queueReadModel.enrichmentRetryService = queueService.enrichmentRetryService;
        queueService.queueCarsaService.mediaSyncService = mockMediaSync;
        queueService.queueCarsaService.getScheduler = () => mockScheduler;
        queueService.evidenceService = {
            purgeAllLegacyPatterns: jest.fn().mockResolvedValue({ deleted: 5, rows: [{ id: 1 }] }),
        };
        queueService.queueCarsaService.evidenceService = queueService.evidenceService;
    });

    describe('enqueue', () => {
        it('should insert task into database', async () => {
            db.query.mockResolvedValue({ rows: [{ id: 123 }] });

            const taskId = await queueService.enqueue('classification', { title: 'Test' });

            expect(taskId).toBe(123);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO task_queue'),
                expect.arrayContaining(['classification', expect.stringContaining('Test')]),
            );
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('DB Error'));

            await expect(queueService.enqueue('test', {})).rejects.toThrow('DB Error');
        });
    });

    describe('processTask', () => {
        it('should process classification task success', async () => {
            const task = {
                id: 1,
                task_type: 'classification',
                payload: JSON.stringify({ title: 'Test Movie' }),
            };

            classificationService.classify.mockResolvedValue({
                library: { name: 'Movies' },
                bestMatch: { type: 'movie', confidence: 90 },
            });

            db.query.mockResolvedValue({});

            await queueService.processTask(task);

            expect(classificationService.classify).toHaveBeenCalled();
            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue\s+SET status = 'completed'/),
                expect.any(Array),
            );
        });

        it('should process metadata_enrichment task (OMDb+Tavily)', async () => {
            const task = {
                id: 2,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify({
                    title: 'Test Movie',
                    year: 2024,
                    itemId: 55,
                    source_library_id: 1,
                    source_library_name: 'Movies',
                }),
            };

            db.query.mockImplementation((query) => {
                if (query.includes('SELECT * FROM omdb_config')) {
                    return Promise.resolve({ rows: [{ api_key: 'test_key', is_active: true }] });
                }
                if (query.includes('SELECT * FROM tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            await queueService.processTask(task);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE media_server_items/),
                expect.any(Array),
            );
        });

        it('should preserve source-library identity and metadata_enrichment source in persisted metadata', async () => {
            const task = {
                id: 99,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify({
                    title: 'Obscure Film',
                    year: 2010,
                    itemId: 42,
                    source_library_id: 3,
                    source_library_name: 'Movies',
                    media: { media_type: 'movie' },
                }),
            };

            const omdbService = mockOmdb;
            omdbService.getByTitle.mockResolvedValue(null);

            let capturedMetadata = null;
            db.query.mockImplementation((query, params) => {
                if (query.includes('SELECT * FROM omdb_config')) {
                    return Promise.resolve({ rows: [{ api_key: 'k', is_active: true }] });
                }
                if (query.includes('SELECT * FROM tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('UPDATE media_server_items') && params && params[0]) {
                    capturedMetadata = typeof params[0] === 'string' ? JSON.parse(params[0]) : params[0];
                }
                return Promise.resolve({ rows: [], rowCount: 1 });
            });

            await queueService.processTask(task);

            expect(capturedMetadata).not.toBeNull();
            expect(capturedMetadata.source_library_id).toBe(3);
            expect(capturedMetadata.source_library_name).toBe('Movies');
            expect(capturedMetadata.content_analysis).toBeDefined();
            expect(capturedMetadata.content_analysis.source).toBe('metadata_enrichment');
            expect(capturedMetadata.content_analysis.source_library_id).toBe(3);
            expect(capturedMetadata.content_analysis.source_library_name).toBe('Movies');
        });

        it('should mark holiday-only Tavily enrichment as tavilyEnriched in the completed task result', async () => {
            const task = {
                id: 100,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify({
                    title: 'Holiday Special',
                    year: 2024,
                    itemId: 56,
                    source_library_id: 4,
                    source_library_name: 'Seasonal',
                    media: { media_type: 'movie' },
                }),
            };

            const tavilyService = mockTavily;
            tavilyService.getContentAdvisory.mockResolvedValue(null);
            tavilyService.search.mockResolvedValue({
                answer: 'This title is commonly grouped with holiday viewing.',
            });

            let completedResult = null;
            db.query.mockImplementation((query, params) => {
                if (query.includes('SELECT * FROM omdb_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('SELECT * FROM tavily_config')) {
                    return Promise.resolve({
                        rows: [{ api_key: 'tavily-key', search_depth: 'advanced', max_results: 3 }],
                    });
                }
                if (query.includes('SELECT 1 FROM libraries WHERE id')) {
                    return Promise.resolve({ rows: [{ exists: 1 }] });
                }
                if (query.includes('SELECT 1 FROM classification_history')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('UPDATE task_queue') && params?.[1]) {
                    completedResult = JSON.parse(params[1]);
                }
                return Promise.resolve({ rows: [], rowCount: 1 });
            });

            await queueService.processTask(task);

            expect(completedResult).toBeTruthy();
            expect(completedResult.result.tavilyEnriched).toBe(true);
        });

        it('should return the self-healed source library name in the completed task result', async () => {
            const task = {
                id: 101,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify({
                    title: 'Recovered Library Name',
                    year: 2024,
                    itemId: 57,
                    source_library_id: 8,
                    media: { media_type: 'movie' },
                }),
            };

            let completedResult = null;
            db.query.mockImplementation((query, params) => {
                if (query.includes('FROM media_server_items msi')) {
                    return Promise.resolve({
                        rows: [{
                            tmdb_id: null,
                            library_id: 8,
                            metadata: {},
                            library_name: 'Recovered Movies',
                        }],
                    });
                }
                if (query.includes('SELECT * FROM omdb_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('SELECT * FROM tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('SELECT 1 FROM libraries WHERE id')) {
                    return Promise.resolve({ rows: [{ exists: 1 }] });
                }
                if (query.includes('SELECT 1 FROM classification_history')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('UPDATE task_queue') && params?.[1]) {
                    completedResult = JSON.parse(params[1]);
                }
                return Promise.resolve({ rows: [], rowCount: 1 });
            });

            await queueService.processTask(task);

            expect(completedResult).toBeTruthy();
            expect(completedResult.result.sourceLibrary).toBe('Recovered Movies');
        });

        it('should recover a missing source library name from the libraries table for completion and persistence', async () => {
            const task = {
                id: 102,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify({
                    title: 'Fallback Library Name',
                    year: 2024,
                    itemId: 58,
                    source_library_id: 999,
                    source_library_name: null,
                    media: { media_type: 'movie' },
                }),
            };

            let capturedMetadata = null;
            let completedResult = null;

            db.query.mockImplementation((query, params) => {
                if (query.includes('FROM media_server_items msi')) {
                    return Promise.resolve({
                        rows: [{
                            tmdb_id: null,
                            library_id: 999,
                            metadata: {},
                            library_name: null,
                        }],
                    });
                }
                if (query === 'SELECT name FROM libraries WHERE id = $1') {
                    return Promise.resolve({ rows: [{ name: 'Recovered Queue Library' }] });
                }
                if (query.includes('SELECT * FROM omdb_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('SELECT * FROM tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('UPDATE media_server_items') && params?.[0]) {
                    capturedMetadata = typeof params[0] === 'string' ? JSON.parse(params[0]) : params[0];
                    return Promise.resolve({ rows: [], rowCount: 1 });
                }
                if (query.includes('SELECT 1 FROM libraries WHERE id')) {
                    return Promise.resolve({ rows: [{ exists: 1 }] });
                }
                if (query.includes('SELECT 1 FROM classification_history')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('UPDATE task_queue') && params?.[1]) {
                    completedResult = JSON.parse(params[1]);
                }
                return Promise.resolve({ rows: [], rowCount: 1 });
            });

            await queueService.processTask(task);

            expect(capturedMetadata).toBeTruthy();
            expect(capturedMetadata.source_library_name).toBe('Recovered Queue Library');
            expect(capturedMetadata.content_analysis.source_library_name).toBe('Recovered Queue Library');
            expect(completedResult).toBeTruthy();
            expect(completedResult.result.sourceLibrary).toBe('Recovered Queue Library');
        });

        it('should suppress warn spam for OMDb HALF_OPEN throttling and queue for OMDb retry', async () => {
            const task = {
                id: 3,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify({
                    title: 'The Office (AU)',
                    year: 2023,
                    itemId: 77,
                    source_library_id: 1,
                    source_library_name: 'TV Shows',
                }),
            };

            const omdbService = mockOmdb;
            const enrichmentRetryService = mockEnrichmentRetryService;

            const breakerError = new Error('OMDb circuit breaker is HALF_OPEN and maximum concurrent attempts have been reached');
            breakerError.code = 'CIRCUIT_BREAKER_HALF_OPEN_THROTTLED';
            omdbService.getByTitle.mockRejectedValueOnce(breakerError);

            db.query.mockImplementation((query) => {
                if (query.includes('SELECT * FROM omdb_config')) {
                    return Promise.resolve({ rows: [{ api_key: 'test_key', is_active: true }] });
                }
                if (query.includes('SELECT * FROM tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                if (query.includes('UPDATE media_server_items')) {
                    return Promise.resolve({ rows: [], rowCount: 1 });
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            });

            await queueService.processTask(task);

            expect(enrichmentRetryService.queueForRetry).toHaveBeenCalledWith(
                77,
                'omdb',
                expect.stringContaining('CIRCUIT_BREAKER_HALF_OPEN_THROTTLED'),
                6,
            );
            expect(queueService.logger.warn).not.toHaveBeenCalledWith(
                'OMDb enrichment failed',
                expect.anything(),
            );
            expect(queueService.logger.debug).toHaveBeenCalledWith(
                'OMDb circuit breaker HALF_OPEN throttled request; queuing for OMDb retry',
                expect.objectContaining({
                    title: 'The Office (AU)',
                    code: 'CIRCUIT_BREAKER_HALF_OPEN_THROTTLED',
                }),
            );
        });

        it('should throttle OMDb SSL warning spam and queue OMDb retry', async () => {
            const task = {
                id: 4,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify({
                    title: 'Kill Bill the Whole Bloody Affair',
                    year: 2006,
                    itemId: 88,
                    source_library_id: 1,
                    source_library_name: 'Movies',
                }),
            };

            const omdbService = mockOmdb;
            const enrichmentRetryService = mockEnrichmentRetryService;

            const sslError = new Error('certificate has expired');
            sslError.code = 'CERT_HAS_EXPIRED';
            sslError.isOmdbSslCertError = true;
            omdbService.getByTitle.mockRejectedValue(sslError);
            omdbService.checkHealth.mockResolvedValue({
                healthy: false,
                ssl_error: true,
                message: 'certificate has expired',
            });

            db.query.mockImplementation((query) => {
                if (query.includes('SELECT * FROM omdb_config')) {
                    return Promise.resolve({ rows: [{ api_key: 'test_key', is_active: true }] });
                }
                if (query.includes('SELECT * FROM tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [], rowCount: 1 });
            });

            await queueService.processTask(task);
            await queueService.processTask(task);

            const sslWarnCalls = queueService.logger.warn.mock.calls.filter(
                ([message]) => message === 'OMDb SSL certificate issue; queuing OMDb retry and pausing OMDb enrichment until recovery probe succeeds',
            );
            expect(sslWarnCalls).toHaveLength(1);

            const suppressedCalls = queueService.logger.debug.mock.calls.filter(
                ([message]) =>
                    message === 'OMDb SSL certificate warning suppressed' ||
                    message === 'OMDb SSL persistent warning suppressed',
            );
            expect(suppressedCalls).toHaveLength(1);

            const omdbRetryCalls = enrichmentRetryService.queueForRetry.mock.calls.filter(
                ([, enrichmentType, reason]) => enrichmentType === 'omdb' && reason === 'OMDb SSL certificate issue',
            );
            expect(omdbRetryCalls).toHaveLength(2);

            const tavilyFallbackCalls = enrichmentRetryService.queueForRetry.mock.calls.filter(
                ([, enrichmentType]) => enrichmentType === 'tavily',
            );
            expect(tavilyFallbackCalls).toHaveLength(0);
            expect(omdbService.getByTitle).toHaveBeenCalledTimes(1);
        });

        it('should resume OMDb enrichment when SSL recovery probe reports healthy', async () => {
            const task = {
                id: 5,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify({
                    title: 'Recovered Movie',
                    year: 2025,
                    itemId: 99,
                    source_library_id: 1,
                    source_library_name: 'Movies',
                }),
            };

            const omdbService = mockOmdb;
            const enrichmentRetryService = mockEnrichmentRetryService;

            queueService.queueTaskProcessorService.omdbSslBlockedUntil = Date.now() + 60_000;
            queueService.queueTaskProcessorService.lastOmdbSslProbeAt = 0;

            omdbService.checkHealth.mockResolvedValue({
                healthy: true,
                ssl_error: false,
                message: 'OMDb API is healthy',
            });
            omdbService.getByTitle.mockResolvedValue({
                rated: 'N/A',
                genre: 'Action',
                imdbRating: 7.5,
            });

            db.query.mockImplementation((query) => {
                if (query.includes('SELECT * FROM omdb_config')) {
                    return Promise.resolve({ rows: [{ api_key: 'test_key', is_active: true }] });
                }
                if (query.includes('SELECT * FROM tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [], rowCount: 1 });
            });

            await queueService.processTask(task);

            expect(omdbService.checkHealth).toHaveBeenCalled();
            expect(omdbService.getByTitle).toHaveBeenCalledTimes(1);

            const omdbRetryCalls = enrichmentRetryService.queueForRetry.mock.calls.filter(
                ([, enrichmentType, reason]) => enrichmentType === 'omdb' && reason === 'OMDb SSL certificate issue',
            );
            expect(omdbRetryCalls).toHaveLength(0);
        });
    });

    describe('refillQueue', () => {
        it('should normalize JSON-string metadata fields without manual parsing', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{
                    id: 42,
                    title: 'Nature Movie',
                    metadata: { summary: 'A documentary about wildlife', posterPath: '/poster.jpg' },
                    genres: '[{"name":"Documentary"},{"name":"Family"}]',
                    tags: '[{"name":"nature"},{"name":"wildlife"}]',
                    content_rating: 'PG',
                    tmdb_id: 123,
                    tvdb_id: null,
                    imdb_id: 'tt1234567',
                    year: 2022,
                    library_id: 7,
                    library_name: 'Movies',
                    media_type: 'movie',
                }],
            });

            jest.spyOn(queueService, 'enqueue').mockResolvedValue(1001);

            const result = await queueService.refillQueue();

            expect(result).toEqual({ queued: 1 });
            expect(queueService.enqueue).toHaveBeenCalledWith(
                'metadata_enrichment',
                expect.objectContaining({
                    genres: ['Documentary', 'Family'],
                    keywords: ['nature', 'wildlife'],
                }),
                expect.objectContaining({
                    source: 'gap_analysis',
                }),
            );
        });

        it('should tolerate malformed JSON-like metadata strings', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{
                    id: 43,
                    title: 'Broken Metadata Movie',
                    metadata: { summary: 'Bad metadata payload' },
                    genres: 'not json',
                    tags: 'still not json',
                    content_rating: 'PG-13',
                    tmdb_id: 456,
                    tvdb_id: null,
                    imdb_id: 'tt7654321',
                    year: 2023,
                    library_id: 8,
                    library_name: 'Movies',
                    media_type: 'movie',
                }],
            });

            jest.spyOn(queueService, 'enqueue').mockResolvedValue(1002);

            const result = await queueService.refillQueue();

            expect(result).toEqual({ queued: 1 });
            expect(queueService.enqueue).toHaveBeenCalledWith(
                'metadata_enrichment',
                expect.objectContaining({
                    genres: [],
                    keywords: [],
                }),
                expect.any(Object),
            );
        });

        it('should keep failed metadata_enrichment tasks eligible for refill requeue', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const result = await queueService.refillQueue();

            expect(result).toEqual({ queued: 0 });
            const sql = db.query.mock.calls[0][0];
            expect(sql).toMatch(/status IN \('pending', 'processing'\)/);
            expect(sql).not.toMatch(/'failed'/);
        });

        it('should keep metadata_enrichment anti-loop filtering in the refill selector', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const result = await queueService.refillQueue();

            expect(result).toEqual({ queued: 0 });
            const sql = db.query.mock.calls[0][0];
            expect(sql).toMatch(/msi\.metadata->'omdb' IS NULL/);
            expect(sql).toMatch(/msi\.metadata->'content_analysis'->>'source' IS DISTINCT FROM 'metadata_enrichment'/);
        });

        it('should tolerate orphaned library rows by defaulting media_type and preserving null library name', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{
                    id: 44,
                    title: 'Orphaned Library Movie',
                    metadata: { summary: 'Still ingestible without joined library metadata' },
                    genres: [],
                    tags: [],
                    content_rating: null,
                    tmdb_id: null,
                    tvdb_id: null,
                    imdb_id: null,
                    year: 2024,
                    library_id: 999,
                    library_name: null,
                    media_type: null,
                }],
            });

            jest.spyOn(queueService, 'enqueue').mockResolvedValue(1003);

            const result = await queueService.refillQueue();

            expect(result).toEqual({ queued: 1 });
            expect(queueService.enqueue).toHaveBeenCalledWith(
                'metadata_enrichment',
                expect.objectContaining({
                    source_library_id: 999,
                    source_library_name: null,
                    media: { media_type: 'movie' },
                }),
                expect.objectContaining({
                    source: 'gap_analysis',
                }),
            );
        });
    });

    describe('queue API facade helpers', () => {
        it('getLiveStats assembles the combined queue payload', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{
                        new_classified: '4',
                        all_classified: '9',
                        new_avg_confidence: '82.6',
                        all_avg_confidence: '78.4',
                    }],
                })
                .mockResolvedValueOnce({
                    rows: [{
                        total_items: '100',
                        enriched: '45',
                        tavily_enriched: '30',
                        omdb_enriched: '20',
                    }],
                })
                .mockResolvedValueOnce({
                    rows: [{ pending: '7' }],
                });

            jest.spyOn(queueService.queueReadModel, 'getStats').mockResolvedValue({ pending: 2, aiAvailable: true, workerRunning: true });
            jest.spyOn(queueService.queueReadModel, 'getGapAnalysisStats').mockResolvedValue({ unprocessed: 3 });
            jest.spyOn(queueService.queueReadModel.enrichmentRetryService, 'getStats').mockResolvedValue({ tavily: { pending: 1 }, total: { pending: 1 } });

            const result = await queueService.getLiveStats();
            const enrichmentSql = db.query.mock.calls[1][0];

            expect(result.queue.pending).toBe(2);
            expect(result.today.classified).toBe(4);
            expect(result.today.avgConfidence).toBe(83);
            expect(result.enrichment.progress).toBe(45);
            expect(result.enrichment.pending).toBe(7);
            expect(result.enrichment.retryQueue.total.pending).toBe(1);
            expect(result.health.ai).toBe(true);
            expect(result).toHaveProperty('timestamp');
            expect(enrichmentSql).toContain("metadata->'tavily_holiday' IS NOT NULL");
            expect(enrichmentSql).toContain("metadata->'tavily_anime' IS NOT NULL");
        });

        it('getLiveStats falls back when retry queue stats are unavailable', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{ new_classified: '0', all_classified: '0', new_avg_confidence: null, all_avg_confidence: null }],
                })
                .mockResolvedValueOnce({
                    rows: [{ total_items: '10', enriched: '0', tavily_enriched: '0', omdb_enriched: '0' }],
                })
                .mockResolvedValueOnce({
                    rows: [{ pending: '0' }],
                });

            jest.spyOn(queueService.queueReadModel, 'getStats').mockResolvedValue({ pending: 0, aiAvailable: true, workerRunning: true });
            jest.spyOn(queueService.queueReadModel, 'getGapAnalysisStats').mockResolvedValue({ unprocessed: 0 });
            jest.spyOn(queueService.queueReadModel.enrichmentRetryService, 'getStats').mockRejectedValue(new Error('retry stats unavailable'));

            const result = await queueService.getLiveStats();

            expect(result.enrichment.retryQueue.total.pending).toBe(0);
        });

        it('delegates retry queue operations through the injected enrichment retry service', async () => {
            const enrichmentRetryService = mockEnrichmentRetryService;
            enrichmentRetryService.getStats.mockResolvedValueOnce({ tavily: { pending: 2 } });
            enrichmentRetryService.processRetryQueue.mockResolvedValueOnce({ processed: 5, failed: 1 });
            enrichmentRetryService.backfillRetryQueue.mockResolvedValueOnce({
                success: true,
                queued: 13,
                enrichmentType: 'tavily',
                reason: 'items_missing_omdb_data',
            });

            await expect(queueService.getEnrichmentRetryStats()).resolves.toEqual({ tavily: { pending: 2 } });
            await expect(queueService.processEnrichmentRetryQueue(25, 'tavily')).resolves.toEqual({ processed: 5, failed: 1 });
            await expect(queueService.backfillEnrichmentRetryQueue()).resolves.toEqual({
                success: true,
                queued: 13,
                enrichmentType: 'tavily',
                reason: 'items_missing_omdb_data',
            });
        });
    });

    describe('startWorker', () => {
        it('should start worker loop', async () => {
            jest.spyOn(queueService.queueWorkerLoopService, 'resetStaleProcessingTasks').mockResolvedValue();
            jest.spyOn(queueService, 'hasClassificationDispatchBlocker').mockResolvedValue({
                hasProcessingClassification: false,
            });
            jest.spyOn(queueService, 'dequeue').mockResolvedValue(null);

            const workerPromise = queueService.startWorker();

            await new Promise(resolve => setImmediate(resolve));

            expect(queueService.running).toBe(true);

            queueService.stopWorker();

            await workerPromise;

            expect(queueService.running).toBe(false);
        });

        it('should not start if already running', async () => {
            queueService.running = true;
            jest.spyOn(queueService.queueWorkerLoopService, 'resetStaleProcessingTasks').mockResolvedValue();

            await queueService.startWorker();

            expect(queueService.queueWorkerLoopService.resetStaleProcessingTasks).not.toHaveBeenCalled();
        });

        it('should skip new classification dequeue while another classification is processing', async () => {
            jest.spyOn(queueService.queueWorkerLoopService, 'resetStaleProcessingTasks').mockResolvedValue();
            jest.spyOn(queueService, 'hasClassificationDispatchBlocker').mockResolvedValue({
                hasProcessingClassification: true,
                lookupFailed: false,
            });
            const dequeueSpy = jest.spyOn(queueService, 'dequeue').mockResolvedValue(null);

            const workerPromise = queueService.startWorker();

            await new Promise(resolve => setImmediate(resolve));

            queueService.stopWorker();
            await workerPromise;

            expect(dequeueSpy).toHaveBeenCalledWith({ excludeClassification: true });
        });
    });

    describe('dequeue', () => {
        it('should return next pending task', async () => {
            const mockTask = { id: 1, task_type: 'classification', payload: '{}' };
            db.query.mockImplementation((query) => {
                if (query.includes('RETURNING')) {
                    return Promise.resolve({ rows: [mockTask] });
                }
                return Promise.resolve({ rows: [] });
            });

            const task = await queueService.dequeue();

            expect(task).toEqual(mockTask);
        });

        it('should exclude classification tasks when requested', async () => {
            db.query.mockResolvedValue({ rows: [] });

            await queueService.dequeue({ excludeClassification: true });

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("AND task_type <> 'classification'"),
            );
        });

        it('should return null when queue is empty', async () => {
            db.query.mockImplementation(() => Promise.resolve({ rows: [] }));

            const task = await queueService.dequeue();

            expect(task).toBeNull();
        });
    });

    describe('hasClassificationDispatchBlocker', () => {
        it('should report active classification work', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    has_processing_classification: true,
                }],
            });

            const result = await queueService.hasClassificationDispatchBlocker();

            expect(result).toEqual(expect.objectContaining({
                hasProcessingClassification: true,
                lookupFailed: false,
            }));
        });

        it('should ignore pending manual decisions when checking blockers', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    has_processing_classification: false,
                }],
            });

            const result = await queueService.hasClassificationDispatchBlocker();

            expect(result.hasProcessingClassification).toBe(false);
            expect(result.lookupFailed).toBe(false);
        });

        it('should fail closed for classification dequeue when blocker lookup errors', async () => {
            db.query.mockRejectedValue(new Error('lookup failed'));

            const result = await queueService.hasClassificationDispatchBlocker();

            expect(result).toEqual(expect.objectContaining({
                hasProcessingClassification: false,
                lookupFailed: true,
            }));
            expect(queueService.logger.error).toHaveBeenCalledWith(
                'Failed to check classification dispatch blockers',
                expect.objectContaining({ error: 'lookup failed' }),
            );
        });

        it('should serve cached result within 250ms TTL without a second DB query', async () => {
            db.query.mockResolvedValue({
                rows: [{ has_processing_classification: true }],
            });

            const first = await queueService.hasClassificationDispatchBlocker();
            const second = await queueService.hasClassificationDispatchBlocker();

            expect(second).toBe(first);
            expect(db.query).toHaveBeenCalledTimes(1);
        });

        it('should re-query DB after 250ms TTL expires', async () => {
            db.query.mockResolvedValue({
                rows: [{ has_processing_classification: false }],
            });

            await queueService.hasClassificationDispatchBlocker();

            queueService._blockerCacheExpiresAt = 0;

            db.query.mockResolvedValue({
                rows: [{ has_processing_classification: true }],
            });

            const result = await queueService.hasClassificationDispatchBlocker();

            expect(db.query).toHaveBeenCalledTimes(2);
            expect(result.hasProcessingClassification).toBe(true);
        });
    });

    describe('completeTask', () => {
        it('should mark task as completed', async () => {
            db.query.mockResolvedValue({});

            await queueService.completeTask(123, { success: true });

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'completed'/s),
                expect.arrayContaining([123]),
            );
        });
    });

    describe('failTask', () => {
        it('should mark task as failed when max attempts reached', async () => {
            db.query.mockResolvedValue({});

            await queueService.failTask(123, 'Error message', 3, 3);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'failed'/s),
                expect.arrayContaining([123, 'Error message']),
            );
        });

        it('should reschedule task for retry when attempts remain', async () => {
            db.query.mockResolvedValue({});

            await queueService.failTask(123, 'Temporary error', 1, 3);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'pending'/s),
                expect.any(Array),
            );
        });
    });

    describe('getStats', () => {
        it('should return queue statistics', async () => {
            jest.spyOn(queueService, 'hasClassificationDispatchBlocker').mockResolvedValue({
                hasProcessingClassification: false,
                lookupFailed: false,
            });
            db.query.mockResolvedValueOnce({
                rows: [{
                    pending: '5',
                    processing: '2',
                    completed: '100',
                    failed: '3',
                }],
            });

            const stats = await queueService.getStats();

            expect(stats.pending).toBe(5);
            expect(stats.processing).toBe(2);
            expect(stats.completed).toBe(100);
            expect(stats.failed).toBe(3);
            expect(stats.total).toBe(110);
            expect(stats).toHaveProperty('aiAvailable');
            expect(stats).toHaveProperty('workerRunning');
            expect(stats.classificationPaused).toBe(false);
            expect(stats.classificationPauseReason).toBeNull();
        });

        it('should propagate read-model failures instead of flattening them', async () => {
            jest.spyOn(queueService.queueReadModel, 'getStats').mockRejectedValueOnce(new Error('stats query failed'));

            await expect(queueService.getStats()).rejects.toThrow('stats query failed');
        });

        it('should surface dispatch check failures as a paused state', async () => {
            jest.spyOn(queueService, 'hasClassificationDispatchBlocker').mockResolvedValue({
                hasProcessingClassification: false,
                lookupFailed: true,
            });
            db.query.mockResolvedValueOnce({
                rows: [{
                    pending: '1',
                    processing: '0',
                    completed: '2',
                    failed: '0',
                }],
            });

            const stats = await queueService.getStats();

            expect(stats.classificationPaused).toBe(true);
            expect(stats.classificationPauseReason).toBe('dispatch_check_failed');
        });

        it('should surface AI unavailability as a paused classification state while the worker is running', async () => {
            queueService.running = true;
            queueService.aiAvailable = false;
            jest.spyOn(queueService, 'hasClassificationDispatchBlocker').mockResolvedValue({
                hasProcessingClassification: false,
                lookupFailed: false,
            });
            db.query.mockResolvedValueOnce({
                rows: [{
                    pending: '1',
                    processing: '0',
                    completed: '2',
                    failed: '0',
                }],
            });

            const stats = await queueService.getStats();

            expect(stats.aiAvailable).toBe(false);
            expect(stats.workerRunning).toBe(true);
            expect(stats.classificationPaused).toBe(true);
            expect(stats.classificationPauseReason).toBe('ai_unavailable');
        });
    });

    describe('checkAIAvailability', () => {
        it('delegates to aiRouterService.checkAvailability and updates this.aiAvailable', async () => {
            queueService.aiAvailable = true;
            jest.spyOn(queueService.aiRouterService, 'checkAvailability').mockResolvedValue(false);

            const result = await queueService.checkAIAvailability();

            expect(result).toBe(false);
            expect(queueService.aiAvailable).toBe(false);
            expect(queueService.aiRouterService.checkAvailability).toHaveBeenCalledWith(
                true,
                queueService.ollamaService,
                queueService.logger,
            );
        });

        it('reflects true return from aiRouterService.checkAvailability', async () => {
            queueService.aiAvailable = false;
            jest.spyOn(queueService.aiRouterService, 'checkAvailability').mockResolvedValue(true);

            const result = await queueService.checkAIAvailability();

            expect(result).toBe(true);
            expect(queueService.aiAvailable).toBe(true);
        });
    });

    describe('retryTask', () => {
        it('should reset failed task to pending', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ id: 123, status: 'failed' }] })
                .mockResolvedValueOnce({ rowCount: 1 });

            const result = await queueService.retryTask(123);

            expect(result).toEqual({ success: true });
            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'pending'/s),
                expect.arrayContaining([123]),
            );
        });
    });

    describe('cancelTask', () => {
        it('should mark task as cancelled', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ id: 123, status: 'pending' }] })
                .mockResolvedValueOnce({ rowCount: 1 });

            const result = await queueService.cancelTask(123);

            expect(result).toEqual({ success: true });
            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'cancelled'/s),
                expect.arrayContaining([123]),
            );
        });
    });

    describe('dismissFailedTask', () => {
        it('should delete a failed task and return a success result when row is removed', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ id: 456, status: 'failed' }] })
                .mockResolvedValueOnce({ rowCount: 1 });

            const result = await queueService.dismissFailedTask(456);

            expect(result).toEqual({ success: true });
            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/DELETE FROM task_queue[\s\S]*status = 'failed'/),
                expect.arrayContaining([456]),
            );
        });

        it('should return a not_found result when the task row is missing', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const result = await queueService.dismissFailedTask(999);

            expect(result).toEqual({ success: false, code: 'not_found' });
        });
    });

    describe('bulk queue actions', () => {
        it('should delegate Ollama status through the queue facade', () => {
            queueService.ollamaService.getGenerationStatus = jest.fn().mockReturnValue({
                isGenerating: true,
                model: 'gemma3',
            });

            expect(queueService.getOllamaStatus()).toEqual({
                isGenerating: true,
                model: 'gemma3',
            });
            expect(queueService.ollamaService.getGenerationStatus).toHaveBeenCalled();
        });

        it('should clear failed tasks and return affected count', async () => {
            db.query.mockResolvedValue({ rowCount: 3 });

            const result = await queueService.clearFailedTasks();

            expect(result).toEqual({ success: true, count: 3 });
            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/DELETE FROM task_queue WHERE status = 'failed'/),
            );
        });

        it('should retry all failed tasks and return affected count', async () => {
            db.query.mockResolvedValue({ rowCount: 4 });

            const result = await queueService.retryAllFailedTasks();

            expect(result).toEqual({ success: true, count: 4 });
            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue[\s\S]*WHERE status = 'failed'/),
            );
        });

        it('should cancel all pending tasks and return affected count', async () => {
            db.query.mockResolvedValue({ rowCount: 7 });

            const result = await queueService.cancelAllPendingTasks();

            expect(result).toEqual({ success: true, count: 7 });
            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue[\s\S]*WHERE status = 'pending'/),
            );
        });
    });

    describe('clearAndResync', () => {
        beforeEach(() => {
            db.withTransaction.mockImplementation(fn => fn(db));
        });

        it('should delete all required tables in correct order', async () => {
            db.query.mockImplementation((query) => {
                if (query.includes('DELETE FROM')) {
                    return Promise.resolve({
                        rows: [{ id: 1 }],
                        rowCount: 5,
                    });
                }
                if (query.includes('SELECT id FROM libraries')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            });

            const result = await queueService.clearAndResync();

            expect(db.query).toHaveBeenCalledWith('DELETE FROM task_queue RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM content_analysis_log');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM classification_embeddings RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM classification_history RETURNING id');
            expect(queueService.evidenceService.purgeAllLegacyPatterns).toHaveBeenCalledWith({
                client: db,
                actor: 'carsa',
                reason: 'clear_and_resync',
            });
            expect(db.query).toHaveBeenCalledWith('DELETE FROM classification_corrections RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM library_rules_v2 RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM library_custom_rules');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM library_pattern_suggestions');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM library_profiles');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM media_server_sync_status RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM media_server_collections RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM media_server_items RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM libraries RETURNING id');

            expect(result).toHaveProperty('queueCleared');
            expect(result).toHaveProperty('embeddingsCleared');
            expect(result).toHaveProperty('historyCleared');
            expect(result).toHaveProperty('patternsCleared');
            expect(result).toHaveProperty('correctionsCleared');
            expect(result).toHaveProperty('rulesCleared');
            expect(result).toHaveProperty('syncStatusRowsCleared');
            expect(result).toHaveProperty('collectionsCleared');
            expect(result).toHaveProperty('itemsReset');
            expect(result).toHaveProperty('librariesCleared');
        });

        it('should delete tables in dependency-safe order', async () => {
            const deletionOrder = [];

            db.query.mockImplementation((query) => {
                if (query.includes('DELETE FROM task_queue')) {
                    deletionOrder.push('task_queue');
                } else if (query.includes('DELETE FROM content_analysis_log')) {
                    deletionOrder.push('content_analysis_log');
                } else if (query.includes('DELETE FROM classification_embeddings')) {
                    deletionOrder.push('classification_embeddings');
                } else if (query.includes('DELETE FROM classification_history')) {
                    deletionOrder.push('classification_history');
                } else if (query.includes('DELETE FROM library_profiles')) {
                    deletionOrder.push('library_profiles');
                } else if (query.includes('DELETE FROM media_server_sync_status')) {
                    deletionOrder.push('media_server_sync_status');
                } else if (query.includes('DELETE FROM media_server_collections')) {
                    deletionOrder.push('media_server_collections');
                } else if (query.includes('DELETE FROM media_server_items')) {
                    deletionOrder.push('media_server_items');
                } else if (query.includes('DELETE FROM libraries')) {
                    deletionOrder.push('libraries');
                }

                if (query.includes('SELECT id FROM libraries')) {
                    return Promise.resolve({ rows: [] });
                }

                return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
            });

            await queueService.clearAndResync();

            const embeddingsIndex = deletionOrder.indexOf('classification_embeddings');
            const historyIndex = deletionOrder.indexOf('classification_history');
            expect(embeddingsIndex).toBeLessThan(historyIndex);

            const librariesIndex = deletionOrder.indexOf('libraries');
            expect(deletionOrder.indexOf('library_profiles')).toBeLessThan(librariesIndex);
            expect(deletionOrder.indexOf('media_server_sync_status')).toBeLessThan(librariesIndex);
            expect(deletionOrder.indexOf('media_server_collections')).toBeLessThan(librariesIndex);
            expect(deletionOrder.indexOf('media_server_items')).toBeLessThan(librariesIndex);
        });

        it('should clear in-memory caches before re-sync', async () => {
            db.query.mockImplementation((query) => {
                if (query.includes('DELETE FROM')) {
                    return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            });

            queueService.queueTaskProcessorService.omdbLimitHit = true;

            await queueService.clearAndResync();

            expect(queueService.queueTaskProcessorService.omdbLimitHit).toBe(false);
        });

        it('should use syncAllLibraries for fresh sync', async () => {
            const mediaSyncService = mockMediaSync;

            db.query.mockImplementation((query) => {
                if (query.includes('DELETE FROM')) {
                    return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            });

            await queueService.clearAndResync();

            await new Promise(resolve => setImmediate(resolve));

            expect(mediaSyncService.syncAllLibraries).toHaveBeenCalled();
        });

        it('should not query for old library IDs after clear', async () => {
            db.query.mockImplementation((query) => {
                if (query.includes('DELETE FROM')) {
                    return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
                }
                if (query.includes('SELECT id FROM libraries WHERE is_active')) {
                    throw new Error('Should not query deleted libraries!');
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            });

            await expect(queueService.clearAndResync()).resolves.toBeDefined();
        });

        it('should handle errors gracefully', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            await expect(queueService.clearAndResync()).rejects.toThrow('Database error');
        });

        it('should restart worker when clearAndResync fails after stop', async () => {
            queueService.running = true;

            db.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockRejectedValueOnce(new Error('Database error'));

            const stopSpy = jest.spyOn(queueService, 'stopWorker');
            const startSpy = jest.spyOn(queueService, 'startWorker').mockResolvedValue();

            await expect(queueService.clearAndResync()).rejects.toThrow('Database error');

            expect(stopSpy).toHaveBeenCalled();
            expect(startSpy).toHaveBeenCalled();
        });

        it('should wait for in-flight tasks to drain before clearing the database', async () => {
            queueService.running = true;
            queueService.processing = 2;

            db.query.mockImplementation((query) => {
                if (query.includes('DELETE FROM')) {
                    return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            });

            jest.spyOn(queueService, 'stopWorker').mockImplementation(() => {
                queueService.running = false;
                setTimeout(() => { queueService.processing = 0; }, 150);
            });

            jest.spyOn(queueService, 'startWorker').mockResolvedValue();

            const performCleanupSpy = jest.spyOn(queueService, 'performClearAndResyncCleanup');

            await queueService.clearAndResync();

            expect(performCleanupSpy).toHaveBeenCalled();
            expect(queueService.processing).toBe(0);
        });

        it('should proceed with a warning if in-flight tasks do not drain within the timeout', async () => {
            jest.useFakeTimers();

            queueService.running = true;
            queueService.processing = 3;

            db.query.mockImplementation((query) => {
                if (query.includes('DELETE FROM')) {
                    return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            });

            jest.spyOn(queueService, 'stopWorker').mockImplementation(() => {
                queueService.running = false;
            });

            jest.spyOn(queueService, 'startWorker').mockResolvedValue();

            const warnSpy = queueService.logger
                ? jest.spyOn(queueService.logger, 'warn')
                : null;

            const promise = queueService.clearAndResync();
            for (let i = 0; i < 160; i++) {
                jest.advanceTimersByTime(100);
                await Promise.resolve();
            }
            await jest.runAllTimersAsync();
            await promise;

            expect(queueService.processing).toBe(3);

            if (warnSpy) {
                expect(warnSpy).toHaveBeenCalledWith(
                    expect.stringContaining('in-flight tasks still active after drain timeout'),
                    expect.objectContaining({ inFlight: 3 }),
                );
            }

            jest.useRealTimers();
        });
    });

    describe('Library Mapping Preservation', () => {
        describe('buildLibrarySnapshot', () => {
            it('should capture library info and mappings with external IDs', async () => {
                db.query.mockResolvedValueOnce({
                    rows: [
                        {
                            id: 1,
                            name: 'Movies',
                            media_type: 'movie',
                            external_id: 'plex-123',
                            media_server_type: 'plex',
                        },
                        {
                            id: 2,
                            name: 'TV Shows',
                            media_type: 'tv',
                            external_id: 'plex-456',
                            media_server_type: 'plex',
                        },
                    ],
                });

                db.query.mockResolvedValueOnce({
                    rows: [
                        { id: 10, library_id: 1, arr_type: 'radarr', arr_config_id: 1 },
                        { id: 11, library_id: 2, arr_type: 'sonarr', arr_config_id: 1 },
                    ],
                });

                const snapshot = await queueService.buildLibrarySnapshot();

                expect(snapshot.libraries).toEqual({
                    1: {
                        name: 'Movies',
                        media_type: 'movie',
                        external_id: 'plex-123',
                        media_server_type: 'plex',
                    },
                    2: {
                        name: 'TV Shows',
                        media_type: 'tv',
                        external_id: 'plex-456',
                        media_server_type: 'plex',
                    },
                });

                expect(snapshot.mappings).toHaveLength(2);
            });

            it('should handle empty library table', async () => {
                db.query.mockResolvedValueOnce({ rows: [] });
                db.query.mockResolvedValueOnce({ rows: [] });

                const snapshot = await queueService.buildLibrarySnapshot();

                expect(snapshot.libraries).toEqual({});
                expect(snapshot.mappings).toEqual([]);
            });
        });

        describe('buildNewLibraryLookup', () => {
            it('should create lookup tables by external_id and name+type', async () => {
                db.query.mockResolvedValueOnce({
                    rows: [
                        {
                            id: 10,
                            name: 'Movies',
                            media_type: 'movie',
                            external_id: 'plex-123',
                            media_server_type: 'plex',
                        },
                        {
                            id: 20,
                            name: 'TV Shows',
                            media_type: 'tv',
                            external_id: 'plex-456',
                            media_server_type: 'plex',
                        },
                    ],
                });

                const lookup = await queueService.buildNewLibraryLookup();

                expect(lookup.byExternalId['plex:plex-123']).toBe(10);
                expect(lookup.byExternalId['plex:plex-456']).toBe(20);
                expect(lookup.byNameType['movies|movie']).toBe(10);
                expect(lookup.byNameType['tv shows|tv']).toBe(20);
            });
        });

        describe('findNewLibraryId', () => {
            const newLookup = {
                byExternalId: {
                    'plex:plex-123': 10,
                    'emby:emby-abc': 20,
                },
                byNameType: {
                    'movies|movie': 10,
                    'tv shows|tv': 20,
                },
            };

            it('should match by external_id first (highest priority)', () => {
                const oldLibInfo = {
                    name: 'Movies',
                    media_type: 'movie',
                    external_id: 'plex-123',
                    media_server_type: 'plex',
                };

                const newId = queueService.findNewLibraryId(oldLibInfo, newLookup);

                expect(newId).toBe(10);
            });

            it('should fallback to name+type if external_id not found', () => {
                const oldLibInfo = {
                    name: 'Movies',
                    media_type: 'movie',
                    external_id: 'plex-999',
                    media_server_type: 'plex',
                };

                const newId = queueService.findNewLibraryId(oldLibInfo, newLookup);

                expect(newId).toBe(10);
            });

            it('should return null if no match found', () => {
                const oldLibInfo = {
                    name: 'Anime',
                    media_type: 'tv',
                    external_id: 'plex-999',
                    media_server_type: 'plex',
                };

                const newId = queueService.findNewLibraryId(oldLibInfo, newLookup);

                expect(newId).toBeNull();
            });

            it('should handle missing external_id gracefully', () => {
                const oldLibInfo = {
                    name: 'TV Shows',
                    media_type: 'tv',
                    media_server_type: 'plex',
                };

                const newId = queueService.findNewLibraryId(oldLibInfo, newLookup);

                expect(newId).toBe(20);
            });
        });

        describe('remapInstanceMappings', () => {
            const snapshot = {
                libraries: {
                    1: {
                        name: 'Movies',
                        media_type: 'movie',
                        external_id: 'plex-123',
                        media_server_type: 'plex',
                    },
                    2: {
                        name: 'TV Shows',
                        media_type: 'tv',
                        external_id: 'plex-456',
                        media_server_type: 'plex',
                    },
                },
                mappings: [
                    {
                        id: 10,
                        library_id: 1,
                        arr_type: 'radarr',
                        arr_config_id: 1,
                        arr_root_folder_id: 1,
                        arr_root_folder_path: '/movies/4k',
                        quality_profile_id: null,
                        plex_path_prefix: null,
                        arr_path_prefix: null,
                        classifarr_path_prefix: null,
                    },
                ],
            };

            const newLookup = {
                byExternalId: {
                    'plex:plex-123': 100,
                    'plex:plex-456': 200,
                },
                byNameType: {
                    'movies|movie': 100,
                    'tv shows|tv': 200,
                },
            };

            it('should recreate all mappings for an instance', async () => {
                const config = { id: 1, name: 'Radarr 4K' };

                db.query.mockResolvedValueOnce({ rowCount: 1 });

                const result = await queueService.remapInstanceMappings(
                    'radarr',
                    config,
                    snapshot,
                    newLookup,
                );

                expect(result.remapped).toBe(1);
                expect(result.failed).toBe(0);
                expect(db.query).toHaveBeenCalledWith(
                    expect.stringMatching(/INSERT INTO library_arr_mappings/),
                    expect.arrayContaining([100]),
                );
            });

            it('should track failed mappings', async () => {
                const config = { id: 1, name: 'Radarr 4K' };

                const snapshotWithUnknown = {
                    libraries: {},
                    mappings: [
                        {
                            id: 99,
                            library_id: 999,
                            arr_type: 'radarr',
                            arr_config_id: 1,
                            arr_root_folder_id: 1,
                            arr_root_folder_path: '/movies/deleted',
                            quality_profile_id: null,
                            plex_path_prefix: null,
                            arr_path_prefix: null,
                            classifarr_path_prefix: null,
                        },
                    ],
                };

                const result = await queueService.remapInstanceMappings(
                    'radarr',
                    config,
                    snapshotWithUnknown,
                    newLookup,
                );

                expect(result.remapped).toBe(0);
                expect(result.failed).toBe(1);
                expect(result.failedLibraries).toEqual([
                    {
                        oldId: 999,
                        reason: 'Library not found in snapshot',
                    },
                ]);
            });
        });

        describe('remapAllArrMappings', () => {
            const snapshot = {
                libraries: {
                    1: {
                        name: 'Movies',
                        media_type: 'movie',
                        external_id: 'plex-123',
                        media_server_type: 'plex',
                    },
                },
                mappings: [
                    {
                        id: 100,
                        library_id: 1,
                        arr_type: 'radarr',
                        arr_config_id: 1,
                        arr_root_folder_id: 1,
                        arr_root_folder_path: '/movies',
                        quality_profile_id: null,
                        plex_path_prefix: null,
                        arr_path_prefix: null,
                        classifarr_path_prefix: null,
                    },
                ],
            };

            const newLookup = {
                byExternalId: { 'plex:plex-123': 10 },
                byNameType: { 'movies|movie': 10 },
            };

            it('should remap all Radarr and Sonarr instances', async () => {
                db.query.mockResolvedValueOnce({
                    rows: [{ id: 1, name: 'Radarr 4K' }],
                });

                db.query.mockResolvedValueOnce({ rowCount: 1 });

                db.query.mockResolvedValueOnce({
                    rows: [{ id: 2, name: 'Sonarr' }],
                });

                const results = await queueService.remapAllArrMappings(snapshot, newLookup);

                expect(results.totalRemapped).toBe(1);
                expect(results.totalFailed).toBe(0);
                expect(results.radarr).toHaveLength(1);
                expect(results.sonarr).toHaveLength(1);
            });
        });

        describe('createRemapFailureNotification', () => {
            it('should create notification when mappings fail', async () => {
                const results = {
                    totalFailed: 2,
                    totalRemapped: 1,
                    radarr: [
                        {
                            id: 1,
                            name: 'Radarr 4K',
                            failed: 2,
                            failedLibraries: [
                                { oldId: 1, name: 'Movies', reason: 'No match' },
                            ],
                        },
                    ],
                    sonarr: [],
                };

                db.query.mockResolvedValueOnce({ rowCount: 1 });

                await queueService.createRemapFailureNotification(results);

                expect(db.query).toHaveBeenCalledWith(
                    expect.stringMatching(/INSERT INTO app_notifications/),
                    expect.arrayContaining([
                        'warning',
                        'Some library mappings need attention',
                        expect.stringContaining('2 library mapping(s)'),
                    ]),
                );
            });

            it('should not create notification when no failures', async () => {
                const results = {
                    totalFailed: 0,
                    totalRemapped: 3,
                    radarr: [],
                    sonarr: [],
                };

                await queueService.createRemapFailureNotification(results);

                expect(db.query).not.toHaveBeenCalled();
            });
        });

        describe('NULL handling in library matching', () => {
            describe('buildNewLibraryLookup', () => {
                it('should skip libraries with NULL media_server_type when building external_id lookup', async () => {
                    db.query.mockResolvedValueOnce({
                        rows: [
                            {
                                id: 10,
                                name: 'Movies',
                                media_type: 'movie',
                                external_id: 'plex-123',
                                media_server_type: 'plex',
                            },
                            {
                                id: 20,
                                name: 'Orphaned Library',
                                media_type: 'movie',
                                external_id: 'orphan-456',
                                media_server_type: null,
                            },
                        ],
                    });

                    const lookup = await queueService.buildNewLibraryLookup();

                    expect(lookup.byExternalId['plex:plex-123']).toBe(10);
                    expect(lookup.byExternalId['null:orphan-456']).toBeUndefined();
                    expect(lookup.byExternalId['undefined:orphan-456']).toBeUndefined();

                    expect(lookup.byNameType['movies|movie']).toBe(10);
                    expect(lookup.byNameType['orphaned library|movie']).toBe(20);
                });

                it('should skip libraries with NULL external_id when building external_id lookup', async () => {
                    db.query.mockResolvedValueOnce({
                        rows: [
                            {
                                id: 10,
                                name: 'Movies',
                                media_type: 'movie',
                                external_id: null,
                                media_server_type: 'plex',
                            },
                        ],
                    });

                    const lookup = await queueService.buildNewLibraryLookup();

                    expect(Object.keys(lookup.byExternalId)).toHaveLength(0);

                    expect(lookup.byNameType['movies|movie']).toBe(10);
                });
            });

            describe('findNewLibraryId', () => {
                const newLookup = {
                    byExternalId: {
                        'plex:plex-123': 10,
                    },
                    byNameType: {
                        'movies|movie': 10,
                    },
                };

                it('should fallback to name+type when media_server_type is NULL', () => {
                    const oldLibInfo = {
                        name: 'Movies',
                        media_type: 'movie',
                        external_id: 'plex-123',
                        media_server_type: null,
                    };

                    const newId = queueService.findNewLibraryId(oldLibInfo, newLookup);

                    expect(newId).toBe(10);
                });

                it('should fallback to name+type when external_id is NULL', () => {
                    const oldLibInfo = {
                        name: 'Movies',
                        media_type: 'movie',
                        external_id: null,
                        media_server_type: 'plex',
                    };

                    const newId = queueService.findNewLibraryId(oldLibInfo, newLookup);

                    expect(newId).toBe(10);
                });

                it('should return null when both external_id and name+type fail to match', () => {
                    const oldLibInfo = {
                        name: 'Deleted Library',
                        media_type: 'movie',
                        external_id: null,
                        media_server_type: null,
                    };

                    const newId = queueService.findNewLibraryId(oldLibInfo, newLookup);

                    expect(newId).toBeNull();
                });
            });
        });

        describe('clearAndResync with mapping preservation', () => {
            beforeEach(() => {
                db.withTransaction.mockImplementation(fn => fn(db));
            });

            it('should preserve library mappings during CARSA', async () => {
                db.query.mockImplementationOnce(() =>
                    Promise.resolve({
                        rows: [
                            {
                                id: 1,
                                name: 'Movies',
                                media_type: 'movie',
                                external_id: 'plex-123',
                                media_server_type: 'plex',
                            },
                        ],
                    }),
                );

                db.query.mockImplementationOnce(() =>
                    Promise.resolve({
                        rows: [
                            {
                                id: 10,
                                library_id: 1,
                                arr_type: 'radarr',
                                arr_config_id: 1,
                                arr_root_folder_id: 1,
                                arr_root_folder_path: '/movies',
                            },
                        ],
                    }),
                );

                db.query.mockImplementation((query) => {
                    if (query.includes('DELETE FROM')) {
                        return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
                    }
                    return Promise.resolve({ rows: [], rowCount: 0 });
                });

                const result = await queueService.clearAndResync();

                expect(db.query).toHaveBeenCalledWith(
                    expect.stringMatching(/SELECT.*external_id.*FROM libraries/s),
                );

                expect(db.query).toHaveBeenCalledWith(
                    expect.stringMatching(/SELECT \* FROM library_arr_mappings/),
                );

                expect(result).toHaveProperty('librariesCleared');
            });
        });
    });

    describe('dequeue SQL pattern', () => {
        it('dequeue query uses FOR UPDATE SKIP LOCKED', async () => {
            db.query.mockResolvedValue({ rows: [] });
            await queueService.dequeue();
            const sql = db.query.mock.calls[0][0];
            expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
        });

        it('dequeue query filters by status pending and next_retry_at', async () => {
            db.query.mockResolvedValue({ rows: [] });
            await queueService.dequeue();
            const sql = db.query.mock.calls[0][0];
            expect(sql).toMatch(/status.*=.*'pending'/);
            expect(sql).toMatch(/next_retry_at.*<=.*NOW/);
        });

        it('dequeue query orders by priority DESC then created_at ASC', async () => {
            db.query.mockResolvedValue({ rows: [] });
            await queueService.dequeue();
            const sql = db.query.mock.calls[0][0];
            expect(sql).toMatch(/ORDER BY.*priority.*DESC.*created_at.*ASC/s);
        });

        it('dequeue SET includes visible_at assignment', async () => {
            db.query.mockResolvedValue({ rows: [] });
            await queueService.dequeue();
            const sql = db.query.mock.calls[0][0];
            expect(sql).toMatch(/SET.*visible_at\s*=\s*NOW\(\)/s);
        });

        it('dequeue WHERE includes visibility-timeout recovery branch', async () => {
            db.query.mockResolvedValue({ rows: [] });
            await queueService.dequeue();
            const sql = db.query.mock.calls[0][0];
            expect(sql).toMatch(/status\s*=\s*'processing'.*visible_at\s*<=\s*NOW\(\)/s);
        });
    });

    describe('recoverExpiredVisibilityTasks', () => {
        it('resets processing rows whose visible_at has expired', async () => {
            db.query.mockResolvedValue({ rowCount: 2, rows: [{ id: 10 }, { id: 11 }] });
            const count = await queueService.recoverExpiredVisibilityTasks();
            expect(count).toBe(2);
            const sql = db.query.mock.calls[0][0];
            expect(sql).toMatch(/visible_at\s*<=\s*NOW\(\)/);
            expect(sql).toMatch(/status\s*=\s*'pending'/);
            expect(sql).toMatch(/visible_at\s*=\s*NULL/);
        });

        it('decrements this.processing by the number of recovered rows', async () => {
            queueService.processing = 5;
            db.query.mockResolvedValue({ rowCount: 3, rows: [{ id: 1 }, { id: 2 }, { id: 3 }] });
            await queueService.recoverExpiredVisibilityTasks();
            expect(queueService.processing).toBe(2);
        });

        it('does not decrement this.processing below zero', async () => {
            queueService.processing = 1;
            db.query.mockResolvedValue({ rowCount: 5, rows: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }] });
            await queueService.recoverExpiredVisibilityTasks();
            expect(queueService.processing).toBe(0);
        });

        it('returns 0 and logs error when query fails', async () => {
            db.query.mockRejectedValue(new Error('connection lost'));
            const count = await queueService.recoverExpiredVisibilityTasks();
            expect(count).toBe(0);
            expect(queueService.logger.error).toHaveBeenCalledWith(
                'Failed to recover expired visibility tasks',
                expect.objectContaining({ error: 'connection lost' }),
            );
        });

        it('returns 0 without warn when no rows expired', async () => {
            db.query.mockResolvedValue({ rowCount: 0, rows: [] });
            const count = await queueService.recoverExpiredVisibilityTasks();
            expect(count).toBe(0);
            expect(queueService.logger.warn).not.toHaveBeenCalled();
        });
    });

    describe('resetStaleProcessingTasks', () => {
        function makeClient(acquiredValue, rowCount = 0, rows = []) {
            return {
                query: jest.fn().mockImplementation((sql, _params) => {
                    if (sql && sql.includes('pg_try_advisory_xact_lock')) {
                        return Promise.resolve({ rows: [{ acquired: acquiredValue }] });
                    }
                    if (sql && sql.includes('UPDATE task_queue')) {
                        return Promise.resolve({ rowCount, rows });
                    }
                    return Promise.resolve({ rows: [] });
                }),
                release: jest.fn(),
            };
        }

        it('resetStaleProcessingTasks: acquires advisory lock and resets rows', async () => {
            const mockRows = [{ id: 1 }, { id: 2 }];
            const mockClient = makeClient(true, 2, mockRows);
            db.withTransaction.mockImplementation(async (fn) => {
                try {
                    await mockClient.query('BEGIN');
                    const result = await fn(mockClient);
                    await mockClient.query('COMMIT');
                    return result;
                } catch (err) {
                    try { await mockClient.query('ROLLBACK'); } catch (_) {}
                    throw err;
                } finally {
                    mockClient.release();
                }
            });

            const count = await queueService.resetStaleProcessingTasks();

            expect(count).toBe(2);
            const updateCall = mockClient.query.mock.calls.find(
                ([sql]) => sql && sql.includes('UPDATE task_queue'),
            );
            expect(updateCall).toBeDefined();
            expect(updateCall[0]).toMatch(/started_at.*<.*NOW\(\).*INTERVAL/s);
            expect(updateCall[0]).toMatch(/visible_at\s*=\s*NULL/);
            const commitCall = mockClient.query.mock.calls.find(([sql]) => sql === 'COMMIT');
            expect(commitCall).toBeDefined();
        });

        it('resetStaleProcessingTasks: skips when advisory lock unavailable', async () => {
            const mockClient = makeClient(false);
            db.withTransaction.mockImplementation(async (fn) => {
                try {
                    await mockClient.query('BEGIN');
                    const result = await fn(mockClient);
                    await mockClient.query('COMMIT');
                    return result;
                } catch (err) {
                    try { await mockClient.query('ROLLBACK'); } catch (_) {}
                    throw err;
                } finally {
                    mockClient.release();
                }
            });

            const count = await queueService.resetStaleProcessingTasks();

            expect(count).toBe(0);
            const updateCall = mockClient.query.mock.calls.find(
                ([sql]) => sql && sql.includes('UPDATE task_queue'),
            );
            expect(updateCall).toBeUndefined();
            // When lock is unavailable, callback returns early and transaction is committed (no writes)
            const commitCall = mockClient.query.mock.calls.find(([sql]) => sql === 'COMMIT');
            expect(commitCall).toBeDefined();
        });

        it('resetStaleProcessingTasks: returns 0 and logs error when withTransaction throws', async () => {
            db.withTransaction.mockRejectedValue(new Error('connection refused'));

            const count = await queueService.resetStaleProcessingTasks();

            expect(count).toBe(0);
            expect(queueService.logger.error).toHaveBeenCalledWith(
                'Failed to reset stale tasks',
                expect.objectContaining({ error: 'connection refused' }),
            );
        });
    });

    describe('gracefulShutdown', () => {
        it('sets error_message to diagnostic note instead of NULL on in-flight tasks', async () => {
            db.query.mockResolvedValue({ rowCount: 2, rows: [{ id: 10 }, { id: 11 }] });
            queueService.running = true;

            await queueService.gracefulShutdown();

            const updateCall = db.query.mock.calls.find(
                ([sql]) => typeof sql === 'string' && sql.includes("SET status = 'pending'"),
            );
            expect(updateCall).toBeDefined();
            expect(updateCall[0]).toContain("error_message = 'Reset by graceful shutdown'");
            expect(updateCall[0]).not.toMatch(/error_message\s*=\s*NULL/);
        });

        it('does not throw when the DB update fails', async () => {
            db.query.mockRejectedValue(new Error('DB gone'));
            queueService.running = true;

            await expect(queueService.gracefulShutdown()).resolves.toBeUndefined();
            expect(queueService.logger.error).toHaveBeenCalledWith(
                'Graceful shutdown: failed to reset in-flight tasks',
                expect.objectContaining({ error: 'DB gone' }),
            );
        });
    });

    describe('withOptionalTransaction', () => {
        it('attaches rollbackFailed and rollbackError to thrown error when ROLLBACK also fails', async () => {
            const workError = new Error('work bombed');
            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({})
                    .mockRejectedValueOnce(new Error('rollback failed')),
                release: jest.fn(),
            };
            db.connect = jest.fn().mockResolvedValue(mockClient);

            const thrownError = await queueService
                .withOptionalTransaction(async () => { throw workError; }, 'test-ctx')
                .catch(e => e);

            expect(thrownError).toBe(workError);
            expect(thrownError.rollbackFailed).toBe(true);
            expect(thrownError.rollbackError).toBe('rollback failed');
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('does not add rollback properties when ROLLBACK succeeds', async () => {
            const workError = new Error('work failed cleanly');
            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({})
                    .mockResolvedValueOnce({}),
                release: jest.fn(),
            };
            db.connect = jest.fn().mockResolvedValue(mockClient);

            const thrownError = await queueService
                .withOptionalTransaction(async () => { throw workError; }, 'test-ctx')
                .catch(e => e);

            expect(thrownError).toBe(workError);
            expect(thrownError.rollbackFailed).toBeUndefined();
            expect(thrownError.rollbackError).toBeUndefined();
            expect(mockClient.release).toHaveBeenCalled();
        });
    });

    describe('rebuild_hnsw_index task', () => {
        it('runs CREATE INDEX CONCURRENTLY for all three image indexes and completes task', async () => {
            const task = {
                id: 99,
                task_type: 'rebuild_hnsw_index',
                payload: JSON.stringify({ reason: 'image_dimension_mismatch', targetDims: 768 }),
                attempts: 1,
                max_attempts: 3,
            };

            db.query.mockResolvedValue({ rows: [] });

            await queueService.processTask(task);

            const queryCalls = db.query.mock.calls.map(([sql]) => sql);

            const hnsw = queryCalls.find(s => s.includes('idx_embeddings_image_hnsw') && s.includes('CONCURRENTLY'));
            expect(hnsw).toBeDefined();
            expect(hnsw).toMatch(/USING hnsw/i);

            const present = queryCalls.find(s => s.includes('idx_embeddings_image_present') && s.includes('CONCURRENTLY'));
            expect(present).toBeDefined();

            const hash = queryCalls.find(s => s.includes('idx_embeddings_image_hash') && s.includes('CONCURRENTLY'));
            expect(hash).toBeDefined();

            const completeCall = queryCalls.find(s => /UPDATE task_queue\s+SET status = 'completed'/i.test(s));
            expect(completeCall).toBeDefined();
        });

        it('propagates error and fails task when CREATE INDEX CONCURRENTLY throws', async () => {
            const task = {
                id: 100,
                task_type: 'rebuild_hnsw_index',
                payload: JSON.stringify({ reason: 'image_dimension_mismatch', targetDims: 512 }),
                attempts: 2,
                max_attempts: 3,
            };

            db.query.mockImplementation((sql) => {
                if (typeof sql === 'string' && sql.includes('CREATE INDEX CONCURRENTLY')) {
                    return Promise.reject(new Error('index build failed'));
                }
                return Promise.resolve({ rows: [] });
            });

            await queueService.processTask(task);

            expect(queueService.logger.error).toHaveBeenCalledWith(
                'Task processing failed',
                expect.objectContaining({ taskId: 100, error: 'index build failed' }),
            );

            const failCall = db.query.mock.calls.find(
                ([sql]) => typeof sql === 'string' && /UPDATE task_queue\s+SET status = 'failed'/i.test(sql),
            );
            expect(failCall).toBeDefined();
        });
    });
});
