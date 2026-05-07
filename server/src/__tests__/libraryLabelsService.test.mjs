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

import { jest } from '@jest/globals';
import { createMockModule } from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createMockModule(mockDb));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: jest.fn(() => ({
        info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
    }))
}));

jest.unstable_mockModule('../utils/metadataNormalization.mjs', () => ({
    normalizeMetadataListLower: jest.fn(arr => arr ? arr.map(v => typeof v === 'string' ? v.toLowerCase() : v) : arr)
}));

const { matchRules, metadataMatchesLabel, evaluateCustomRule, evaluateSingleCondition } = await import('../services/libraryLabelsService.mjs');

const libMovies = { id: 1, name: 'Movies' };
const libKids = { id: 2, name: 'Kids Movies' };
const libraries = [libMovies, libKids];

function makeDb(labelRows = [], ruleRows = []) {
    return {
        query: jest.fn()
            .mockResolvedValueOnce({ rows: labelRows })
            .mockResolvedValueOnce({ rows: ruleRows }),
    };
}

describe('matchRules', () => {
    it('returns null for empty libraries list', async () => {
        const db = makeDb();
        expect(await matchRules({}, [], db)).toBeNull();
    });

    it('issues exactly 2 DB queries regardless of library count (N+1 fix)', async () => {
        const threeLibraries = [
            { id: 1, name: 'A' },
            { id: 2, name: 'B' },
            { id: 3, name: 'C' },
        ];
        const db = makeDb([], []);
        await matchRules({}, threeLibraries, db);
        expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('passes library ids as ANY($1) array in both queries', async () => {
        const db = makeDb([], []);
        await matchRules({}, libraries, db);
        expect(db.query.mock.calls[0][1]).toEqual([[1, 2]]);
        expect(db.query.mock.calls[1][1]).toEqual([[1, 2]]);
    });

    it('disqualifies a library when an exclude label matches', async () => {
        const labelRows = [
            {
                library_id: 1,
                rule_type: 'exclude',
                category: 'rating',
                name: 'adult',
                display_name: 'Adult',
                tmdb_match_field: 'certification',
                tmdb_match_values: ['R'],
            },
        ];
        const db = makeDb(labelRows, []);
        const result = await matchRules({ certification: 'R' }, [libMovies], db);
        expect(result).toBeNull();
    });

    it('scores a library with a matching include label', async () => {
        const labelRows = [
            {
                library_id: 1,
                rule_type: 'include',
                category: 'genre',
                name: 'action',
                display_name: 'Action',
                tmdb_match_field: 'genres',
                tmdb_match_values: ['action'],
            },
        ];
        const db = makeDb(labelRows, []);
        const result = await matchRules({ genres: ['Action'] }, [libMovies], db);
        expect(result).not.toBeNull();
        expect(result.library.id).toBe(1);
        expect(result.confidence).toBe(25);
    });

    it('scores a library with a matching custom rule', async () => {
        const ruleRows = [
            {
                library_id: 1,
                name: 'Animated',
                is_active: true,
                rule_json: [{ field: 'genres', operator: 'contains', value: 'animation' }],
            },
        ];
        const db = makeDb([], ruleRows);
        const result = await matchRules({ genres: ['Animation'] }, [libMovies], db);
        expect(result).not.toBeNull();
        expect(result.confidence).toBe(30);
    });

    it('selects the highest-scoring library across multiple libraries', async () => {
        const labelRows = [
            {
                library_id: 2,
                rule_type: 'include',
                category: 'genre',
                name: 'family',
                display_name: 'Family',
                tmdb_match_field: 'genres',
                tmdb_match_values: ['family'],
            },
        ];
        const ruleRows = [
            {
                library_id: 2,
                name: 'Kids rule',
                is_active: true,
                rule_json: [{ field: 'certification', operator: 'equals', value: 'G' }],
            },
        ];
        const db = makeDb(labelRows, ruleRows);
        const result = await matchRules({ genres: ['Family'], certification: 'G' }, libraries, db);
        expect(result.library.id).toBe(2);
        expect(result.confidence).toBe(55);
    });

    it('caps confidence at 100', async () => {
        const labelRows = Array.from({ length: 5 }, (_, i) => ({
            library_id: 1,
            rule_type: 'include',
            category: 'genre',
            name: `genre${i}`,
            display_name: `Genre ${i}`,
            tmdb_match_field: 'genres',
            tmdb_match_values: [`genre${i}`],
        }));
        const db = makeDb(labelRows, []);
        const result = await matchRules(
            { genres: ['genre0', 'genre1', 'genre2', 'genre3', 'genre4'] },
            [libMovies],
            db
        );
        expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('returns null when no labels or rules match any library', async () => {
        const db = makeDb([], []);
        const result = await matchRules({ certification: 'PG-13' }, libraries, db);
        expect(result).toBeNull();
    });
});

describe('metadataMatchesLabel', () => {
    it('returns false when tmdb_match_field is missing', () => {
        expect(metadataMatchesLabel({}, { tmdb_match_values: ['R'] })).toBe(false);
    });

    it('returns false when tmdb_match_values is empty', () => {
        expect(metadataMatchesLabel({ certification: 'R' }, { tmdb_match_field: 'certification', tmdb_match_values: [] })).toBe(false);
    });

    it('matches certification case-insensitively', () => {
        const label = { tmdb_match_field: 'certification', tmdb_match_values: ['R'] };
        expect(metadataMatchesLabel({ certification: 'r' }, label)).toBe(true);
        expect(metadataMatchesLabel({ certification: 'PG' }, label)).toBe(false);
    });

    it('matches genres', () => {
        const label = { tmdb_match_field: 'genres', tmdb_match_values: ['action'] };
        expect(metadataMatchesLabel({ genres: ['Action', 'Thriller'] }, label)).toBe(true);
        expect(metadataMatchesLabel({ genres: ['Drama'] }, label)).toBe(false);
    });

    it('matches keywords', () => {
        const label = { tmdb_match_field: 'keywords', tmdb_match_values: ['superhero'] };
        expect(metadataMatchesLabel({ keywords: ['superhero', 'based on comic'] }, label)).toBe(true);
    });

    it('matches original_language', () => {
        const label = { tmdb_match_field: 'original_language', tmdb_match_values: ['ja'] };
        expect(metadataMatchesLabel({ original_language: 'ja' }, label)).toBe(true);
        expect(metadataMatchesLabel({ original_language: 'en' }, label)).toBe(false);
    });

    it('returns false for unknown tmdb_match_field', () => {
        const label = { tmdb_match_field: 'unknown_field', tmdb_match_values: ['x'] };
        expect(metadataMatchesLabel({ certification: 'R' }, label)).toBe(false);
    });
});

describe('evaluateCustomRule', () => {
    it('evaluates a single condition object', () => {
        expect(evaluateCustomRule({ title: 'Avengers' }, { field: 'title', operator: 'contains', value: 'avengers' })).toBe(true);
    });

    it('evaluates an array with AND logic — all must match', () => {
        const conditions = [
            { field: 'certification', operator: 'equals', value: 'PG-13' },
            { field: 'original_language', operator: 'equals', value: 'en' },
        ];
        expect(evaluateCustomRule({ certification: 'PG-13', original_language: 'en' }, conditions)).toBe(true);
        expect(evaluateCustomRule({ certification: 'PG-13', original_language: 'fr' }, conditions)).toBe(false);
    });

    it('returns false on thrown error', () => {
        expect(evaluateCustomRule({}, null)).toBe(false);
    });
});

describe('evaluateSingleCondition', () => {
    it('contains — string field', () => {
        expect(evaluateSingleCondition({ title: 'The Avengers' }, { field: 'title', operator: 'contains', value: 'avengers' })).toBe(true);
        expect(evaluateSingleCondition({ title: 'Dune' }, { field: 'title', operator: 'contains', value: 'avengers' })).toBe(false);
    });

    it('contains — array field', () => {
        expect(evaluateSingleCondition({ genres: ['Action', 'Sci-Fi'] }, { field: 'genres', operator: 'contains', value: 'sci' })).toBe(true);
    });

    it('not_contains', () => {
        expect(evaluateSingleCondition({ title: 'Dune' }, { field: 'title', operator: 'not_contains', value: 'avengers' })).toBe(true);
    });

    it('equals', () => {
        expect(evaluateSingleCondition({ certification: 'PG-13' }, { field: 'certification', operator: 'equals', value: 'pg-13' })).toBe(true);
    });

    it('not_equals', () => {
        expect(evaluateSingleCondition({ certification: 'R' }, { field: 'certification', operator: 'not_equals', value: 'PG-13' })).toBe(true);
    });

    it('greater_than / less_than', () => {
        expect(evaluateSingleCondition({ year: 2010 }, { field: 'year', operator: 'greater_than', value: '2000' })).toBe(true);
        expect(evaluateSingleCondition({ year: 1990 }, { field: 'year', operator: 'less_than', value: '2000' })).toBe(true);
    });

    it('between', () => {
        expect(evaluateSingleCondition({ year: 1995 }, { field: 'year', operator: 'between', value: '1990,1999' })).toBe(true);
        expect(evaluateSingleCondition({ year: 2005 }, { field: 'year', operator: 'between', value: '1990,1999' })).toBe(false);
    });

    it('content_type uses nested path', () => {
        const metadata = { contentAnalysis: { bestMatch: { type: 'anime' } } };
        expect(evaluateSingleCondition(metadata, { field: 'content_type', operator: 'equals', value: 'anime' })).toBe(true);
    });

    it('returns false when fieldValue is missing', () => {
        expect(evaluateSingleCondition({}, { field: 'year', operator: 'equals', value: '2020' })).toBe(false);
    });

    it('returns false for unknown operator', () => {
        expect(evaluateSingleCondition({ title: 'Dune' }, { field: 'title', operator: 'unknown_op', value: 'x' })).toBe(false);
    });
});
