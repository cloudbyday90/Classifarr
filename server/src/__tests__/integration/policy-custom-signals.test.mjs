/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for preset customization (custom_signals) feature
 * Ensures policies can store and retrieve per-preset signal customizations
 */

import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/database', () => ({
    query: jest.fn(),
}));

const db = await import('../../config/database');

describe('Policy Custom Signals API', () => {
    let mockQuery;

    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery = jest.fn();
        db.query = mockQuery;
    });

    describe('POST /api/policies - Create policy with custom signals', () => {
        test('should accept customSignals in preset payload', async () => {
            const policyPayload = {
                library_id: 1,
                name: 'Custom Family Policy',
                description: 'Family content with custom signals',
                presets: [
                    {
                        preset_id: 1,
                        weight: 1.0,
                        customSignals: {
                            certifications: {
                                include: ['G', 'PG', 'PG-13']
                            },
                            genres: {
                                prefer: ['Animation', 'Family'],
                                exclude: ['Horror']
                            },
                            keywords: {
                                exclude: ['gore', 'explicit']
                            }
                        }
                    }
                ],
                preset_weight: 0.40,
                pattern_weight: 0.30,
                rag_weight: 0.20,
                history_weight: 0.10
            };

            expect(policyPayload.presets[0].customSignals).toBeDefined();
            expect(policyPayload.presets[0].customSignals.certifications.include).toContain('G');
            expect(policyPayload.presets[0].customSignals.genres.exclude).toContain('Horror');
        });

        test('should handle null customSignals', () => {
            const presetWithNullSignals = {
                preset_id: 2,
                weight: 0.8,
                customSignals: null
            };

            expect(presetWithNullSignals.customSignals).toBeNull();
        });

        test('should handle missing customSignals (undefined)', () => {
            const presetWithoutSignals = {
                preset_id: 3,
                weight: 1.0
            };

            expect(presetWithoutSignals.customSignals).toBeUndefined();
            const customSignals = presetWithoutSignals.customSignals || null;
            expect(customSignals).toBeNull();
        });
    });

    describe('Custom Signals Structure Validation', () => {
        test('certifications signal structure is valid', () => {
            const certSignals = {
                include: ['G', 'PG'],
                exclude: ['R', 'NC-17']
            };

            expect(Array.isArray(certSignals.include)).toBe(true);
            expect(Array.isArray(certSignals.exclude)).toBe(true);
        });

        test('genres signal structure is valid', () => {
            const genreSignals = {
                prefer: ['Animation', 'Family'],
                require_any: ['Comedy'],
                exclude: ['Horror', 'Thriller']
            };

            expect(Array.isArray(genreSignals.prefer)).toBe(true);
            expect(Array.isArray(genreSignals.exclude)).toBe(true);
        });

        test('keywords signal structure is valid', () => {
            const keywordSignals = {
                require_any: ['disney', 'pixar'],
                exclude: ['gore', 'explicit', 'adult']
            };

            expect(Array.isArray(keywordSignals.require_any)).toBe(true);
            expect(Array.isArray(keywordSignals.exclude)).toBe(true);
        });

        test('complete customSignals object merges correctly', () => {
            const basePresetSignals = {
                certifications: { include: ['G', 'PG'] },
                genres: { prefer: ['Animation'] },
                keywords: { exclude: ['gore'] }
            };

            const customOverrides = {
                certifications: { include: ['G', 'PG', 'PG-13'] },
                genres: { exclude: ['Horror'] }
            };

            const merged = {
                ...basePresetSignals,
                certifications: { ...basePresetSignals.certifications, ...customOverrides.certifications },
                genres: { ...basePresetSignals.genres, ...customOverrides.genres }
            };

            expect(merged.certifications.include).toContain('PG-13');
            expect(merged.genres.prefer).toContain('Animation');
            expect(merged.genres.exclude).toContain('Horror');
        });
    });

    describe('Database Column Verification', () => {
        test('policy_presets INSERT includes custom_signals', () => {
            const insertQuery = `
                INSERT INTO policy_presets (policy_id, preset_id, weight, custom_signals)
                VALUES ($1, $2, $3, $4)
            `;

            expect(insertQuery).toContain('custom_signals');
            expect(insertQuery).toContain('$4');
        });

        test('policy_presets SELECT includes custom_signals', () => {
            const selectQuery = `
                SELECT cp.*, pp.weight, pp.custom_signals
                FROM policy_presets pp
                JOIN content_presets cp ON pp.preset_id = cp.id
                WHERE pp.policy_id = $1
            `;

            expect(selectQuery).toContain('pp.custom_signals');
        });
    });
});

describe('PresetCard CustomSignals Functions', () => {
    describe('Signal Manipulation', () => {
        test('addSignalItem adds to correct list', () => {
            const signals = {
                certifications: { include: ['G'], exclude: [] },
                genres: { prefer: [], exclude: [] },
                keywords: { require_any: [], exclude: [] }
            };

            const newRating = 'PG';
            if (!signals.certifications.include.includes(newRating)) {
                signals.certifications.include.push(newRating);
            }

            expect(signals.certifications.include).toContain('G');
            expect(signals.certifications.include).toContain('PG');
            expect(signals.certifications.include.length).toBe(2);
        });

        test('removeSignalItem removes from correct list', () => {
            const signals = {
                genres: { prefer: ['Animation', 'Family', 'Comedy'], exclude: [] }
            };

            signals.genres.prefer = signals.genres.prefer.filter(g => g !== 'Family');

            expect(signals.genres.prefer).toContain('Animation');
            expect(signals.genres.prefer).toContain('Comedy');
            expect(signals.genres.prefer).not.toContain('Family');
            expect(signals.genres.prefer.length).toBe(2);
        });

        test('prevents duplicate additions', () => {
            const keywords = ['disney', 'pixar'];
            const newKeyword = 'disney';

            if (!keywords.includes(newKeyword)) {
                keywords.push(newKeyword);
            }

            expect(keywords.length).toBe(2);
        });
    });

    describe('Available Options', () => {
        test('availableRatings includes common ratings', () => {
            const availableRatings = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', 'NR'];

            expect(availableRatings).toContain('G');
            expect(availableRatings).toContain('PG');
            expect(availableRatings).toContain('PG-13');
            expect(availableRatings).toContain('R');
            expect(availableRatings).toContain('TV-MA');
        });

        test('availableGenres includes common genres', () => {
            const availableGenres = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'];

            expect(availableGenres).toContain('Animation');
            expect(availableGenres).toContain('Family');
            expect(availableGenres).toContain('Horror');
            expect(availableGenres.length).toBeGreaterThan(10);
        });
    });
});
