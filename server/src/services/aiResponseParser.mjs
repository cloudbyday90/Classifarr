/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { createLogger } from '../utils/logger.mjs';

class AIResponseParser {
    constructor(deps = {}) {
        this._logger = deps.logger || null;
        this.formatParsers = new Map();
        this.registerDefaultParsers();
    }

    get logger() {
        if (!this._logger) {
            this._logger = createLogger('AIResponseParser');
        }
        return this._logger;
    }

    registerDefaultParsers() {
        this.register('confirm', this.parseConfirmFormat.bind(this));
        this.register('confident', this.parseConfidentFormat.bind(this));
        this.register('clarify', this.parseClarifyFormat.bind(this));
    }

    register(formatName, parser) {
        this.formatParsers.set(formatName, parser);
        this.logger.debug('Registered format parser', { formatName });
    }

    parse(response, context, options = {}) {
        const { libraries, metadata } = context;
        const mode = options.mode || (context.signalContext ? 'verify' : 'classify');
        const logInvalid = options.logInvalid !== false;
        const logMalformed = options.logMalformed !== false;

        if (!response || typeof response !== 'string') {
            if (logInvalid) {
                this.logger.warn('Invalid AI response', { response: String(response).substring(0, 100) });
            }
            return this.createFallbackResult(libraries, metadata, {
                parseFailureReason: 'invalid_response'
            });
        }

        const formatOrder = mode === 'verify'
            ? ['confirm', 'clarify']
            : ['confident', 'clarify'];
        
        for (const formatName of formatOrder) {
            const parser = this.formatParsers.get(formatName);
            if (!parser) continue;

            const result = parser(response, context);
            if (result) {
                this.logger.debug('Parsed AI response', { 
                    format: formatName,
                    library: result.library?.name,
                    confidence: result.confidence
                });
                return result;
            }
        }

        const narrativeResult = this.parseNarrativeSuggestion(response, context, mode);
        if (narrativeResult) {
            this.logger.info('Salvaged malformed AI response into structured clarification', {
                title: metadata?.title,
                library: narrativeResult.library?.name || null,
                format: narrativeResult.format
            });
            return narrativeResult;
        }

        if (logMalformed) {
            this.logger.warn('AI response malformed, no format matched', { 
                response: response.substring(0, 200) 
            });
        }
        return this.createFallbackResult(libraries, metadata, {
            parseFailureReason: 'no_format_matched'
        });
    }

