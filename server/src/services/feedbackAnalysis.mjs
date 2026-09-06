/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';

import { normalizeGroupingValues, groupByMetadataField, extractSignificantPatterns } from './feedbackAnalysisUtils.mjs';
import { detectFailurePatterns, analyzeSignalEffectiveness, detectNewPatterns, analyzeThresholds } from './feedbackAnalysisPatternDetection.mjs';
import { generateSuggestions, storeSuggestions, getPendingSuggestions, applySuggestion, rejectSuggestion, getImpactMetrics } from './feedbackAnalysisSuggestions.mjs';
import { updateLearningStats } from './feedbackAnalysisLearning.mjs';
import { captureSuggestionCohort } from './feedbackAnalysisCohort.mjs';

export { normalizeGroupingValues, groupByMetadataField, extractSignificantPatterns };
export { detectFailurePatterns, analyzeSignalEffectiveness, detectNewPatterns, analyzeThresholds };
export { generateSuggestions, storeSuggestions, getPendingSuggestions, applySuggestion, rejectSuggestion, getImpactMetrics };
export { updateLearningStats };

const logger = createLogger('FeedbackAnalysis');

export class FeedbackAnalysis {
    normalizeGroupingValues(...args) { return normalizeGroupingValues(...args); }
    groupByMetadataField(...args) { return groupByMetadataField(...args); }
    extractSignificantPatterns(...args) { return extractSignificantPatterns(...args); }

    async recordFeedback(feedbackData) {
        return withServiceCatch(logger, 'Failed to record feedback', async () => {
            const {
                tmdb_id,
                media_type,
                title,
                item_metadata,
                prompt_type,
                original_scores,
                top_suggestion_library_id,
                top_suggestion_score,
                selected_library_id,
                selected_policy_id,
                was_correction,
                user_reason,
                user_reason_text,
                signal_analysis,
                patterns_created,
                source = 'web',
                prompted_at,
                responded_at
            } = feedbackData;

            let response_time_seconds = null;
            if (prompted_at && responded_at) {
                const promptTime = new Date(prompted_at);
                const responseTime = new Date(responded_at);

                if (!Number.isNaN(promptTime.getTime()) && !Number.isNaN(responseTime.getTime())) {
                    const diffSeconds = (responseTime.getTime() - promptTime.getTime()) / 1000;

                    if (diffSeconds >= 0) {
                        response_time_seconds = Math.floor(diffSeconds);
                    } else {
                        logger.warn('Feedback response time is negative; possible clock skew or data error', {
                            prompted_at,
                            responded_at
                        });
                    }
                } else {
                    logger.warn('Invalid timestamps provided for feedback response time', {
                        prompted_at,
                        responded_at
                    });
                }
            }

            const result = await db.query(`
                INSERT INTO policy_feedback_log (
                    tmdb_id,
                    media_type,
                    title,
                    item_metadata,
                    prompt_type,
                    original_scores,
                    top_suggestion_library_id,
                    top_suggestion_score,
                    selected_library_id,
                    selected_policy_id,
                    was_correction,
                    user_reason,
                    user_reason_text,
                    signal_analysis,
                    patterns_created,
                    source,
                    prompted_at,
                    responded_at,
                    response_time_seconds
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                RETURNING id
            `, [
                tmdb_id,
                media_type,
                title,
                JSON.stringify(item_metadata || {}),
                prompt_type,
                JSON.stringify(original_scores || {}),
                top_suggestion_library_id,
                top_suggestion_score,
                selected_library_id,
                selected_policy_id,
                was_correction || false,
                user_reason,
                user_reason_text,
                JSON.stringify(signal_analysis || {}),
                JSON.stringify(patterns_created || []),
                source,
                prompted_at || new Date(),
                responded_at || new Date(),
                response_time_seconds
            ]);

            const feedbackId = result.rows[0].id;

            logger.info('Feedback recorded', {
                feedbackId,
                tmdb_id,
                title,
                was_correction,
                selected_library_id
            });

            if (selected_policy_id) {
                await this.updateLearningStats(selected_policy_id);
            }

            return feedbackId;
        });
    }

