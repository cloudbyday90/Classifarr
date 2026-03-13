/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for AIResponseParser
 */

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};
jest.mock('../utils/logger', () => ({
    createLogger: jest.fn(() => mockLogger)
}));

describe('AIResponseParser', () => {
    let parser;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        parser = require('../services/aiResponseParser');
    });

    const makeLibraries = (names) =>
        names.map((name, i) => ({ id: i + 1, name }));

    describe('mapOptionsToLibraries', () => {
        const libraries = makeLibraries(['Movies', 'Family', 'Comedy and Standup', 'Anime Movies']);

        it('matches plain library name exactly', () => {
            const result = parser.mapOptionsToLibraries(['Movies'], libraries);
            expect(result).toHaveLength(1);
            expect(result[0].library_name).toBe('Movies');
        });

        it('matches case-insensitively', () => {
            const result = parser.mapOptionsToLibraries(['movies'], libraries);
            expect(result[0].library_name).toBe('Movies');
        });

        // Numbered prefix variants — root cause of the logged bug
        it('strips "N. " numeric prefix before matching', () => {
            const result = parser.mapOptionsToLibraries(['1. Movies', '2. Family'], libraries);
            expect(result).toHaveLength(2);
            expect(result[0].library_name).toBe('Movies');
            expect(result[1].library_name).toBe('Family');
        });

        it('strips double-digit numeric prefix "10. "', () => {
            const result = parser.mapOptionsToLibraries(['10. Movies'], libraries);
            expect(result[0].library_name).toBe('Movies');
        });

        it('strips uppercase alpha prefix "A. "', () => {
            const result = parser.mapOptionsToLibraries(['A. Movies'], libraries);
            expect(result[0].library_name).toBe('Movies');
        });

        it('strips lowercase alpha prefix "a. "', () => {
            const result = parser.mapOptionsToLibraries(['a. Family'], libraries);
            expect(result[0].library_name).toBe('Family');
        });

        it('strips parenthesized numeric prefix "(1) "', () => {
            const result = parser.mapOptionsToLibraries(['(1) Movies'], libraries);
            expect(result[0].library_name).toBe('Movies');
        });

        it('strips bracketed numeric prefix "[2] "', () => {
            const result = parser.mapOptionsToLibraries(['[2] Family'], libraries);
            expect(result[0].library_name).toBe('Family');
        });

        it('strips dash bullet "- "', () => {
            const result = parser.mapOptionsToLibraries(['- Movies'], libraries);
            expect(result[0].library_name).toBe('Movies');
        });

        it('strips bullet character "• "', () => {
            const result = parser.mapOptionsToLibraries(['• Family'], libraries);
            expect(result[0].library_name).toBe('Family');
        });

        it('strips asterisk bullet "* "', () => {
            const result = parser.mapOptionsToLibraries(['* Movies'], libraries);
            expect(result[0].library_name).toBe('Movies');
        });

        // Noise-word stripping (pre-existing behaviour)
        it('strips trailing "library" noise word', () => {
            const result = parser.mapOptionsToLibraries(['Movies Library'], libraries);
            expect(result[0].library_name).toBe('Movies');
        });

        it('strips trailing "content" noise word', () => {
            const result = parser.mapOptionsToLibraries(['Movies Content'], libraries);
            expect(result[0].library_name).toBe('Movies');
        });

        // Partial / contains matching (second pass)
        it('matches via partial contains when exact fails', () => {
            // "Anime content" → optClean = "anime" → libLower.includes("anime") hits "Anime Movies"
            // without also hitting "Movies", so only one match is possible
            const result = parser.mapOptionsToLibraries(['Anime content'], libraries);
            expect(result[0].library_name).toBe('Anime Movies');
        });

        // Unmatched names
        it('drops options with no matching library and logs a warning', () => {
            const result = parser.mapOptionsToLibraries(['Documentary'], libraries);
            expect(result).toHaveLength(0);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('does not match any known library'),
                expect.objectContaining({ suggested: 'Documentary' })
            );
        });

        it('drops numbered-prefix option when stripped name still has no match', () => {
            // "1. Documentary" strips to "documentary", which genuinely does not exist
            const result = parser.mapOptionsToLibraries(['1. Documentary'], libraries);
            expect(result).toHaveLength(0);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('does not match any known library'),
                expect.objectContaining({ suggested: '1. Documentary' })
            );
        });

        it('filters nulls and returns only matched options', () => {
            const result = parser.mapOptionsToLibraries(['1. Movies', '2. Documentary'], libraries);
            expect(result).toHaveLength(1);
            expect(result[0].library_name).toBe('Movies');
        });

        it('deduplicates options that resolve to the same library_id', () => {
            // Two variant names that both fuzzy-match "Movies" — only the first should survive.
            const result = parser.mapOptionsToLibraries(['Movies', 'movies'], libraries);
            expect(result).toHaveLength(1);
            expect(result[0].library_name).toBe('Movies');
        });

        it('deduplicates across prefix-stripped variants resolving to the same library', () => {
            // "1. Family" and "A. Family" both strip to "family" → same library_id
            const result = parser.mapOptionsToLibraries(['1. Family', 'A. Family'], libraries);
            expect(result).toHaveLength(1);
            expect(result[0].library_name).toBe('Family');
        });

        it('returns correct value/label shape', () => {
            const result = parser.mapOptionsToLibraries(['Movies'], libraries);
            expect(result[0]).toMatchObject({
                label: 'Movies',
                library_id: expect.any(Number),
                library_name: 'Movies',
                value: expect.any(String),
            });
        });
    });
});
