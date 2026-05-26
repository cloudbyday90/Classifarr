import { jest } from '@jest/globals';
import { createMockLogger } from './helpers/mockFactory.mjs';

const mockLogger = createMockLogger();
jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: jest.fn(() => mockLogger)
}));

const { aiResponseParser: parser } = await import('../services/aiResponseParser.mjs');

describe('AIResponseParser', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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

        it('strips trailing "library" noise word', () => {
            const result = parser.mapOptionsToLibraries(['Movies Library'], libraries);
            expect(result[0].library_name).toBe('Movies');
        });

        it('strips trailing "content" noise word', () => {
            const result = parser.mapOptionsToLibraries(['Movies Content'], libraries);
            expect(result[0].library_name).toBe('Movies');
        });

        it('matches via partial contains when exact fails', () => {
            const result = parser.mapOptionsToLibraries(['Anime content'], libraries);
            expect(result[0].library_name).toBe('Anime Movies');
        });

        it('drops options with no matching library and logs a debug entry', () => {
            const result = parser.mapOptionsToLibraries(['Documentary'], libraries);
            expect(result).toHaveLength(0);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('does not match any known library'),
                expect.objectContaining({ suggested: 'Documentary' })
            );
        });

        it('drops numbered-prefix option when stripped name still has no match', () => {
            const result = parser.mapOptionsToLibraries(['1. Documentary'], libraries);
            expect(result).toHaveLength(0);
            expect(mockLogger.debug).toHaveBeenCalledWith(
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
            const result = parser.mapOptionsToLibraries(['Movies', 'movies'], libraries);
            expect(result).toHaveLength(1);
            expect(result[0].library_name).toBe('Movies');
        });

        it('deduplicates across prefix-stripped variants resolving to the same library', () => {
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

        it('matches library when option is wrapped in double quotes', () => {
            const result = parser.mapOptionsToLibraries(['"Movies"'], libraries);
            expect(result).toHaveLength(1);
            expect(result[0].library_name).toBe('Movies');
        });

        it('matches library when option is wrapped in single quotes', () => {
            const result = parser.mapOptionsToLibraries(["'Family'"], libraries);
            expect(result).toHaveLength(1);
            expect(result[0].library_name).toBe('Family');
        });

        it('matches library when option has prefix AND surrounding quotes combined', () => {
            const result = parser.mapOptionsToLibraries(['1. "Movies"'], libraries);
            expect(result).toHaveLength(1);
            expect(result[0].library_name).toBe('Movies');
        });

        it('drops quoted option when stripped name still has no match', () => {
            const result = parser.mapOptionsToLibraries(['"Documentaries"'], libraries);
            expect(result).toHaveLength(0);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('does not match any known library'),
                expect.objectContaining({ suggested: '"Documentaries"' })
            );
        });
    });

    describe('parse', () => {
        const libraries = makeLibraries(['Movies', 'Family', 'Comedy and Standup', 'Anime Movies']);
        const context = { libraries, metadata: { title: 'Test Title', media_type: 'movie' } };

        it('successfully parses a clean CONFIDENT format', () => {
            const response = 'CONFIDENT|3|95|Matches Comedy';
            const result = parser.parse(response, context);
            expect(result).toMatchObject({
                library: { name: 'Comedy and Standup' },
                confidence: 95,
                reason: 'AI: Matches Comedy',
                needs_clarification: false,
                format: 'confident'
            });
        });

        it('successfully parses a dirty Gemma-style CONFIDENT response with percent sign and markdown', () => {
            const response = '**CONFIDENT**|3|95%|Matches Comedy';
            const result = parser.parse(response, context);
            expect(result).toMatchObject({
                library: { name: 'Comedy and Standup' },
                confidence: 95,
                reason: 'AI: Matches Comedy',
                needs_clarification: false,
                format: 'confident'
            });
        });

        it('safely rounds decimal confidence scores', () => {
            const response = 'CONFIDENT|3|94.7|Matches Comedy';
            const result = parser.parse(response, context);
            expect(result.confidence).toBe(95);
        });

        it('successfully parses CONFIRM verify-mode with preambles and dirty library index', () => {
            const verifyContext = {
                libraries,
                metadata: { title: 'Test Title', media_type: 'movie' },
                signalContext: {
                    confidence: 85,
                    suggestedLibrary: libraries[2] // Comedy and Standup
                }
            };
            const response = 'Based on analysis:\n\nCONFIRM| (3) | Verification matches';
            const result = parser.parse(response, verifyContext, { mode: 'verify' });
            expect(result).toMatchObject({
                library: { name: 'Comedy and Standup' },
                confidence: 85,
                reason: 'AI verified: Verification matches',
                needs_clarification: false,
                verified_by_ai: true,
                format: 'confirm'
            });
        });

        it('successfully parses a native JSON CONFIDENT response', () => {
            const response = JSON.stringify({
                decision: 'CONFIDENT',
                library_number: 3,
                confidence: 90,
                reason: 'The item fits the Comedy and Standup library profile.'
            });
            const result = parser.parse(response, context);
            expect(result).toMatchObject({
                library: { name: 'Comedy and Standup' },
                confidence: 90,
                reason: 'AI: The item fits the Comedy and Standup library profile.',
                needs_clarification: false,
                format: 'confident'
            });
        });

        it('successfully parses a native JSON CONFIRM response in verify mode', () => {
            const verifyContext = {
                libraries,
                metadata: { title: 'Test Title', media_type: 'movie' },
                signalContext: {
                    confidence: 85,
                    suggestedLibrary: libraries[2] // Comedy and Standup
                }
            };
            const response = JSON.stringify({
                decision: 'CONFIRM',
                library_number: 3,
                reason: 'Verification matches comedy signals.'
            });
            const result = parser.parse(response, verifyContext, { mode: 'verify' });
            expect(result).toMatchObject({
                library: { name: 'Comedy and Standup' },
                confidence: 85,
                reason: 'AI verified: Verification matches comedy signals.',
                needs_clarification: false,
                verified_by_ai: true,
                format: 'confirm'
            });
        });

        it('successfully parses a native JSON CLARIFY response', () => {
            const response = JSON.stringify({
                decision: 'CLARIFY',
                problem_summary: 'Genre ambiguity',
                why_uncertain: 'Matches both comedy and anime profiles',
                question: 'Which library is correct?',
                options: [3, 4]
            });
            const result = parser.parse(response, context);
            expect(result.needs_clarification).toBe(true);
            expect(result.clarification.problem_summary).toBe('Genre ambiguity');
            expect(result.clarification.options).toHaveLength(2);
            expect(result.clarification.options[0].label).toBe('Comedy and Standup');
            expect(result.clarification.options[1].label).toBe('Anime Movies');
        });

        it('returns null and falls back when JSON decision is invalid', () => {
            const response = JSON.stringify({
                decision: 'INVALID_DECISION'
            });
            const result = parser.parse(response, context);
            expect(result.format).toBe('contract_violation'); // salvage narrative / violation fallback
        });

        it('returns contract_violation with validation_failed when Zod validation fails due to missing properties', () => {
            const response = JSON.stringify({
                decision: 'CONFIDENT',
                confidence: 90
                // missing library_number and reason
            });
            const result = parser.parse(response, context);
            expect(result.format).toBe('contract_violation');
            expect(result.policy_question.meta.violation_reason).toBe('validation_failed');
            expect(result.validation_errors).toContain('library_number is required');
            expect(result.validation_errors).toContain('reason explanation is required');
        });

        it('returns contract_violation with validation_failed when library index is out of bounds', () => {
            const response = JSON.stringify({
                decision: 'CONFIDENT',
                library_number: 99, // out of bounds (max is 4)
                confidence: 90,
                reason: 'Looks comedy'
            });
            const result = parser.parse(response, context);
            expect(result.format).toBe('contract_violation');
            expect(result.policy_question.meta.violation_reason).toBe('validation_failed');
            expect(result.validation_errors).toContain('Number must be less than or equal to 4');
        });
    });
});