    async analyzePolicy(policyId, options = {}) {
        const { days = 30, minFeedback = 5 } = options;

        return withServiceCatch(logger, 'Failed to analyze policy', { policyId }, async () => {
            logger.info('Analyzing policy', { policyId, days, minFeedback });

            const cohort = await captureSuggestionCohort(policyId, days);
            const feedback = cohort.feedback;

            if (feedback.length === 0 || feedback.length < minFeedback) {
                logger.info('Insufficient feedback for analysis', {
                    policyId,
                    feedbackCount: feedback.length,
                    minRequired: minFeedback
                });
                return {
                    policyId,
                    feedbackCount: feedback.length,
                    suggestions: [],
                    message: 'Insufficient feedback for meaningful analysis'
                };
            }

            const failurePatterns = await this.detectFailurePatterns(policyId, feedback);
            const signalEffectiveness = await this.analyzeSignalEffectiveness(policyId, feedback);
            const newPatterns = await this.detectNewPatterns(policyId, feedback);
            const thresholdAnalysis = await this.analyzeThresholds(policyId, feedback, cohort.policy);

            const analysis = {
                failurePatterns,
                signalEffectiveness,
                newPatterns,
                thresholdAnalysis
            };

            const suggestions = await this.generateSuggestions(policyId, analysis, feedback);
            const storedSuggestions = await this.storeSuggestions(policyId, suggestions, cohort);

            logger.info('Policy analysis complete', {
                policyId,
                feedbackCount: feedback.length,
                suggestionsGenerated: storedSuggestions.length
            });

            return {
                policyId,
                feedbackCount: feedback.length,
                analysis,
                suggestions: storedSuggestions
            };
        });
    }

    async detectFailurePatterns(...args) { return detectFailurePatterns(...args); }
    async analyzeSignalEffectiveness(...args) { return analyzeSignalEffectiveness(...args); }
    async detectNewPatterns(...args) { return detectNewPatterns(...args); }
    async analyzeThresholds(...args) { return analyzeThresholds(...args); }
    async generateSuggestions(...args) { return generateSuggestions(...args); }
    async storeSuggestions(...args) { return storeSuggestions(...args); }
    async updateLearningStats(...args) { return updateLearningStats(...args); }
    async getPendingSuggestions(...args) { return getPendingSuggestions(...args); }
    async applySuggestion(...args) { return applySuggestion(...args); }
    async rejectSuggestion(...args) { return rejectSuggestion(...args); }
    async getImpactMetrics(...args) { return getImpactMetrics(...args); }

    async runFullAnalysis() {
        return withServiceCatch(logger, 'Failed to run full analysis', async () => {
            logger.info('Running full analysis for all active policies');

            const policiesResult = await db.query(`
                SELECT id, name FROM library_policies
                WHERE enabled = true
            `);

            const results = [];

            for (const policy of policiesResult.rows) {
                try {
                    const analysis = await this.analyzePolicy(policy.id);
                    results.push({
                        policyId: policy.id,
                        policyName: policy.name,
                        ...analysis
                    });
                } catch (error) {
                    logger.error('Failed to analyze policy in full analysis', {
                        policyId: policy.id,
                        error: error.message
                    });
                    results.push({
                        policyId: policy.id,
                        policyName: policy.name,
                        error: error.message
                    });
                }
            }

            logger.info('Full analysis complete', {
                policiesAnalyzed: results.length
            });

            return {
                policiesAnalyzed: results.length,
                results
            };
        });
    }
}

export function createFeedbackAnalysis() {
    return new FeedbackAnalysis();
}

export const feedbackAnalysis = createFeedbackAnalysis();
