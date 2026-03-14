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

            const result = aiResponseParser.parse(response, context, { mode: 'classify' });

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

            const result = aiResponseParser.parse(response, context, { mode: 'classify' });

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
            const response = 'CLARIFY|Uncertain content type|Mixed signals from genres|What type is this?|Action Movies|Documentaries|Family Movies';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.clarification.options).toHaveLength(3);
            expect(result.clarification.options[0].label).toBe('Action Movies');
            expect(result.clarification.options[2].label).toBe('Family Movies');
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

        it('should fall through when all options fail to match a library', () => {
            // If the AI suggests library names that don't exist, parseClarifyFormat
            // drops all options and returns null, so parse() falls through to a
            // fallback result rather than storing broken options with null library_id.
            const response = 'CLARIFY|Test|Why|Question|Unknown Library|Review manually';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            // Should NOT produce a clarify result with null library IDs
            expect(result.format).not.toBe('clarify');
        });

        it('should include signal context in policy question', () => {
            const response = 'CLARIFY|Test|Why|Question|Action Movies|Drama Movies';
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
            const response = 'CLARIFY|Test|Why|Question|Action Movies|Drama Movies';
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

        // ── Pipeline tests: prefix-stripping + dedup through the full parse() chain ──

        it('should parse CLARIFY options with LLM-style numbered prefixes and populate library_id', () => {
            // Reproduces the Bug 3 scenario: LLM returns "1. Action Movies" instead of
            // "Action Movies". Verifies the prefix-strip fix is wired all the way through
            // parseClarifyFormat → mapOptionsToLibraries → library lookup.
            const response = 'CLARIFY|Genre ambiguity|Signals conflict between action and drama|Which library is correct?|1. Action Movies|2. Drama Movies';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.format).toBe('clarify');
            expect(result.needs_clarification).toBe(true);
            expect(result.clarification.options).toHaveLength(2);
            // Options must resolve to real library IDs — not null
            expect(result.clarification.options[0].library_id).toBe(1);
            expect(result.clarification.options[0].library_name).toBe('Action Movies');
            expect(result.clarification.options[1].library_id).toBe(2);
            expect(result.clarification.options[1].library_name).toBe('Drama Movies');
        });

        it('should deduplicate options that resolve to the same library through the parse() pipeline', () => {
            // LLM offers "Action Movies" and "action movies" — both strip/match to id:1.
            // After dedup, only one option should survive; parseClarifyFormat requires ≥2
            // distinct libraries, so the result must fall through rather than present a
            // single-choice clarification that the user cannot meaningfully act on.
            const response = 'CLARIFY|Ambiguous|Both options are the same library|Which do you prefer?|Action Movies|action movies';
            const context = {
                libraries: mockLibraries,
                signalContext: mockSignalContext,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            // Only 1 distinct library after dedup → parseClarifyFormat returns null
            // → falls through to narrative salvage (signalContext present) or fallback
            expect(result.format).not.toBe('clarify');
        });

        it('should parse CLARIFY format with numeric library indices (new prompt format)', () => {
            // Regression test: the new prompt format emits "CLARIFY|...|1|3" using library
            // numbers instead of free-text names. _resolveOptionsFromTokens must resolve them
            // to real library objects without going through text matching.
            const response = 'CLARIFY|Genre ambiguity|Could be action or family|Is this action or family content?|1|4';
            const context = {
                libraries: mockLibraries, // id:1 = Action Movies, id:4 = Family Movies
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.format).toBe('clarify');
            expect(result.clarification.options).toHaveLength(2);
            expect(result.clarification.options[0].library_id).toBe(1);
            expect(result.clarification.options[0].library_name).toBe('Action Movies');
            expect(result.clarification.options[0].label).toBe('Action Movies');
            expect(result.clarification.options[1].library_id).toBe(4);
            expect(result.clarification.options[1].library_name).toBe('Family Movies');
        });

        it('should drop out-of-range numeric index and fall through when < 2 options remain', () => {
            // AI returns index 99 (doesn't exist) + index 1 → only 1 valid option → fall through
            const response = 'CLARIFY|Uncertain|Mixed signals|Which library?|1|99';
            const context = {
                libraries: mockLibraries,
                signalContext: mockSignalContext,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.format).not.toBe('clarify');
        });

        it('should fall through to contract_violation when CLARIFY options are all unrecognized in classify mode', () => {
            // Bug 4 scenario: AI invents genre names as options. After mapOptionsToLibraries
            // drops all of them, parseClarifyFormat returns null and parse() continues to
            // malformed-response handling. In classify mode this must now produce a
            // deterministic contract_violation clarification anchored to pre-calculated
            // candidates rather than trusting narrative prose.
            const response = 'CLARIFY|Genre unclear|Could be documentary or biography|What genre is this?|Documentary|Biography|Nature';
            const context = {
                libraries: mockLibraries, // none of those genre names exist
                signalContext: mockSignalContext, // has suggestedLibrary
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context, { mode: 'classify' });

            expect(result.format).toBe('contract_violation');
            expect(result.needs_clarification).toBe(true);
            expect(result.library.name).toBe('Action Movies');
            expect(result.policy_question.problem_summary).toBe('AI response contract violation');
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

        it('should reject CONFIDENT format in verify mode', () => {
            const response = 'CONFIDENT|1|85|Should not be accepted in verify mode';
            const context = {
                libraries: mockLibraries,
                signalContext: mockSignalContext,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context, { mode: 'verify' });

            // CONFIDENT is not a valid verify-mode format.
            // Because signalContext.suggestedLibrary is present, the narrative
            // salvage path fires and produces a clarification (narrative_clarify)
            // rather than a raw fallback — the user still gets to decide.
            expect(result.format).toBe('narrative_clarify');
            expect(result.needs_clarification).toBe(true);
            expect(result.library.name).toBe('Action Movies');
        });

        it('should fall back to CLARIFY when others are not present', () => {
            const response = 'CLARIFY|Problem|Why|Question|Action Movies|Drama Movies';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.format).toBe('clarify');
            expect(result.needs_clarification).toBe(true);
        });

        it('should return contract_violation for malformed classify response', () => {
            const response = 'This is not a valid format';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.format).toBe('contract_violation');
            expect(result.needs_clarification).toBe(true);
            expect(result.confidence).toBe(50);
            expect(result.clarification.problem_summary).toBe('AI response contract violation');
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('malformed'), expect.any(Object));
        });

        it('should handle null response', () => {
            const result = aiResponseParser.parse(null, {
                libraries: mockLibraries,
                metadata: mockMetadata
            });

            expect(result.format).toBe('fallback');
            expect(result.parse_failure_reason).toBe('invalid_response');
            expect(result.needs_clarification).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid AI response'), expect.any(Object));
        });

        it('should handle empty response', () => {
            const result = aiResponseParser.parse('', {
                libraries: mockLibraries,
                metadata: mockMetadata
            });

            expect(result.format).toBe('fallback');
            expect(result.parse_failure_reason).toBe('invalid_response');
            expect(result.needs_clarification).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid AI response'), expect.any(Object));
        });

        it('should support suppressing malformed logs via options', () => {
            const response = 'This is not a valid format';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context, {
                mode: 'classify',
                logMalformed: false,
                logInvalid: false
            });

            expect(result.format).toBe('contract_violation');
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should convert malformed classify prose into contract_violation using deterministic candidates', () => {
            const libraries = [
                { id: 11, name: 'TV Shows', media_type: 'tv' },
                { id: 12, name: 'Movies', media_type: 'movie' },
            ];
            const response = 'The item is a TV show. The confidence score is low, and the suggested library is "TV Shows".';
            const context = {
                libraries,
                metadata: { title: 'DTF St. Louis', media_type: 'tv' },
                signalContext: {
                    confidence: 62,
                    suggestedLibrary: { id: 12, name: 'Movies' },
                    breakdown: [{ type: 'genre_match', score: 62, weight: 10 }]
                }
            };

            const result = aiResponseParser.parse(response, context, { mode: 'classify' });

            expect(result.format).toBe('contract_violation');
            expect(result.needs_clarification).toBe(true);
            expect(result.library).toEqual(expect.objectContaining({ id: 12, name: 'Movies' }));
            expect(result.confidence).toBe(62);
            expect(result.policy_question.question).toContain('Movies');
            expect(result.policy_question.meta.suggested_library_name).toBe('Movies');
        });

        it('should not extract a lead library from malformed classify prose when no deterministic suggestion exists', () => {
            const libraries = [
                { id: 11, name: 'TV Shows', media_type: 'tv' },
                { id: 12, name: 'Movies', media_type: 'movie' },
            ];
            const response = 'The item is a TV show. The suggested library is "TV Shows".';
            const context = {
                libraries,
                metadata: { title: 'DTF St. Louis', media_type: 'movie' }
            };

            const result = aiResponseParser.parse(response, context, { mode: 'classify' });

            expect(result.format).toBe('contract_violation');
            expect(result.library).toEqual(expect.objectContaining({ id: 12, name: 'Movies' }));
            expect(result.policy_question.question).toContain('Movies');
            expect(result.policy_question.question).not.toContain('TV Shows');
        });

        it('should handle malformed classify prose from production incident without inventing a lead library', () => {
            const libraries = [
                { id: 56, name: 'Comedy and Standup', media_type: 'movie' },
                { id: 57, name: 'Family', media_type: 'movie' },
                { id: 58, name: 'Movies', media_type: 'movie' }
            ];
            const response = `The item is a documentary movie. The library profile doesn't strongly align with documentaries, but the calculated confidence is low, indicating a possible fit for the general "Movies" library. The "p`;
            const context = {
                libraries,
                metadata: { title: 'Taming the Garden', media_type: 'movie' },
                signalContext: {
                    confidence: 60,
                    suggestedLibrary: { id: 58, name: 'Movies' },
                    breakdown: []
                }
            };

            const result = aiResponseParser.parse(response, context, { mode: 'classify' });

            expect(result.format).toBe('contract_violation');
            expect(result.library.name).toBe('Movies');
            expect(result.policy_question.problem_summary).toBe('AI response contract violation');
            expect(result.pending_reason).toBe('AI response contract violation');
        });

        it('should salvage narrative disagreement in verify mode using signalContext.suggestedLibrary', () => {
            const libraries = [
                { id: 1, name: 'Comedy and Standup', media_type: 'tv' },
                { id: 2, name: 'Documentary', media_type: 'tv' },
                { id: 3, name: 'Family', media_type: 'tv' },
            ];
            // AI response names the suggested library while objecting to it —
            // the salvage path should NOT use this name as the target library
            const response = 'The media item is a nature documentary about Costa Rica. The suggested library is "Comedy and Standup." The confidence score is very low (6%). The library profile shows a strong preference for comedy,';
            const context = {
                libraries,
                metadata: { title: 'World Natural Heritage Costa Rica: Guanacaste National Park', media_type: 'tv' },
                signalContext: {
                    confidence: 6,
                    suggestedLibrary: { id: 1, name: 'Comedy and Standup' },
                    breakdown: []
                }
            };

            const result = aiResponseParser.parse(response, context, { mode: 'verify' });

            expect(result.format).toBe('narrative_clarify');
            expect(result.needs_clarification).toBe(true);
            // Contested library is surfaced as first option so user can confirm or override
            expect(result.library.name).toBe('Comedy and Standup');
            expect(result.policy_question.question).toContain('Comedy and Standup');
            expect(result.policy_question.question).toContain('disagreed');
            // Alternatives from library list are included
            const optionNames = result.policy_question.options.map(o => o.library_name);
            expect(optionNames).toContain('Comedy and Standup');
            expect(optionNames.length).toBeGreaterThanOrEqual(2);
        });

        it('should return fallback in verify mode when narrative response lacks signalContext.suggestedLibrary', () => {
            const libraries = [{ id: 1, name: 'Movies', media_type: 'movie' }];
            const response = 'This is some narrative response without useful content.';
            const context = {
                libraries,
                metadata: { title: 'Some Movie' },
                signalContext: { confidence: 50 }  // no suggestedLibrary
            };

            const result = aiResponseParser.parse(response, context, { mode: 'verify' });

            expect(result.format).toBe('fallback');
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

        it('should prioritize exact match over partial match', () => {
            const trickyLibraries = [
                { id: 10, name: 'Anime Movies', media_type: 'movie' },
                { id: 11, name: 'Movies', media_type: 'movie' },
            ];

            const options = aiResponseParser.mapOptionsToLibraries(
                ['Movies'],
                trickyLibraries
            );

            expect(options[0].library_id).toBe(11);
            expect(options[0].library_name).toBe('Movies');
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

        it('should filter out unmatched options', () => {
            // Unmatched library names are dropped rather than stored with null library_id
            const options = aiResponseParser.mapOptionsToLibraries(
                ['Unknown Library', 'Review manually'],
                mockLibraries
            );

            expect(options).toHaveLength(0);
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
