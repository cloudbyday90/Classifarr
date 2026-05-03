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

let ragRetriever;
const db = require('../config/database');
const ragLogger = require('../utils/ragLogger');

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

const embeddingService = mockEmbeddingService;
const embeddingRouter = mockEmbeddingRouter;
const imageEmbeddingProvider = mockImageEmbeddingProvider;

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
jest.mock('../services/embeddingService', () => mockEmbeddingService);
jest.mock('../services/embeddingRouter', () => mockEmbeddingRouter);
jest.mock('../services/imageEmbeddingProvider', () => mockImageEmbeddingProvider);

jest.unstable_mockModule('../config/database.js', () => ({
    default: require('../config/database')
}));

jest.unstable_mockModule('../config/database.mjs', () => ({
    default: require('../config/database')
}));

jest.unstable_mockModule('../services/embeddingService.mjs', () => ({
    default: mockEmbeddingService
}));

jest.unstable_mockModule('../services/embeddingRouter.mjs', () => ({
    default: mockEmbeddingRouter
}));

jest.unstable_mockModule('../services/imageEmbeddingProvider.mjs', () => ({
    default: mockImageEmbeddingProvider
}));

jest.unstable_mockModule('../utils/logger.js', () => ({
    default: require('../utils/logger')
}));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
    default: require('../utils/logger')
}));

jest.unstable_mockModule('../utils/ragLogger.mjs', () => ({
    default: require('../utils/ragLogger')
}));

jest.unstable_mockModule('../utils/ragLoopHelpers.mjs', () => ({
    default: require('../utils/ragLoopHelpers')
}));

jest.unstable_mockModule('../services/ragGraphExtractor.mjs', () => ({
    default: require('../services/ragGraphExtractor')
}));

beforeAll(async () => {
    ({ default: ragRetriever } = await import('../services/ragRetriever.mjs'));
});

