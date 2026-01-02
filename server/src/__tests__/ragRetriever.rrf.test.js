const ragRetriever = require('../services/ragRetriever');

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
jest.mock('../utils/ragLogger', () => ({
    logOperation: jest.fn(),
    logError: jest.fn()
}));

describe('RAGRetriever - RRF Algorithm', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('calculateRRF', () => {
        it('should handle empty/null inputs', () => {
            // Both empty
            expect(ragRetriever.calculateRRF(null, null)).toEqual([]);
            expect(ragRetriever.calculateRRF([], [])).toEqual([]);

            // Only semantic
            const semanticOnly = [{ classificationId: 1, similarity: 0.9 }];
            expect(ragRetriever.calculateRRF(semanticOnly, [])).toEqual(semanticOnly);
            expect(ragRetriever.calculateRRF(semanticOnly, null)).toEqual(semanticOnly);

            // Only text
            const textOnly = [{ classificationId: 2, textScore: 0.8 }];
            expect(ragRetriever.calculateRRF([], textOnly)).toEqual(textOnly);
            expect(ragRetriever.calculateRRF(null, textOnly)).toEqual(textOnly);
        });

        it('should calculate RRF for single-source results', () => {
            const semanticMatches = [
                { classificationId: 1, title: 'Movie A', similarity: 0.95 },
                { classificationId: 2, title: 'Movie B', similarity: 0.90 },
                { classificationId: 3, title: 'Movie C', similarity: 0.85 }
            ];

            const results = ragRetriever.calculateRRF(semanticMatches, [], 60);

            expect(results).toHaveLength(3);
            expect(results[0].classificationId).toBe(1);
            expect(results[0].rrfScore).toBeCloseTo(1 / 61, 5); // 1/(60+0+1)
            expect(results[0].semanticRank).toBe(1);
            expect(results[0].textRank).toBeNull();
        });

        it('should combine semantic and text results with RRF', () => {
            const semanticMatches = [
                { classificationId: 1, title: 'Movie A', similarity: 0.95 },
                { classificationId: 2, title: 'Movie B', similarity: 0.90 }
            ];

            const textMatches = [
                { classificationId: 2, title: 'Movie B', textScore: 0.85 },
                { classificationId: 3, title: 'Movie C', textScore: 0.80 }
            ];

            const results = ragRetriever.calculateRRF(semanticMatches, textMatches, 60);

            // Movie B appears in both - should have highest RRF score
            expect(results).toHaveLength(3);
            
            // Find Movie B (id=2) - should be first due to appearing in both sources
            const movieB = results.find(r => r.classificationId === 2);
            expect(movieB).toBeDefined();
            expect(movieB.rrfScore).toBeCloseTo((1/61) + (1/61), 5); // Appears in both at rank 0
            expect(movieB.semanticRank).toBe(2);
            expect(movieB.textRank).toBe(1);
        });

        it('should validate k parameter', () => {
            const semanticMatches = [
                { classificationId: 1, similarity: 0.9 }
            ];

            // Invalid k should default to 60
            const results1 = ragRetriever.calculateRRF(semanticMatches, [], 'invalid');
            expect(results1[0].rrfScore).toBeCloseTo(1 / 61, 5);

            const results2 = ragRetriever.calculateRRF(semanticMatches, [], -5);
            expect(results2[0].rrfScore).toBeCloseTo(1 / 61, 5);

            // Valid k
            const results3 = ragRetriever.calculateRRF(semanticMatches, [], 30);
            expect(results3[0].rrfScore).toBeCloseTo(1 / 31, 5);
        });

        it('should handle tie-breaking with semantic rank preference', () => {
            // Create scenario where RRF scores are equal
            const semanticMatches = [
                { classificationId: 1, similarity: 0.9 },
                { classificationId: 2, similarity: 0.85 }
            ];

            const textMatches = [
                { classificationId: 3, textScore: 0.8 },
                { classificationId: 4, textScore: 0.75 }
            ];

            const results = ragRetriever.calculateRRF(semanticMatches, textMatches, 60);

            // Items with same RRF score should be ordered by semantic rank (if present)
            // Items in semantic search should come before text-only items when RRF scores are equal
            expect(results[0].classificationId).toBe(1); // Best semantic match
            expect(results[1].classificationId).toBe(2); // Second semantic match
        });

        it('should preserve scores in results', () => {
            const semanticMatches = [
                { classificationId: 1, similarity: 0.95, libraryName: 'Movies' }
            ];

            const textMatches = [
                { classificationId: 1, textScore: 0.80 }
            ];

            const results = ragRetriever.calculateRRF(semanticMatches, textMatches, 60);

            expect(results[0].vectorScore).toBe(0.95);
            expect(results[0].textScore).toBe(0.80);
            expect(results[0].libraryName).toBe('Movies');
        });

        it('should skip matches without classificationId', () => {
            const semanticMatches = [
                { classificationId: 1, similarity: 0.9 },
                { similarity: 0.85 }, // Missing classificationId
                { classificationId: 2, similarity: 0.8 }
            ];

            const results = ragRetriever.calculateRRF(semanticMatches, [], 60);

            // Should only include matches with classificationId
            expect(results).toHaveLength(2);
            expect(results.every(r => r.classificationId)).toBe(true);
        });
    });

    describe('legacyHybridCombine', () => {
        it('should use weighted average (70% semantic, 30% text)', () => {
            const semanticMatches = [
                { classificationId: 1, similarity: 1.0 }
            ];

            const textMatches = [
                { classificationId: 1, textScore: 0.5 }
            ];

            const results = ragRetriever.legacyHybridCombine(semanticMatches, textMatches, 5);

            expect(results[0].combinedScore).toBeCloseTo((1.0 * 0.7) + (0.5 * 0.3), 5);
        });
    });
});
