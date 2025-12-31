const ragRetriever = require('../services/ragRetriever');
const embeddingService = require('../services/embeddingService');
const embeddingRouter = require('../services/embeddingRouter');
const db = require('../config/database');

jest.mock('../services/embeddingService');
jest.mock('../services/embeddingRouter');
jest.mock('../config/database');
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

describe('RAGRetriever', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('semanticSearch', () => {
        it('should return similar items when found', async () => {
            // Mock embedding generation
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });

            // Mock DB search result
            db.query.mockResolvedValue({
                rows: [
                    {
                        classification_id: 1,
                        similarity: 0.95,
                        title: 'Test',
                        media_type: 'movie'
                    }
                ]
            });

            // Mock config enabled and threshold
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingService.hasMinimumEmbeddings.mockResolvedValue(true);
            embeddingRouter.getConfig.mockResolvedValue({ rag_similarity_threshold: 0.7 });

            const results = await ragRetriever.semanticSearch({ title: 'Query' });

            expect(results).toHaveLength(1);
            expect(results[0].similarity).toBe(0.95);
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

            expect(results).toHaveLength(1);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('plainto_tsquery'),
                expect.any(Array)
            );
        });

        it('should return empty for no search terms', async () => {
            const results = await ragRetriever.fullTextSearch({});
            expect(results).toEqual([]);
        });
    });

    describe('hybridSearch', () => {
        it('should combine semantic and text search results', async () => {
            // Mock semanticSearch
            jest.spyOn(ragRetriever, 'semanticSearch').mockResolvedValue([
                { classificationId: 1, similarity: 0.9, libraryId: 1 }
            ]);
            // Mock fullTextSearch
            jest.spyOn(ragRetriever, 'fullTextSearch').mockResolvedValue([
                { classificationId: 2, textScore: 0.8, libraryId: 2 }
            ]);

            const results = await ragRetriever.hybridSearch({ title: 'Test' });

            expect(results.length).toBeGreaterThan(0);
            expect(results[0]).toHaveProperty('combinedScore');
        });
    });
});
