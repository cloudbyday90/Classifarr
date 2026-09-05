/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for library profile statistics methods (Issue #142)
 */

import { jest } from '@jest/globals';
import { createNamedMockModule, createLoggerModuleMock} from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const db = mockDb;
const { libraryProfileService } = await import('../services/libraryProfileService.mjs');

describe('LibraryProfileService - Profile Statistics', () => {
    beforeEach(() => {
        db.query.mockReset();
    });

    it('projects every live distribution from one observation snapshot', async () => {
        db.query.mockResolvedValueOnce({ rows: [
            { tmdb_id: 7, media_type: 'movie', genres: ['Action', 'Drama', 'Action'], content_rating: 'PG', studio: 'A', metadata: { inventory_tmdb: { version: 1, tmdb_id: 7, media_type: 'movie', keywords: [], original_language: 'en' } } },
            { genres: ['Action'], content_rating: 'G', metadata: {} },
        ] });
        const stats = await libraryProfileService.getProfileStats(1);
        expect(db.query).toHaveBeenCalledTimes(1);
        expect(stats.genreDistribution).toEqual([{ genre: 'Action', count: 2, percentage: 100 }, { genre: 'Drama', count: 1, percentage: 50 }]);
        expect(stats.studioDistribution).toEqual([{ studio: 'A', count: 1, percentage: 50 }]);
        expect(stats.languageDistribution).toEqual([{ language: 'en', count: 1, percentage: 50 }]);
        expect(stats.observation.traits.rating).toEqual({ observedCount: 2, unknownCount: 0 });
        expect(stats.totalItems).toBe(2);
    });
    it.each(['getCertificationDistribution', 'getGenreDistribution', 'getStudioDistribution', 'getLanguageDistribution'])('uses the shared population for %s', async method => {
        db.query.mockResolvedValueOnce({ rows: [{ tmdb_id: 7, media_type: 'movie', genres: ['Action'], content_rating: 'PG', studio: 'A', metadata: { inventory_tmdb: { version: 1, tmdb_id: 7, media_type: 'movie', keywords: [], original_language: 'en' } } }, {}] });
        const values = await libraryProfileService[method](1);
        expect(values).toHaveLength(1);
        expect(values[0]).toMatchObject({ count: 1, percentage: 50 });
    });
    it.each(['getProfileStats', 'getGenreDistribution', 'getTotalItems'])('propagates an unavailable read rather than claiming empty data: %s', async method => {
        db.query.mockRejectedValueOnce(new Error('database unavailable'));
        await expect(libraryProfileService[method](1)).rejects.toThrow('database unavailable');
    });
    it('reads exact inventory count', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ total: 100 }] });
        expect(await libraryProfileService.getTotalItems(1)).toBe(100);
    });

    describe('formatForPrompt', () => {
        it('should format stats as text for AI prompt', () => {
            const stats = {
                totalItems: 100,
                certificationDistribution: [
                    { certification: 'PG', count: 75, percentage: 75.0 }
                ],
                genreDistribution: [
                    { genre: 'Animation', count: 50, percentage: 50.0 }
                ],
                studioDistribution: [
                    { studio: 'Disney', count: 60, percentage: 60.0 }
                ],
                languageDistribution: [
                    { language: 'en', count: 80, percentage: 80.0 }
                ]
            };

            const formatted = libraryProfileService.formatForPrompt(stats);

            expect(formatted).toContain('=== LIBRARY PROFILE STATISTICS ===');
            expect(formatted).toContain('Total items in library: 100');
            expect(formatted).toContain('Content Rating Distribution:');
            expect(formatted).toContain('PG: 75% (75 items)');
            expect(formatted).toContain('Genre Distribution:');
            expect(formatted).toContain('Animation: 50% (50 items)');
            expect(formatted).toContain('Top Studios:');
            expect(formatted).toContain('Disney: 60% (60 items)');
            expect(formatted).toContain('Language Distribution:');
            expect(formatted).toContain('en: 80% (80 items)');
        });

        it('should handle empty distributions', () => {
            const stats = {
                totalItems: 0,
                certificationDistribution: [],
                genreDistribution: [],
                studioDistribution: [],
                languageDistribution: []
            };

            const formatted = libraryProfileService.formatForPrompt(stats);

            expect(formatted).toContain('Total items in library: 0');
            expect(formatted).not.toContain('Content Rating Distribution:');
            expect(formatted).not.toContain('Genre Distribution:');
        });
    });
});
