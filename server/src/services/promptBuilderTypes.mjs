import { MAX_SUGGESTIONS } from './promptBuilderConstants.mjs';
import { buildReasonOptions, buildPatternOptions, analyzeSignals, identifyKeyDifferences, identifyReinforcedPatterns, describeFutureImpact } from './promptBuilderTypeHelpers.mjs';

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
