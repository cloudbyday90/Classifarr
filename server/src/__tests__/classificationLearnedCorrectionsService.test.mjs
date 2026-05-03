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

import { checkLearnedCorrections } from '../services/classificationLearnedCorrectionsService.mjs';

function makeDb(rows = []) {
    return { query: jest.fn().mockResolvedValue({ rows }) };
}

describe('checkLearnedCorrections', () => {
    it('returns null when tmdbId is falsy', async () => {
        const db = makeDb([{ corrected_library_id: 1 }]);
        expect(await checkLearnedCorrections(null, 'movie', db)).toBeNull();
        expect(await checkLearnedCorrections(0, 'movie', db)).toBeNull();
        expect(await checkLearnedCorrections('', 'movie', db)).toBeNull();
        expect(db.query).not.toHaveBeenCalled();
    });

    it('returns null when no matching correction row exists', async () => {
        const db = makeDb([]);
        const result = await checkLearnedCorrections(12345, 'movie', db);
        expect(result).toBeNull();
    });

    it('returns the correction row when one exists', async () => {
        const row = {
            corrected_library_id: 7,
            corrected_by: 'admin',
            title: 'Dune',
            created_at: new Date(),
            user_note: null,
        };
        const db = makeDb([row]);
        const result = await checkLearnedCorrections(12345, 'movie', db);
        expect(result).toEqual(row);
    });

    it('queries with correct tmdbId and mediaType params', async () => {
        const db = makeDb([]);
        await checkLearnedCorrections(99, 'show', db);
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('learned_corrections'),
            [99, 'show']
        );
    });

    it('queries ORDER BY created_at DESC LIMIT 1 to return most recent', async () => {
        const db = makeDb([]);
        await checkLearnedCorrections(1, 'movie', db);
        const sql = db.query.mock.calls[0][0];
        expect(sql).toMatch(/ORDER BY created_at DESC LIMIT 1/);
    });

    it('returns null and logs warning when query throws (table missing)', async () => {
        const db = { query: jest.fn().mockRejectedValue(new Error('relation "learned_corrections" does not exist')) };
        const result = await checkLearnedCorrections(1, 'movie', db);
        expect(result).toBeNull();
    });
});
