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
import defaultLibraryProfileService from './libraryProfileService.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';

const logger = createLogger('PromptBuilder');

export const LOW_CONFIDENCE_THRESHOLD = 70;
export const CLOSE_RACE_SCORE_DELTA = 15;
export const STRONG_SCORE_THRESHOLD = 70;
export const PATTERN_REINFORCEMENT_THRESHOLD = 50;
export const MAX_SUGGESTIONS = 3;
export const DARK_KEYWORDS = ['horror', 'dark', 'scary', 'violent'];

export function safeJSONParse(value, defaultValue = null) {
    if (typeof value !== 'string') {
        return value || defaultValue;
    }
    try {
        return JSON.parse(value);
    } catch (error) {
        logger.warn('Failed to parse JSON', { value, error: error.message });
        return defaultValue;
    }
}

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

    determinePromptType(evaluationResult) {
        const { action, confidence, ranked, aiRejection, newStudio, newCollection } = evaluationResult;

        if (aiRejection) {
            return 'ai_rejection';
        }

        if (newStudio || newCollection) {
            return 'new_discovery';
        }

        if (ranked && ranked.length >= 2) {
            const topScore = ranked[0].score;
            const secondScore = ranked[1].score;
            if (topScore - secondScore < CLOSE_RACE_SCORE_DELTA) {
                return 'close_race';
            }
        }

        if (confidence < LOW_CONFIDENCE_THRESHOLD) {
            return 'low_confidence';
        }

        if (action === 'prompt_confirm') {
            return 'confirmation';
        }

        return 'standard';
    }

    buildLowConfidencePrompt(item, evaluation) {
        const { ranked, confidence } = evaluation;
        const topSuggestion = ranked && ranked.length > 0 ? ranked[0] : null;

        const signals = this.analyzeSignals(item, evaluation);

        return {
            type: 'low_confidence',
            title: `${item.title} (${item.year || 'Unknown'})`,
            confidence: confidence || 0,
            topSuggestion: topSuggestion ? {
                libraryId: topSuggestion.library_id,
                libraryName: topSuggestion.library_name,
                score: topSuggestion.score
            } : null,
            matchingSignals: signals.matching,
            conflictingSignals: signals.conflicting,
            missingSignals: signals.missing,
            suggestions: ranked ? ranked.slice(0, MAX_SUGGESTIONS).map(r => ({
                libraryId: r.library_id,
                libraryName: r.library_name,
                score: r.score,
                policyId: r.policy_id
            })) : [],
            reasonOptions: this.buildReasonOptions(item, evaluation),
            patternOptions: this.buildPatternOptions(item, evaluation)
        };
    }

    buildAIRejectionPrompt(item, evaluation) {
        const { ranked, aiRejection } = evaluation;
        const originalSuggestion = ranked && ranked.length > 0 ? ranked[0] : null;

        return {
            type: 'ai_rejection',
            title: `${item.title} (${item.year || 'Unknown'})`,
            originalSuggestion: originalSuggestion ? {
                libraryId: originalSuggestion.library_id,
                libraryName: originalSuggestion.library_name,
                score: originalSuggestion.score
            } : null,
            aiReasoning: aiRejection?.reasoning || 'AI validation flagged this classification for review',
            alternativeSuggestions: ranked ? ranked.slice(1, 4).map(r => ({
                libraryId: r.library_id,
                libraryName: r.library_name,
                score: r.score,
                policyId: r.policy_id
            })) : [],
            reasonOptions: this.buildReasonOptions(item, evaluation),
            patternOptions: this.buildPatternOptions(item, evaluation)
        };
    }

    buildCloseRacePrompt(item, evaluation) {
        const { ranked } = evaluation;
        const topCandidates = ranked ? ranked.slice(0, MAX_SUGGESTIONS) : [];

        return {
            type: 'close_race',
            title: `${item.title} (${item.year || 'Unknown'})`,
            topContenders: topCandidates.map(r => ({
                libraryId: r.library_id,
                libraryName: r.library_name,
                score: r.score,
                policyId: r.policy_id,
                scoreBreakdown: r.scores,
                weights: r.weights
            })),
            keyDifferences: this.identifyKeyDifferences(topCandidates, item),
            reasonOptions: this.buildReasonOptions(item, evaluation),
            patternOptions: this.buildPatternOptions(item, evaluation)
        };
    }

    buildNewDiscoveryPrompt(item, evaluation) {
        const { ranked, newStudio, newCollection } = evaluation;
        const bestGuess = ranked && ranked.length > 0 ? ranked[0] : null;

        const discoveryEntity = newStudio || newCollection;
        const discoveryType = newStudio ? 'studio' : 'collection';

        return {
            type: 'new_discovery',
            title: `${item.title} (${item.year || 'Unknown'})`,
            discoveryType,
            discoveryEntity,
            bestGuess: bestGuess ? {
                libraryId: bestGuess.library_id,
                libraryName: bestGuess.library_name,
                score: bestGuess.score,
                policyId: bestGuess.policy_id
            } : null,
            suggestions: ranked ? ranked.slice(0, MAX_SUGGESTIONS).map(r => ({
                libraryId: r.library_id,
                libraryName: r.library_name,
                score: r.score,
                policyId: r.policy_id
            })) : [],
            reasonOptions: this.buildReasonOptions(item, evaluation),
            patternOptions: this.buildPatternOptions(item, evaluation)
        };
    }

    buildConfirmationPrompt(item, evaluation, userChoice = null) {
        const { ranked, library } = evaluation;
        const suggestion = library || (ranked && ranked.length > 0 ? ranked[0] : null);

        return {
            type: 'confirmation',
            title: `${item.title} (${item.year || 'Unknown'})`,
            suggestion: suggestion ? {
                libraryId: suggestion.library_id,
                libraryName: suggestion.library_name,
                score: suggestion.score || evaluation.confidence,
                policyId: suggestion.policy_id
            } : null,
            userChoice: userChoice ? {
                libraryId: userChoice.libraryId,
                libraryName: userChoice.libraryName,
                reasons: userChoice.reasons,
                customReason: userChoice.customReason
            } : null,
            patternsReinforced: this.identifyReinforcedPatterns(item, evaluation, userChoice),
            patternsCreated: userChoice?.patternActions || [],
            futureImpact: this.describeFutureImpact(item, evaluation, userChoice),
            reasonOptions: this.buildReasonOptions(item, evaluation),
            patternOptions: this.buildPatternOptions(item, evaluation)
        };
    }

    buildStandardPrompt(item, evaluation) {
        const { ranked, confidence, library } = evaluation;
        const suggestion = library || (ranked && ranked.length > 0 ? ranked[0] : null);

        return {
            type: 'standard',
            title: `${item.title} (${item.year || 'Unknown'})`,
            confidence: confidence || 0,
            suggestion: suggestion ? {
                libraryId: suggestion.library_id,
                libraryName: suggestion.library_name,
                score: suggestion.score || confidence,
                policyId: suggestion.policy_id
            } : null,
            suggestions: ranked ? ranked.slice(0, MAX_SUGGESTIONS).map(r => ({
                libraryId: r.library_id,
                libraryName: r.library_name,
                score: r.score,
                policyId: r.policy_id
            })) : [],
            reasonOptions: this.buildReasonOptions(item, evaluation),
            patternOptions: this.buildPatternOptions(item, evaluation)
        };
    }

    buildBatchSummary(items) {
        const grouped = {
            highConfidence: [],
            lowConfidence: [],
            closeRace: [],
            newDiscovery: []
        };

        for (const item of items) {
            const promptType = this.determinePromptType(item.evaluation);

            if (promptType === 'close_race') {
                grouped.closeRace.push(item);
            } else if (promptType === 'new_discovery') {
                grouped.newDiscovery.push(item);
            } else if (item.evaluation.confidence < 70) {
                grouped.lowConfidence.push(item);
            } else {
                grouped.highConfidence.push(item);
            }
        }

        return {
            type: 'batch_summary',
            totalItems: items.length,
            grouped,
            summary: {
                highConfidence: grouped.highConfidence.length,
                lowConfidence: grouped.lowConfidence.length,
                closeRace: grouped.closeRace.length,
                newDiscovery: grouped.newDiscovery.length
            }
        };
    }

    buildTuningSuggestionPrompt(suggestion) {
        return {
            type: 'tuning_suggestion',
            suggestionType: suggestion.suggestion_type,
            config: suggestion.suggestion_config,
            confidence: suggestion.confidence,
            impactEstimate: suggestion.impact_estimate,
            supportingEvidence: suggestion.supporting_feedback_ids || [],
            policyId: suggestion.policy_id,
            policyName: suggestion.policy_name,
            createdAt: suggestion.created_at
        };
    }

    formatForDiscord(prompt) {
        const embed = {
            title: this.getDiscordTitle(prompt),
            description: this.getDiscordDescription(prompt),
            color: this.getDiscordColor(prompt),
            fields: this.getDiscordFields(prompt),
            timestamp: new Date().toISOString()
        };

        const components = this.getDiscordComponents(prompt);

        return {
            embeds: [embed],
            components
        };
    }

    formatForWeb(prompt) {
        return {
            type: prompt.type,
            title: prompt.title,
            content: this.getWebContent(prompt),
            actions: this.getWebActions(prompt),
            metadata: {
                confidence: prompt.confidence,
                timestamp: new Date().toISOString()
            }
        };
    }

    buildReasonOptions(item, _evaluation) {
        const options = [];

        if (item.genres) {
            const genres = normalizeMetadataList(safeJSONParse(item.genres, []));
            if (genres.length > 0) {
                options.push({
                    category: 'genre',
                    label: `Based on genre (${genres.slice(0, 2).join(', ')})`,
                    value: 'genre_based'
                });
            }
        }

        if (item.studios || item.production_companies) {
            const studios = item.studios || item.production_companies;
            const studiosList = safeJSONParse(studios, []);
            if (Array.isArray(studiosList) && studiosList.length > 0) {
                const studioName = typeof studiosList[0] === 'string' ? studiosList[0] : studiosList[0]?.name;
                if (studioName) {
                    options.push({
                        category: 'studio',
                        label: `Based on studio (${studioName})`,
                        value: 'studio_based'
                    });
                }
            }
        }

        if (item.certification) {
            options.push({
                category: 'rating',
                label: `Based on rating (${item.certification})`,
                value: 'rating_based'
            });
        }

        if (item.keywords) {
            options.push({
                category: 'keywords',
                label: 'Based on content keywords',
                value: 'keyword_based'
            });
        }

        if (item.belongs_to_collection) {
            options.push({
                category: 'collection',
                label: 'Part of a collection/franchise',
                value: 'collection_based'
            });
        }

        options.push({
            category: 'custom',
            label: 'Other reason',
            value: 'custom'
        });

        return options;
    }

    buildPatternOptions(item, _evaluation) {
        const options = [];

        if (item.studios || item.production_companies) {
            const studios = item.studios || item.production_companies;
            const studiosList = safeJSONParse(studios, []);
            if (Array.isArray(studiosList) && studiosList.length > 0) {
                const studioName = typeof studiosList[0] === 'string' ? studiosList[0] : studiosList[0]?.name;
                if (studioName) {
                    options.push({
                        type: 'studio',
                        label: `Remember: ${studioName} → [Selected Library]`,
                        value: studioName
                    });
                }
            }
        }

        if (item.belongs_to_collection) {
            const collection = safeJSONParse(item.belongs_to_collection, null);
            const collectionName = typeof collection === 'string' ? collection : collection?.name;
            if (collectionName) {
                options.push({
                    type: 'collection',
                    label: `Always classify ${collectionName} as [Selected Library]`,
                    value: collectionName
                });
            }
        }

        if (item.keywords) {
            const keywords = normalizeMetadataList(safeJSONParse(item.keywords, []));
            if (keywords.length > 0) {
                const prominentKeyword = keywords[0];
                if (prominentKeyword) {
                    options.push({
                        type: 'keyword',
                        label: `Remember: "${prominentKeyword}" → [Selected Library]`,
                        value: prominentKeyword
                    });
                }
            }
        }

        return options;
    }

    analyzeSignals(item, evaluation) {
        const signals = {
            matching: [],
            conflicting: [],
            missing: []
        };

        const topRanked = evaluation.ranked && evaluation.ranked[0];
        if (!topRanked) return signals;

        if (item.genres) {
            const genres = normalizeMetadataList(safeJSONParse(item.genres, []));
            if (genres.length > 0) {
                signals.matching.push(`${genres.slice(0, 2).join(', ')} genre${genres.length > 1 ? 's' : ''}`);
            }
        }

        if (item.certification) {
            signals.matching.push(`${item.certification} rating`);
        }

        const keywords = normalizeMetadataList(safeJSONParse(item.keywords, []));
        const keywordText = keywords.join(' ').toLowerCase();
        const overviewText = (item.overview || '').toLowerCase();
        const allText = `${keywordText} ${overviewText}`;

        const hasDarkContent = DARK_KEYWORDS.some(k => allText.includes(k));
        if (hasDarkContent) {
            signals.conflicting.push('Dark/mature themes detected');
        }

        if (!item.studios && !item.production_companies) {
            signals.missing.push('Studio information');
        }

        return signals;
    }

    identifyKeyDifferences(topCandidates, _item) {
        const differences = [];

        if (topCandidates.length < 2) return differences;

        for (let i = 0; i < Math.min(topCandidates.length, MAX_SUGGESTIONS); i++) {
            const candidate = topCandidates[i];
            const strengths = [];

            if (candidate.scores?.preset > STRONG_SCORE_THRESHOLD) {
                strengths.push('Strong preset match');
            }
            if (candidate.scores?.pattern > STRONG_SCORE_THRESHOLD) {
                strengths.push('Known pattern');
            }
            if (candidate.scores?.rag > STRONG_SCORE_THRESHOLD) {
                strengths.push('Similar to past items');
            }

            differences.push({
                libraryName: candidate.library_name,
                score: candidate.score,
                strengths
            });
        }

        return differences;
    }

    identifyReinforcedPatterns(item, evaluation, userChoice) {
        const patterns = [];

        if (!userChoice) return patterns;

        const topRanked = evaluation.ranked && evaluation.ranked[0];
        if (topRanked && userChoice.libraryId === topRanked.library_id) {
            if (topRanked.scores?.pattern > PATTERN_REINFORCEMENT_THRESHOLD) {
                patterns.push('Existing pattern confirmed');
            }
            if (topRanked.scores?.rag > PATTERN_REINFORCEMENT_THRESHOLD) {
                patterns.push('Semantic similarity validated');
            }
        }

        return patterns;
    }

    describeFutureImpact(item, evaluation, userChoice) {
        if (!userChoice) {
            return 'Your choice will help improve future classifications.';
        }

        const hasPatternActions = userChoice.patternActions && userChoice.patternActions.length > 0;

        if (hasPatternActions) {
            return `New pattern${userChoice.patternActions.length > 1 ? 's' : ''} created. Similar items will be classified automatically.`;
        }

        return 'This decision will be used to improve classification accuracy.';
    }

    getDiscordTitle(prompt) {
        const emoji = {
            low_confidence: '🎬',
            ai_rejection: '⚠️',
            close_race: '🏆',
            new_discovery: '🆕',
            confirmation: '✅',
            standard: '🎬'
        };

        return `${emoji[prompt.type] || '🎬'} ${prompt.title}`;
    }

    getDiscordDescription(prompt) {
        switch (prompt.type) {
            case 'low_confidence':
                return `Classification Needed\n\n📊 Confidence: ${prompt.confidence}% → ${prompt.topSuggestion?.libraryName || 'Unknown'}`;
            case 'ai_rejection':
                return `AI Validation Rejected\n\n${prompt.aiReasoning}`;
            case 'close_race':
                return 'Close Call - Multiple Strong Matches';
            case 'new_discovery':
                return `New ${prompt.discoveryType} Detected: ${prompt.discoveryEntity}`;
            case 'confirmation':
                return `Please confirm: ${prompt.suggestion?.libraryName}`;
            default:
                return `Confidence: ${prompt.confidence}%`;
        }
    }

    getDiscordColor(prompt) {
        const colors = {
            low_confidence: 0xFFA500,
            ai_rejection: 0xFF0000,
            close_race: 0xFFFF00,
            new_discovery: 0x00FFFF,
            confirmation: 0x00FF00,
            standard: 0x0099FF
        };

        return colors[prompt.type] || colors.standard;
    }

    getDiscordFields(prompt) {
        const fields = [];

        if (prompt.type === 'low_confidence') {
            if (prompt.matchingSignals.length > 0) {
                fields.push({
                    name: '✅ Matching Signals',
                    value: prompt.matchingSignals.map(s => `• ${s}`).join('\n'),
                    inline: false
                });
            }
            if (prompt.conflictingSignals.length > 0) {
                fields.push({
                    name: '⚠️ Conflicting Signals',
                    value: prompt.conflictingSignals.map(s => `• ${s}`).join('\n'),
                    inline: false
                });
            }
            if (prompt.missingSignals.length > 0) {
                fields.push({
                    name: '❓ Missing Information',
                    value: prompt.missingSignals.map(s => `• ${s}`).join('\n'),
                    inline: false
                });
            }
        }

        if (prompt.suggestions && prompt.suggestions.length > 0) {
            fields.push({
                name: '📚 Suggestions',
                value: prompt.suggestions.map((s, i) =>
                    `[${i + 1}] ${s.libraryName} (${s.score}%)`
                ).join('\n'),
                inline: false
            });
        }

        return fields;
    }

    getDiscordComponents(prompt) {
        const components = [];

        if (prompt.suggestions && prompt.suggestions.length > 0) {
            const options = prompt.suggestions.map(s => ({
                label: s.libraryName,
                value: s.libraryId.toString(),
                description: `${s.score}% confidence`
            }));

            components.push({
                type: 1,
                components: [{
                    type: 3,
                    custom_id: 'library_select',
                    placeholder: 'Select library...',
                    options
                }]
            });
        }

        return components;
    }

    getWebContent(prompt) {
        return {
            header: prompt.title,
            description: this.getDiscordDescription(prompt),
            signals: {
                matching: prompt.matchingSignals || [],
                conflicting: prompt.conflictingSignals || [],
                missing: prompt.missingSignals || []
            },
            suggestions: prompt.suggestions || [],
            reasonOptions: prompt.reasonOptions || [],
            patternOptions: prompt.patternOptions || []
        };
    }

    getWebActions(prompt) {
        const actions = [];

        if (prompt.suggestions && prompt.suggestions.length > 0) {
            actions.push({
                type: 'select_library',
                options: prompt.suggestions.map(s => ({
                    value: s.libraryId,
                    label: s.libraryName,
                    score: s.score
                }))
            });
        }

        actions.push({
            type: 'submit',
            label: 'Confirm Selection'
        });

        return actions;
    }
}

export function createPromptBuilder({ libraryProfileService = defaultLibraryProfileService } = {}) {
    return new PromptBuilder({ libraryProfileService });
}

const promptBuilder = createPromptBuilder({ libraryProfileService: defaultLibraryProfileService });

export default promptBuilder;
