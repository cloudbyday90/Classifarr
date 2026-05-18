import { jest } from '@jest/globals';

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

jest.unstable_mockModule('../../utils/logger.mjs', () => ({
    createLogger: jest.fn(() => mockLogger)
}));

const { aiResponseParser } = await import('../../services/aiResponseParser.mjs');

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
            expect(result.confidence).toBe(85);
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

        it('turns verify-mode CONFIRM disagreement into clarification instead of confirming a different library', () => {
            const response = 'CONFIRM|2|Drama signals are stronger than the suggested action profile';
            const context = {
                libraries: mockLibraries,
                signalContext: mockSignalContext,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context, { mode: 'verify' });

            expect(result.format).toBe('verify_disagreement');
            expect(result.needs_clarification).toBe(true);
            expect(result.library).toEqual(mockSignalContext.suggestedLibrary);
            expect(result.policy_question.meta.conflicting_library_name).toBe('Drama Movies');
            expect(result.policy_question.options[0].library_name).toBe('Action Movies');
            expect(result.policy_question.options.map(option => option.library_name)).toContain('Drama Movies');
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
            expect(result1.confidence).toBe(50);

            const response2 = 'CONFIDENT|1|99|Too high confidence';
            const result2 = aiResponseParser.parse(response2, {
                libraries: mockLibraries,
                metadata: mockMetadata
            });
            expect(result2.confidence).toBe(95);
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
            const response = 'CLARIFY|Test|Why|Question|Unknown Library|Review manually';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

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

        it('should parse CLARIFY options with LLM-style numbered prefixes and populate library_id', () => {
            const response = 'CLARIFY|Genre ambiguity|Signals conflict between action and drama|Which library is correct?|1. Action Movies|2. Drama Movies';
            const context = {
                libraries: mockLibraries,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.format).toBe('clarify');
            expect(result.needs_clarification).toBe(true);
            expect(result.clarification.options).toHaveLength(2);
            expect(result.clarification.options[0].library_id).toBe(1);
            expect(result.clarification.options[0].library_name).toBe('Action Movies');
            expect(result.clarification.options[1].library_id).toBe(2);
            expect(result.clarification.options[1].library_name).toBe('Drama Movies');
        });

        it('should deduplicate options that resolve to the same library through the parse() pipeline', () => {
            const response = 'CLARIFY|Ambiguous|Both options are the same library|Which do you prefer?|Action Movies|action movies';
            const context = {
                libraries: mockLibraries,
                signalContext: mockSignalContext,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.format).toBe('contract_violation');
            expect(result.policy_question.meta.violation_reason).toBe('single_valid_option');
            expect(result.policy_question.meta.matched_option_count).toBe(1);
        });

        it('should parse CLARIFY format with numeric library indices (new prompt format)', () => {
            const response = 'CLARIFY|Genre ambiguity|Could be action or family|Is this action or family content?|1|4';
            const context = {
                libraries: mockLibraries,
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
            const response = 'CLARIFY|Uncertain|Mixed signals|Which library?|1|99';
            const context = {
                libraries: mockLibraries,
                signalContext: mockSignalContext,
                metadata: mockMetadata
            };

            const result = aiResponseParser.parse(response, context);

            expect(result.format).toBe('contract_violation');
            expect(result.policy_question.meta.violation_reason).toBe('single_valid_option');
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('CLARIFY option index out of range'),
                expect.objectContaining({
                    index: 99,
                    libraryCount: mockLibraries.length
                })
            );
        });

        it('should fall through to contract_violation when CLARIFY options are all unrecognized in classify mode', () => {
            const response = 'CLARIFY|Genre unclear|Could be documentary or biography|What genre is this?|Documentary|Biography|Nature';
            const context = {
                libraries: mockLibraries,
                signalContext: mockSignalContext,
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
            expect(result.policy_question.meta.violation_reason).toBe('narrative_no_format_match');
            expect(result.policy_question.why_uncertain).toContain('narrative text instead of the required response contract format');
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('malformed'), expect.any(Object));
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Salvaged malformed AI response into structured clarification'),
                expect.objectContaining({
                    title: 'Test Movie',
                    format: 'contract_violation'
                })
            );
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
            expect(result.policy_question.meta.violation_reason).toBe('narrative_no_format_match');
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
            expect(result.policy_question.meta.violation_reason).toBe('narrative_no_format_match');
            expect(result.policy_question.why_uncertain).toContain('narrative text instead of the required response contract format');
        });

        it('should use generic invalid-response wording for non-narrative contract violations', () => {
            const result = aiResponseParser.createContractViolationResult({
                libraries: mockLibraries,
                metadata: mockMetadata,
                signalContext: mockSignalContext,
            }, {
                violationReason: 'no_format_matched',
            });

            expect(result.policy_question.meta.violation_reason).toBe('no_format_matched');
            expect(result.policy_question.why_uncertain).toContain('invalid classification response that did not match the required response contract');
            expect(result.policy_question.why_uncertain).not.toContain('narrative text instead');
        });

        it('should salvage narrative disagreement in verify mode using signalContext.suggestedLibrary', () => {
            const libraries = [
                { id: 1, name: 'Comedy and Standup', media_type: 'tv' },
                { id: 2, name: 'Documentary', media_type: 'tv' },
                { id: 3, name: 'Family', media_type: 'tv' },
            ];
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
            expect(result.library.name).toBe('Comedy and Standup');
            expect(result.policy_question.question).toContain('Comedy and Standup');
            expect(result.policy_question.question).toContain('disagreed');
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
                signalContext: { confidence: 50 }
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

            expect(result.id).toBe(3);
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

        it('keeps the default suggested library inside the selectable fallback options', () => {
            const libraries = [
                { id: 1, name: 'Action', media_type: 'movie' },
                { id: 2, name: 'Drama', media_type: 'movie' },
                { id: 3, name: 'Family', media_type: 'movie' },
                { id: 4, name: 'Comedy', media_type: 'movie' },
                { id: 5, name: 'Movies', media_type: 'movie' }
            ];

            const result = aiResponseParser.createFallbackResult(libraries, {
                title: 'Fallback Test',
                media_type: 'movie'
            });

            expect(result.library).toEqual(expect.objectContaining({ id: 5, name: 'Movies' }));
            expect(result.clarification.options[0]).toEqual(expect.objectContaining({
                library_id: 5,
                library_name: 'Movies'
            }));
            expect(result.clarification.options.map(option => option.library_id)).toContain(5);
            expect(result.clarification.options).toHaveLength(4);
        });

        it('should handle missing metadata', () => {
            const result = aiResponseParser.createFallbackResult(mockLibraries, null);

            expect(result.clarification.question).toContain('this item');
        });
    });
});
