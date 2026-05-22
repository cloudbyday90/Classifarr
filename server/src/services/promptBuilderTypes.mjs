import { MAX_SUGGESTIONS, DARK_KEYWORDS, STRONG_SCORE_THRESHOLD, PATTERN_REINFORCEMENT_THRESHOLD } from './promptBuilder.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { safeJSONParse } from './promptBuilder.mjs';

export function determinePromptType(evaluationResult) {
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
        if (topScore - secondScore < 15) {
            return 'close_race';
        }
    }

    if (confidence < 70) {
        return 'low_confidence';
    }

    if (action === 'prompt_confirm') {
        return 'confirmation';
    }

    return 'standard';
}

export function buildLowConfidencePrompt(item, evaluation) {
    const { ranked, confidence } = evaluation;
    const topSuggestion = ranked && ranked.length > 0 ? ranked[0] : null;

    const signals = analyzeSignals(item, evaluation);

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
        reasonOptions: buildReasonOptions(item, evaluation),
        patternOptions: buildPatternOptions(item, evaluation)
    };
}

export function buildAIRejectionPrompt(item, evaluation) {
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
        reasonOptions: buildReasonOptions(item, evaluation),
        patternOptions: buildPatternOptions(item, evaluation)
    };
}

export function buildCloseRacePrompt(item, evaluation) {
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
        keyDifferences: identifyKeyDifferences(topCandidates, item),
        reasonOptions: buildReasonOptions(item, evaluation),
        patternOptions: buildPatternOptions(item, evaluation)
    };
}

export function buildNewDiscoveryPrompt(item, evaluation) {
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
        reasonOptions: buildReasonOptions(item, evaluation),
        patternOptions: buildPatternOptions(item, evaluation)
    };
}

export function buildConfirmationPrompt(item, evaluation, userChoice = null) {
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
        patternsReinforced: identifyReinforcedPatterns(item, evaluation, userChoice),
        patternsCreated: userChoice?.patternActions || [],
        futureImpact: describeFutureImpact(item, evaluation, userChoice),
        reasonOptions: buildReasonOptions(item, evaluation),
        patternOptions: buildPatternOptions(item, evaluation)
    };
}

export function buildStandardPrompt(item, evaluation) {
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
        reasonOptions: buildReasonOptions(item, evaluation),
        patternOptions: buildPatternOptions(item, evaluation)
    };
}

export function buildBatchSummary(items) {
    const grouped = {
        highConfidence: [],
        lowConfidence: [],
        closeRace: [],
        newDiscovery: []
    };

    for (const item of items) {
        const promptType = determinePromptType(item.evaluation);

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

export function buildTuningSuggestionPrompt(suggestion) {
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

export function buildReasonOptions(item, _evaluation) {
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

export function buildPatternOptions(item, _evaluation) {
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

export function analyzeSignals(item, evaluation) {
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

export function identifyKeyDifferences(topCandidates, _item) {
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

export function identifyReinforcedPatterns(item, evaluation, userChoice) {
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

export function describeFutureImpact(item, evaluation, userChoice) {
    if (!userChoice) {
        return 'Your choice will help improve future classifications.';
    }

    const hasPatternActions = userChoice.patternActions && userChoice.patternActions.length > 0;

    if (hasPatternActions) {
        return `New pattern${userChoice.patternActions.length > 1 ? 's' : ''} created. Similar items will be classified automatically.`;
    }

    return 'This decision will be used to improve classification accuracy.';
}
