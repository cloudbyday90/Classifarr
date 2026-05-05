/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for PromptBuilder service
 */

import { jest } from '@jest/globals';

const mockDb = { query: jest.fn() };
const mockLoggerObj = {
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
};
const mockLibraryProfileService = {
  getProfileStats: jest.fn(),
  formatForPrompt: jest.fn()
};

jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLoggerObj, default: mockLoggerObj }));

jest.unstable_mockModule('../services/libraryProfileService.mjs', () => ({ ...mockLibraryProfileService, default: mockLibraryProfileService }));

const libraryProfileService = mockLibraryProfileService;
const { default: promptBuilder } = await import('../services/promptBuilder.mjs');

describe('PromptBuilder', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('formatItemForPrompt', () => {
        it('should format basic item information', () => {
            const item = {
                title: 'Test Movie',
                year: 2024,
                media_type: 'movie',
                certification: 'PG-13'
            };

            const formatted = promptBuilder.formatItemForPrompt(item);

            expect(formatted).toContain('=== MEDIA ITEM TO CLASSIFY ===');
            expect(formatted).toContain('Title: Test Movie');
            expect(formatted).toContain('Year: 2024');
            expect(formatted).toContain('Type: movie');
            expect(formatted).toContain('Rating: PG-13');
        });

        it('should handle genres as array', () => {
            const item = {
                title: 'Test Movie',
                genres: ['Action', 'Adventure', 'Sci-Fi']
            };

            const formatted = promptBuilder.formatItemForPrompt(item);

            expect(formatted).toContain('Genres: Action, Adventure, Sci-Fi');
        });

        it('should handle genres as JSON string', () => {
            const item = {
                title: 'Test Movie',
                genres: '["Drama", "Thriller"]'
            };

            const formatted = promptBuilder.formatItemForPrompt(item);

            expect(formatted).toContain('Genres: Drama, Thriller');
        });

        it('should format object-shaped genres and keywords using their names', () => {
            const item = {
                title: 'Test Movie',
                genres: [{ id: 1, name: 'Drama' }, { id: 2, name: 'Thriller' }],
                keywords: [{ id: 3, name: 'character study' }, { id: 4, name: 'slow burn' }]
            };

            const formatted = promptBuilder.formatItemForPrompt(item);

            expect(formatted).toContain('Genres: Drama, Thriller');
            expect(formatted).toContain('Keywords: character study, slow burn');
        });

        it('should include overview if present', () => {
            const item = {
                title: 'Test Movie',
                overview: 'A thrilling adventure about testing code.'
            };

            const formatted = promptBuilder.formatItemForPrompt(item);

            expect(formatted).toContain('Overview: A thrilling adventure about testing code.');
        });

        it('should handle keywords as array', () => {
            const item = {
                title: 'Test Movie',
                keywords: ['action', 'adventure', 'sci-fi', 'space', 'aliens']
            };

            const formatted = promptBuilder.formatItemForPrompt(item);

            expect(formatted).toContain('Keywords: action, adventure, sci-fi, space, aliens');
        });

        it('should limit keywords to 10', () => {
            const item = {
                title: 'Test Movie',
                keywords: Array.from({ length: 15 }, (_, i) => `keyword${i}`)
            };

            const formatted = promptBuilder.formatItemForPrompt(item);

            // Should only include first 10
            expect(formatted).toContain('keyword0');
            expect(formatted).toContain('keyword9');
            expect(formatted).not.toContain('keyword10');
        });

        it('should handle studios as array', () => {
            const item = {
                title: 'Test Movie',
                studios: ['Warner Bros', 'Universal']
            };

            const formatted = promptBuilder.formatItemForPrompt(item);

            expect(formatted).toContain('Studios: Warner Bros, Universal');
        });

        it('should handle studios as objects with name property', () => {
            const item = {
                title: 'Test Movie',
                production_companies: [
                    { id: 1, name: 'Pixar' },
                    { id: 2, name: 'Disney' }
                ]
            };

            const formatted = promptBuilder.formatItemForPrompt(item);

            expect(formatted).toContain('Studios: Pixar, Disney');
        });

        it('should handle missing fields gracefully', () => {
            const item = {
                title: 'Minimal Movie'
            };

            const formatted = promptBuilder.formatItemForPrompt(item);

            expect(formatted).toContain('Title: Minimal Movie');
            expect(formatted).toContain('==============================');
            // Should not crash or include undefined
            expect(formatted).not.toContain('undefined');
        });

        it('should handle empty arrays', () => {
            const item = {
                title: 'Test Movie',
                genres: [],
                keywords: [],
                studios: []
            };

            const formatted = promptBuilder.formatItemForPrompt(item);

            expect(formatted).toContain('Title: Test Movie');
            // Should not include empty sections
            expect(formatted).not.toContain('Genres:');
            expect(formatted).not.toContain('Keywords:');
            expect(formatted).not.toContain('Studios:');
        });
    });

    describe('buildClassificationPrompt', () => {
        it('should build prompt without profile when libraryId not provided', async () => {
            const item = {
                title: 'Test Movie',
                year: 2024
            };

            const prompt = await promptBuilder.buildClassificationPrompt(item, null);

            expect(prompt).toContain('=== MEDIA ITEM TO CLASSIFY ===');
            expect(prompt).toContain('Title: Test Movie');
            expect(libraryProfileService.getProfileStats).not.toHaveBeenCalled();
        });

        it('should build prompt with profile when libraryId provided', async () => {
            const item = {
                title: 'Test Movie',
                year: 2024
            };

            libraryProfileService.getProfileStats.mockResolvedValue({
                totalItems: 100,
                certificationDistribution: [],
                genreDistribution: [],
                studioDistribution: [],
                languageDistribution: []
            });

            libraryProfileService.formatForPrompt.mockReturnValue('=== PROFILE STATS ===');

            const prompt = await promptBuilder.buildClassificationPrompt(item, 1);

            expect(libraryProfileService.getProfileStats).toHaveBeenCalledWith(1);
            expect(libraryProfileService.formatForPrompt).toHaveBeenCalled();
            expect(prompt).toContain('=== PROFILE STATS ===');
            expect(prompt).toContain('=== MEDIA ITEM TO CLASSIFY ===');
        });

        it('should skip profile when includeProfile is false', async () => {
            const item = {
                title: 'Test Movie'
            };

            const prompt = await promptBuilder.buildClassificationPrompt(item, 1, { includeProfile: false });

            expect(libraryProfileService.getProfileStats).not.toHaveBeenCalled();
            expect(prompt).toContain('=== MEDIA ITEM TO CLASSIFY ===');
        });

        it('should include custom instructions when provided', async () => {
            const item = {
                title: 'Test Movie'
            };

            const prompt = await promptBuilder.buildClassificationPrompt(item, null, {
                instructions: 'Classify this item carefully.'
            });

            expect(prompt).toContain('Classify this item carefully.');
        });

        it('should handle profile fetch errors gracefully', async () => {
            const item = {
                title: 'Test Movie'
            };

            libraryProfileService.getProfileStats.mockRejectedValue(new Error('Database error'));

            const prompt = await promptBuilder.buildClassificationPrompt(item, 1);

            // Should still return a valid prompt
            expect(prompt).toContain('=== MEDIA ITEM TO CLASSIFY ===');
            expect(prompt).toContain('Title: Test Movie');
        });

        it('should skip profile when totalItems is 0', async () => {
            const item = {
                title: 'Test Movie'
            };

            libraryProfileService.getProfileStats.mockResolvedValue({
                totalItems: 0,
                certificationDistribution: [],
                genreDistribution: [],
                studioDistribution: [],
                languageDistribution: []
            });

            const prompt = await promptBuilder.buildClassificationPrompt(item, 1);

            expect(libraryProfileService.getProfileStats).toHaveBeenCalledWith(1);
            expect(libraryProfileService.formatForPrompt).not.toHaveBeenCalled();
            expect(prompt).toContain('=== MEDIA ITEM TO CLASSIFY ===');
        });
    });
});