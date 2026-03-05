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

const ragRetriever = require('../services/ragRetriever');
const embeddingService = require('../services/embeddingService');
const embeddingRouter = require('../services/embeddingRouter');
const imageEmbeddingProvider = require('../services/imageEmbeddingProvider');
const db = require('../config/database');
const ragLogger = require('../utils/ragLogger');

jest.mock('../services/embeddingService');
jest.mock('../services/embeddingRouter');
jest.mock('../services/imageEmbeddingProvider', () => ({
    embedImageFromUrl: jest.fn(),
    getConfig: jest.fn(),
    isConfigured: jest.fn()
}));
jest.mock('../config/database', () => {
    const mockPool = { connect: jest.fn() };
    return {
        query: jest.fn(),
        pool: mockPool,
        healthCheck: jest.fn(),
        withTransaction: jest.fn(),
        tryAdvisoryLock: jest.fn(),
        DB_ADVISORY_LOCKS: { IDLE_BACKFILL: 1001, SCHEDULED_BACKFILL: 1002, MANUAL_BACKFILL: 1003 }
    };
});
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));
jest.mock('../utils/ragLogger', () => ({
    logOperation: jest.fn().mockResolvedValue(undefined),
    logError: jest.fn().mockResolvedValue(undefined)
}));

describe('RAGRetriever', () => {
    let mockPoolClient;

    beforeEach(() => {
        jest.clearAllMocks();
        imageEmbeddingProvider.embedImageFromUrl.mockResolvedValue(null);
        imageEmbeddingProvider.getConfig.mockResolvedValue({ image_embedding_provider_mode: 'disabled' });
        imageEmbeddingProvider.isConfigured.mockReturnValue(false);
        embeddingService.formatForEmbedding.mockReturnValue('query');
        embeddingService.resolvePosterUrl.mockReturnValue(null);

        // Default pool client mock for semanticSearch (uses db.pool.connect internally)
        mockPoolClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn()
        };
        db.pool.connect.mockResolvedValue(mockPoolClient);

        // Reset embedding stats TTL cache so each test starts with a cold cache
        ragRetriever._embeddingCountCache = null;
        ragRetriever._embeddingCountCachedAt = 0;
        ragRetriever._hasMinimumCache = null;
        ragRetriever._hasMinimumCachedAt = 0;
    });

    afterEach(() => {
        // Restore any spies (e.g. jest.spyOn(ragRetriever, 'semanticSearch')) so they
        // don't bleed into subsequent tests.
        jest.restoreAllMocks();
    });

    describe('semanticSearch', () => {
        it('should return similar items when found', async () => {
            // Mock embedding generation
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            embeddingService.resolvePosterUrl.mockReturnValue('https://example.com/poster.jpg');
            imageEmbeddingProvider.embedImageFromUrl.mockResolvedValue({ embedding: [0.2, 0.3], dims: 2 });
            imageEmbeddingProvider.getConfig.mockResolvedValue({ image_embedding_provider_mode: 'local' });
            imageEmbeddingProvider.isConfigured.mockReturnValue(true);

            // Mock pool client: BEGIN resolves, SET LOCAL resolves, CTE returns rows, COMMIT resolves
            mockPoolClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({}) // SET LOCAL hnsw.ef_search
                .mockResolvedValueOnce({  // CTE query
                    rows: [
                        {
                            classification_id: 1,
                            combined_similarity: 0.93,
                            text_similarity: 0.95,
                            image_similarity: 0.92,
                            title: 'Test',
                            media_type: 'movie'
                        }
                    ]
                })
                .mockResolvedValueOnce({}); // COMMIT

            // Mock config enabled and threshold
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.getConfig.mockResolvedValue({ 
                rag_similarity_threshold: 0.7,
                rag_text_weight: 0.6,
                rag_image_weight: 0.4
            });

            const results = await ragRetriever.semanticSearch({ title: 'Query' });

            expect(results).toHaveLength(1);
            expect(results[0].similarity).toBe(0.93);
            expect(results[0].textSimilarity).toBe(0.95);
            expect(results[0].imageSimilarity).toBe(0.92);
            expect(results[0].textWeight).toBe(0.6);
            expect(results[0].imageWeight).toBe(0.4);
        });

        it('should return empty array if no embedding generated', async () => {
            // If embed fails or returns null (unlikely with throw), catch handles it
            embeddingRouter.embed.mockRejectedValue(new Error('Fail'));

            // Mocks needed for pre-checks
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);

            const results = await ragRetriever.semanticSearch({ title: '' });
            expect(results).toEqual([]);
        });

        it('should rethrow semantic errors when throwOnError is enabled', async () => {
            embeddingRouter.embed.mockRejectedValue(new Error('embed failed'));
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.7,
                rag_text_weight: 1,
                rag_image_weight: 0
            });

            await expect(
                ragRetriever.semanticSearch({ title: 'Query' }, 5, { throwOnError: true })
            ).rejects.toThrow('embed failed');
        });

        it('should skip image embedding when image mode is disabled', async () => {
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            // pool client returns empty rows (default mockPoolClient resolves to { rows: [] })
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.7,
                rag_text_weight: 0.7,
                rag_image_weight: 0.3
            });
            embeddingService.formatForEmbedding.mockReturnValue('query');
            embeddingService.resolvePosterUrl.mockReturnValue('https://example.com/poster.jpg');
            imageEmbeddingProvider.getConfig.mockResolvedValue({ image_embedding_provider_mode: 'disabled' });
            imageEmbeddingProvider.isConfigured.mockReturnValue(false);

            await ragRetriever.semanticSearch({ title: 'Query', poster_path: '/poster.jpg' });

            expect(imageEmbeddingProvider.embedImageFromUrl).not.toHaveBeenCalled();
        });

        it('should fall back to text-only when no poster is available', async () => {
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            mockPoolClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({}) // SET LOCAL hnsw.ef_search
                .mockResolvedValueOnce({  // CTE query
                    rows: [
                        {
                            classification_id: 1,
                            combined_similarity: 0.9,
                            text_similarity: 0.9,
                            image_similarity: null,
                            title: 'Test',
                            media_type: 'movie'
                        }
                    ]
                })
                .mockResolvedValueOnce({}); // COMMIT
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.7,
                rag_text_weight: 0.7,
                rag_image_weight: 0.3
            });
            embeddingService.formatForEmbedding.mockReturnValue('query');
            embeddingService.resolvePosterUrl.mockReturnValue(null);
            imageEmbeddingProvider.getConfig.mockResolvedValue({ image_embedding_provider_mode: 'separate_local' });
            imageEmbeddingProvider.isConfigured.mockReturnValue(true);

            const results = await ragRetriever.semanticSearch({ title: 'Query' });

            expect(results).toHaveLength(1);
            expect(results[0].similarity).toBe(0.9);
            expect(results[0].imageSimilarity).toBeNull();
            expect(imageEmbeddingProvider.embedImageFromUrl).not.toHaveBeenCalled();
        });

        it('should return unfiltered candidates when threshold filtering is disabled', async () => {
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            mockPoolClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({}) // SET LOCAL hnsw.ef_search
                .mockResolvedValueOnce({  // CTE query
                    rows: [
                        {
                            classification_id: 1,
                            combined_similarity: 0.42,
                            text_similarity: 0.42,
                            image_similarity: null,
                            title: 'Low Similarity Match',
                            media_type: 'movie'
                        }
                    ]
                })
                .mockResolvedValueOnce({}); // COMMIT
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.7,
                rag_text_weight: 1,
                rag_image_weight: 0
            });

            const candidates = await ragRetriever.semanticSearchCandidates({ title: 'Query' }, 25);

            expect(candidates).toHaveLength(1);
            expect(candidates[0].similarity).toBe(0.42);
        });

        it('should build expanded pass2 query text deterministically', async () => {
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            // pool client default returns { rows: [] } for all calls
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.7,
                rag_text_weight: 1,
                rag_image_weight: 0
            });
            embeddingService.formatForEmbedding.mockReturnValue('base text');

            await ragRetriever.semanticSearch({
                title: 'Original Title',
                original_title: 'Original Alt',
                original_language: 'ja',
                keywords: ['anime']
            }, 5, {
                pass: 'pass2',
                useExpandedQuery: true,
                applyThreshold: false,
                expansionOptions: {
                    aliasEnabled: true,
                    aliasMaxTerms: 2,
                    aliasMinTokenLength: 2
                }
            });

            expect(embeddingRouter.embed).toHaveBeenCalledTimes(1);
            const queryText = embeddingRouter.embed.mock.calls[0][0];
            expect(queryText).toContain('Aliases:');
            expect(queryText).toContain('Evidence Keywords:');
        });
    });

    describe('calculateDynamicWeight', () => {
        it('should return high weight for strong matches', () => {
            const matches = [
                { similarity: 0.95, label_data: { type: 'movie' }, libraryId: 1 },
                { similarity: 0.92, label_data: { type: 'movie' }, libraryId: 1 }
            ];
            // Assuming default logic: base 50 + bonus
            const weight = ragRetriever.calculateDynamicWeight(matches);
            expect(weight).toBeGreaterThanOrEqual(80);
        });

        it('should return low weight for weak matches', () => {
            const matches = [
                { similarity: 0.60, label_data: { type: 'movie' } }
            ];
            const weight = ragRetriever.calculateDynamicWeight(matches);
            expect(weight).toBeLessThan(60);
        });

        it('should return 0 for empty matches', () => {
            const weight = ragRetriever.calculateDynamicWeight([]);
            expect(weight).toBe(0);
        });
    });

    describe('getSuggestedLibrary', () => {
        it('should return library with most votes', () => {
            const matches = [
                { similarity: 0.95, libraryId: 1, libraryName: 'Movies' },
                { similarity: 0.90, libraryId: 1, libraryName: 'Movies' },
                { similarity: 0.85, libraryId: 2, libraryName: 'TV Shows' }
            ];

            const result = ragRetriever.getSuggestedLibrary(matches);

            expect(result.libraryId).toBe(1);
            expect(result.libraryName).toBe('Movies');
            expect(result.voteCount).toBe(2);
        });

        it('should return null for empty matches', () => {
            const result = ragRetriever.getSuggestedLibrary([]);
            expect(result).toBeNull();
        });
    });

    describe('formatForAIContext', () => {
        it('should format matches for AI prompt', () => {
            const matches = [
                { title: 'Movie A', libraryName: 'Movies', similarity: 0.95, libraryId: 1 },
                { title: 'Movie B', libraryName: 'Movies', similarity: 0.90, libraryId: 1 }
            ];

            const result = ragRetriever.formatForAIContext(matches);

            expect(result).toContain('Similar past classifications');
            expect(result).toContain('Movie A');
            expect(result).toContain('Movies');
            expect(result).toContain('95%');
        });

        it('should include image similarity when available', () => {
            const matches = [
                {
                    title: 'Movie A',
                    libraryName: 'Movies',
                    similarity: 0.9,
                    textSimilarity: 0.88,
                    imageSimilarity: 0.92,
                    libraryId: 1
                }
            ];

            const result = ragRetriever.formatForAIContext(matches);

            expect(result).toContain('combined');
            expect(result).toContain('text 88%');
            expect(result).toContain('image 92%');
        });

        it('should return empty string for no matches', () => {
            const result = ragRetriever.formatForAIContext([]);
            expect(result).toBe('');
        });
    });

    describe('fullTextSearch', () => {
        it('should search by title and library name', async () => {
            db.query.mockResolvedValue({
                rows: [
                    { classification_id: 1, title: 'Test', text_score: 0.8 }
                ]
            });

            const results = await ragRetriever.fullTextSearch({
                title: 'Test Movie',
                library_name: 'Movies'
            });

            expect(results.matches).toHaveLength(1);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('plainto_tsquery'),
                expect.any(Array)
            );
        });

        it('should return empty for no search terms', async () => {
            const results = await ragRetriever.fullTextSearch({});
            expect(results.matches).toEqual([]);
        });
    });

    describe('hybridSearch', () => {
        it('should rethrow errors when throwOnError is enabled', async () => {
            embeddingRouter.getConfig.mockRejectedValue(new Error('config failure'));

            await expect(
                ragRetriever.hybridSearch({ title: 'Query' }, 5, { throwOnError: true })
            ).rejects.toThrow('config failure');
        });
    });

    describe('hybridSearch', () => {
        it('should combine semantic and text search results with RRF', async () => {
            // Mock embeddingRouter for config
            embeddingRouter.getConfig.mockResolvedValue({ 
                rag_fusion_method: 'rrf',
                rag_rrf_k: 60
            });
            
            // Mock semanticSearch
            jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([
                { classificationId: 1, similarity: 0.9, libraryId: 1 }
            ]);
            // Mock fullTextSearch
            jest.spyOn(ragRetriever, 'fullTextSearch').mockResolvedValue({
                matches: [{ classificationId: 2, textScore: 0.8, libraryId: 2 }],
                expansionTermCount: 0
            });

            const results = await ragRetriever.hybridSearch({ title: 'Test' });

            expect(results.length).toBeGreaterThan(0);
            // With RRF, results should have rrfScore
            expect(results[0]).toHaveProperty('rrfScore');
        });
    });

    describe('AbortSignal support', () => {
        beforeEach(() => {
            jest.restoreAllMocks();
            jest.clearAllMocks();
            db.query.mockResolvedValue({ rows: [] });
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.7,
                rag_text_weight: 1,
                rag_image_weight: 0
            });
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            embeddingService.formatForEmbedding.mockReturnValue('query');
            embeddingService.resolvePosterUrl.mockReturnValue(null);
            imageEmbeddingProvider.getConfig.mockResolvedValue({ image_embedding_provider_mode: 'disabled' });
            imageEmbeddingProvider.isConfigured.mockReturnValue(false);
            imageEmbeddingProvider.embedImageFromUrl.mockResolvedValue(null);
        });

        it('should throw AbortError when signal is already aborted', async () => {
            const controller = new AbortController();
            controller.abort();

            await expect(
                ragRetriever.semanticSearch({ title: 'Test' }, 5, { signal: controller.signal })
            ).rejects.toThrow('aborted');
        });

        it('should throw AbortError from hybridSearch when signal aborted', async () => {
            const controller = new AbortController();
            controller.abort();

            await expect(
                ragRetriever.hybridSearch({ title: 'Test' }, 5, { signal: controller.signal })
            ).rejects.toThrow('aborted');
        });

        it('should throw AbortError from fullTextSearch when signal aborted', async () => {
            const controller = new AbortController();
            controller.abort();

            await expect(
                ragRetriever.fullTextSearch({ title: 'Test', library_name: 'Movies' }, 5, { signal: controller.signal })
            ).rejects.toThrow('aborted');
        });

        it('should propagate AbortError through hybridSearch', async () => {
            const controller = new AbortController();
            
            embeddingRouter.getConfig.mockImplementation(async () => {
                controller.abort();
                return { rag_fusion_method: 'rrf' };
            });

            jest.spyOn(ragRetriever, 'semanticSearch').mockImplementation(async (metadata, limit, options) => {
                if (options.signal?.aborted) {
                    const err = new Error('semantic search aborted');
                    err.name = 'AbortError';
                    throw err;
                }
                return [];
            });

            await expect(
                ragRetriever.hybridSearch({ title: 'Test' }, 5, { signal: controller.signal })
            ).rejects.toThrow('aborted');
        });
    });

    describe('fullTextSearch with expanded query', () => {
        it('should use only title and library_name when useExpandedQuery is false (pass-1 regression)', async () => {
            db.query.mockResolvedValue({ rows: [] });

            await ragRetriever.fullTextSearch(
                {
                    title: 'My Movie',
                    library_name: 'Movies',
                    rag_query_overrides: {
                        alias_terms: ['Alias One'],
                        evidence_tokens: { genres: ['Action'], keywords: ['hero'], cast: ['Actor A'] }
                    }
                },
                5,
                { useExpandedQuery: false }
            );

            const [queryStr, params] = db.query.mock.calls[0];
            expect(queryStr).toContain('plainto_tsquery');
            expect(queryStr).not.toContain('websearch_to_tsquery');
            expect(params[0]).toBe('My Movie Movies');
        });

        it('should append alias_terms, genres, and keywords (not cast) with OR semantics when useExpandedQuery is true', async () => {
            db.query.mockResolvedValue({ rows: [] });

            await ragRetriever.fullTextSearch(
                {
                    title: 'My Movie',
                    library_name: 'Movies',
                    rag_query_overrides: {
                        alias_terms: ['My Film'],
                        evidence_tokens: {
                            genres: ['Action', 'Thriller'],
                            keywords: ['hero', 'spy'],
                            cast: ['Actor A']
                        }
                    }
                },
                5,
                { useExpandedQuery: true }
            );

            const [queryStr, params] = db.query.mock.calls[0];
            expect(queryStr).toContain('websearch_to_tsquery');
            const searchString = params[0];
            expect(searchString).toContain('My Movie');
            expect(searchString).toContain('Movies');
            expect(searchString).toContain('My Film');
            expect(searchString).toContain('Action');
            expect(searchString).toContain('Thriller');
            expect(searchString).toContain('hero');
            expect(searchString).toContain('spy');
            // Cast is not indexed in search_text tsvector; must not appear in FTS query
            expect(searchString).not.toContain('Actor A');
            // Expansion terms must be OR-separated (not AND/space-joined)
            expect(searchString).toContain(' OR ');
        });

        it('should fall back to plainto_tsquery when useExpandedQuery is true but no rag_query_overrides', async () => {
            db.query.mockResolvedValue({ rows: [] });

            await ragRetriever.fullTextSearch(
                { title: 'My Movie', library_name: 'Movies' },
                5,
                { useExpandedQuery: true }
            );

            const [queryStr] = db.query.mock.calls[0];
            expect(queryStr).toContain('plainto_tsquery');
            expect(queryStr).not.toContain('websearch_to_tsquery');
        });
    });

    describe('hybridSearch passes useExpandedQuery to fullTextSearch', () => {
        beforeEach(() => {
            jest.restoreAllMocks();
            jest.clearAllMocks();
            ragLogger.logOperation.mockResolvedValue(undefined);
            ragLogger.logError.mockResolvedValue(undefined);
        });

        it('should pass useExpandedQuery through to fullTextSearch', async () => {
            embeddingRouter.getConfig.mockResolvedValue({ rag_fusion_method: 'rrf', rag_rrf_k: 60 });
            jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([]);
            const ftsSpy = jest.spyOn(ragRetriever, 'fullTextSearch').mockResolvedValue({ matches: [], expansionTermCount: 0 });

            await ragRetriever.hybridSearch({ title: 'Test' }, 5, { useExpandedQuery: true });

            expect(ftsSpy).toHaveBeenCalledWith(
                expect.anything(),
                expect.any(Number),
                expect.objectContaining({ useExpandedQuery: true })
            );
        });

        it('should log expandedQuery:true and expansionTermCount when useExpandedQuery is set', async () => {
            embeddingRouter.getConfig.mockResolvedValue({ rag_fusion_method: 'rrf', rag_rrf_k: 60 });
            jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([]);
            jest.spyOn(ragRetriever, 'fullTextSearch').mockImplementation(async () => {
                return { matches: [], expansionTermCount: 4 };
            });

            await ragRetriever.hybridSearch({ title: 'Test' }, 5, { useExpandedQuery: true });

            expect(ragLogger.logOperation).toHaveBeenCalledWith(
                'hybrid_search',
                expect.any(Number),
                true,
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        expandedQuery: true,
                        expansionTermCount: 4
                    })
                })
            );
        });

        it('should log expandedQuery:false and expansionTermCount:0 when useExpandedQuery is not set', async () => {
            embeddingRouter.getConfig.mockResolvedValue({ rag_fusion_method: 'rrf', rag_rrf_k: 60 });
            jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([]);
            jest.spyOn(ragRetriever, 'fullTextSearch').mockResolvedValue({ matches: [], expansionTermCount: 0 });

            await ragRetriever.hybridSearch({ title: 'Test' }, 5, {});

            expect(ragLogger.logOperation).toHaveBeenCalledWith(
                'hybrid_search',
                expect.any(Number),
                true,
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        expandedQuery: false,
                        expansionTermCount: 0
                    })
                })
            );
        });

        it('should derive expansionTermCount from real fullTextSearch expansion and log it via hybridSearch', async () => {
            // Uses the real fullTextSearch implementation (only db.query is mocked) to verify
            // that the expansion parsing → term counting → ragLogger.logOperation wiring is correct.
            embeddingRouter.getConfig.mockResolvedValue({ rag_fusion_method: 'rrf', rag_rrf_k: 60 });
            jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([]);
            db.query.mockResolvedValue({ rows: [] });

            const metadataWithOverrides = {
                title: 'Test Movie',
                library_name: 'Movies',
                rag_query_overrides: {
                    alias_terms: ['Alias One'],
                    evidence_tokens: {
                        genres: ['Action', 'Thriller'],
                        keywords: ['spy'],
                        cast: ['Actor A']  // cast must NOT be counted; it is not indexed
                    }
                }
            };

            await ragRetriever.hybridSearch(metadataWithOverrides, 5, { useExpandedQuery: true });

            // alias_terms(1) + genres(2) + keywords(1) = 4 terms; cast excluded
            expect(ragLogger.logOperation).toHaveBeenCalledWith(
                'hybrid_search',
                expect.any(Number),
                true,
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        expandedQuery: true,
                        expansionTermCount: 4
                    })
                })
            );
        });
    });

    describe('HNSW ef_search tuning', () => {
        it('semanticSearch issues SET LOCAL hnsw.ef_search before vector query', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.7,
                rag_text_weight: 1,
                rag_image_weight: 0
            });

            await ragRetriever.semanticSearch({ title: 'Query' });

            // Find the SET LOCAL call in pool client query calls
            const queries = mockPoolClient.query.mock.calls.map(call => call[0]);
            const setLocalIdx = queries.findIndex(q => typeof q === 'string' && q.includes('SET LOCAL hnsw.ef_search'));
            const cteIdx = queries.findIndex(q => typeof q === 'string' && q.includes('WITH candidates AS'));
            expect(setLocalIdx).toBeGreaterThanOrEqual(0);
            expect(cteIdx).toBeGreaterThanOrEqual(0);
            expect(setLocalIdx).toBeLessThan(cteIdx);
        });

        it('ef_search value defaults to 80 when PGVECTOR_EF_SEARCH is unset', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.7,
                rag_text_weight: 1,
                rag_image_weight: 0
            });

            await ragRetriever.semanticSearch({ title: 'Query' });

            const setLocalCall = mockPoolClient.query.mock.calls.find(
                call => typeof call[0] === 'string' && call[0].includes('SET LOCAL hnsw.ef_search')
            );
            expect(setLocalCall).toBeDefined();
            // EF_SEARCH is evaluated at module load time; env var should not be set in test env
            const efSearchValue = parseInt(process.env.PGVECTOR_EF_SEARCH) || 80;
            expect(setLocalCall[0]).toContain(`SET LOCAL hnsw.ef_search = ${efSearchValue}`);
        });

        it('client is released even when vector query throws', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.7,
                rag_text_weight: 1,
                rag_image_weight: 0
            });

            // Make the CTE query throw
            mockPoolClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({}) // SET LOCAL
                .mockRejectedValueOnce(new Error('vector query failed')); // CTE

            const result = await ragRetriever.semanticSearch({ title: 'Query' });

            // Should return [] (error is caught), and client should be released
            expect(result).toEqual([]);
            expect(mockPoolClient.release).toHaveBeenCalled();
        });

        it('semanticSearchCandidates uses lower ef_search (EF_SEARCH_CANDIDATES) by default', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.7,
                rag_text_weight: 1,
                rag_image_weight: 0
            });

            await ragRetriever.semanticSearchCandidates({ title: 'Query' });

            const setLocalCall = mockPoolClient.query.mock.calls.find(
                call => typeof call[0] === 'string' && call[0].includes('SET LOCAL hnsw.ef_search')
            );
            expect(setLocalCall).toBeDefined();
            // EF_SEARCH_CANDIDATES defaults to 40 (PGVECTOR_EF_SEARCH_CANDIDATES env var)
            const efSearchCandidatesValue = parseInt(process.env.PGVECTOR_EF_SEARCH_CANDIDATES) || 40;
            expect(setLocalCall[0]).toContain(`SET LOCAL hnsw.ef_search = ${efSearchCandidatesValue}`);
        });

        it('semanticSearch respects per-call efSearch option override', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.7,
                rag_text_weight: 1,
                rag_image_weight: 0
            });

            await ragRetriever.semanticSearch({ title: 'Query' }, 5, { efSearch: 120 });

            const setLocalCall = mockPoolClient.query.mock.calls.find(
                call => typeof call[0] === 'string' && call[0].includes('SET LOCAL hnsw.ef_search')
            );
            expect(setLocalCall).toBeDefined();
            expect(setLocalCall[0]).toContain('SET LOCAL hnsw.ef_search = 120');
        });
    });

    describe('Embedding stats TTL cache', () => {
        it('getEmbeddingCount() returns cached value on second call without hitting DB', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ count: '42' }] });

            const first = await ragRetriever.getEmbeddingCount();
            const second = await ragRetriever.getEmbeddingCount();

            expect(first).toBe(42);
            expect(second).toBe(42);
            expect(db.query).toHaveBeenCalledTimes(1);
        });

        it('getEmbeddingCount() re-queries DB after TTL expires', async () => {
            // Seed an expired cache entry
            ragRetriever._embeddingCountCache = 99;
            ragRetriever._embeddingCountCachedAt = Date.now() - 31_000;

            db.query.mockResolvedValueOnce({ rows: [{ count: '55' }] });

            const result = await ragRetriever.getEmbeddingCount();

            expect(result).toBe(55);
            expect(db.query).toHaveBeenCalledTimes(1);
        });

        it('_getHasMinimumCached() calls hasMinimumEmbeddings only once per TTL window', async () => {
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);

            await ragRetriever._getHasMinimumCached();
            await ragRetriever._getHasMinimumCached();

            expect(embeddingService.hasMinimumEmbeddings).toHaveBeenCalledTimes(1);
        });

        it('_getHasMinimumCached() re-calls hasMinimumEmbeddings after TTL expires', async () => {
            // Seed an expired cache entry
            ragRetriever._hasMinimumCache = false;
            ragRetriever._hasMinimumCachedAt = Date.now() - 31_000;

            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);

            const result = await ragRetriever._getHasMinimumCached();

            expect(result).toBe(true);
            expect(embeddingService.hasMinimumEmbeddings).toHaveBeenCalledTimes(1);
        });
    });
});
