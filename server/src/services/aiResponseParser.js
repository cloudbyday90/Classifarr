/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const { createLogger } = require('../utils/logger');

const logger = createLogger('AIResponseParser');

/**
 * AIResponseParser - Modular AI response parsing with format handlers
 * 
 * Parses AI classification responses in multiple formats (CONFIRM, CONFIDENT, CLARIFY)
 * and returns structured results. Complements the aiPromptBuilder service.
 * 
 * @see https://github.com/cloudbyday90/Classifarr/issues/212
 */
class AIResponseParser {
    constructor() {
        this.formatParsers = new Map();
        this.registerDefaultParsers();
    }

    /**
     * Register default format parsers
     */
    registerDefaultParsers() {
        this.register('confirm', this.parseConfirmFormat.bind(this));
        this.register('confident', this.parseConfidentFormat.bind(this));
        this.register('clarify', this.parseClarifyFormat.bind(this));
    }

    /**
     * Register a custom format parser
     * @param {string} formatName - Format identifier
     * @param {Function} parser - Parser function
     */
    register(formatName, parser) {
        this.formatParsers.set(formatName, parser);
        logger.debug('Registered format parser', { formatName });
    }

    /**
     * Parse AI response and return structured result
     * @param {string} response - Raw AI response text
     * @param {object} context - Context for parsing (libraries, metadata)
     * @returns {object} Parsed result with library, confidence, reason, etc.
     */
    parse(response, context, options = {}) {
        const { libraries, metadata } = context;
        const mode = options.mode || (context.signalContext ? 'verify' : 'classify');
        const logInvalid = options.logInvalid !== false;
        const logMalformed = options.logMalformed !== false;

        if (!response || typeof response !== 'string') {
            if (logInvalid) {
                logger.warn('Invalid AI response', { response: String(response).substring(0, 100) });
            }
            return this.createFallbackResult(libraries, metadata, {
                parseFailureReason: 'invalid_response'
            });
        }

        // Try each format parser in priority order
        const formatOrder = mode === 'verify'
            ? ['confirm', 'clarify']
            : ['confident', 'clarify'];
        
        for (const formatName of formatOrder) {
            const parser = this.formatParsers.get(formatName);
            if (!parser) continue;

            const result = parser(response, context);
            if (result) {
                logger.debug('Parsed AI response', { 
                    format: formatName,
                    library: result.library?.name,
                    confidence: result.confidence
                });
                return result;
            }
        }

        // Deterministic salvage for malformed responses. Verify mode keeps the existing
        // disagreement clarification path; classify mode now returns an explicit
        // contract violation clarification anchored to deterministic candidates rather
        // than trusting prose-extracted library names.
        const narrativeResult = this.parseNarrativeSuggestion(response, context, mode);
        if (narrativeResult) {
            logger.info('Salvaged malformed AI response into structured clarification', {
                title: metadata?.title,
                library: narrativeResult.library?.name || null,
                format: narrativeResult.format
            });
            return narrativeResult;
        }

        // No format matched - return fallback
        if (logMalformed) {
            logger.warn('AI response malformed, no format matched', { 
                response: response.substring(0, 200) 
            });
        }
        return this.createFallbackResult(libraries, metadata, {
            parseFailureReason: 'no_format_matched'
        });
    }

    /**
     * Parse CONFIRM format (verification mode)
     * Format: CONFIRM|<library_number>|<brief_verification_reason>
     * 
     * @param {string} response - AI response
     * @param {object} context - Context with libraries and signalContext
     * @returns {object|null} Parsed result or null if format doesn't match
     */
    parseConfirmFormat(response, context) {
        const { libraries, signalContext, metadata } = context;
        
        // CONFIRM format only valid when we have signalContext (verification mode)
        if (!signalContext) {
            return null;
        }

        const match = response.match(/CONFIRM\|(\d+)\|(.+)/);
        if (!match) {
            return null;
        }

        const libraryIndex = parseInt(match[1]) - 1;
        const reason = match[2].trim();

        // Validate library index
        if (libraryIndex < 0 || libraryIndex >= libraries.length) {
            logger.warn('Invalid library index in CONFIRM response', {
                index: libraryIndex,
                libraryCount: libraries.length
            });
            return null;
        }

        const confirmedLibrary = libraries[libraryIndex];
        const suggestedLibrary = signalContext?.suggestedLibrary || null;

        if (suggestedLibrary && confirmedLibrary.id !== suggestedLibrary.id) {
            logger.warn('Verify-mode CONFIRM disagreed with suggested library', {
                title: metadata?.title,
                suggestedLibrary: suggestedLibrary.name,
                confirmedLibrary: confirmedLibrary.name
            });
            return this.createVerifyDisagreementResult(context, {
                conflictingLibrary: confirmedLibrary,
                disagreementReason: reason,
                sourceFormat: 'confirm'
            });
        }

        logger.info('AI confirmed classification', {
            title: metadata?.title,
            library: confirmedLibrary.name,
            originalConfidence: signalContext.confidence
        });

        return {
            library: confirmedLibrary,
            confidence: signalContext.confidence, // Use pre-calculated confidence
            reason: `AI verified: ${reason}`,
            needs_clarification: false,
            verified_by_ai: true,
            format: 'confirm'
        };
    }

