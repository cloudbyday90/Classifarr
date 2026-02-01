/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for AIResponseParser service
 */

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// Mock the logger to suppress console warnings
jest.mock('../../utils/logger', () => ({
    createLogger: () => mockLogger,
}));

const aiResponseParser = require('../../services/aiResponseParser');

describe('AIResponseParser', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockLibraries = [
        { id: 1, name: 'Action Movies', media_type: 'movie' },
        { id: 2, name: 'Drama Movies', media_type: 'movie' },
        { id: 3, name: 'Documentaries', media_type: 'movie' },
        { id: 4, name: 'Family Movies', media_type: 'movie' }
    ];

    const mockMetadata = {
        title: 'Test Movie',
        year: 2024,
        media_type: 'movie'
    };

    const mockSignalContext = {
        confidence: 85,
        suggestedLibrary: { id: 1, name: 'Action Movies' },
        breakdown: [
            { type: 'genre_match', score: 70, weight: 10 }
        ],
        hasConflict: false
    };

    describe('parseConfirmFormat', () => {
        it('should parse CONFIRM format with signalContext', () => {
            const response = 'CONFIRM|1|Signals align correctly - Action movie matches library profile';
            const context = {
                libraries: mockLibraries,
                signalContext: mockSignalContext,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.library).toEqual(mockLibraries[0]);
            expect(result.confidence).toBe(85); // Uses pre-calculated confidence
            expect(result.reason).toContain('AI verified');
            expect(result.needs_clarification).toBe(false);
            expect(result.verified_by_ai).toBe(true);
            expect(result.format).toBe('confirm');
        });

        it('should return null when signalContext is missing', () => {
            const response = 'CONFIRM|1|Signals align';
            const context = {
                libraries: mockLibraries,
                signalContext: null,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parseConfirmFormat(response, context);
            expect(result).toBeNull();
        });

        it('should return null for invalid library index', () => {
            const response = 'CONFIRM|99|Invalid index';
            const context = {
                libraries: mockLibraries,
                signalContext: mockSignalContext,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parseConfirmFormat(response, context);
            expect(result).toBeNull();
        });

        it('should return null when format does not match', () => {
            const response = 'CONFIDENT|1|85|Not a confirm format';
            const context = {
                libraries: mockLibraries,
                signalContext: mockSignalContext,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parseConfirmFormat(response, context);
            expect(result).toBeNull();
        });
    });

    describe('parseConfidentFormat', () => {
        it('should parse CONFIDENT format', () => {
            const response = 'CONFIDENT|2|88|Drama movie with strong emotional themes';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.library).toEqual(mockLibraries[1]);
            expect(result.confidence).toBe(88);
            expect(result.reason).toContain('AI: Drama movie');
            expect(result.needs_clarification).toBe(false);
            expect(result.format).toBe('confident');
        });

        it('should clamp confidence to 50-95 range', () => {
            const response1 = 'CONFIDENT|1|30|Too low confidence';
            const result1 = aiResponseParser.parse(response1, {
                libraries: mockLibraries,
                metadata: mockMetadata
            });
            expect(result1.confidence).toBe(50); // Clamped to minimum

            const response2 = 'CONFIDENT|1|99|Too high confidence';
            const result2 = aiResponseParser.parse(response2, {
                libraries: mockLibraries,
                metadata: mockMetadata
            });
            expect(result2.confidence).toBe(95); // Clamped to maximum
        });

        it('should return null for invalid library index', () => {
            const response = 'CONFIDENT|10|88|Invalid index';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parseConfidentFormat(response, context);
            expect(result).toBeNull();
        });

        it('should return null when format does not match', () => {
            const response = 'CLARIFY|Problem|Reason|Question|Opt1|Opt2';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parseConfidentFormat(response, context);
            expect(result).toBeNull();
        });
    });

    describe('parseClarifyFormat', () => {
        it('should parse CLARIFY format with 2 options', () => {
            const response = 'CLARIFY|Genre ambiguity|Content has both Documentary and Drama genres|Is this primarily a documentary or a drama?|Documentaries|Drama Movies';
            const context = {
                libraries: mockLibraries,
                signalContext: mockSignalContext,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.needs_clarification).toBe(true);
            expect(result.clarification.problem_summary).toBe('Genre ambiguity');
            expect(result.clarification.why_uncertain).toContain('Documentary and Drama');
            expect(result.clarification.question).toContain('primarily a documentary');
            expect(result.clarification.options).toHaveLength(2);
            expect(result.clarification.options[0].label).toBe('Documentaries');
            expect(result.clarification.options[1].label).toBe('Drama Movies');
            expect(result.format).toBe('clarify');
        });

        it('should parse CLARIFY format with 3 options', () => {
            const response = 'CLARIFY|Uncertain content type|Mixed signals from genres|What type is this?|Action Movies|Documentaries|Review manually';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.clarification.options).toHaveLength(3);
            expect(result.clarification.options[0].label).toBe('Action Movies');
            expect(result.clarification.options[2].label).toBe('Review manually');
        });

        it('should map options to libraries', () => {
            const response = 'CLARIFY|Test|Why|Question|Action Movies|Drama Movies';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.clarification.options[0].library_id).toBe(1);
            expect(result.clarification.options[0].library_name).toBe('Action Movies');
            expect(result.clarification.options[1].library_id).toBe(2);
            expect(result.clarification.options[1].library_name).toBe('Drama Movies');
        });

        it('should handle options that do not match libraries', () => {
            const response = 'CLARIFY|Test|Why|Question|Unknown Library|Review manually';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.clarification.options[0].library_id).toBeNull();
            expect(result.clarification.options[1].library_id).toBeNull();
        });

        it('should include signal context in policy question', () => {
            const response = 'CLARIFY|Test|Why|Question|Opt1|Opt2';
            const context = {
                libraries: mockLibraries,
                signalContext: mockSignalContext,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.policy_question.signal_breakdown).toEqual(mockSignalContext.breakdown);
            expect(result.policy_question.calculated_confidence).toBe(85);
        });

        it('should use suggested library from signalContext', () => {
            const response = 'CLARIFY|Test|Why|Question|Opt1|Opt2';
            const context = {
                libraries: mockLibraries,
                signalContext: mockSignalContext,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.library).toEqual(mockSignalContext.suggestedLibrary);
            expect(result.confidence).toBe(85);
        });

        it('should return null when format does not match', () => {
            const response = 'CONFIDENT|1|85|Not clarify format';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parseClarifyFormat(response, context);
            expect(result).toBeNull();
        });
    });

    describe('parse (main method)', () => {
        it('should prioritize CONFIRM over other formats', () => {
            const response = 'CONFIRM|1|Verified\nCONFIDENT|2|85|Ignored';
            const context = {
                libraries: mockLibraries,
                signalContext: mockSignalContext,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.format).toBe('confirm');
            expect(result.library).toEqual(mockLibraries[0]);
        });

        it('should fall back to CONFIDENT when CONFIRM is not present', () => {
            const response = 'CONFIDENT|2|85|Drama movie';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.format).toBe('confident');
            expect(result.library).toEqual(mockLibraries[1]);
        });

        it('should fall back to CLARIFY when others are not present', () => {
            const response = 'CLARIFY|Problem|Why|Question|Opt1|Opt2';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.format).toBe('clarify');
            expect(result.needs_clarification).toBe(true);
        });

        it('should return fallback for invalid response', () => {
            const response = 'This is not a valid format';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.format).toBe('fallback');
            expect(result.needs_clarification).toBe(true);
            expect(result.confidence).toBe(50);
            expect(result.clarification.problem_summary).toBe('Unable to auto-classify');
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('malformed'), expect.any(Object));
        });

        it('should handle null response', () => {
            const result = aiResponseParser.parse(null, {
                libraries: mockLibraries,
                metadata: mockMetadata
            });

            expect(result.format).toBe('fallback');
            expect(result.needs_clarification).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid AI response'), expect.any(Object));
        });

        it('should handle empty response', () => {
            const result = aiResponseParser.parse('', {
                libraries: mockLibraries,
                metadata: mockMetadata
            });

            expect(result.format).toBe('fallback');
            expect(result.needs_clarification).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid AI response'), expect.any(Object));
        });
    });

    describe('mapOptionsToLibraries', () => {
        it('should match exact library names', () => {
            const options = aiResponseParser.mapOptionsToLibraries(
                ['Action Movies', 'Drama Movies'],
                mockLibraries
            );

            expect(options[0].library_id).toBe(1);
            expect(options[0].library_name).toBe('Action Movies');
            expect(options[1].library_id).toBe(2);
        });

        it('should match partial library names', () => {
            const options = aiResponseParser.mapOptionsToLibraries(
                ['Action', 'Drama'],
                mockLibraries
            );

            expect(options[0].library_id).toBe(1);
            expect(options[1].library_id).toBe(2);
        });

        it('should handle options with "library" suffix', () => {
            const options = aiResponseParser.mapOptionsToLibraries(
                ['Action library', 'Drama content'],
                mockLibraries
            );

            expect(options[0].library_id).toBe(1);
            expect(options[1].library_id).toBe(2);
        });

        it('should return null for unmatched options', () => {
            const options = aiResponseParser.mapOptionsToLibraries(
                ['Unknown Library', 'Review manually'],
                mockLibraries
            );

            expect(options[0].library_id).toBeNull();
            expect(options[1].library_id).toBeNull();
        });
    });

    describe('getDefaultLibrary', () => {
        it('should find general movie library', () => {
            const libraries = [
                { id: 1, name: 'Action', media_type: 'movie' },
                { id: 2, name: 'Movies', media_type: 'movie' },
                { id: 3, name: 'Drama', media_type: 'movie' }
            ];

            const result = aiResponseParser.getDefaultLibrary(libraries, 'movie');

            expect(result.id).toBe(2);
            expect(result.name).toBe('Movies');
        });

        it('should find general TV library', () => {
            const libraries = [
                { id: 1, name: 'Drama', media_type: 'tv' },
                { id: 2, name: 'TV Shows', media_type: 'tv' },
                { id: 3, name: 'Comedy', media_type: 'tv' }
            ];

            const result = aiResponseParser.getDefaultLibrary(libraries, 'tv');

            expect(result.id).toBe(2);
            expect(result.name).toBe('TV Shows');
        });

        it('should fall back to last library when no general library found', () => {
            const libraries = [
                { id: 1, name: 'Action', media_type: 'movie' },
                { id: 2, name: 'Drama', media_type: 'movie' },
                { id: 3, name: 'Horror', media_type: 'movie' }
            ];

            const result = aiResponseParser.getDefaultLibrary(libraries, 'movie');

            expect(result.id).toBe(3); // Last library
        });

        it('should return null for empty libraries array', () => {
            const result = aiResponseParser.getDefaultLibrary([], 'movie');
            expect(result).toBeNull();
        });
    });

    describe('createFallbackResult', () => {
        it('should create fallback with limited options', () => {
            const result = aiResponseParser.createFallbackResult(mockLibraries, mockMetadata);

            expect(result.format).toBe('fallback');
            expect(result.needs_clarification).toBe(true);
            expect(result.confidence).toBe(50);
            expect(result.clarification.options.length).toBeLessThanOrEqual(4);
            expect(result.clarification.question).toContain('Test Movie');
        });

        it('should handle missing metadata', () => {
            const result = aiResponseParser.createFallbackResult(mockLibraries, null);

            expect(result.clarification.question).toContain('this item');
        });
    });
});
