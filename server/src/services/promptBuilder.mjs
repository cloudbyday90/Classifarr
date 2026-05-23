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
import { libraryProfileService as defaultLibraryProfileService } from './libraryProfileService.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import {
    LOW_CONFIDENCE_THRESHOLD,
    CLOSE_RACE_SCORE_DELTA,
    STRONG_SCORE_THRESHOLD,
    PATTERN_REINFORCEMENT_THRESHOLD,
    MAX_SUGGESTIONS,
    DARK_KEYWORDS,
    safeJSONParse
} from './promptBuilderConstants.mjs';
import {
    determinePromptType,
    buildLowConfidencePrompt,
    buildAIRejectionPrompt,
    buildCloseRacePrompt,
    buildNewDiscoveryPrompt,
    buildConfirmationPrompt,
    buildStandardPrompt,
    buildBatchSummary,
    buildTuningSuggestionPrompt
} from './promptBuilderTypes.mjs';
import {
    buildReasonOptions,
    buildPatternOptions,
    analyzeSignals,
    identifyKeyDifferences,
    identifyReinforcedPatterns,
    describeFutureImpact
} from './promptBuilderTypeHelpers.mjs';
import {
    formatForDiscord,
    formatForWeb,
    getDiscordTitle,
    getDiscordDescription,
    getDiscordColor,
    getDiscordFields,
    getDiscordComponents,
    getWebContent,
    getWebActions
} from './promptBuilderFormatters.mjs';

const logger = createLogger('PromptBuilder');

export {
    LOW_CONFIDENCE_THRESHOLD,
    CLOSE_RACE_SCORE_DELTA,
    STRONG_SCORE_THRESHOLD,
    PATTERN_REINFORCEMENT_THRESHOLD,
    MAX_SUGGESTIONS,
    DARK_KEYWORDS,
    safeJSONParse
};

export {
    determinePromptType,
    buildLowConfidencePrompt,
    buildAIRejectionPrompt,
    buildCloseRacePrompt,
    buildNewDiscoveryPrompt,
    buildConfirmationPrompt,
    buildStandardPrompt,
    buildBatchSummary,
    buildTuningSuggestionPrompt,
    buildReasonOptions,
    buildPatternOptions,
    analyzeSignals,
    identifyKeyDifferences,
    identifyReinforcedPatterns,
    describeFutureImpact,
    formatForDiscord,
    formatForWeb,
    getDiscordTitle,
    getDiscordDescription,
    getDiscordColor,
    getDiscordFields,
    getDiscordComponents,
    getWebContent,
    getWebActions
};

export class PromptBuilder {
    constructor({ libraryProfileService = defaultLibraryProfileService } = {}) {
        this.libraryProfileService = libraryProfileService;
    }

    async buildClassificationPrompt(item, libraryId, options = {}) {
        let prompt = '';

        if (libraryId && options.includeProfile !== false) {
            try {
                const profileStats = await this.libraryProfileService.getProfileStats(libraryId);
                if (profileStats.totalItems > 0) {
                    prompt += this.libraryProfileService.formatForPrompt(profileStats);
                    prompt += '\n\n';
                }
            } catch (error) {
                logger.warn('Failed to load library profile for prompt', {
                    libraryId,
                    error: error.message
                });
            }
        }

        prompt += this.formatItemForPrompt(item);

        if (options.instructions) {
            prompt += '\n\n';
            prompt += options.instructions;
        }

        return prompt;
    }