    /**
     * Parse CONFIDENT format (classification mode)
     * Format: CONFIDENT|<library_number>|<confidence_0_to_100>|<brief_reason>
     * 
     * @param {string} response - AI response
     * @param {object} context - Context with libraries
     * @returns {object|null} Parsed result or null if format doesn't match
     */
    parseConfidentFormat(response, context) {
        const { libraries, metadata } = context;

        const match = response.match(/CONFIDENT\|(\d+)\|(\d+)\|(.+)/);
        if (!match) {
            return null;
        }

        const libraryIndex = parseInt(match[1]) - 1;
        const rawConfidence = parseInt(match[2]);
        const reason = match[3].trim();

        // Validate library index
        if (libraryIndex < 0 || libraryIndex >= libraries.length) {
            logger.warn('Invalid library index in CONFIDENT response', {
                index: libraryIndex,
                libraryCount: libraries.length
            });
            return null;
        }

        // Clamp confidence to 50-95 range (100% reserved for authoritative signals)
        const confidence = Math.min(95, Math.max(50, rawConfidence));

        logger.info('AI classified with confidence', {
            title: metadata?.title,
            library: libraries[libraryIndex].name,
            confidence: confidence,
            rawConfidence: rawConfidence
        });

        return {
            library: libraries[libraryIndex],
            confidence: confidence,
            reason: `AI: ${reason}`,
            needs_clarification: false,
            format: 'confident'
        };
    }

    /**
     * Parse CLARIFY format (uncertainty/clarification needed)
     * Format: CLARIFY|<problem_summary>|<why_uncertain>|<question>|<option1>|<option2>|<option3_optional>
     * 
     * @param {string} response - AI response
     * @param {object} context - Context with libraries, signalContext, metadata
     * @returns {object|null} Parsed result or null if format doesn't match
     */
    parseClarifyFormat(response, context) {
        const { libraries, signalContext, metadata } = context;

        const match = response.match(/CLARIFY\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)(?:\|([^|]+))?/);
        if (!match) {
            return null;
        }

        const problemSummary = match[1].trim();
        const whyUncertain = match[2].trim();
        const question = match[3].trim();
        const optionTokens = [match[4].trim(), match[5].trim()];
        if (match[6]) {
            optionTokens.push(match[6].trim());
        }

        // Resolve options to library objects.
        // New format: the AI emits 1-based library indices (e.g. "2|4") — same convention
        // as CONFIDENT/CONFIRM. This eliminates hallucinated library names.
        // Legacy fallback: if a token is not a bare integer, fall back to text matching so
        // responses generated before the prompt update are still handled gracefully.
        const options = this._resolveOptionsFromTokens(optionTokens, libraries);

        // Require at least 2 valid options — if the AI suggested non-existent libraries
        // we cannot present a meaningful clarification question.
        if (options.length < 2) {
            const fallbackReason = options.length === 1 ? 'single_valid_option' : 'no_valid_options';
            logger.warn('parseClarifyFormat: fewer than 2 valid library options after mapping — falling through', {
                title: context.metadata?.title,
                requestedOptions: optionTokens,
                matchedCount: options.length,
                fallbackReason,
            });
            return this.createContractViolationResult(context, {
                violationReason: fallbackReason,
                requestedOptions: optionTokens,
                matchedOptions: options
            });
        }

        logger.info('AI requests clarification', {
            title: metadata?.title,
            problem: problemSummary,
            options: options.map(o => o.label),
            hasSignalContext: !!signalContext,
            suggestedLibrary: signalContext?.suggestedLibrary?.name
        });

        // Log signal breakdown for debugging
        if (signalContext) {
            logger.debug('Signal breakdown with AI CLARIFY', {
                title: metadata?.title,
                confidence: signalContext.confidence,
                suggestedLibrary: signalContext.suggestedLibrary?.name,
                breakdown: signalContext.breakdown,
                hasConflict: signalContext.hasConflict
            });
        }

