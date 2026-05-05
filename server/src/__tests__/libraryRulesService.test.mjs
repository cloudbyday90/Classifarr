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

import { LibraryRulesService } from '../services/libraryRulesService.mjs';

const libraries = [
    { id: 1, name: 'Movies', priority: 10 },
    { id: 2, name: 'Kids Movies', priority: 5 },
];

function makeDb(rows = []) {
    return { query: jest.fn().mockResolvedValue({ rows }) };
}

function makeService(db) {
    return new LibraryRulesService({ db });
}

describe('checkLibraryRules', () => {
    it('returns null when no active rules exist', async () => {
        const db = makeDb([]);
        const result = await makeService(db).checkLibraryRules({}, libraries);
        expect(result).toBeNull();
    });

    it('returns match when all conditions pass', async () => {
        const db = makeDb([{
            id: 1,
            library_id: 1,
            conditions: JSON.stringify([{ field: 'rating', operator: 'equals', value: 'PG-13' }]),
            description: 'PG-13 movies',
            name: 'PG-13 rule',
        }]);
        const metadata = { certification: 'PG-13' };
        const result = await makeService(db).checkLibraryRules(metadata, libraries);
        expect(result).not.toBeNull();
        expect(result.library.id).toBe(1);
        expect(result.isException).toBe(false);
        expect(result.matchedRule).toContain('rating');
    });

    it('returns null when a condition fails (AND logic)', async () => {
        const db = makeDb([{
            id: 1,
            library_id: 1,
            conditions: JSON.stringify([
                { field: 'rating', operator: 'equals', value: 'PG-13' },
                { field: 'language', operator: 'equals', value: 'fr' },
            ]),
            description: null,
            name: 'French PG-13',
        }]);
        const metadata = { certification: 'PG-13', original_language: 'en' };
        const result = await makeService(db).checkLibraryRules(metadata, libraries);
        expect(result).toBeNull();
    });

    it('skips rules with malformed conditions JSON', async () => {
        const db = makeDb([
            {
                id: 1,
                library_id: 1,
                conditions: 'NOT_VALID_JSON',
                description: null,
                name: 'Bad rule',
            },
            {
                id: 2,
                library_id: 2,
                conditions: JSON.stringify([{ field: 'rating', operator: 'equals', value: 'G' }]),
                description: 'G-rated kids',
                name: 'G rule',
            },
        ]);
        const metadata = { certification: 'G' };
        const result = await makeService(db).checkLibraryRules(metadata, libraries);
        expect(result).not.toBeNull();
        expect(result.library.id).toBe(2);
    });

    it('handles between operator for year ranges', async () => {
        const rule = {
            id: 1,
            library_id: 1,
            conditions: JSON.stringify([{ field: 'year', operator: 'between', value: '1990,1999' }]),
            description: '90s movies',
            name: '90s rule',
        };

        const dbIn = makeDb([rule]);
        const inRange = await makeService(dbIn).checkLibraryRules({ year: '1995' }, libraries);
        expect(inRange).not.toBeNull();
        expect(inRange.library.id).toBe(1);

        const dbOut = makeDb([rule]);
        const outOfRange = await makeService(dbOut).checkLibraryRules({ year: '2005' }, libraries);
        expect(outOfRange).toBeNull();
    });

    it('matches genre array field with includes operator', async () => {
        const db = makeDb([{
            id: 1,
            library_id: 1,
            conditions: JSON.stringify([{ field: 'genre', operator: 'includes', value: 'action' }]),
            description: 'Action movies',
            name: 'Action rule',
        }]);
        const metadata = { genres: ['Action', 'Thriller'] };
        const result = await makeService(db).checkLibraryRules(metadata, libraries);
        expect(result).not.toBeNull();
    });

    it('returns null when library_id in rule does not match any active library', async () => {
        const db = makeDb([{
            id: 1,
            library_id: 99,
            conditions: JSON.stringify([{ field: 'rating', operator: 'equals', value: 'R' }]),
            description: null,
            name: 'Orphaned rule',
        }]);
        const metadata = { certification: 'R' };
        const result = await makeService(db).checkLibraryRules(metadata, libraries);
        expect(result).toBeNull();
    });

    it('uses rule.description as reason when present', async () => {
        const db = makeDb([{
            id: 1,
            library_id: 1,
            conditions: JSON.stringify([{ field: 'rating', operator: 'equals', value: 'R' }]),
            description: 'Rated R content',
            name: 'R rule',
        }]);
        const result = await makeService(db).checkLibraryRules({ certification: 'R' }, libraries);
        expect(result.reason).toBe('Rated R content');
    });

    it('falls back to rule name in reason when description is absent', async () => {
        const db = makeDb([{
            id: 1,
            library_id: 1,
            conditions: JSON.stringify([{ field: 'rating', operator: 'equals', value: 'R' }]),
            description: null,
            name: 'R rule',
        }]);
        const result = await makeService(db).checkLibraryRules({ certification: 'R' }, libraries);
        expect(result.reason).toContain('R rule');
    });
});
