/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { extract } from '../services/ragGraphExtractor.mjs';

describe('ragGraphExtractor.extract()', () => {
    // ── Null / bad input ──────────────────────────────────────────────────────

    it('returns safe defaults for null metadata', () => {
        const result = extract(null);
        expect(result).toEqual({
            director_name: null,
            primary_studio_name: null,
            genre_names: [],
            cast_ids: [],
            cast_names: []
        });
    });

    it('returns safe defaults for undefined metadata', () => {
        expect(extract(undefined)).toEqual({
            director_name: null,
            primary_studio_name: null,
            genre_names: [],
            cast_ids: [],
            cast_names: []
        });
    });

    it('returns safe defaults for string metadata (not an object)', () => {
        expect(extract('not an object')).toEqual({
            director_name: null,
            primary_studio_name: null,
            genre_names: [],
            cast_ids: [],
            cast_names: []
        });
    });

    it('returns safe defaults for array metadata (truthy non-object shape)', () => {
        expect(extract([])).toEqual({
            director_name: null,
            primary_studio_name: null,
            genre_names: [],
            cast_ids: [],
            cast_names: []
        });
    });

    // ── Movie metadata – full shape ───────────────────────────────────────────

    it('extracts all 5 fields from a full movie metadata object', () => {
        const metadata = {
            director_name: 'Christopher Nolan',
            production_companies: [
                { id: 1, name: 'Warner Bros.' },
                { id: 2, name: 'Syncopy' }
            ],
            genres: ['Action', 'Sci-Fi'],
            cast: [
                { id: 1136406, name: 'Tom Hardy' },
                { id: 6193,    name: 'Leonardo DiCaprio' },
                { id: 2037,    name: 'Joseph Gordon-Levitt' },
                { id: 5294,    name: 'Ellen Page' },
                { id: 1204,    name: 'Ken Watanabe' },
                { id: 8784,    name: 'Cillian Murphy' }  // 6th — should be sliced off
            ]
        };

        const result = extract(metadata);

        expect(result.director_name).toBe('christopher nolan');
        expect(result.primary_studio_name).toBe('warner bros.');
        expect(result.genre_names).toEqual(['Action', 'Sci-Fi']);
        expect(result.cast_ids).toEqual([1136406, 6193, 2037, 5294, 1204]);
        expect(result.cast_ids).toHaveLength(5); // capped at 5
        expect(result.cast_names).toEqual(['Tom Hardy', 'Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Ellen Page', 'Ken Watanabe']);
    });

    // ── TV metadata – director from created_by ────────────────────────────────

    it('uses created_by[0].name as director for TV metadata', () => {
        const metadata = {
            director_name: 'Vince Gilligan', // enrichWithTMDB sets this from created_by
            production_companies: [{ id: 10, name: 'High Bridge Entertainment' }],
            genres: ['Crime', 'Drama'],
            cast: [{ id: 17419, name: 'Bryan Cranston' }]
        };

        const result = extract(metadata);

        expect(result.director_name).toBe('vince gilligan');
        expect(result.primary_studio_name).toBe('high bridge entertainment');
    });

    it('returns null director when director_name is absent', () => {
        const result = extract({ genres: ['Drama'] });
        expect(result.director_name).toBeNull();
    });

    it('returns null director for empty director_name string', () => {
        const result = extract({ director_name: '   ' });
        expect(result.director_name).toBeNull();
    });

    // ── Normalization ─────────────────────────────────────────────────────────

    it('lowercases and trims director_name', () => {
        const result = extract({ director_name: '  STEVEN SPIELBERG  ' });
        expect(result.director_name).toBe('steven spielberg');
    });

    it('lowercases and trims primary_studio_name', () => {
        const result = extract({
            production_companies: [{ id: 1, name: '  PIXAR ANIMATION STUDIOS  ' }]
        });
        expect(result.primary_studio_name).toBe('pixar animation studios');
    });

    it('truncates director_name to 255 characters', () => {
        const longName = 'a'.repeat(300);
        const result = extract({ director_name: longName });
        expect(result.director_name).toHaveLength(255);
    });

    it('truncates primary_studio_name to 255 characters', () => {
        const longName = 'b'.repeat(300);
        const result = extract({
            production_companies: [{ id: 1, name: longName }]
        });
        expect(result.primary_studio_name).toHaveLength(255);
    });

    // ── Studio edge cases ─────────────────────────────────────────────────────

    it('returns null studio when first production company has no name key', () => {
        const result = extract({ production_companies: [{ id: 1 }] }); // name absent
        expect(result.primary_studio_name).toBeNull();
    });

    it('returns null studio when company name is all whitespace', () => {
        const result = extract({ production_companies: [{ id: 1, name: '   ' }] });
        expect(result.primary_studio_name).toBeNull();
    });

    it('returns null studio when production_companies is empty', () => {
        const result = extract({ production_companies: [] });
        expect(result.primary_studio_name).toBeNull();
    });

    it('returns null studio when production_companies is absent', () => {
        const result = extract({ genres: ['Comedy'] });
        expect(result.primary_studio_name).toBeNull();
    });

    it('uses only the first production company (primary studio)', () => {
        const result = extract({
            production_companies: [
                { id: 1, name: 'First Studio' },
                { id: 2, name: 'Second Studio' }
            ]
        });
        expect(result.primary_studio_name).toBe('first studio');
    });

    // ── Genre edge cases ──────────────────────────────────────────────────────

    it('caps genre_names at 10 entries', () => {
        const result = extract({
            genres: ['G1','G2','G3','G4','G5','G6','G7','G8','G9','G10','G11','G12']
        });
        expect(result.genre_names).toHaveLength(10);
    });

    it('filters falsy values from genre_names', () => {
        const result = extract({ genres: ['Action', '', null, undefined, 'Drama'] });
        expect(result.genre_names).toEqual(['Action', 'Drama']);
    });

    it('normalizes object-shaped genres to name values', () => {
        const result = extract({
            genres: [{ id: 1, name: 'Action' }, { id: 2, name: 'Drama' }, { id: 3 }]
        });
        expect(result.genre_names).toEqual(['Action', 'Drama']);
    });

    it('returns empty array when genres is absent', () => {
        const result = extract({ director_name: 'Someone' });
        expect(result.genre_names).toEqual([]);
    });

    // ── Cast edge cases ───────────────────────────────────────────────────────

    it('returns empty cast arrays when cast is absent', () => {
        const result = extract({ director_name: 'Someone' });
        expect(result.cast_ids).toEqual([]);
        expect(result.cast_names).toEqual([]);
    });

    it('filters cast members missing a numeric id (intarray null safety)', () => {
        const result = extract({
            cast: [
                { id: 123,       name: 'Valid Actor' },
                { id: null,      name: 'No ID' },
                { id: undefined, name: 'Undefined ID' },
                { id: 'bad',     name: 'String ID' },
                { id: 456,       name: 'Another Valid' }
            ]
        });
        expect(result.cast_ids).toEqual([123, 456]);
        // Critical: cast_ids must NEVER contain null — GIN gin__int_ops would throw
        expect(result.cast_ids.every(id => id != null)).toBe(true);
    });

    it('filters cast members missing a name', () => {
        const result = extract({
            cast: [
                { id: 1, name: 'Alice'    },
                { id: 2              },          // no name
                { id: 3, name: null  },
                { id: 4, name: '    ' }          // whitespace — non-empty string, included
            ]
        });
        // cast_ids: all 4 have valid numeric id but is name filter for names only
        expect(result.cast_ids).toContain(1);
        expect(result.cast_ids).toContain(4);
        // cast_names: only truthy names
        expect(result.cast_names).toContain('Alice');
        expect(result.cast_names).not.toContain(null);
        expect(result.cast_names).not.toContain(undefined);
    });

    it('cast_ids never contains null regardless of input (intarray safety invariant)', () => {
        // Fuzz a variety of malformed cast inputs
        const inputs = [
            null, undefined, [], {},
            [{}],
            [{ id: null }],
            [{ id: undefined }],
            [{ id: NaN }],
            [{ id: 0 }]  // 0 is a valid non-null integer
        ];
        for (const cast of inputs) {
            const result = extract({ cast });
            expect(result.cast_ids.every(id => id != null)).toBe(true);
        }
    });

    it('cast_ids includes 0 (valid TMDB person ID edge case)', () => {
        const result = extract({ cast: [{ id: 0, name: 'Edge Case' }] });
        // id = 0 is a valid non-null integer; however our filter is id != null which passes 0
        expect(result.cast_ids).toContain(0);
    });
});
