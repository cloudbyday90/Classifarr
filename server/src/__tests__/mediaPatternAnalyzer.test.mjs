/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

const mockDb = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => ({
    ...mockDb,
    default: mockDb,
}));

const mockLogger = {
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
};
jest.unstable_mockModule('../utils/logger.mjs', () => ({
    ...mockLogger,
    default: mockLogger,
}));

const { default: mediaPatternAnalyzer } = await import('../services/mediaPatternAnalyzer.mjs');

describe('MediaPatternAnalyzer', () => {
    test('extractArrayPattern handles string, name, and tag metadata values', () => {
        const items = [
            { genres: [{ name: 'Documentary' }, { name: 'Family' }] },
            { genres: ['Documentary', 'Family'] },
            { genres: [{ tag: 'Documentary' }] },
            { genres: JSON.stringify([{ name: 'Documentary' }]) },
            { genres: [{ name: 'Documentary' }] },
            { genres: [{ name: 'Family' }, { name: 'Documentary' }] },
            { genres: [{ tag: 'Documentary' }] },
            { genres: ['Family'] },
            { genres: [{ name: 'Family' }] },
            { genres: null }
        ];

        const pattern = mediaPatternAnalyzer.extractArrayPattern(items, 'genres', 'is_one_of', items.length);

        expect(pattern).toBeDefined();
        expect(pattern.values).toContain('Documentary');
        expect(pattern.values).toContain('Family');
        expect(pattern.valueCounts.Documentary).toBe(7);
        expect(pattern.valueCounts.Family).toBe(5);
    });

    test('extractServerDataPattern handles name-shaped array values', () => {
        const items = [
            { emby_data: { labels: [{ name: 'Anime' }] } },
            { jellyfin_data: { labels: [{ tag: 'Anime' }] } },
            { plex_data: { labels: ['Anime'] } }
        ];

        const pattern = mediaPatternAnalyzer.extractServerDataPattern(items, 'labels', 'contains', items.length);

        expect(pattern).toBeDefined();
        expect(pattern.values).toContain('Anime');
        expect(pattern.valueCounts.Anime).toBe(3);
    });

    test('itemMatchesPattern handles name-shaped array values', () => {
        const item = {
            genres: [{ name: 'Documentary' }, { name: 'Family' }]
        };

        expect(mediaPatternAnalyzer.itemMatchesPattern(item, {
            field: 'genres',
            operator: 'is_one_of',
            values: ['Documentary']
        })).toBe(true);

        expect(mediaPatternAnalyzer.itemMatchesPattern(item, {
            field: 'genres',
            operator: 'contains',
            values: ['Docu']
        })).toBe(true);
    });
});
