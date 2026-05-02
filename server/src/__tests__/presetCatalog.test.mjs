/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildPresetListQuery, normalizeFilterValue } from '../utils/presetCatalog.mjs';

describe('presetCatalog', () => {
    test('normalizeFilterValue trims strings and rejects empty or non-string values', () => {
        expect(normalizeFilterValue('  genre  ')).toBe('genre');
        expect(normalizeFilterValue('   ')).toBeNull();
        expect(normalizeFilterValue(null)).toBeNull();
        expect(normalizeFilterValue(42)).toBeNull();
    });

    test('buildPresetListQuery parameterizes category and search across builtin and custom rows', () => {
        const result = buildPresetListQuery({
            category: ' audience ',
            search: ' family ',
            includeCustom: true,
            orderBy: 'policy'
        });

        expect(result.values).toEqual(['audience', '%family%']);
        expect(result.text).toContain('cp.category = $1');
        expect(result.text).toContain("cp.name ILIKE $2");
        expect(result.text).toContain('UNION ALL');
        expect(result.text).toContain('ORDER BY category, source DESC, display_order, name');
        expect(result.text).not.toContain("'audience'");
        expect(result.text).not.toContain("'%family%'");
    });

    test('buildPresetListQuery supports builtin-only unified ordering', () => {
        const result = buildPresetListQuery({
            includeCustom: false,
            orderBy: 'unified'
        });

        expect(result.values).toEqual([]);
        expect(result.text).not.toContain('UNION ALL');
        expect(result.text).toContain('cp.is_system = true');
        expect(result.text).toContain('ORDER BY source DESC, display_order, name');
    });
});