        // Build policy question object
        const policyQuestion = {
            problem_summary: problemSummary,
            why_uncertain: whyUncertain,
            question: question,
            options: options,
            generated_at: new Date().toISOString(),
            signal_breakdown: signalContext?.breakdown || [],
            calculated_confidence: signalContext?.confidence || null,
        };

        // Determine suggested library
        const suggestedLibrary = signalContext?.suggestedLibrary || 
                                 this.getDefaultLibrary(libraries, metadata?.media_type);

        return {
            library: suggestedLibrary,
            confidence: signalContext?.confidence || 55,
            reason: `Needs clarification: ${problemSummary}`,
            needs_clarification: true,
            clarification: policyQuestion,
            pending_reason: problemSummary,
            policy_question: policyQuestion,
            libraries: libraries,
            format: 'clarify'
        };
    }

    /**
     * Resolve CLARIFY option tokens to library objects.
     * Tries 1-based numeric index first (new format); falls back to text matching
     * via mapOptionsToLibraries for responses generated before the prompt update.
     * Deduplicates by library_id and filters out unresolved tokens.
     *
     * @param {Array<string>} tokens - Raw option tokens from the AI response
     * @param {Array<object>} libraries - Available libraries
     * @returns {Array<object>} Resolved options with library_id, library_name, label, value
     */
    _resolveOptionsFromTokens(tokens, libraries) {
        const resolved = tokens.map(token => {
            // Try index-based resolution first (new prompt format)
            if (/^\d+$/.test(token)) {
                const idx = parseInt(token, 10) - 1;
                const lib = libraries[idx];
                if (lib) {
                    return {
                        label: lib.name,
                        value: lib.name.toLowerCase().replace(/\s+/g, '_').substring(0, 30),
                        library_id: lib.id,
                        library_name: lib.name,
                    };
                }
                logger.warn('CLARIFY option index out of range — option dropped', {
                    index: parseInt(token, 10),
                    libraryCount: libraries.length,
                });
                return null;
            }

            // Legacy text-based resolution (pre-prompt-update responses)
            const textMatches = this.mapOptionsToLibraries([token], libraries);
            return textMatches[0] || null;
        });

        return resolved
            .filter(Boolean)
            .filter((opt, idx, arr) => arr.findIndex(o => o.library_id === opt.library_id) === idx);
    }

    /**
     * Map option text to library objects
     * @param {Array<string>} optionTexts - Option labels from AI
     * @param {Array<object>} libraries - Available libraries
     * @returns {Array<object>} Options with library mappings
     */
    mapOptionsToLibraries(optionTexts, libraries) {
        return optionTexts.map(opt => {
            const optLower = opt.toLowerCase();
            // Strip common LLM artefacts before matching:
            //   surrounding quotes: "Documentaries" → documentaries
            //   numeric prefixes:   "1. ", "2. "
            //   alpha prefixes:     "a. ", "B. "
            //   bracketed:          "(1) ", "[A] "
            //   bullets:            "- ", "• ", "* ", "· "
            //   filler words:       "library", "content", "media"
            const optClean = optLower
                .replace(/^["'`]+|["'`]+$/g, '')
                .replace(/^(\d+\.|[a-z]\.|[([]\d+[)\]]|[([][a-z][)\]]|[-•*·])\s+/i, '')
                .replace(/\s*(library|content|media)\s*/gi, '')
                .trim();

            // First pass: exact match on either the raw-lowercased or cleaned string.
            let matchedLibrary = libraries.find(lib => {
                const libLower = lib.name.toLowerCase();
                return libLower === optLower || libLower === optClean;
            });

            // Second pass: fall back to contains/partial matching using the cleaned value.
            if (!matchedLibrary) {
                matchedLibrary = libraries.find(lib => {
                    const libLower = lib.name.toLowerCase();
                    return optClean.includes(libLower) || libLower.includes(optClean);
                });
            }

            if (!matchedLibrary) {
                // AI suggested a library name that doesn't exist in the database.
                // Return null and filter below to avoid storing broken options.
                logger.warn('AI suggested library name that does not match any known library — option dropped', {
                    suggested: opt,
                    knownLibraries: libraries.map(l => l.name),
                });
                return null;
            }

            return {
                label: opt,
                value: opt.toLowerCase().replace(/\s+/g, '_').substring(0, 30),
                library_id: matchedLibrary.id,
                library_name: matchedLibrary.name,
            };
        }).filter(Boolean)
          // Deduplicate: if the AI used two variant names for the same library,
          // keep only the first occurrence so the user isn't shown identical options.
          .filter((opt, idx, arr) => arr.findIndex(o => o.library_id === opt.library_id) === idx);
    }

    parseNarrativeSuggestion(response, context, mode = 'classify') {
        const { libraries, signalContext } = context;

        if (!Array.isArray(libraries) || libraries.length === 0) {
            return null;
        }

        // Verify mode: the AI returning narrative text means it's expressing
        // uncertainty or disagreement with the suggested library — it's likely
        // naming that library in the text while objecting to it.  Extracting the
        // library name from the response here would surface the wrong question
        // ("should it go to X?" when the AI just said it shouldn't).
        // Instead, use signalContext.suggestedLibrary as the contested pick and
        // let the user confirm or override.
        if (mode === 'verify') {
            const suggestedLibrary = signalContext?.suggestedLibrary;
            if (!suggestedLibrary) {
                return null;
            }
            return this.createVerifyDisagreementResult(context, {
                sourceFormat: 'narrative'
            });
        }

        return this.createContractViolationResult(context);
    }

    createVerifyDisagreementResult(context, details = {}) {
        const { libraries, signalContext, metadata } = context;
        const suggestedLibrary = signalContext?.suggestedLibrary;
        if (!suggestedLibrary) {
            return this.createFallbackResult(libraries, metadata, {
                parseFailureReason: 'verify_missing_suggested_library'
            });
        }

        const title = metadata?.title || 'this item';
        const orderedAlternatives = [];

        if (details.conflictingLibrary && details.conflictingLibrary.id !== suggestedLibrary.id) {
            orderedAlternatives.push(details.conflictingLibrary);
        }

        for (const library of libraries) {
            if (library.id !== suggestedLibrary.id && !orderedAlternatives.some(candidate => candidate.id === library.id)) {
                orderedAlternatives.push(library);
            }
        }

        const options = [
            {
                label: suggestedLibrary.name,
                value: `library_${suggestedLibrary.id}`,
                library_id: suggestedLibrary.id,
                library_name: suggestedLibrary.name,
            },
            ...orderedAlternatives.slice(0, 3).map(lib => ({
                label: lib.name,
                value: `library_${lib.id}`,
                library_id: lib.id,
                library_name: lib.name,
            }))
        ].slice(0, 4);

        const whyUncertain = details.conflictingLibrary
            ? `The AI verify response selected "${details.conflictingLibrary.name}" instead of confirming the suggested library "${suggestedLibrary.name}".`
            : 'The AI returned a narrative response instead of confirming the suggested library, indicating disagreement or uncertainty.';
        const question = `The AI disagreed with classifying "${title}" as "${suggestedLibrary.name}". Please confirm or choose an alternative.`;
        const policyQuestion = {
            problem_summary: 'AI disagreed with suggested classification',
            why_uncertain: whyUncertain,
            question,
            options,
            generated_at: new Date().toISOString(),
            signal_breakdown: signalContext?.breakdown || [],
            calculated_confidence: signalContext?.confidence || null,
            meta: {
                source_format: details.sourceFormat || 'verify_disagreement',
                conflicting_library_id: details.conflictingLibrary?.id || null,
                conflicting_library_name: details.conflictingLibrary?.name || null,
                disagreement_reason: details.disagreementReason || null
            }
        };

        return {
            library: suggestedLibrary,
            confidence: Number.isFinite(Number(signalContext?.confidence))
                ? Number(signalContext.confidence)
                : 50,
            reason: 'Needs clarification: AI disagreed with suggested classification',
            needs_clarification: true,
            clarification: policyQuestion,
            pending_reason: 'AI disagreed with suggested classification',
            policy_question: policyQuestion,
            libraries,
            format: details.sourceFormat === 'narrative' ? 'narrative_clarify' : 'verify_disagreement',
        };
    }

    /**
     * Create fallback result when no format matches
     * @param {Array<object>} libraries - Available libraries
     * @param {object} metadata - Media metadata
     * @returns {object} Fallback clarification result
     */
    createFallbackResult(libraries, metadata, options = {}) {
        const parseFailureReason = options.parseFailureReason || 'unknown_parse_failure';
        const defaultLibrary = this.getDefaultLibrary(libraries, metadata?.media_type);
        const orderedLibraries = [];

        if (defaultLibrary) {
            orderedLibraries.push(defaultLibrary);
        }

        for (const library of libraries || []) {
            if (!orderedLibraries.some(candidate => candidate.id === library.id)) {
                orderedLibraries.push(library);
            }
        }

        return {
            library: defaultLibrary,
            confidence: 50,
            reason: 'AI could not determine classification - manual review needed',
            parse_failure_reason: parseFailureReason,
            needs_clarification: true,
            clarification: {
                problem_summary: 'Unable to auto-classify',
                why_uncertain: 'The AI classification returned an unexpected format. Manual review is recommended.',
                question: `Which library should "${metadata?.title || 'this item'}" be added to?`,
                options: orderedLibraries.slice(0, 4).map(lib => ({
                    label: lib.name,
                    value: `library_${lib.id}`,
                    library_id: lib.id,
                    library_name: lib.name,
                })),
            },
            libraries: libraries,
            format: 'fallback'
        };
    }

    createContractViolationResult(context, details = {}) {
        const { libraries, metadata, signalContext } = context;
        if (!Array.isArray(libraries) || libraries.length === 0) {
            return null;
        }

        const suggestedLibrary = signalContext?.suggestedLibrary || this.getDefaultLibrary(libraries, metadata?.media_type);
        const orderedLibraries = [];
        const matchedOptions = Array.isArray(details.matchedOptions) ? details.matchedOptions : [];

        for (const option of matchedOptions) {
            const matchedLibrary = libraries.find(lib => lib.id === option.library_id);
            if (matchedLibrary && !orderedLibraries.some(candidate => candidate.id === matchedLibrary.id)) {
                orderedLibraries.push(matchedLibrary);
            }
        }

        if (suggestedLibrary && libraries.some(lib => lib.id === suggestedLibrary.id) && !orderedLibraries.some(candidate => candidate.id === suggestedLibrary.id)) {
            orderedLibraries.push(suggestedLibrary);
        }

        for (const library of libraries) {
            if (!orderedLibraries.some(candidate => candidate.id === library.id)) {
                orderedLibraries.push(library);
            }
        }

        const clarificationOptions = orderedLibraries.slice(0, 4).map(lib => ({
            label: lib.name,
            value: `library_${lib.id}`,
            library_id: lib.id,
            library_name: lib.name
        }));

        const title = metadata?.title || 'this item';
        const targetLibrary = suggestedLibrary || orderedLibraries[0] || null;
        const confidence = Number.isFinite(Number(signalContext?.confidence))
            ? Math.min(95, Math.max(50, Number(signalContext.confidence)))
            : 50;
        const whyUncertain = targetLibrary
            ? `The AI returned narrative text instead of the required response contract format. Deterministic scoring currently favors "${targetLibrary.name}", but the malformed AI output cannot be trusted as-is.`
            : 'The AI returned narrative text instead of the required response contract format.';
        const question = targetLibrary
            ? `The AI returned an invalid classification response. Should "${title}" go to "${targetLibrary.name}", or to a different library?`
            : `The AI returned an invalid classification response. Which library should "${title}" be added to?`;

        const policyQuestion = {
            problem_summary: 'AI response contract violation',
            why_uncertain: whyUncertain,
            question,
            options: clarificationOptions,
            generated_at: new Date().toISOString(),
            signal_breakdown: signalContext?.breakdown || [],
            calculated_confidence: signalContext?.confidence || null,
            meta: {
                suggested_library_id: targetLibrary?.id || null,
                suggested_library_name: targetLibrary?.name || null,
                parser_mode: 'classify',
                violation_reason: details.violationReason || 'no_format_matched',
                requested_options: Array.isArray(details.requestedOptions) ? details.requestedOptions : [],
                matched_option_count: matchedOptions.length
            }
        };

        return {
            library: targetLibrary,
            confidence,
            reason: 'Needs clarification: AI response contract violation',
            needs_clarification: true,
            clarification: policyQuestion,
            pending_reason: 'AI response contract violation',
            policy_question: policyQuestion,
            libraries,
            format: 'contract_violation'
        };
    }

    /**
     * Get default library for media type
     * @param {Array<object>} libraries - Available libraries
     * @param {string} mediaType - Media type (movie/tv)
     * @returns {object} Default library
     */
    getDefaultLibrary(libraries, mediaType) {
        if (!libraries || libraries.length === 0) {
            return null;
        }

        // Look for a general-purpose library matching the media type
        const generalNames = mediaType === 'movie'
            ? ['movies', 'films', 'general movies']
            : ['tv shows', 'tv series', 'series', 'television'];

        const generalLib = libraries.find(l =>
            generalNames.some(name => l.name.toLowerCase().includes(name))
        );

        // Fall back to lowest priority library (most general)
        return generalLib || libraries[libraries.length - 1];
    }
}

// Export singleton instance
module.exports = new AIResponseParser();