describe('RAGRetriever', () => {
    let mockPoolClient;

    beforeEach(() => {
        jest.clearAllMocks();
        imageEmbeddingProvider.embedImageFromUrl.mockReset();
        imageEmbeddingProvider.getConfig.mockReset();
        imageEmbeddingProvider.isConfigured.mockReset();
        embeddingService.formatForEmbedding.mockReset();
        embeddingService.resolvePosterUrl.mockReset();
        db.pool.connect.mockReset();
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

        // Exact threshold boundary tests — all conditions use strict >  inequalities
        it('returns 90 only when topMatch is strictly above 0.90 (3+ unanimous)', () => {
            const atBoundary = [
                { similarity: 0.90, libraryId: 1 },
                { similarity: 0.90, libraryId: 1 },
                { similarity: 0.90, libraryId: 1 }
            ];
            // 0.90 is NOT > 0.90 → falls through to >=2 unanimous && > 0.80 check → returns 80
            expect(ragRetriever.calculateDynamicWeight(atBoundary)).toBe(80);

            const aboveBoundary = [
                { similarity: 0.91, libraryId: 1 },
                { similarity: 0.91, libraryId: 1 },
                { similarity: 0.91, libraryId: 1 }
            ];
            expect(ragRetriever.calculateDynamicWeight(aboveBoundary)).toBe(90);
        });

        it('returns 80 only when topMatch is strictly above 0.80 (2+ unanimous)', () => {
            const atBoundary = [
                { similarity: 0.80, libraryId: 1 },
                { similarity: 0.80, libraryId: 1 }
            ];
            // 0.80 is NOT > 0.80 → falls to >=1 && > 0.70 check → returns 70
            expect(ragRetriever.calculateDynamicWeight(atBoundary)).toBe(70);

            const aboveBoundary = [
                { similarity: 0.81, libraryId: 1 },
                { similarity: 0.81, libraryId: 1 }
            ];
            expect(ragRetriever.calculateDynamicWeight(aboveBoundary)).toBe(80);
        });

        it('returns 70 only when topMatch is strictly above 0.70', () => {
            const atBoundary = [{ similarity: 0.70, libraryId: 1 }];
            // 0.70 is NOT > 0.70 → falls to > 0.60 check → returns 60
            expect(ragRetriever.calculateDynamicWeight(atBoundary)).toBe(60);

            const aboveBoundary = [{ similarity: 0.71, libraryId: 1 }];
            expect(ragRetriever.calculateDynamicWeight(aboveBoundary)).toBe(70);
        });

        it('returns 60 only when topMatch is strictly above 0.60', () => {
            const atBoundary = [{ similarity: 0.60, libraryId: 1 }];
            // 0.60 is NOT > 0.60 → returns 50
            expect(ragRetriever.calculateDynamicWeight(atBoundary)).toBe(50);

            const aboveBoundary = [{ similarity: 0.61, libraryId: 1 }];
            expect(ragRetriever.calculateDynamicWeight(aboveBoundary)).toBe(60);
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

        it('rounds percentages correctly (Math.round, not Math.floor)', () => {
            // 0.937 → Math.round(93.7) = 94, not 93
            // 0.934 → Math.round(93.4) = 93
            const matches = [
                { title: 'Film', libraryName: 'Movies', similarity: 0.937, libraryId: 1 },
                { title: 'Show', libraryName: 'TV',     similarity: 0.934, libraryId: 2 }
            ];
            const result = ragRetriever.formatForAIContext(matches);
            expect(result).toContain('94% similar');
            expect(result).toContain('93% similar');
        });

        it('rounds image and text percentages with Math.round (not Math.floor)', () => {
            // textSimilarity=0.885 → Math.round(88.5) = 89; imageSimilarity=0.934 → 93
            const matches = [
                {
                    title: 'Film',
                    libraryName: 'Movies',
                    similarity: 0.91,
                    textSimilarity: 0.885,
                    imageSimilarity: 0.934,
                    libraryId: 1
                }
            ];
            const result = ragRetriever.formatForAIContext(matches);
            expect(result).toContain('text 89%');
            expect(result).toContain('image 93%');
        });

        it('caps output at 3 matches regardless of input size', () => {
            const matches = Array.from({ length: 5 }, (_, i) => ({
                title: `Movie ${i + 1}`,
                libraryName: 'Movies',
                similarity: 0.9 - i * 0.01,
                libraryId: 1
            }));
            const result = ragRetriever.formatForAIContext(matches);
            expect(result).toContain('Movie 1');
            expect(result).toContain('Movie 3');
            expect(result).not.toContain('Movie 4');
            expect(result).not.toContain('Movie 5');
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
            db.query.mockReset();
            embeddingRouter.isEnabled.mockReset();
            embeddingService.hasMinimumEmbeddings.mockReset();
            embeddingRouter.getConfig.mockReset();
            embeddingRouter.embed.mockReset();
            embeddingService.formatForEmbedding.mockReset();
            embeddingService.resolvePosterUrl.mockReset();
            imageEmbeddingProvider.getConfig.mockReset();
            imageEmbeddingProvider.isConfigured.mockReset();
            imageEmbeddingProvider.embedImageFromUrl.mockReset();
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
            ragLogger.logOperation.mockReset();
            ragLogger.logError.mockReset();
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
            const efSearchValue = parseInt(process.env.PGVECTOR_EF_SEARCH) || 80;
            expect(setLocalCall[0]).toBe('SET LOCAL hnsw.ef_search = $1');
            expect(setLocalCall[1]).toEqual([efSearchValue]);
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
            const efSearchCandidatesValue = parseInt(process.env.PGVECTOR_EF_SEARCH_CANDIDATES) || 40;
            expect(setLocalCall[0]).toBe('SET LOCAL hnsw.ef_search = $1');
            expect(setLocalCall[1]).toEqual([efSearchCandidatesValue]);
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
            expect(setLocalCall[0]).toBe('SET LOCAL hnsw.ef_search = $1');
            expect(setLocalCall[1]).toEqual([120]);
        });
    });

    describe('buildRetrievalText — evidence_tokens branches', () => {
        it('appends Evidence Genres when evidence_tokens.genres is non-empty', () => {
            embeddingService.formatForEmbedding.mockReturnValue('base text');
            const metadata = {
                title: 'Test Movie',
                genres: ['Action', 'Thriller']
            };
            const result = ragRetriever.buildRetrievalText(metadata, { useExpandedQuery: true });
            expect(result).toContain('Evidence Genres:');
            expect(result).toContain('action');
        });

        it('appends Evidence Studios when evidence_tokens.studios is non-empty', () => {
            embeddingService.formatForEmbedding.mockReturnValue('base text');
            const metadata = {
                title: 'Test Movie',
                production_companies: ['Warner Bros']
            };
            const result = ragRetriever.buildRetrievalText(metadata, { useExpandedQuery: true });
            expect(result).toContain('Evidence Studios:');
            expect(result).toContain('warner bros');
        });

        it('appends Evidence Cast when evidence_tokens.cast is non-empty', () => {
            embeddingService.formatForEmbedding.mockReturnValue('base text');
            const metadata = {
                title: 'Test Movie',
                cast: ['Tom Hanks', 'Meryl Streep']
            };
            const result = ragRetriever.buildRetrievalText(metadata, { useExpandedQuery: true });
            expect(result).toContain('Evidence Cast:');
            expect(result).toContain('tom hanks');
        });

        it('appends Evidence Collection when evidence_tokens.collection is set', () => {
            embeddingService.formatForEmbedding.mockReturnValue('base text');
            const metadata = {
                title: 'Test Movie',
                belongs_to_collection: 'Marvel Cinematic Universe'
            };
            const result = ragRetriever.buildRetrievalText(metadata, { useExpandedQuery: true });
            expect(result).toContain('Evidence Collection:');
            expect(result).toContain('marvel cinematic universe');
        });

        it('returns baseText unchanged when useExpandedQuery=true but no extra terms or aliases', () => {
            embeddingService.formatForEmbedding.mockReturnValue('base text');
            // No title aliases (aliasEnabled: false) and no evidence → extraTerms stays empty
            const result = ragRetriever.buildRetrievalText(
                { title: 'X' },
                { useExpandedQuery: true, aliasEnabled: false }
            );
            expect(result).toBe('base text');
        });
    });

    describe('semanticSearch — skip/early-return branches', () => {
        it('returns [] and logs when RAG is disabled (isEnabled=false)', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(false);

            const result = await ragRetriever.semanticSearch({ title: 'Query' });

            expect(result).toEqual([]);
            expect(embeddingRouter.embed).not.toHaveBeenCalled();
        });

        it('returns [] when not enough embeddings (hasMinimum=false)', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(false);
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.7,
                rag_text_weight: 1,
                rag_image_weight: 0
            });

            const result = await ragRetriever.semanticSearch({ title: 'Query' });

            expect(result).toEqual([]);
            expect(embeddingRouter.embed).not.toHaveBeenCalled();
        });

        it('normalizes to text-only when both configured weights sum to zero', async () => {
            // rag_text_weight=0 + image disabled → weightSum===0 → else branch → textWeight=1
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.7,
                rag_text_weight: 0,
                rag_image_weight: 0
            });
            // image is disabled (default beforeEach), so imageWeight stays 0
            // weightSum = 0 → else branch executes (textWeight=1, imageWeight=0)

            const result = await ragRetriever.semanticSearch({ title: 'Query' });

            // Should complete without error and return [] (pool returns empty rows)
            expect(result).toEqual([]);
        });

        it('normalizes image+text weights so they sum to 1 when config provides unbalanced values', async () => {
            // config: textWeight=0.3, imageWeight=0.9 → sum=1.2 → normalized: text=0.25, image=0.75
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.1,
                rag_text_weight: 0.3,
                rag_image_weight: 0.9
            });
            // Enable image embedding so imageWeight is NOT zeroed out
            imageEmbeddingProvider.getConfig.mockResolvedValue({ image_embedding_provider_mode: 'clip' });
            imageEmbeddingProvider.isConfigured.mockReturnValue(true);
            imageEmbeddingProvider.embedImageFromUrl.mockResolvedValue({ embedding: [0.5, 0.6] });
            embeddingService.resolvePosterUrl.mockReturnValue('https://example.com/poster.jpg');

            mockPoolClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({}) // SET LOCAL hnsw.ef_search
                .mockResolvedValueOnce({
                    rows: [{
                        classification_id: 1,
                        combined_similarity: 0.88,
                        text_similarity: 0.85,
                        image_similarity: 0.92,
                        title: 'Test',
                        media_type: 'movie',
                        created_at: new Date()
                    }]
                })
                .mockResolvedValueOnce({}); // COMMIT

            const results = await ragRetriever.semanticSearch({ title: 'Query' });

            // 0.3 + 0.9 = 1.2 → textWeight = 0.3/1.2 = 0.25, imageWeight = 0.9/1.2 = 0.75
            // normalizedTextWeight = Math.round(0.25 * 100) / 100 = 0.25
            // normalizedImageWeight = Math.round(0.75 * 100) / 100 = 0.75
            expect(results).toHaveLength(1);
            expect(results[0].textWeight).toBe(0.25);
            expect(results[0].imageWeight).toBe(0.75);
        });

        it('rounds similarity values to 2 decimal places in result mapping', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.1,
                rag_text_weight: 1,
                rag_image_weight: 0
            });

            mockPoolClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({}) // SET LOCAL
                .mockResolvedValueOnce({
                    rows: [{
                        classification_id: 1,
                        combined_similarity: 0.87654,  // rounds to 0.88
                        text_similarity: 0.91234,      // rounds to 0.91
                        image_similarity: null,
                        title: 'Test',
                        media_type: 'movie',
                        created_at: new Date()
                    }]
                })
                .mockResolvedValueOnce({});

            const results = await ragRetriever.semanticSearch({ title: 'Query' });

            expect(results[0].similarity).toBe(0.88);       // Math.round(0.87654 * 100) / 100
            expect(results[0].textSimilarity).toBe(0.91);   // Math.round(0.91234 * 100) / 100
            expect(results[0].imageSimilarity).toBeNull();  // null passthrough
        });

        it('returns [] and logs "below threshold" when applyThreshold=true and all results are sub-threshold', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.9, // high threshold
                rag_text_weight: 1,
                rag_image_weight: 0
            });

            // CTE returns rows but combined_similarity < threshold → matches filtered to []
            mockPoolClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({}) // SET LOCAL hnsw.ef_search
                .mockResolvedValueOnce({
                    rows: [
                        {
                            classification_id: 1,
                            combined_similarity: 0.65, // below 0.9 threshold
                            text_similarity: 0.65,
                            image_similarity: null,
                            title: 'Low Similarity',
                            media_type: 'movie',
                            created_at: new Date()
                        }
                    ]
                })
                .mockResolvedValueOnce({}); // COMMIT

            const result = await ragRetriever.semanticSearch({ title: 'Query' });

            expect(result).toEqual([]);
        });

        it('continues (swallows) image embedding error and uses text-only vector', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            embeddingRouter.getConfig.mockResolvedValue({
                rag_similarity_threshold: 0.7,
                rag_text_weight: 0.7,
                rag_image_weight: 0.3
            });
            // Enable image embedding so the posterUrl path is entered
            embeddingService.resolvePosterUrl.mockReturnValue('https://example.com/poster.jpg');
            imageEmbeddingProvider.getConfig.mockResolvedValue({ image_embedding_provider_mode: 'clip' });
            imageEmbeddingProvider.isConfigured.mockReturnValue(true);
            // Make the image embedding throw — should be caught and logged as debug
            imageEmbeddingProvider.embedImageFromUrl.mockRejectedValue(new Error('image service unavailable'));

            const result = await ragRetriever.semanticSearch({ title: 'Query' });

            // Should not propagate — returns [] (empty pool rows)
            expect(result).toEqual([]);
            expect(imageEmbeddingProvider.embedImageFromUrl).toHaveBeenCalled();
        });
    });

    describe('hybridSearch — legacy mode and error handling', () => {
        beforeEach(() => {
            jest.restoreAllMocks();
            jest.clearAllMocks();
            ragLogger.logOperation.mockReset();
            ragLogger.logError.mockReset();
            ragLogger.logOperation.mockResolvedValue(undefined);
            ragLogger.logError.mockResolvedValue(undefined);
        });

        it('uses legacyHybridCombine when fusionMethod is not "rrf"', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                rag_fusion_method: 'weighted',
                rag_rrf_k: 60,
                rag_graph_enabled: false
            });
            jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([
                { classificationId: 1, similarity: 0.9 }
            ]);
            jest.spyOn(ragRetriever, 'fullTextSearch').mockResolvedValue({
                matches: [{ classificationId: 1, textScore: 0.7 }],
                expansionTermCount: 0
            });
            const legacySpy = jest.spyOn(ragRetriever, 'legacyHybridCombine');

            const results = await ragRetriever.hybridSearch({ title: 'Test' }, 5);

            expect(legacySpy).toHaveBeenCalled();
            expect(Array.isArray(results)).toBe(true);
        });

        it('returns [] on general error without re-throwing (throwOnError not set)', async () => {
            embeddingRouter.getConfig.mockRejectedValue(new Error('config fetch failed'));

            const result = await ragRetriever.hybridSearch({ title: 'Test' });

            expect(result).toEqual([]);
        });
    });

    describe('fullTextSearch — error handling', () => {
        it('returns empty matches when DB throws', async () => {
            db.query.mockRejectedValue(new Error('DB unavailable'));

            const result = await ragRetriever.fullTextSearch({ title: 'Test' }, 5, {});

            expect(result).toEqual({ matches: [], expansionTermCount: 0 });
        });
    });

    describe('calculateDynamicWeight — return value branches', () => {
        it('returns 90 for 3+ unanimous matches with topMatch > 0.90', () => {
            const matches = [
                { similarity: 0.95, libraryId: 1 },
                { similarity: 0.93, libraryId: 1 },
                { similarity: 0.92, libraryId: 1 }
            ];
            expect(ragRetriever.calculateDynamicWeight(matches)).toBe(90);
        });

        it('returns 70 for a single match with topMatch > 0.70 (not meeting 80 criteria)', () => {
            const matches = [
                { similarity: 0.75, libraryId: 1 }
            ];
            expect(ragRetriever.calculateDynamicWeight(matches)).toBe(70);
        });

        it('returns 60 for a single match with topMatch between 0.60 and 0.70', () => {
            const matches = [
                { similarity: 0.65, libraryId: 1 }
            ];
            expect(ragRetriever.calculateDynamicWeight(matches)).toBe(60);
        });
    });

    describe('findSimilarItems', () => {
        it('returns [] when RAG is disabled', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(false);

            const result = await ragRetriever.findSimilarItems('Test Movie', 1);

            expect(result).toEqual([]);
            expect(embeddingRouter.embed).not.toHaveBeenCalled();
        });

        it('returns [] when not enough embeddings', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(false);

            const result = await ragRetriever.findSimilarItems('Test Movie', 1);

            expect(result).toEqual([]);
            expect(embeddingRouter.embed).not.toHaveBeenCalled();
        });

        it('returns mapped array of similar items on success', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingService.formatForEmbedding.mockReturnValue('Test Movie');
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] });
            db.query.mockResolvedValueOnce({
                rows: [
                    { title: 'Similar Movie', media_type: 'movie', similarity: 0.857 },
                    { title: 'Another Film', media_type: 'movie', similarity: 0.72 }
                ]
            });

            const result = await ragRetriever.findSimilarItems('Test Movie', 42);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ title: 'Similar Movie', mediaType: 'movie', similarity: 0.86 });
            expect(result[1]).toEqual({ title: 'Another Film', mediaType: 'movie', similarity: 0.72 });
        });

        it('returns [] when DB returns no rows', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2] });
            db.query.mockResolvedValueOnce({ rows: [] });

            const result = await ragRetriever.findSimilarItems('Unknown', 1);

            expect(result).toEqual([]);
        });

        it('respects custom limit parameter in DB query', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2] });
            db.query.mockResolvedValueOnce({ rows: [] });

            await ragRetriever.findSimilarItems('Test', 7, 10);

            const [, params] = db.query.mock.calls[0];
            expect(params).toContain(10); // custom limit
        });

        it('returns [] and swallows error on DB failure', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2] });
            db.query.mockRejectedValueOnce(new Error('DB error'));

            const result = await ragRetriever.findSimilarItems('Test', 1);

            expect(result).toEqual([]);
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
