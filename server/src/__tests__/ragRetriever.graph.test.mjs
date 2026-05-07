/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import { createMockModule } from './helpers/mockFactory.mjs';

/**
 * Tests for the Issue-286 graph retrieval additions to ragRetriever:
 *   - calculateWeightedRRF()
 *   - graphSearch()
 *   - hybridSearch() with rag_graph_enabled flag (integration paths)
 */

const mockDb = {
    query: jest.fn(),
    pool: { connect: jest.fn() },
    healthCheck: jest.fn(),
    withTransaction: jest.fn(),
    tryAdvisoryLock: jest.fn(),
    DB_ADVISORY_LOCKS: { IDLE_BACKFILL: 1001, SCHEDULED_BACKFILL: 1002, MANUAL_BACKFILL: 1003 }
};

const mockLogger = {
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
};

const mockRagLogger = {
    logOperation: jest.fn().mockResolvedValue(undefined),
    logError: jest.fn().mockResolvedValue(undefined)
};

const mockEmbeddingService = {
    formatForEmbedding: jest.fn(),
    resolvePosterUrl: jest.fn(),
    hasMinimumEmbeddings: jest.fn(),
};

const mockEmbeddingRouter = {
    isEnabled: jest.fn(),
    embed: jest.fn(),
    getConfig: jest.fn(),
};

const mockImageEmbeddingProvider = {
    embedImageFromUrl: jest.fn(),
    getConfig: jest.fn(),
    isConfigured: jest.fn(),
};

const mockRagGraphExtractor = {
    extract: jest.fn()
};

const mockRagLoopHelpers = {
    expandRetrievalMetadata: jest.fn((metadata) => metadata),
};

jest.unstable_mockModule('../config/database.mjs', () => createMockModule(mockDb));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

jest.unstable_mockModule('../utils/ragLogger.mjs', () => createMockModule(mockRagLogger));

jest.unstable_mockModule('../services/embeddingService.mjs', () => createMockModule(mockEmbeddingService));

jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createMockModule(mockEmbeddingRouter));

jest.unstable_mockModule('../services/imageEmbeddingProvider.mjs', () => createMockModule(mockImageEmbeddingProvider));

jest.unstable_mockModule('../services/ragGraphExtractor.mjs', () => createMockModule(mockRagGraphExtractor));

jest.unstable_mockModule('../utils/ragLoopHelpers.mjs', () => createMockModule(mockRagLoopHelpers));

const db = mockDb;
const ragLogger = mockRagLogger;
const embeddingService = mockEmbeddingService;
const embeddingRouter = mockEmbeddingRouter;
const imageEmbeddingProvider = mockImageEmbeddingProvider;
const ragGraphExtractor = mockRagGraphExtractor;

let ragRetriever;

