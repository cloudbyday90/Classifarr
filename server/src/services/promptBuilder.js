/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

const logger = createLogger('PromptBuilder');

/**
 * PromptBuilder Service
 * Generates context-rich prompts for Discord and web UI that explain uncertainty,
 * show best guesses, capture user reasons, and make learning actionable.
 */
class PromptBuilder {
    /**
     * Build a prompt based on evaluation results
     * @param {object} item - Media item with metadata
     * @param {object} evaluationResult - PolicyEngine evaluation result
     * @returns {Promise<object>} Rich prompt with explanations and options
     */
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
    
    /**
     * Determine which type of prompt to show based on evaluation result
     * @param {object} evaluationResult - PolicyEngine evaluation result
     * @returns {string} Prompt type
     */
    determinePromptType(evaluationResult) {
        const { action, confidence, ranked, method, aiRejection, newStudio, newCollection } = evaluationResult;
        
        // Check for AI validation rejection
        if (aiRejection) {
            return 'ai_rejection';
        }
        
        // Check for new discovery (studio, collection, etc.)
        if (newStudio || newCollection) {
            return 'new_discovery';
        }
        
        // Check for close race (multiple similar scores)
        if (ranked && ranked.length >= 2) {
            const topScore = ranked[0].score;
            const secondScore = ranked[1].score;
            if (topScore - secondScore < 15) {
                return 'close_race';
            }
        }
        
        // Check for low confidence
        if (confidence < 70) {
            return 'low_confidence';
        }
        
        // Check for confirmation prompt (high confidence, needs user validation)
        if (action === 'prompt_confirm') {
            return 'confirmation';
        }
        
        return 'standard';
    }
    
