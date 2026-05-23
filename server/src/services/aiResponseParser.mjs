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
import {
    getDefaultLibrary as _getDefaultLibrary,
    createFallbackResult as _createFallbackResult,
    createVerifyDisagreementResult as _createVerifyDisagreementResult,
    createContractViolationResult as _createContractViolationResult,
} from './aiResponseParserResults.mjs';
import {
    mapOptionsToLibraries as _mapOptionsToLibraries,
    resolveOptionsFromTokens as _resolveOptionsFromTokens,
} from './aiResponseParserOptions.mjs';

export class AIResponseParser {
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
            this.logger.info('Malformed CLARIFY response had fewer than 2 valid options; converting to contract violation', {
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

        return this.createContractViolationResult(context, {
            violationReason: 'narrative_no_format_match',
        });
    }

    mapOptionsToLibraries(optionTexts, libraries) {
        return _mapOptionsToLibraries(optionTexts, libraries, this.logger);
    }

    _resolveOptionsFromTokens(tokens, libraries) {
        return _resolveOptionsFromTokens(tokens, libraries, this.logger);
    }

    getDefaultLibrary(libraries, mediaType) {
        return _getDefaultLibrary(libraries, mediaType);
    }

    createFallbackResult(libraries, metadata, options) {
        return _createFallbackResult(libraries, metadata, options);
    }

    createVerifyDisagreementResult(context, details) {
        return _createVerifyDisagreementResult(context, details);
    }

    createContractViolationResult(context, details) {
        return _createContractViolationResult(context, details);
    }
}

export const aiResponseParser = new AIResponseParser();