beforeAll(async () => {
    ({ default: ragRetriever } = await import('../services/ragRetriever.mjs'));
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateWeightedRRF
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateWeightedRRF', () => {
    it('returns [] for null sources', () => {
        expect(ragRetriever.calculateWeightedRRF(null)).toEqual([]);
    });

    it('returns [] for empty sources array', () => {
        expect(ragRetriever.calculateWeightedRRF([])).toEqual([]);
    });

    it('returns [] when all sources have empty matches', () => {
        const sources = [
            { matches: [], weight: 1.0 },
            { matches: [], weight: 0.5 }
        ];
        expect(ragRetriever.calculateWeightedRRF(sources)).toEqual([]);
    });

    it('applies default weight 1.0 when no weight specified', () => {
        const sources = [
            { matches: [{ classificationId: 1, title: 'A' }] } // no weight
        ];
        const results = ragRetriever.calculateWeightedRRF(sources, 60);
        expect(results).toHaveLength(1);
        // weight 1.0, rank 0 → 1.0 * 1/(60+0+1) = 1/61
        expect(results[0].rrfScore).toBeCloseTo(1 / 61, 6);
    });

    it('skips matches without classificationId', () => {
        const sources = [
            {
                matches: [
                    { classificationId: 1, title: 'Valid' },
                    { title: 'Missing ID' }
                ],
                weight: 1.0
            }
        ];
        const results = ragRetriever.calculateWeightedRRF(sources);
        expect(results).toHaveLength(1);
        expect(results[0].classificationId).toBe(1);
    });

    it('item appearing in all 3 sources ranks above item in 2, which ranks above item in 1', () => {
        const inAll3   = { classificationId: 1, title: 'All Three' };
        const inTwo    = { classificationId: 2, title: 'Two Sources' };
        const inOneOnly = { classificationId: 3, title: 'One Source' };

        const sources = [
            { matches: [inAll3, inTwo, inOneOnly], weight: 1.0 },
            { matches: [inAll3, inTwo],            weight: 1.0 },
            { matches: [inAll3],                   weight: 1.0 }
        ];

        const results = ragRetriever.calculateWeightedRRF(sources, 60);

        const ids = results.map(r => r.classificationId);
        expect(ids[0]).toBe(1); // in all 3 — highest
        expect(ids[1]).toBe(2); // in 2
        expect(ids[2]).toBe(3); // in 1
    });

    it('produces no duplicate classificationIds in output', () => {
        const match = { classificationId: 7, title: 'Franchise Film' };
        const sources = [
            { matches: [match], weight: 1.0 },
            { matches: [match], weight: 1.0 },
            { matches: [match], weight: 0.5 }
        ];
        const results = ragRetriever.calculateWeightedRRF(sources);
        const ids = results.map(r => r.classificationId);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('weighted graph signal contributes proportionally less at low weight', () => {
        // semantic id=1 rank 1, graph id=2 rank 1 (weight 0.20)
        const sources = [
            { matches: [{ classificationId: 1 }], weight: 1.0  },
            { matches: [{ classificationId: 2 }], weight: 0.20 }
        ];
        const results = ragRetriever.calculateWeightedRRF(sources, 60);
        const id1 = results.find(r => r.classificationId === 1);
        const id2 = results.find(r => r.classificationId === 2);
        expect(id1.rrfScore).toBeCloseTo(1 / 61, 6);
        expect(id2.rrfScore).toBeCloseTo(0.20 / 61, 6);
        expect(id1.rrfScore).toBeGreaterThan(id2.rrfScore);
    });

    it('accumulates score when item appears in multiple sources', () => {
        const match = { classificationId: 5 };
        const sources = [
            { matches: [match], weight: 1.0 },
            { matches: [match], weight: 1.0 }
        ];
        const results = ragRetriever.calculateWeightedRRF(sources, 60);
        // Two sources, rank 0 each → 2 * (1.0 / 61) = 2/61
        expect(results[0].rrfScore).toBeCloseTo(2 / 61, 6);
    });

    it('invalid k defaults to 60', () => {
        const sources = [{ matches: [{ classificationId: 1 }], weight: 1.0 }];
        const result = ragRetriever.calculateWeightedRRF(sources, 'bad');
        expect(result[0].rrfScore).toBeCloseTo(1 / 61, 6);
    });

    it('negative k defaults to 60', () => {
        const sources = [{ matches: [{ classificationId: 1 }], weight: 1.0 }];
        const result = ragRetriever.calculateWeightedRRF(sources, -10);
        expect(result[0].rrfScore).toBeCloseTo(1 / 61, 6);
    });

    it('preserves all original match properties on output items', () => {
        const sources = [
            { matches: [{ classificationId: 9, title: 'Test', libraryName: 'Movies', confidence: 0.9 }], weight: 1.0 }
        ];
        const results = ragRetriever.calculateWeightedRRF(sources);
        expect(results[0].title).toBe('Test');
        expect(results[0].libraryName).toBe('Movies');
        expect(results[0].confidence).toBe(0.9);
        expect(results[0].rrfScore).toBeDefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// graphSearch
// ─────────────────────────────────────────────────────────────────────────────

describe('graphSearch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ragGraphExtractor.extract.mockReset();
        db.query.mockReset();
        // Default extractor returns no relationships
        ragGraphExtractor.extract.mockReturnValue({
            director_name: null,
            primary_studio_name: null,
            genre_names: [],
            cast_ids: [],
            cast_names: []
        });
        db.query.mockResolvedValue({ rows: [] });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns [] immediately when rag_graph_enabled is false', async () => {
        const config = { rag_graph_enabled: false };
        const result = await ragRetriever.graphSearch({}, config);
        expect(result).toEqual([]);
        expect(db.query).not.toHaveBeenCalled();
    });

    it('returns [] when no conditions can be built (all dimensions null/empty)', async () => {
        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: true,
            rag_graph_director_enabled: true,
            rag_graph_studio_enabled: true,
            rag_graph_cast_enabled: true,
            rag_graph_genre_enabled: true
        };
        // metadata has no collection_id, extractor returns all nulls/empty
        const result = await ragRetriever.graphSearch({ title: 'Film' }, config);
        expect(result).toEqual([]);
        expect(db.query).not.toHaveBeenCalled();
    });

    it('queries DB when collection_id is present and collection dimension enabled', async () => {
        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: true,
            rag_graph_director_enabled: false,
            rag_graph_studio_enabled: false,
            rag_graph_cast_enabled: false,
            rag_graph_genre_enabled: false,
            rag_graph_candidates_limit: 20
        };
        const metadata = { collectionId: 123, classificationId: 999 };

        db.query.mockResolvedValue({
            rows: [{
                classification_id: 42,
                title: 'Franchise Film 2',
                media_type: 'movie',
                library_id: 1,
                library_name: 'Movies',
                method: 'AI',
                confidence: 0.95,
                match_score: 8
            }]
        });

        const _result = await ragRetriever.graphSearch(metadata, config);

        expect(db.query).toHaveBeenCalledTimes(1);
        const [sql, params] = db.query.mock.calls[0];
        expect(sql).toContain('collection_id');
        expect(params).toContain(123);  // collection_id value
        expect(params).toContain(999);  // exclusion id ($1)
    });

    it('maps DB rows to correct output shape', async () => {
        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: true,
            rag_graph_candidates_limit: 10
        };
        const metadata = { collection_id: 77 };

        db.query.mockResolvedValue({
            rows: [{
                classification_id: 55,
                title: 'Related Film',
                media_type: 'movie',
                library_id: 2,
                library_name: 'Films',
                method: 'AI',
                confidence: 0.88,
                match_score: 8
            }]
        });

        const result = await ragRetriever.graphSearch(metadata, config);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            classificationId: 55,
            title: 'Related Film',
            mediaType: 'movie',
            libraryId: 2,
            libraryName: 'Films',
            method: 'AI',
            confidence: 0.88,
            similarity: null,       // graph hits have no cosine similarity
            graphMatchScore: 8
        });
    });

    it('accepts collection_id via metadata.collection_id (snake_case)', async () => {
        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: true,
            rag_graph_candidates_limit: 20
        };
        db.query.mockResolvedValue({ rows: [] });

        await ragRetriever.graphSearch({ collection_id: 50 }, config);

        const [, params] = db.query.mock.calls[0];
        expect(params).toContain(50);
    });

    it('queries DB when director dimension enabled and director_name is present', async () => {
        ragGraphExtractor.extract.mockReturnValue({
            director_name: 'christopher nolan',
            primary_studio_name: null,
            genre_names: [],
            cast_ids: [],
            cast_names: []
        });

        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: false,
            rag_graph_director_enabled: true,
            rag_graph_studio_enabled: false,
            rag_graph_cast_enabled: false,
            rag_graph_genre_enabled: false,
            rag_graph_candidates_limit: 20
        };

        db.query.mockResolvedValue({ rows: [] });
        await ragRetriever.graphSearch({ title: 'Film' }, config);

        expect(db.query).toHaveBeenCalledTimes(1);
        const [sql, params] = db.query.mock.calls[0];
        expect(sql).toContain('director_name');
        expect(params).toContain('christopher nolan');
    });

    it('queries DB when cast dimension enabled and cast_ids is non-empty', async () => {
        ragGraphExtractor.extract.mockReturnValue({
            director_name: null,
            primary_studio_name: null,
            genre_names: [],
            cast_ids: [1136406, 6193],
            cast_names: ['Tom Hardy', 'Leonardo DiCaprio']
        });

        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: false,
            rag_graph_director_enabled: false,
            rag_graph_studio_enabled: false,
            rag_graph_cast_enabled: true,
            rag_graph_genre_enabled: false,
            rag_graph_candidates_limit: 20
        };

        db.query.mockResolvedValue({ rows: [] });
        await ragRetriever.graphSearch({ title: 'Film' }, config);

        expect(db.query).toHaveBeenCalledTimes(1);
        const [sql, params] = db.query.mock.calls[0];
        expect(sql).toContain('cast_ids');
        expect(params).toContainEqual([1136406, 6193]);
    });

    it('queries DB when studio dimension enabled and primary_studio_name is present', async () => {
        ragGraphExtractor.extract.mockReturnValue({
            director_name: null,
            primary_studio_name: 'pixar',
            genre_names: [],
            cast_ids: [],
            cast_names: []
        });

        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: false,
            rag_graph_director_enabled: false,
            rag_graph_studio_enabled: true,
            rag_graph_cast_enabled: false,
            rag_graph_genre_enabled: false,
            rag_graph_candidates_limit: 20
        };

        db.query.mockResolvedValue({ rows: [] });
        await ragRetriever.graphSearch({ title: 'Film' }, config);

        expect(db.query).toHaveBeenCalledTimes(1);
        const [sql, params] = db.query.mock.calls[0];
        expect(sql).toContain('primary_studio_name');
        expect(params).toContain('pixar');
    });

    it('queries DB when genre dimension enabled and genre_names is non-empty', async () => {
        ragGraphExtractor.extract.mockReturnValue({
            director_name: null,
            primary_studio_name: null,
            genre_names: ['action', 'thriller'],
            cast_ids: [],
            cast_names: []
        });

        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: false,
            rag_graph_director_enabled: false,
            rag_graph_studio_enabled: false,
            rag_graph_cast_enabled: false,
            rag_graph_genre_enabled: true,
            rag_graph_candidates_limit: 20
        };

        db.query.mockResolvedValue({ rows: [] });
        await ragRetriever.graphSearch({ title: 'Film' }, config);

        expect(db.query).toHaveBeenCalledTimes(1);
        const [sql, params] = db.query.mock.calls[0];
        expect(sql).toContain('genre_names');
        expect(params).toContainEqual(['action', 'thriller']);
    });

    it('excludes the current classification row (id != $1)', async () => {
        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: true,
            rag_graph_candidates_limit: 20
        };
        const metadata = { collectionId: 10, classificationId: 42 };

        db.query.mockResolvedValue({ rows: [] });
        await ragRetriever.graphSearch(metadata, config);

        const [sql, params] = db.query.mock.calls[0];
        expect(sql).toMatch(/id != \$1/);
        expect(params[0]).toBe(42);  // excluded id is always $1
    });

    it('defaults exclude id to 0 when metadata has no classificationId', async () => {
        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: true,
            rag_graph_candidates_limit: 20
        };
        db.query.mockResolvedValue({ rows: [] });
        await ragRetriever.graphSearch({ collectionId: 5 }, config);

        const [, params] = db.query.mock.calls[0];
        expect(params[0]).toBe(0);
    });

    it('throws AbortError when signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();

        const config = { rag_graph_enabled: true };
        await expect(
            ragRetriever.graphSearch({ collectionId: 1 }, config, { signal: controller.signal })
        ).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('swallows DB errors and returns [] (does not propagate)', async () => {
        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: true,
            rag_graph_candidates_limit: 20
        };
        db.query.mockRejectedValue(new Error('DB connection failed'));

        const result = await ragRetriever.graphSearch({ collectionId: 1 }, config);
        expect(result).toEqual([]);
    });

    it('calls ragLogger.logError on DB failure', async () => {
        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: true,
            rag_graph_candidates_limit: 20
        };
        db.query.mockRejectedValue(new Error('timeout'));

        await ragRetriever.graphSearch({ collectionId: 1 }, config);

        expect(ragLogger.logError).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'timeout' }),
            'graph_search',
            expect.objectContaining({ duration_ms: expect.any(Number) })
        );
    });

    it('does NOT call ragLogger.logError when query succeeds', async () => {
        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: true,
            rag_graph_candidates_limit: 20
        };
        db.query.mockResolvedValue({ rows: [] });

        await ragRetriever.graphSearch({ collectionId: 1 }, config);

        expect(ragLogger.logError).not.toHaveBeenCalled();
    });

    it('respects rag_graph_candidates_limit in SQL LIMIT param', async () => {
        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: true,
            rag_graph_candidates_limit: 7
        };
        db.query.mockResolvedValue({ rows: [] });
        await ragRetriever.graphSearch({ collectionId: 1 }, config);

        const [, params] = db.query.mock.calls[0];
        expect(params).toContain(7); // limit is last param
    });

    it('returns [] (no DB call) when cast_enabled but cast_ids is empty', async () => {
        ragGraphExtractor.extract.mockReturnValue({
            director_name: null,
            primary_studio_name: null,
            genre_names: [],
            cast_ids: [],   // empty — should not generate a condition
            cast_names: []
        });
        const config = {
            rag_graph_enabled: true,
            rag_graph_collection_enabled: false,
            rag_graph_director_enabled: false,
            rag_graph_studio_enabled: false,
            rag_graph_cast_enabled: true,
            rag_graph_genre_enabled: false
        };
        const result = await ragRetriever.graphSearch({ title: 'Film' }, config);
        expect(result).toEqual([]);
        expect(db.query).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// hybridSearch — graph integration paths
// ─────────────────────────────────────────────────────────────────────────────

describe('hybridSearch — graph integration', () => {
    let mockPoolClient;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();

        db.pool.connect.mockReset();
        db.query.mockReset();
        embeddingService.formatForEmbedding.mockReset();
        embeddingService.resolvePosterUrl.mockReset();
        imageEmbeddingProvider.getConfig.mockReset();
        imageEmbeddingProvider.isConfigured.mockReset();
        imageEmbeddingProvider.embedImageFromUrl.mockReset();
        ragGraphExtractor.extract.mockReset();

        mockPoolClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn()
        };
        db.pool.connect.mockResolvedValue(mockPoolClient);
        db.query.mockResolvedValue({ rows: [] });

        embeddingService.formatForEmbedding.mockReturnValue('query');
        embeddingService.resolvePosterUrl.mockReturnValue(null);
        imageEmbeddingProvider.getConfig.mockResolvedValue({ image_embedding_provider_mode: 'disabled' });
        imageEmbeddingProvider.isConfigured.mockReturnValue(false);
        imageEmbeddingProvider.embedImageFromUrl.mockResolvedValue(null);

        ragGraphExtractor.extract.mockReturnValue({
            director_name: null,
            primary_studio_name: null,
            genre_names: [],
            cast_ids: [],
            cast_names: []
        });

        // Reset TTL caches so each test starts fresh
        ragRetriever._embeddingCountCache = null;
        ragRetriever._embeddingCountCachedAt = 0;
        ragRetriever._hasMinimumCache = null;
        ragRetriever._hasMinimumCachedAt = 0;
    });

    it('does NOT call graphSearch when rag_graph_enabled is false', async () => {
        embeddingRouter.getConfig.mockResolvedValue({
            rag_fusion_method: 'rrf',
            rag_rrf_k: 60,
            rag_graph_enabled: false
        });
        jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([]);
        jest.spyOn(ragRetriever, 'fullTextSearch').mockResolvedValue({ matches: [], expansionTermCount: 0 });
        const graphSpy = jest.spyOn(ragRetriever, 'graphSearch');

        await ragRetriever.hybridSearch({ title: 'Test' });

        expect(graphSpy).not.toHaveBeenCalled();
    });

    it('uses 2-way calculateRRF (not calculateWeightedRRF) when graph disabled', async () => {
        embeddingRouter.getConfig.mockResolvedValue({
            rag_fusion_method: 'rrf',
            rag_rrf_k: 60,
            rag_graph_enabled: false
        });
        jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([
            { classificationId: 1, similarity: 0.9 }
        ]);
        jest.spyOn(ragRetriever, 'fullTextSearch').mockResolvedValue({
            matches: [{ classificationId: 2, textScore: 0.8 }],
            expansionTermCount: 0
        });

        const weightedRRFSpy = jest.spyOn(ragRetriever, 'calculateWeightedRRF');
        const rrfSpy         = jest.spyOn(ragRetriever, 'calculateRRF');

        await ragRetriever.hybridSearch({ title: 'Test' });

        expect(weightedRRFSpy).not.toHaveBeenCalled();
        expect(rrfSpy).toHaveBeenCalled();
    });

    it('calls graphSearch when rag_graph_enabled is true', async () => {
        embeddingRouter.getConfig.mockResolvedValue({
            rag_fusion_method: 'rrf',
            rag_rrf_k: 60,
            rag_graph_enabled: true,
            rag_graph_min_matches_to_apply: 1,
            rag_graph_weight: 0.20
        });
        jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([]);
        jest.spyOn(ragRetriever, 'fullTextSearch').mockResolvedValue({ matches: [], expansionTermCount: 0 });
        const graphSpy = jest.spyOn(ragRetriever, 'graphSearch').mockResolvedValue([]);

        await ragRetriever.hybridSearch({ title: 'Test' });

        expect(graphSpy).toHaveBeenCalled();
    });

    it('falls back to 2-way calculateRRF when graph returns fewer than min_matches_to_apply', async () => {
        embeddingRouter.getConfig.mockResolvedValue({
            rag_fusion_method: 'rrf',
            rag_rrf_k: 60,
            rag_graph_enabled: true,
            rag_graph_min_matches_to_apply: 3, // needs at least 3
            rag_graph_weight: 0.20
        });
        jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([
            { classificationId: 1, similarity: 0.9 }
        ]);
        jest.spyOn(ragRetriever, 'fullTextSearch').mockResolvedValue({
            matches: [{ classificationId: 2, textScore: 0.8 }],
            expansionTermCount: 0
        });
        jest.spyOn(ragRetriever, 'graphSearch').mockResolvedValue([
            { classificationId: 5, graphMatchScore: 8 } // only 1 — below threshold
        ]);

        const weightedSpy = jest.spyOn(ragRetriever, 'calculateWeightedRRF');
        const rrfSpy      = jest.spyOn(ragRetriever, 'calculateRRF');

        await ragRetriever.hybridSearch({ title: 'Test' });

        expect(weightedSpy).not.toHaveBeenCalled();
        expect(rrfSpy).toHaveBeenCalled();
    });

    it('uses 3-way calculateWeightedRRF when graph returns >= min_matches_to_apply', async () => {
        embeddingRouter.getConfig.mockResolvedValue({
            rag_fusion_method: 'rrf',
            rag_rrf_k: 60,
            rag_graph_enabled: true,
            rag_graph_min_matches_to_apply: 1,
            rag_graph_weight: 0.20
        });
        jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([
            { classificationId: 1, similarity: 0.9 }
        ]);
        jest.spyOn(ragRetriever, 'fullTextSearch').mockResolvedValue({
            matches: [{ classificationId: 2, textScore: 0.8 }],
            expansionTermCount: 0
        });
        jest.spyOn(ragRetriever, 'graphSearch').mockResolvedValue([
            { classificationId: 3, graphMatchScore: 8, similarity: null }
        ]);

        const weightedSpy = jest.spyOn(ragRetriever, 'calculateWeightedRRF');
        const rrfSpy      = jest.spyOn(ragRetriever, 'calculateRRF');

        const results = await ragRetriever.hybridSearch({ title: 'Test' });

        expect(rrfSpy).not.toHaveBeenCalled();
        expect(weightedSpy).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ weight: 1.0 }),  // semantic
                expect.objectContaining({ weight: 1.0 }),  // text
                expect.objectContaining({ weight: 0.20 })  // graph
            ]),
            60 // rrfK
        );
        expect(Array.isArray(results)).toBe(true);
    });

    it('produces no duplicate classificationIds in fused output', async () => {
        // id=1 appears in all 3 sources — should appear only once in results
        embeddingRouter.getConfig.mockResolvedValue({
            rag_fusion_method: 'rrf',
            rag_rrf_k: 60,
            rag_graph_enabled: true,
            rag_graph_min_matches_to_apply: 1,
            rag_graph_weight: 0.20
        });
        jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([
            { classificationId: 1, similarity: 0.9 },
            { classificationId: 2, similarity: 0.8 }
        ]);
        jest.spyOn(ragRetriever, 'fullTextSearch').mockResolvedValue({
            matches: [
                { classificationId: 1, textScore: 0.85 },
                { classificationId: 3, textScore: 0.7 }
            ],
            expansionTermCount: 0
        });
        jest.spyOn(ragRetriever, 'graphSearch').mockResolvedValue([
            { classificationId: 1, graphMatchScore: 8, similarity: null },
            { classificationId: 4, graphMatchScore: 4, similarity: null }
        ]);

        const results = await ragRetriever.hybridSearch({ title: 'Test' }, 10);

        const ids = results.map(r => r.classificationId);
        expect(new Set(ids).size).toBe(ids.length); // no duplicates
    });

    it('logs graphMatches.length and graphEnabled in ragLogger.logOperation', async () => {
        embeddingRouter.getConfig.mockResolvedValue({
            rag_fusion_method: 'rrf',
            rag_rrf_k: 60,
            rag_graph_enabled: true,
            rag_graph_min_matches_to_apply: 1,
            rag_graph_weight: 0.20
        });
        jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([]);
        jest.spyOn(ragRetriever, 'fullTextSearch').mockResolvedValue({ matches: [], expansionTermCount: 0 });
        jest.spyOn(ragRetriever, 'graphSearch').mockResolvedValue([
            { classificationId: 9, graphMatchScore: 4, similarity: null }
        ]);

        await ragRetriever.hybridSearch({ title: 'Test' });

        expect(ragLogger.logOperation).toHaveBeenCalledWith(
            'hybrid_search',
            expect.any(Number),
            true,
            expect.objectContaining({
                metadata: expect.objectContaining({
                    graphMatches: 1,
                    graphEnabled: true
                })
            })
        );
    });

    it('pre-286 output is reproduced exactly when rag_graph_enabled is false', async () => {
        // When graph is disabled, hybridSearch must fall through to calculateRRF.
        // Spy on calculateRRF to verify the call signature is identical to pre-286.
        embeddingRouter.getConfig.mockResolvedValue({
            rag_fusion_method: 'rrf',
            rag_rrf_k: 60,
            rag_graph_enabled: false
        });

        const semanticMatches = [
            { classificationId: 10, similarity: 0.95 },
            { classificationId: 11, similarity: 0.90 }
        ];
        const textMatches = [
            { classificationId: 11, textScore: 0.85 },
            { classificationId: 12, textScore: 0.80 }
        ];

        jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue(semanticMatches);
        jest.spyOn(ragRetriever, 'fullTextSearch').mockResolvedValue({ matches: textMatches, expansionTermCount: 0 });

        const rrfSpy = jest.spyOn(ragRetriever, 'calculateRRF');

        await ragRetriever.hybridSearch({ title: 'Test' });

        expect(rrfSpy).toHaveBeenCalledWith(semanticMatches, textMatches, 60);
    });
});