    parseConfirmFormat(response, context) {
        const { libraries, signalContext, metadata } = context;
        
        if (!signalContext) {
            return null;
        }

        const match = response.match(/CONFIRM\|(\d+)\|(.+)/);
        if (!match) {
            return null;
        }

        const libraryIndex = parseInt(match[1]) - 1;
        const reason = match[2].trim();

        if (libraryIndex < 0 || libraryIndex >= libraries.length) {
            this.logger.warn('Invalid library index in CONFIRM response', {
                index: libraryIndex,
                libraryCount: libraries.length
            });
            return null;
        }

        const confirmedLibrary = libraries[libraryIndex];
        const suggestedLibrary = signalContext?.suggestedLibrary || null;

        if (suggestedLibrary && confirmedLibrary.id !== suggestedLibrary.id) {
            this.logger.warn('Verify-mode CONFIRM disagreed with suggested library', {
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

        this.logger.info('AI confirmed classification', {
            title: metadata?.title,
            library: confirmedLibrary.name,
            originalConfidence: signalContext.confidence
        });

        return {
            library: confirmedLibrary,
            confidence: signalContext.confidence,
            reason: `AI verified: ${reason}`,
            needs_clarification: false,
            verified_by_ai: true,
            format: 'confirm'
        };
    }

    parseConfidentFormat(response, context) {
        const { libraries, metadata } = context;

        const match = response.match(/CONFIDENT\|(\d+)\|(\d+)\|(.+)/);
        if (!match) {
            return null;
        }

        const libraryIndex = parseInt(match[1]) - 1;
        const rawConfidence = parseInt(match[2]);
        const reason = match[3].trim();

        if (libraryIndex < 0 || libraryIndex >= libraries.length) {
            this.logger.warn('Invalid library index in CONFIDENT response', {
                index: libraryIndex,
                libraryCount: libraries.length
            });
            return null;
        }

        const confidence = Math.min(95, Math.max(50, rawConfidence));

        this.logger.info('AI classified with confidence', {
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

        const options = this._resolveOptionsFromTokens(optionTokens, libraries);

        if (options.length < 2) {
            const fallbackReason = options.length === 1 ? 'single_valid_option' : 'no_valid_options';
            this.logger.warn('parseClarifyFormat: fewer than 2 valid library options after mapping — falling through', {
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

        this.logger.info('AI requests clarification', {
            title: metadata?.title,
            problem: problemSummary,
            options: options.map(o => o.label),
            hasSignalContext: !!signalContext,
            suggestedLibrary: signalContext?.suggestedLibrary?.name
        });

        if (signalContext) {
            this.logger.debug('Signal breakdown with AI CLARIFY', {
                title: metadata?.title,
                confidence: signalContext.confidence,
                suggestedLibrary: signalContext.suggestedLibrary?.name,
                breakdown: signalContext.breakdown,
                hasConflict: signalContext.hasConflict
            });
        }

        const policyQuestion = {
            problem_summary: problemSummary,
            why_uncertain: whyUncertain,
            question: question,
            options: options,
            generated_at: new Date().toISOString(),
            signal_breakdown: signalContext?.breakdown || [],
            calculated_confidence: signalContext?.confidence || null,
        };

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

    _resolveOptionsFromTokens(tokens, libraries) {
        const resolved = tokens.map(token => {
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
                this.logger.warn('CLARIFY option index out of range — option dropped', {
                    index: parseInt(token, 10),
                    libraryCount: libraries.length,
                });
                return null;
            }

            const textMatches = this.mapOptionsToLibraries([token], libraries);
            return textMatches[0] || null;
        });

        return resolved
            .filter(Boolean)
            .filter((opt, idx, arr) => arr.findIndex(o => o.library_id === opt.library_id) === idx);
    }

    mapOptionsToLibraries(optionTexts, libraries) {
        return optionTexts.map(opt => {
            const optLower = opt.toLowerCase();
            const optClean = optLower
                .replace(/^["'`]+|["'`]+$/g, '')
                .replace(/^(\d+\.|[a-z]\.|[([]\d+[)\]]|[([][a-z][)\]]|[-•*·])\s+/i, '')
                .replace(/\s*(library|content|media)\s*/gi, '')
                .trim();

            let matchedLibrary = libraries.find(lib => {
                const libLower = lib.name.toLowerCase();
                return libLower === optLower || libLower === optClean;
            });

            if (!matchedLibrary) {
                matchedLibrary = libraries.find(lib => {
                    const libLower = lib.name.toLowerCase();
                    return optClean.includes(libLower) || libLower.includes(optClean);
                });
            }

            if (!matchedLibrary) {
                this.logger.warn('AI suggested library name that does not match any known library — option dropped', {
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
          .filter((opt, idx, arr) => arr.findIndex(o => o.library_id === opt.library_id) === idx);
    }

    parseNarrativeSuggestion(response, context, mode = 'classify') {
        const { libraries, signalContext } = context;

        if (!Array.isArray(libraries) || libraries.length === 0) {
            return null;
        }

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

    getDefaultLibrary(libraries, mediaType) {
        if (!libraries || libraries.length === 0) {
            return null;
        }

        const generalNames = mediaType === 'movie'
            ? ['movies', 'films', 'general movies']
            : ['tv shows', 'tv series', 'series', 'television'];

        const generalLib = libraries.find(l =>
            generalNames.some(name => l.name.toLowerCase().includes(name))
        );

        return generalLib || libraries[libraries.length - 1];
    }
}

const singleton = new AIResponseParser();

export default singleton;
export { AIResponseParser };
