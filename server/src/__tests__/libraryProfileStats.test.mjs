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
        jest.clearAllMocks();
    });

    describe('getCertificationDistribution', () => {
        it('should return certification distribution with percentages', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { certification: 'PG', count: '75', percentage: '75.0' },
                    { certification: 'G', count: '25', percentage: '25.0' }
                ]
            });

            const result = await libraryProfileService.getCertificationDistribution(1);

            expect(result).toHaveLength(2);
            expect(result[0].certification).toBe('PG');
            expect(result[0].percentage).toBe('75.0');
        });

        it('should handle errors gracefully', async () => {
            db.query.mockRejectedValueOnce(new Error('Database error'));

            const result = await libraryProfileService.getCertificationDistribution(1);

            expect(result).toEqual([]);
        });
    });

    describe('getGenreDistribution', () => {
        it('should return genre distribution with percentages', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { genre: 'Animation', count: '10', percentage: '50.0' },
                    { genre: 'Comedy', count: '5', percentage: '25.0' },
                    { genre: 'Drama', count: '5', percentage: '25.0' }
                ]
            });

            const result = await libraryProfileService.getGenreDistribution(1);

            expect(result).toHaveLength(3);
            expect(result[0].genre).toBe('Animation');
        });
    });

    describe('getStudioDistribution', () => {
        it('should return top studios with percentages', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { studio: 'Disney', count: '15', percentage: '60.0' },
                    { studio: 'Pixar', count: '10', percentage: '40.0' }
                ]
            });

            const result = await libraryProfileService.getStudioDistribution(1);

            expect(result).toHaveLength(2);
            expect(result[0].studio).toBe('Disney');
        });
    });

    describe('getLanguageDistribution', () => {
        it('should return language distribution', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { language: 'en', count: '80', percentage: '80.0' },
                    { language: 'fr', count: '20', percentage: '20.0' }
                ]
            });

            const result = await libraryProfileService.getLanguageDistribution(1);

            expect(result).toHaveLength(2);
            expect(result[0].language).toBe('en');
        });
    });

    describe('getTotalItems', () => {
        it('should return total item count', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ total: 100 }]
            });

            const result = await libraryProfileService.getTotalItems(1);

            expect(result).toBe(100);
        });

        it('should return 0 if no items', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ total: 0 }]
            });

            const result = await libraryProfileService.getTotalItems(1);

            expect(result).toBe(0);
        });
    });

    describe('getProfileStats', () => {
        it('should aggregate all statistics', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{ certification: 'PG', count: '75', percentage: '75.0' }]
                })
                .mockResolvedValueOnce({
                    rows: [{ genre: 'Animation', count: '10', percentage: '50.0' }]
                })
                .mockResolvedValueOnce({
                    rows: [{ studio: 'Disney', count: '15', percentage: '60.0' }]
                })
                .mockResolvedValueOnce({
                    rows: [{ language: 'en', count: '80', percentage: '80.0' }]
                })
                .mockResolvedValueOnce({
                    rows: [{ total: 100 }]
                });

            const stats = await libraryProfileService.getProfileStats(1);

            expect(stats.certificationDistribution).toHaveLength(1);
            expect(stats.genreDistribution).toHaveLength(1);
            expect(stats.studioDistribution).toHaveLength(1);
            expect(stats.languageDistribution).toHaveLength(1);
            expect(stats.totalItems).toBe(100);
            expect(stats.lastUpdated).toBeDefined();
        });
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
