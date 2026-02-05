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

jest.mock('../services/embeddingService');
jest.mock('../services/embeddingRouter');
jest.mock('../services/imageEmbeddingProvider', () => ({
    embedImageFromUrl: jest.fn(),
    getConfig: jest.fn(),
    isConfigured: jest.fn()
}));
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
        imageEmbeddingProvider.embedImageFromUrl.mockResolvedValue(null);
        imageEmbeddingProvider.getConfig.mockResolvedValue({ image_embedding_provider_mode: 'disabled' });
        imageEmbeddingProvider.isConfigured.mockReturnValue(false);
    });

    describe('semanticSearch', () => {
        it('should return similar items when found', async () => {
            // Mock embedding generation
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            embeddingService.resolvePosterUrl.mockReturnValue('https://example.com/poster.jpg');
            imageEmbeddingProvider.embedImageFromUrl.mockResolvedValue({ embedding: [0.2, 0.3], dims: 2 });
            imageEmbeddingProvider.getConfig.mockResolvedValue({ image_embedding_provider_mode: 'local' });
            imageEmbeddingProvider.isConfigured.mockReturnValue(true);

            // Mock DB search result
            db.query.mockResolvedValue({
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
            });

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

        it('should skip image embedding when image mode is disabled', async () => {
            embeddingRouter.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });
            db.query.mockResolvedValue({ rows: [] });
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
            db.query.mockResolvedValue({
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
            });
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
            jest.spyOn(ragRetriever, 'fullTextSearch').mockResolvedValue([
                { classificationId: 2, textScore: 0.8, libraryId: 2 }
            ]);

            const results = await ragRetriever.hybridSearch({ title: 'Test' });

            expect(results.length).toBeGreaterThan(0);
            // With RRF, results should have rrfScore
            expect(results[0]).toHaveProperty('rrfScore');
        });
    });
});
