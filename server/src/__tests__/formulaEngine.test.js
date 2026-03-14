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

const formulaEngine = require('../services/formulaEngine');
const { FORMULA_CONFIDENCE_CAP } = require('../services/formulaEngine');
const db = require('../config/database');
const libraryProfileService = require('../services/libraryProfileService');
const ragRetriever = require('../services/ragRetriever');

jest.mock('../config/database');
jest.mock('../services/libraryProfileService');
jest.mock('../services/ragRetriever');
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

describe('FormulaEngine', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('FORMULA_CONFIDENCE_CAP', () => {
        it('should be set to 95', () => {
            expect(FORMULA_CONFIDENCE_CAP).toBe(95);
        });
    });

    describe('getWeights', () => {
        it('should return weights from ai_provider_config', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    formula_pattern_weight: 0.40,
                    formula_rule_weight: 0.30,
                    formula_rag_weight: 0.20,
                    formula_history_weight: 0.10
                }]
            });

            const weights = await formulaEngine.getWeights();

            expect(weights).toEqual({
                profile: 0.40, // v0.38.0: pattern -> profile
                rule: 0.30,
                rag: 0.20,
                history: 0.10
            });
        });

        it('should return default weights when config is empty', async () => {
            db.query.mockResolvedValue({
                rows: [{}]
            });

            const weights = await formulaEngine.getWeights();

            expect(weights).toEqual({
                profile: 0.40,
                rule: 0.30,
                rag: 0.20,
                history: 0.10
            });
        });

        it('should return default weights when no config row exists', async () => {
            db.query.mockResolvedValue({
                rows: []
            });

            const weights = await formulaEngine.getWeights();

            expect(weights).toEqual({
                profile: 0.40,
                rule: 0.30,
                rag: 0.20,
                history: 0.10
            });
        });

        it('should return default weights on database error', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const weights = await formulaEngine.getWeights();

            expect(weights).toEqual({
                profile: 0.40,
                rule: 0.30,
                rag: 0.20,
                history: 0.10
            });
        });

        it('should handle custom weights', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    formula_pattern_weight: 0.50,
                    formula_rule_weight: 0.25,
                    formula_rag_weight: 0.15,
                    formula_history_weight: 0.10
                }]
            });

            const weights = await formulaEngine.getWeights();

            expect(weights).toEqual({
                profile: 0.50,
                rule: 0.25,
                rag: 0.15,
                history: 0.10
            });
        });
    });

    describe('getActiveLibraries', () => {
        it('should return active libraries', async () => {
            db.query.mockResolvedValue({
                rows: [
                    { id: 1, name: 'Movies', path: '/movies', media_type: 'movie', media_server_id: 1 },
                    { id: 2, name: 'TV Shows', path: '/tv', media_type: 'tv', media_server_id: 1 }
                ]
            });

            const libraries = await formulaEngine.getActiveLibraries();

            expect(libraries).toHaveLength(2);
            expect(libraries[0].name).toBe('Movies');
            expect(libraries[1].name).toBe('TV Shows');
        });

        it('should return empty array when no libraries exist', async () => {
            db.query.mockResolvedValue({
                rows: []
            });

            const libraries = await formulaEngine.getActiveLibraries();

            expect(libraries).toEqual([]);
        });

        it('should return empty array on database error', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const libraries = await formulaEngine.getActiveLibraries();

            expect(libraries).toEqual([]);
        });
    });

    describe('scoreProfile (formerly scorePatterns)', () => {
        const library = { id: 1, name: 'Movies' };
        const metadata = { title: 'Test Movie', studios: ['Marvel'] };

        it('should return high score for strong profile match', async () => {
            // Profile score 100 -> (50/50)*95 = 95
            libraryProfileService.getProfileScore.mockResolvedValue(100);

            const score = await formulaEngine.scoreProfile(metadata, library);

            expect(score).toBe(95);
        });

        it('should return scaled score for moderate profile match', async () => {
            // Profile score 75 -> (25/50)*95 = 47.5
            libraryProfileService.getProfileScore.mockResolvedValue(75);

            const score = await formulaEngine.scoreProfile(metadata, library);

            expect(score).toBe(47.5);
        });

        it('should return 0 for neutral profile match', async () => {
            // Profile score 50 (neutral) -> 0
            libraryProfileService.getProfileScore.mockResolvedValue(50);

            const score = await formulaEngine.scoreProfile(metadata, library);

            expect(score).toBe(0);
        });

        it('should return 0 for negative profile match', async () => {
            // Profile score 25 (mismatch) -> 0
            libraryProfileService.getProfileScore.mockResolvedValue(25);

            const score = await formulaEngine.scoreProfile(metadata, library);

            expect(score).toBe(0);
        });

        it('should return 0 on error', async () => {
            libraryProfileService.getProfileScore.mockRejectedValue(new Error('Profile error'));

            const score = await formulaEngine.scoreProfile(metadata, library);

            expect(score).toBe(0);
        });
    });

    describe('scoreRules', () => {
        const library = { id: 1, name: 'Movies' };
        const metadata = { genres: ['Action', 'Adventure'], certification: 'PG-13' };

        it('should return average confidence when rules match', async () => {
            db.query.mockResolvedValue({
                rows: [
                    { id: 1, name: 'Action Rule', rule_json: { field: 'genres', operator: 'contains', value: 'Action' } }
                ]
            });

            const score = await formulaEngine.scoreRules(metadata, library);

            expect(score).toBe(80); // Base confidence for matching rule
        });

        it('should return 0 when no rules exist', async () => {
            db.query.mockResolvedValue({
                rows: []
            });

            const score = await formulaEngine.scoreRules(metadata, library);

            expect(score).toBe(0);
        });

        it('should return 0 when no rules match', async () => {
            db.query.mockResolvedValue({
                rows: [
                    { id: 1, name: 'Horror Rule', rule_json: { field: 'genres', operator: 'contains', value: 'Horror' } }
                ]
            });

            const score = await formulaEngine.scoreRules(metadata, library);

            expect(score).toBe(0);
        });

        it('should cap score at 95', async () => {
            // Multiple matching rules should still cap at 95
            db.query.mockResolvedValue({
                rows: [
                    { id: 1, rule_json: { field: 'genres', operator: 'contains', value: 'Action' } },
                    { id: 2, rule_json: { field: 'genres', operator: 'contains', value: 'Adventure' } }
                ]
            });

            const score = await formulaEngine.scoreRules(metadata, library);

            expect(score).toBeLessThanOrEqual(95);
        });

        it('should return 0 on error', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const score = await formulaEngine.scoreRules(metadata, library);

            expect(score).toBe(0);
        });
    });

    describe('evaluateRule', () => {
        const metadata = {
            genres: ['Action', 'Adventure'],
            certification: 'PG-13',
            year: 2020,
            title: 'Test Movie'
        };

        it('should evaluate contains operator with array field', () => {
            const rule = { field: 'genres', operator: 'contains', value: 'Action' };
            expect(formulaEngine.evaluateRule(metadata, rule)).toBe(true);
        });

        it('should evaluate contains operator with string field', () => {
            const rule = { field: 'title', operator: 'contains', value: 'Test' };
            expect(formulaEngine.evaluateRule(metadata, rule)).toBe(true);
        });

        it('should evaluate equals operator', () => {
            const rule = { field: 'certification', operator: 'equals', value: 'PG-13' };
            expect(formulaEngine.evaluateRule(metadata, rule)).toBe(true);
        });

        it('should evaluate greater_than operator', () => {
            const rule = { field: 'year', operator: 'greater_than', value: 2015 };
            expect(formulaEngine.evaluateRule(metadata, rule)).toBe(true);
        });

        it('should evaluate less_than operator', () => {
            const rule = { field: 'year', operator: 'less_than', value: 2025 };
            expect(formulaEngine.evaluateRule(metadata, rule)).toBe(true);
        });

        it('should evaluate is_one_of operator with array field', () => {
            const rule = { field: 'genres', operator: 'is_one_of', value: ['Action', 'Horror'] };
            expect(formulaEngine.evaluateRule(metadata, rule)).toBe(true);
        });

        it('should evaluate is_one_of operator with string field', () => {
            const rule = { field: 'certification', operator: 'is_one_of', value: ['PG-13', 'R'] };
            expect(formulaEngine.evaluateRule(metadata, rule)).toBe(true);
        });

        it('should evaluate not_contains operator', () => {
            const rule = { field: 'genres', operator: 'not_contains', value: 'Horror' };
            expect(formulaEngine.evaluateRule(metadata, rule)).toBe(true);
        });

        it('should evaluate array operators against object-shaped metadata arrays', () => {
            const objectMetadata = {
                genres: [{ name: 'Action' }, { tag: 'Drama' }, { title: 'Thriller' }],
                keywords: [{ name: 'hero' }]
            };

            expect(formulaEngine.evaluateRule(objectMetadata, {
                field: 'genres',
                operator: 'contains',
                value: 'Action'
            })).toBe(true);

            expect(formulaEngine.evaluateRule(objectMetadata, {
                field: 'genres',
                operator: 'is_one_of',
                value: ['Drama', 'Comedy']
            })).toBe(true);

            expect(formulaEngine.evaluateRule(objectMetadata, {
                field: 'genres',
                operator: 'not_contains',
                value: 'Horror'
            })).toBe(true);
        });

        it('should return false when field does not exist', () => {
            const rule = { field: 'nonexistent', operator: 'contains', value: 'test' };
            expect(formulaEngine.evaluateRule(metadata, rule)).toBe(false);
        });

        it('should return false for invalid operator', () => {
            const rule = { field: 'genres', operator: 'invalid_op', value: 'Action' };
            expect(formulaEngine.evaluateRule(metadata, rule)).toBe(false);
        });

        it('should return false for malformed rule', () => {
            expect(formulaEngine.evaluateRule(metadata, {})).toBe(false);
        });
    });

    describe('scoreRAG', () => {
        const library = { id: 1, name: 'Movies' };
        const metadata = { title: 'Test Movie', overview: 'A test movie' };

        it('should return top similarity score as percentage', async () => {
            ragRetriever.semanticSearch.mockResolvedValue([
                { libraryId: 1, similarity: 0.85 },
                { libraryId: 1, similarity: 0.75 }
            ]);

            const score = await formulaEngine.scoreRAG(metadata, library);

            expect(score).toBe(85);
        });

        it('should return 0 when no matches found', async () => {
            ragRetriever.semanticSearch.mockResolvedValue([]);

            const score = await formulaEngine.scoreRAG(metadata, library);

            expect(score).toBe(0);
        });

        it('should return 0 when matches are for different library', async () => {
            ragRetriever.semanticSearch.mockResolvedValue([
                { libraryId: 2, similarity: 0.85 }
            ]);

            const score = await formulaEngine.scoreRAG(metadata, library);

            expect(score).toBe(0);
        });

        it('should cap score at 95', async () => {
            ragRetriever.semanticSearch.mockResolvedValue([
                { libraryId: 1, similarity: 0.98 }
            ]);

            const score = await formulaEngine.scoreRAG(metadata, library);

            expect(score).toBe(95);
        });

        it('should return 0 on error', async () => {
            ragRetriever.semanticSearch.mockRejectedValue(new Error('RAG error'));

            const score = await formulaEngine.scoreRAG(metadata, library);

            expect(score).toBe(0);
        });
    });

    describe('scoreHistory', () => {
        const library = { id: 1, name: 'Movies' };

        it('should return 50 when no TMDB ID provided', async () => {
            const metadata = { title: 'Test Movie' };

            const score = await formulaEngine.scoreHistory(metadata, library);

            expect(score).toBe(50);
        });

        it('should return 50 when no history exists', async () => {
            const metadata = { tmdb_id: 12345 };

            db.query.mockResolvedValue({
                rows: []
            });

            const score = await formulaEngine.scoreHistory(metadata, library);

            expect(score).toBe(50);
        });

        it('should return high score when always classified to this library', async () => {
            const metadata = { tmdb_id: 12345 };

            db.query.mockResolvedValue({
                rows: [
                    { library_id: 1, count: '5' }
                ]
            });

            const score = await formulaEngine.scoreHistory(metadata, library);

            expect(score).toBe(95); // 100% success rate = 95 score
        });

        it('should return low score when never classified to this library', async () => {
            const metadata = { tmdb_id: 12345 };

            db.query.mockResolvedValue({
                rows: [
                    { library_id: 2, count: '5' }
                ]
            });

            const score = await formulaEngine.scoreHistory(metadata, library);

            expect(score).toBe(0); // 0% success rate = 0 score
        });

        it('should calculate score based on success rate', async () => {
            const metadata = { tmdb_id: 12345 };

            db.query.mockResolvedValue({
                rows: [
                    { library_id: 1, count: '3' }, // 3 times to this library
                    { library_id: 2, count: '2' }  // 2 times to other library
                ]
            });

            const score = await formulaEngine.scoreHistory(metadata, library);

            // 3/5 = 60% success rate = 57 score (60% of 95)
            expect(score).toBeCloseTo(57, 0);
        });

        it('should return 50 on error', async () => {
            const metadata = { tmdb_id: 12345 };

            db.query.mockRejectedValue(new Error('Database error'));

            const score = await formulaEngine.scoreHistory(metadata, library);

            expect(score).toBe(50);
        });
    });

    describe('calculateLibraryScores', () => {
        const metadata = {
            title: 'Test Movie',
            tmdb_id: 12345,
            genres: ['Action'],
            studios: ['Marvel']
        };

        beforeEach(() => {
            // Mock getWeights
            db.query.mockImplementation((query) => {
                if (query.includes('ai_provider_config')) {
                    return Promise.resolve({
                        rows: [{
                            formula_pattern_weight: 0.40,
                            formula_rule_weight: 0.30,
                            formula_rag_weight: 0.20,
                            formula_history_weight: 0.10
                        }]
                    });
                }
                // Mock getActiveLibraries
                if (query.includes('FROM libraries')) {
                    return Promise.resolve({
                        rows: [
                            { id: 1, name: 'Movies', path: '/movies', media_type: 'movie', media_server_id: 1 },
                            { id: 2, name: 'TV Shows', path: '/tv', media_type: 'tv', media_server_id: 1 }
                        ]
                    });
                }
                // Mock scoreRules
                if (query.includes('library_custom_rules')) {
                    return Promise.resolve({ rows: [] });
                }
                // Mock scoreHistory
                if (query.includes('classification_history')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            // Mock profile scoring (simulating pattern weight use)
            libraryProfileService.getProfileScore.mockImplementation(async (libId, _meta) => {
                if (libId === 1) return 90; // High match for Movies (score ~80%)
                return 50; // Neutral
            });

            // Mock RAG scoring
            ragRetriever.semanticSearch.mockResolvedValue([
                { libraryId: 1, similarity: 0.70 }
            ]);
        });

        it('should calculate scores for all libraries', async () => {
            const results = await formulaEngine.calculateLibraryScores(metadata);

            expect(results).toHaveLength(2);
            expect(results[0].library.name).toBe('Movies'); // Higher score should be first
            expect(results[0]).toHaveProperty('score');
            expect(results[0]).toHaveProperty('breakdown');
            expect(results[0]).toHaveProperty('weights');
        });

        it('should include breakdown of all components', async () => {
            const results = await formulaEngine.calculateLibraryScores(metadata);

            const topResult = results[0];
            expect(topResult.breakdown).toHaveProperty('profile'); // renamed from pattern
            expect(topResult.breakdown).toHaveProperty('rule');
            expect(topResult.breakdown).toHaveProperty('rag');
            expect(topResult.breakdown).toHaveProperty('history');
        });

        it('should cap total score at 95', async () => {
            // Mock very high scores for all components
            libraryProfileService.getProfileScore.mockResolvedValue(100); // 95
            ragRetriever.semanticSearch.mockResolvedValue([
                { libraryId: 1, similarity: 0.95 }
            ]);
            db.query.mockImplementation((query) => {
                if (query.includes('ai_provider_config')) {
                    return Promise.resolve({
                        rows: [{
                            formula_pattern_weight: 0.40,
                            formula_rule_weight: 0.30,
                            formula_rag_weight: 0.20,
                            formula_history_weight: 0.10
                        }]
                    });
                }
                if (query.includes('FROM libraries')) {
                    return Promise.resolve({
                        rows: [{ id: 1, name: 'Movies', path: '/movies', media_type: 'movie', media_server_id: 1 }]
                    });
                }
                if (query.includes('library_custom_rules')) {
                    return Promise.resolve({
                        rows: [{ id: 1, rule_json: { field: 'genres', operator: 'contains', value: 'Action' } }]
                    });
                }
                if (query.includes('classification_history')) {
                    return Promise.resolve({
                        rows: [{ library_id: 1, count: '10' }]
                    });
                }
                return Promise.resolve({ rows: [] });
            });

            const results = await formulaEngine.calculateLibraryScores(metadata);

            expect(results[0].score).toBeLessThanOrEqual(95);
        });

        it('should sort results by score descending', async () => {
            libraryProfileService.getProfileScore.mockImplementation(async (libId) => {
                if (libId === 1) return 90;
                if (libId === 2) return 70;
                return 50;
            });

            const results = await formulaEngine.calculateLibraryScores(metadata);

            expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
        });

        it('should round scores to 2 decimal places', async () => {
            const results = await formulaEngine.calculateLibraryScores(metadata);

            for (const result of results) {
                const decimals = result.score.toString().split('.')[1]?.length || 0;
                expect(decimals).toBeLessThanOrEqual(2);
            }
        });

        it('should return empty array when no libraries exist', async () => {
            db.query.mockImplementation((query) => {
                if (query.includes('FROM libraries')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            const results = await formulaEngine.calculateLibraryScores(metadata);

            expect(results).toEqual([]);
        });

        it('should return empty array on error', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const results = await formulaEngine.calculateLibraryScores(metadata);

            expect(results).toEqual([]);
        });

        it('should cap individual component scores at 95', async () => {
            libraryProfileService.getProfileScore.mockResolvedValue(100);
            ragRetriever.semanticSearch.mockResolvedValue([
                { libraryId: 1, similarity: 1.0 }
            ]);

            const results = await formulaEngine.calculateLibraryScores(metadata);

            expect(results[0].breakdown.profile).toBeLessThanOrEqual(95);
            expect(results[0].breakdown.rag).toBeLessThanOrEqual(95);
        });
    });
});