    formatItemForPrompt(item) {
        const lines = [];

        lines.push('=== MEDIA ITEM TO CLASSIFY ===');
        lines.push(`Title: ${item.title || 'Unknown'}`);
        if (item.year) lines.push(`Year: ${item.year}`);
        if (item.media_type) lines.push(`Type: ${item.media_type}`);
        if (item.certification) lines.push(`Rating: ${item.certification}`);

        if (item.genres) {
            const genres = normalizeMetadataList(Array.isArray(item.genres) ? item.genres : safeJSONParse(item.genres, []));
            if (genres.length > 0) {
                lines.push(`Genres: ${genres.join(', ')}`);
            }
        }

        if (item.overview) {
            lines.push(`\nOverview: ${item.overview}`);
        }

        if (item.keywords) {
            const keywords = normalizeMetadataList(Array.isArray(item.keywords) ? item.keywords : safeJSONParse(item.keywords, []));
            if (keywords.length > 0) {
                lines.push(`\nKeywords: ${keywords.slice(0, 10).join(', ')}`);
            }
        }

        if (item.studios || item.production_companies) {
            const studios = item.studios || item.production_companies;
            const studiosList = Array.isArray(studios) ? studios : safeJSONParse(studios, []);
            if (studiosList.length > 0) {
                const studioNames = studiosList.map(s =>
                    typeof s === 'string' ? s : s?.name
                ).filter(Boolean);
                if (studioNames.length > 0) {
                    lines.push(`\nStudios: ${studioNames.join(', ')}`);
                }
            }
        }

        lines.push('==============================');

        return lines.join('\n');
    }

    async buildPrompt(item, evaluationResult) {
        try {
            const promptType = this.determinePromptType(evaluationResult);

            logger.debug('Building prompt', {
                title: item.title,
                promptType,
                confidence: evaluationResult.confidence
            });

            let prompt;
            switch (promptType) {
                case 'low_confidence':
                    prompt = this.buildLowConfidencePrompt(item, evaluationResult);
                    break;
                case 'ai_rejection':
                    prompt = this.buildAIRejectionPrompt(item, evaluationResult);
                    break;
                case 'close_race':
                    prompt = this.buildCloseRacePrompt(item, evaluationResult);
                    break;
                case 'new_discovery':
                    prompt = this.buildNewDiscoveryPrompt(item, evaluationResult);
                    break;
                case 'confirmation':
                    prompt = this.buildConfirmationPrompt(item, evaluationResult);
                    break;
                default:
                    prompt = this.buildStandardPrompt(item, evaluationResult);
            }

            return prompt;

        } catch (error) {
            logger.error('Failed to build prompt', {
                error: error.message,
                title: item?.title
            });
            throw error;
        }
    }

    determinePromptType(...args) { return determinePromptType(...args); }
    buildLowConfidencePrompt(...args) { return buildLowConfidencePrompt(...args); }
    buildAIRejectionPrompt(...args) { return buildAIRejectionPrompt(...args); }
    buildCloseRacePrompt(...args) { return buildCloseRacePrompt(...args); }
    buildNewDiscoveryPrompt(...args) { return buildNewDiscoveryPrompt(...args); }
    buildConfirmationPrompt(...args) { return buildConfirmationPrompt(...args); }
    buildStandardPrompt(...args) { return buildStandardPrompt(...args); }
    buildBatchSummary(...args) { return buildBatchSummary(...args); }
    buildTuningSuggestionPrompt(...args) { return buildTuningSuggestionPrompt(...args); }
    buildReasonOptions(...args) { return buildReasonOptions(...args); }
    buildPatternOptions(...args) { return buildPatternOptions(...args); }
    analyzeSignals(...args) { return analyzeSignals(...args); }
    identifyKeyDifferences(...args) { return identifyKeyDifferences(...args); }
    identifyReinforcedPatterns(...args) { return identifyReinforcedPatterns(...args); }
    describeFutureImpact(...args) { return describeFutureImpact(...args); }
    formatForDiscord(...args) { return formatForDiscord(...args); }
    formatForWeb(...args) { return formatForWeb(...args); }
    getDiscordTitle(...args) { return getDiscordTitle(...args); }
    getDiscordDescription(...args) { return getDiscordDescription(...args); }
    getDiscordColor(...args) { return getDiscordColor(...args); }
    getDiscordFields(...args) { return getDiscordFields(...args); }
    getDiscordComponents(...args) { return getDiscordComponents(...args); }
    getWebContent(...args) { return getWebContent(...args); }
    getWebActions(...args) { return getWebActions(...args); }
}

export function createPromptBuilder({ libraryProfileService = defaultLibraryProfileService } = {}) {
    return new PromptBuilder({ libraryProfileService });
}

export const promptBuilder = createPromptBuilder({ libraryProfileService: defaultLibraryProfileService });
