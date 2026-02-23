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

        logger.info('AI confirmed classification', {
            title: metadata?.title,
            library: libraries[libraryIndex].name,
            originalConfidence: signalContext.confidence
        });

        return {
            library: libraries[libraryIndex],
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
        const optionTexts = [match[4].trim(), match[5].trim()];
        if (match[6]) {
            optionTexts.push(match[6].trim());
        }

        // Map option texts to library objects
        const options = this.mapOptionsToLibraries(optionTexts, libraries);

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
     * Map option text to library objects
     * @param {Array<string>} optionTexts - Option labels from AI
     * @param {Array<object>} libraries - Available libraries
     * @returns {Array<object>} Options with library mappings
     */
    mapOptionsToLibraries(optionTexts, libraries) {
        return optionTexts.map(opt => {
            const optLower = opt.toLowerCase();
            const optClean = optLower.replace(/\s*(library|content|media)\s*/gi, '').trim();

            // First pass: try to find an exact match
            let matchedLibrary = libraries.find(lib => {
                const libLower = lib.name.toLowerCase();
                return libLower === optLower || libLower === optClean;
            });

            // Second pass: fall back to contains/partial matching
            if (!matchedLibrary) {
                matchedLibrary = libraries.find(lib => {
                    const libLower = lib.name.toLowerCase();
                    return optLower.includes(libLower) || libLower.includes(optClean);
                });
            }

            return {
                label: opt,
                value: opt.toLowerCase().replace(/\s+/g, '_').substring(0, 30),
                library_id: matchedLibrary?.id || null,
                library_name: matchedLibrary?.name || null,
            };
        });
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
                options: libraries.slice(0, 4).map(lib => ({
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
