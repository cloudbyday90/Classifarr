/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { formatDaysConfig, parseDaysConfig } from '../utils/backfillHelpers.mjs';

describe('backfillHelpers', () => {
    test('parseDaysConfig returns default days when input is missing or unsupported', () => {
        expect(parseDaysConfig()).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(parseDaysConfig(null)).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(parseDaysConfig({ bad: true })).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    test('parseDaysConfig handles arrays and comma-separated strings', () => {
        expect(parseDaysConfig([1, '3', '5'])).toEqual([1, 3, 5]);
        expect(parseDaysConfig('0,2,4,6')).toEqual([0, 2, 4, 6]);
    });

    test('formatDaysConfig returns defaults for invalid input and joins arrays', () => {
        expect(formatDaysConfig()).toBe('0,1,2,3,4,5,6');
        expect(formatDaysConfig(null)).toBe('0,1,2,3,4,5,6');
        expect(formatDaysConfig('bad')).toBe('0,1,2,3,4,5,6');
        expect(formatDaysConfig([1, 3, 5])).toBe('1,3,5');
    });
});