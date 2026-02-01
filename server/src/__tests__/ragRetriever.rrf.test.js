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

            // Only semantic - should still add RRF scores
            const semanticOnly = [{ classificationId: 1, similarity: 0.9 }];
            const semanticResult = ragRetriever.calculateRRF(semanticOnly, []);
            expect(semanticResult).toHaveLength(1);
            expect(semanticResult[0].classificationId).toBe(1);
            expect(semanticResult[0].rrfScore).toBeDefined();

            const semanticResult2 = ragRetriever.calculateRRF(semanticOnly, null);
            expect(semanticResult2).toHaveLength(1);
            expect(semanticResult2[0].rrfScore).toBeDefined();

            // Only text - should still add RRF scores
            const textOnly = [{ classificationId: 2, textScore: 0.8 }];
            const textResult = ragRetriever.calculateRRF([], textOnly);
            expect(textResult).toHaveLength(1);
            expect(textResult[0].classificationId).toBe(2);
            expect(textResult[0].rrfScore).toBeDefined();

            const textResult2 = ragRetriever.calculateRRF(null, textOnly);
            expect(textResult2).toHaveLength(1);
            expect(textResult2[0].rrfScore).toBeDefined();
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
            // Movie B: semantic rank 2 (index 1) = 1/62, text rank 1 (index 0) = 1/61
            expect(movieB.rrfScore).toBeCloseTo((1/62) + (1/61), 5);
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
            // ID 1 (semantic rank 1): 1/61, ID 3 (text rank 1): 1/61
            // ID 2 (semantic rank 2): 1/62, ID 4 (text rank 2): 1/62
            // Tie-breaking: semantic before text, so: 1, 3, 2, 4
            expect(results[0].classificationId).toBe(1); // Best semantic match
            expect(results[1].classificationId).toBe(3); // Text match with same RRF as ID 1
            expect(results[2].classificationId).toBe(2); // Second semantic match
            expect(results[3].classificationId).toBe(4); // Text match with same RRF as ID 2
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