    /**
     * Build low confidence prompt - explains why we're unsure
     * @param {object} item - Media item
     * @param {object} evaluation - Evaluation result
     * @returns {object} Low confidence prompt
     */
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
            suggestions: ranked ? ranked.slice(0, 3).map(r => ({
                libraryId: r.library_id,
                libraryName: r.library_name,
                score: r.score,
                policyId: r.policy_id
            })) : [],
            reasonOptions: this.buildReasonOptions(item, evaluation),
            patternOptions: this.buildPatternOptions(item, evaluation)
        };
    }
    
    /**
     * Build AI validation rejection prompt
     * @param {object} item - Media item
     * @param {object} evaluation - Evaluation result with AI rejection
     * @returns {object} AI rejection prompt
     */
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
    
    /**
     * Build close race prompt - multiple libraries with similar scores
     * @param {object} item - Media item
     * @param {object} evaluation - Evaluation result
     * @returns {object} Close race prompt
     */
    buildCloseRacePrompt(item, evaluation) {
        const { ranked } = evaluation;
        const topCandidates = ranked ? ranked.slice(0, 3) : [];
        
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
    
    /**
     * Build new discovery prompt - unknown studio/pattern
     * @param {object} item - Media item
     * @param {object} evaluation - Evaluation result
     * @returns {object} New discovery prompt
     */
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
            suggestions: ranked ? ranked.slice(0, 3).map(r => ({
                libraryId: r.library_id,
                libraryName: r.library_name,
                score: r.score,
                policyId: r.policy_id
            })) : [],
            reasonOptions: this.buildReasonOptions(item, evaluation),
            patternOptions: this.buildPatternOptions(item, evaluation)
        };
    }
    
    /**
     * Build confirmation prompt - explain what we learned
     * @param {object} item - Media item
     * @param {object} evaluation - Evaluation result
     * @param {object} userChoice - User's classification choice (optional)
     * @returns {object} Confirmation prompt
     */
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
    
    /**
     * Build standard prompt for other cases
     * @param {object} item - Media item
     * @param {object} evaluation - Evaluation result
     * @returns {object} Standard prompt
     */
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
            suggestions: ranked ? ranked.slice(0, 3).map(r => ({
                libraryId: r.library_id,
                libraryName: r.library_name,
                score: r.score,
                policyId: r.policy_id
            })) : [],
            reasonOptions: this.buildReasonOptions(item, evaluation),
            patternOptions: this.buildPatternOptions(item, evaluation)
        };
    }
    
    /**
     * Build batch summary for multiple items
     * @param {Array} items - Array of items with evaluations
     * @returns {object} Batch summary
     */
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
    
    /**
     * Build policy tuning suggestion prompt
     * @param {object} suggestion - Tuning suggestion from feedbackAnalysis
     * @returns {object} Tuning suggestion prompt
     */
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
    
    /**
     * Format prompt for Discord embed
     * @param {object} prompt - Prompt object
     * @returns {object} Discord embed with action buttons and select menus
     */
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
    
    /**
     * Format prompt for web UI
     * @param {object} prompt - Prompt object
     * @returns {object} Web UI formatted prompt with interactive elements
     */
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
    
    /**
     * Build reason capture options based on context
     * @param {object} item - Media item
     * @param {object} evaluation - Evaluation result
     * @returns {Array} Array of reason options
     */
    buildReasonOptions(item, evaluation) {
        const options = [];
        
        // Genre-based reasons
        if (item.genres) {
            const genres = typeof item.genres === 'string' ? JSON.parse(item.genres) : item.genres;
            if (Array.isArray(genres) && genres.length > 0) {
                options.push({
                    category: 'genre',
                    label: `Based on genre (${genres.slice(0, 2).join(', ')})`,
                    value: 'genre_based'
                });
            }
        }
        
        // Studio-based reasons
        if (item.studios || item.production_companies) {
            const studios = item.studios || item.production_companies;
            const studiosList = typeof studios === 'string' ? JSON.parse(studios) : studios;
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
        
        // Rating-based reasons
        if (item.certification) {
            options.push({
                category: 'rating',
                label: `Based on rating (${item.certification})`,
                value: 'rating_based'
            });
        }
        
        // Keyword-based reasons
        if (item.keywords) {
            options.push({
                category: 'keywords',
                label: 'Based on content keywords',
                value: 'keyword_based'
            });
        }
        
        // Collection-based reasons
        if (item.belongs_to_collection) {
            options.push({
                category: 'collection',
                label: 'Part of a collection/franchise',
                value: 'collection_based'
            });
        }
        
        // Custom option
        options.push({
            category: 'custom',
            label: 'Other reason',
            value: 'custom'
        });
        
        return options;
    }
    
    /**
     * Build pattern learning options
     * @param {object} item - Media item
     * @param {object} evaluation - Evaluation result
     * @returns {Array} Array of pattern learning options
     */
    buildPatternOptions(item, evaluation) {
        const options = [];
        
        // Studio pattern
        if (item.studios || item.production_companies) {
            const studios = item.studios || item.production_companies;
            const studiosList = typeof studios === 'string' ? JSON.parse(studios) : studios;
            if (Array.isArray(studiosList) && studiosList.length > 0) {
                const studioName = typeof studiosList[0] === 'string' ? studiosList[0] : studiosList[0]?.name;
                if (studioName) {
                    options.push({
                        type: 'remember_studio',
                        label: `Remember: ${studioName} → [Selected Library]`,
                        value: studioName
                    });
                }
            }
        }
        
        // Collection pattern
        if (item.belongs_to_collection) {
            const collection = typeof item.belongs_to_collection === 'string' 
                ? JSON.parse(item.belongs_to_collection) 
                : item.belongs_to_collection;
            const collectionName = typeof collection === 'string' ? collection : collection?.name;
            if (collectionName) {
                options.push({
                    type: 'remember_collection',
                    label: `Always classify ${collectionName} as [Selected Library]`,
                    value: collectionName
                });
            }
        }
        
        // Keyword pattern (for prominent keywords)
        if (item.keywords) {
            const keywords = typeof item.keywords === 'string' ? JSON.parse(item.keywords) : item.keywords;
            if (Array.isArray(keywords) && keywords.length > 0) {
                const prominentKeyword = keywords[0];
                if (prominentKeyword) {
                    options.push({
                        type: 'remember_keyword',
                        label: `Remember: "${prominentKeyword}" → [Selected Library]`,
                        value: prominentKeyword
                    });
                }
            }
        }
        
        return options;
    }
    
    // ============================================================================
    // HELPER METHODS
    // ============================================================================
    
    /**
     * Analyze signals to categorize them as matching, conflicting, or missing
     * @param {object} item - Media item
     * @param {object} evaluation - Evaluation result
     * @returns {object} Categorized signals
     */
    analyzeSignals(item, evaluation) {
        const signals = {
            matching: [],
            conflicting: [],
            missing: []
        };
        
        const topRanked = evaluation.ranked && evaluation.ranked[0];
        if (!topRanked) return signals;
        
        // Analyze genre signals
        if (item.genres) {
            const genres = typeof item.genres === 'string' ? JSON.parse(item.genres) : item.genres;
            if (Array.isArray(genres) && genres.length > 0) {
                signals.matching.push(`${genres.slice(0, 2).join(', ')} genre${genres.length > 1 ? 's' : ''}`);
            }
        }
        
        // Analyze rating signals
        if (item.certification) {
            signals.matching.push(`${item.certification} rating`);
        }
        
        // Check for conflicting keywords
        if (item.keywords || item.overview) {
            const text = (item.overview || '').toLowerCase();
            const darkKeywords = ['horror', 'dark', 'scary', 'violent'];
            const hasDarkContent = darkKeywords.some(k => text.includes(k));
            if (hasDarkContent) {
                signals.conflicting.push('Dark/mature themes detected');
            }
        }
        
        // Check for missing studio data
        if (!item.studios && !item.production_companies) {
            signals.missing.push('Studio information');
        }
        
        return signals;
    }
    
    /**
     * Identify key differences between top contenders
     * @param {Array} topCandidates - Top ranked candidates
     * @param {object} item - Media item
     * @returns {Array} Key differentiating factors
     */
    identifyKeyDifferences(topCandidates, item) {
        const differences = [];
        
        if (topCandidates.length < 2) return differences;
        
        for (let i = 0; i < Math.min(topCandidates.length, 3); i++) {
            const candidate = topCandidates[i];
            const strengths = [];
            
            if (candidate.scores?.preset > 70) {
                strengths.push('Strong preset match');
            }
            if (candidate.scores?.pattern > 70) {
                strengths.push('Known pattern');
            }
            if (candidate.scores?.rag > 70) {
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
    
    /**
     * Identify patterns that were reinforced by user choice
     * @param {object} item - Media item
     * @param {object} evaluation - Evaluation result
     * @param {object} userChoice - User's choice
     * @returns {Array} Reinforced patterns
     */
    identifyReinforcedPatterns(item, evaluation, userChoice) {
        const patterns = [];
        
        if (!userChoice) return patterns;
        
        // Check if user confirmed the top suggestion
        const topRanked = evaluation.ranked && evaluation.ranked[0];
        if (topRanked && userChoice.libraryId === topRanked.library_id) {
            if (topRanked.scores?.pattern > 50) {
                patterns.push('Existing pattern confirmed');
            }
            if (topRanked.scores?.rag > 50) {
                patterns.push('Semantic similarity validated');
            }
        }
        
        return patterns;
    }
    
    /**
     * Describe future impact of user's classification decision
     * @param {object} item - Media item
     * @param {object} evaluation - Evaluation result
     * @param {object} userChoice - User's choice
     * @returns {string} Description of impact
     */
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
    
    /**
     * Get Discord embed title based on prompt type
     * @param {object} prompt - Prompt object
     * @returns {string} Discord title
     */
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
    
    /**
     * Get Discord embed description
     * @param {object} prompt - Prompt object
     * @returns {string} Discord description
     */
    getDiscordDescription(prompt) {
        switch (prompt.type) {
            case 'low_confidence':
                return `Classification Needed\n\n📊 Confidence: ${prompt.confidence}% → ${prompt.topSuggestion?.libraryName || 'Unknown'}`;
            case 'ai_rejection':
                return `AI Validation Rejected\n\n${prompt.aiReasoning}`;
            case 'close_race':
                return `Close Call - Multiple Strong Matches`;
            case 'new_discovery':
                return `New ${prompt.discoveryType} Detected: ${prompt.discoveryEntity}`;
            case 'confirmation':
                return `Please confirm: ${prompt.suggestion?.libraryName}`;
            default:
                return `Confidence: ${prompt.confidence}%`;
        }
    }
    
    /**
     * Get Discord embed color based on confidence/type
     * @param {object} prompt - Prompt object
     * @returns {number} Discord color code
     */
    getDiscordColor(prompt) {
        const colors = {
            low_confidence: 0xFFA500, // Orange
            ai_rejection: 0xFF0000,   // Red
            close_race: 0xFFFF00,     // Yellow
            new_discovery: 0x00FFFF,  // Cyan
            confirmation: 0x00FF00,   // Green
            standard: 0x0099FF        // Blue
        };
        
        return colors[prompt.type] || colors.standard;
    }
    
    /**
     * Get Discord embed fields
     * @param {object} prompt - Prompt object
     * @returns {Array} Discord fields
     */
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
    
    /**
     * Get Discord action components (buttons, select menus)
     * @param {object} prompt - Prompt object
     * @returns {Array} Discord components
     */
    getDiscordComponents(prompt) {
        const components = [];
        
        // Add library selection menu if there are suggestions
        if (prompt.suggestions && prompt.suggestions.length > 0) {
            const options = prompt.suggestions.map(s => ({
                label: s.libraryName,
                value: s.libraryId.toString(),
                description: `${s.score}% confidence`
            }));
            
            components.push({
                type: 1, // Action row
                components: [{
                    type: 3, // Select menu
                    custom_id: 'library_select',
                    placeholder: 'Select library...',
                    options
                }]
            });
        }
        
        return components;
    }
    
    /**
     * Get web UI content sections
     * @param {object} prompt - Prompt object
     * @returns {object} Web content sections
     */
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
    
    /**
     * Get web UI actions
     * @param {object} prompt - Prompt object
     * @returns {Array} Web actions
     */
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

module.exports = new PromptBuilder();
