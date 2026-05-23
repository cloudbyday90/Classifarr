import { createLogger } from '../utils/logger.mjs';
import { storeSuggestions as _storeSuggestions, getPendingSuggestions as _getPendingSuggestions } from './feedbackAnalysisSuggestionStore.mjs';
import { applySuggestion as _applySuggestion, rejectSuggestion as _rejectSuggestion, getImpactMetrics as _getImpactMetrics } from './feedbackAnalysisSuggestionApply.mjs';

const logger = createLogger('FeedbackAnalysis');

export async function generateSuggestions(_policyId, analysis) {
    try {
        const suggestions = [];

        if (analysis.failurePatterns) {
            for (const pattern of analysis.failurePatterns.missedPositives || []) {
                if (pattern.count >= 3) {
                    suggestions.push({
                        type: 'create_pattern',
                        config: {
                            pattern_type: pattern.type,
                            pattern_value: pattern.value,
                            confidence: Math.min(pattern.count * 20, 90)
                        },
                        supporting_feedback: pattern.feedbackIds || [],
                        confidence: Math.min(pattern.count * 15, 85),
                        impact_estimate: `Found in ${pattern.count} corrections toward this policy`
                    });
                }
            }

            for (const issue of analysis.failurePatterns.thresholdIssues || []) {
                if (issue.recommendation === 'increase_auto_classify_threshold') {
                    suggestions.push({
                        type: 'adjust_threshold',
                        config: {
                            threshold_type: 'auto_classify',
                            current: null,
                            recommended: null,
                            reason: `High false positive rate (${(issue.correctionRate * 100).toFixed(1)}%)`
                        },
                        supporting_feedback: [],
                        confidence: 70,
                        impact_estimate: `May reduce false positives by ${(issue.correctionRate * 50).toFixed(0)}%`
                    });
                } else if (issue.recommendation === 'decrease_auto_classify_threshold') {
                    suggestions.push({
                        type: 'adjust_threshold',
                        config: {
                            threshold_type: 'auto_classify',
                            current: null,
                            recommended: null,
                            reason: `Low auto-classification rate (${(issue.autoRate * 100).toFixed(1)}%)`
                        },
                        supporting_feedback: [],
                        confidence: 65,
                        impact_estimate: `May increase auto-classification by ${((1 - issue.autoRate) * 30).toFixed(0)}%`
                    });
                }
            }
        }

        if (analysis.signalEffectiveness) {
            for (const [signal, stats] of Object.entries(analysis.signalEffectiveness)) {
                if (stats.accuracy < 0.5 && (stats.correct + stats.incorrect) >= 5) {
                    suggestions.push({
                        type: 'adjust_weight',
                        config: {
                            signal,
                            current: null,
                            recommended: null,
                            reason: `Low accuracy (${(stats.accuracy * 100).toFixed(1)}%)`
                        },
                        supporting_feedback: [],
                        confidence: 60,
                        impact_estimate: `Signal has ${(stats.accuracy * 100).toFixed(1)}% accuracy`
                    });
                } else if (stats.accuracy > 0.85 && (stats.correct + stats.incorrect) >= 10) {
                    suggestions.push({
                        type: 'adjust_weight',
                        config: {
                            signal,
                            current: null,
                            recommended: null,
                            reason: `High accuracy (${(stats.accuracy * 100).toFixed(1)}%)`
                        },
                        supporting_feedback: [],
                        confidence: 75,
                        impact_estimate: `Signal has ${(stats.accuracy * 100).toFixed(1)}% accuracy`
                    });
                }
            }
        }

        if (analysis.newPatterns && analysis.newPatterns.length > 0) {
            for (const pattern of analysis.newPatterns) {
                suggestions.push({
                    type: 'create_pattern',
                    config: {
                        pattern_type: pattern.type,
                        pattern_value: pattern.value,
                        confidence: Math.min(pattern.count * 20, 90)
                    },
                    supporting_feedback: pattern.feedbackIds || [],
                    confidence: Math.min(pattern.count * 15, 85),
                    impact_estimate: `Found in ${pattern.count} user corrections`
                });
            }
        }

        return suggestions;

    } catch (error) {
        logger.error('Failed to generate suggestions', { error: error.message });
        return [];
    }
}

export async function storeSuggestions(policyId, suggestions) {
    return _storeSuggestions(policyId, suggestions);
}

export async function getPendingSuggestions(policyId) {
    return _getPendingSuggestions(policyId);
}

export async function applySuggestion(suggestionId, userId) {
    return _applySuggestion(suggestionId, userId);
}

export async function rejectSuggestion(suggestionId, userId, reason) {
    return _rejectSuggestion(suggestionId, userId, reason);
}

export async function getImpactMetrics(suggestionId) {
    return _getImpactMetrics(suggestionId);
}
