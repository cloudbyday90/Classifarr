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

const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('FeedbackAnalysis');

// Configuration constants for tuning suggestions
const TUNING_CONSTANTS = {
    THRESHOLD_ADJUSTMENT: 5,           // ±5 points for threshold adjustments
    WEIGHT_ADJUSTMENT: 0.1,            // ±0.1 for weight adjustments
    MIN_AUTO_CLASSIFY_THRESHOLD: 60,  // Minimum auto-classify threshold
    MAX_AUTO_CLASSIFY_THRESHOLD: 95,  // Maximum auto-classify threshold
    MIN_PROMPT_THRESHOLD: 50,          // Minimum prompt threshold
    MIN_WEIGHT: 0.05,                  // Minimum weight value
    MAX_WEIGHT: 0.60                   // Maximum weight value
};

/**
 * Feedback Analysis & Pattern Learning Loop Service
 * Analyzes feedback logs to detect systematic misclassifications,
 * recurring patterns, and generates actionable tuning recommendations.
 */
class FeedbackAnalysis {
    /**
     * Record a feedback event when user makes a classification decision
     * @param {object} feedbackData - Feedback data including item metadata, scores, and decision
     * @returns {Promise<number>} Feedback ID
     */
    async recordFeedback(feedbackData) {
        try {
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

            // Calculate response time if both timestamps provided
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

            // Update learning stats for the affected policy
            if (selected_policy_id) {
                await this.updateLearningStats(selected_policy_id);
            }

            return feedbackId;

        } catch (error) {
            logger.error('Failed to record feedback', { error: error.message });
            throw error;
        }
    }

    /**
     * Analyze feedback for a specific policy
     * @param {number} policyId - Policy ID to analyze
     * @param {object} options - Analysis options (days, minFeedback)
     * @returns {Promise<object>} Analysis results with suggestions
     */
    async analyzePolicy(policyId, options = {}) {
        const { days = 30, minFeedback = 5 } = options;

        try {
            logger.info('Analyzing policy', { policyId, days, minFeedback });

            // Get feedback for this policy within the timeframe
            const feedbackResult = await db.query(`
                SELECT * FROM policy_feedback_log
                WHERE selected_policy_id = $1
                AND prompted_at >= NOW() - INTERVAL '1 day' * $2
                ORDER BY prompted_at DESC
            `, [policyId, days]);

            const feedback = feedbackResult.rows;

            if (feedback.length < minFeedback) {
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

            // Perform various analyses
            const failurePatterns = await this.detectFailurePatterns(policyId, feedback);
            const signalEffectiveness = await this.analyzeSignalEffectiveness(policyId, feedback);
            const newPatterns = await this.detectNewPatterns(policyId, feedback);
            const thresholdAnalysis = await this.analyzeThresholds(policyId, feedback);

            // Generate suggestions based on all analyses
            const analysis = {
                failurePatterns,
                signalEffectiveness,
                newPatterns,
                thresholdAnalysis
            };

            const suggestions = await this.generateSuggestions(policyId, analysis);

            // Store suggestions in database
            const storedSuggestions = await this.storeSuggestions(policyId, suggestions);

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

        } catch (error) {
            logger.error('Failed to analyze policy', {
                error: error.message,
                policyId
            });
            throw error;
        }
    }

    /**
     * Detect failure patterns in feedback data
     * @param {number} policyId - Policy ID
     * @param {Array} feedback - Array of feedback records
     * @returns {Promise<object>} Detected failure patterns
     */
    async detectFailurePatterns(policyId, feedback) {
        try {
            const patterns = {
                falsePositives: [],
                missedPositives: [],
                thresholdIssues: []
            };

            // 1. Find recurring false positives (corrections away from this policy)
            const falsePositiveCorrections = feedback.filter(f => 
                f.was_correction && f.top_suggestion_library_id !== f.selected_library_id
            );

            if (falsePositiveCorrections.length > 0) {
                // Group by common attributes to find patterns
                const byGenre = this.groupByMetadataField(falsePositiveCorrections, 'genres');
                const byStudio = this.groupByMetadataField(falsePositiveCorrections, 'production_companies');
                const byKeyword = this.groupByMetadataField(falsePositiveCorrections, 'keywords');

                patterns.falsePositives = [
                    ...this.extractSignificantPatterns(byGenre, 'genre', 3),
                    ...this.extractSignificantPatterns(byStudio, 'studio', 3),
                    ...this.extractSignificantPatterns(byKeyword, 'keyword', 3)
                ];
            }

            // 2. Find missed positives (corrections toward this policy)
            // First, determine the library associated with this policy
            const policyLibraryResult = await db.query(
                `SELECT library_id FROM library_policies WHERE id = $1`,
                [policyId]
            );
            const policyLibraryId = policyLibraryResult.rows[0]?.library_id || null;

            // Get feedback where user selected this policy but it wasn't the top suggestion
            const correctionsTowardPolicy = await db.query(`
                SELECT * FROM policy_feedback_log
                WHERE selected_policy_id = $1
                AND was_correction = true
                AND (top_suggestion_library_id IS NULL 
                    OR top_suggestion_library_id != $2)
                AND prompted_at >= NOW() - INTERVAL '30 days'
            `, [policyId, policyLibraryId]);

            if (correctionsTowardPolicy.rows.length > 0) {
                const byGenre = this.groupByMetadataField(correctionsTowardPolicy.rows, 'genres');
                const byStudio = this.groupByMetadataField(correctionsTowardPolicy.rows, 'production_companies');
                const byKeyword = this.groupByMetadataField(correctionsTowardPolicy.rows, 'keywords');

                patterns.missedPositives = [
                    ...this.extractSignificantPatterns(byGenre, 'genre', 3),
                    ...this.extractSignificantPatterns(byStudio, 'studio', 3),
                    ...this.extractSignificantPatterns(byKeyword, 'keyword', 3)
                ];
            }

            // 3. Detect threshold issues based on score distribution
            const scoreDistribution = feedback.map(f => f.top_suggestion_score).filter(s => s !== null);
            if (scoreDistribution.length > 0) {
                const avgScore = scoreDistribution.reduce((a, b) => a + b, 0) / scoreDistribution.length;
                const corrections = feedback.filter(f => f.was_correction);
                const correctionRate = corrections.length / feedback.length;

                // If high correction rate with high average scores, threshold may be too low
                if (correctionRate > 0.3 && avgScore > 75) {
                    patterns.thresholdIssues.push({
                        issue: 'high_false_positive_rate',
                        correctionRate,
                        avgScore,
                        recommendation: 'increase_auto_classify_threshold'
                    });
                }

                // If low auto-classification but high accuracy, threshold may be too high
                const autoClassified = feedback.filter(f => f.prompt_type === 'auto_classify');
                if (autoClassified.length / feedback.length < 0.3 && correctionRate < 0.1) {
                    patterns.thresholdIssues.push({
                        issue: 'low_auto_classification_rate',
                        autoRate: autoClassified.length / feedback.length,
                        correctionRate,
                        recommendation: 'decrease_auto_classify_threshold'
                    });
                }
            }

            return patterns;

        } catch (error) {
            logger.error('Failed to detect failure patterns', { error: error.message });
            return { falsePositives: [], missedPositives: [], thresholdIssues: [] };
        }
    }

    /**
     * Analyze signal effectiveness
     * @param {number} policyId - Policy ID
     * @param {Array} feedback - Array of feedback records
     * @returns {Promise<object>} Signal effectiveness analysis
     */
    async analyzeSignalEffectiveness(policyId, feedback) {
        try {
            const analysis = {
                preset: { correct: 0, incorrect: 0, avgScore: 0 },
                pattern: { correct: 0, incorrect: 0, avgScore: 0 },
                rag: { correct: 0, incorrect: 0, avgScore: 0 },
                history: { correct: 0, incorrect: 0, avgScore: 0 }
            };

            // Analyze each feedback's signal scores
            for (const f of feedback) {
                const scores = f.original_scores || {};
                const isCorrect = !f.was_correction;

                for (const signal of ['preset', 'pattern', 'rag', 'history']) {
                    if (scores[signal] !== undefined) {
                        if (isCorrect) {
                            analysis[signal].correct++;
                            analysis[signal].avgScore += scores[signal] || 0;
                        } else {
                            analysis[signal].incorrect++;
                        }
                    }
                }
            }

            // Calculate averages
            for (const signal of Object.keys(analysis)) {
                const total = analysis[signal].correct + analysis[signal].incorrect;
                if (analysis[signal].correct > 0) {
                    analysis[signal].avgScore /= analysis[signal].correct;
                }
                analysis[signal].accuracy = total > 0 ? analysis[signal].correct / total : 0;
            }

            return analysis;

        } catch (error) {
            logger.error('Failed to analyze signal effectiveness', { error: error.message });
            return {};
        }
    }

    /**
     * Detect new patterns from feedback
     * @param {number} policyId - Policy ID
     * @param {Array} feedback - Array of feedback records
     * @returns {Promise<Array>} Detected new patterns
     */
    async detectNewPatterns(policyId, feedback) {
        try {
            // Find items that were corrected TO this policy (user chose it when it wasn't suggested)
            const correctionsToward = feedback.filter(f =>
                f.was_correction && f.selected_policy_id === policyId
            );

            if (correctionsToward.length === 0) {
                return [];
            }

            // Extract patterns from metadata
            const patterns = [];

            // Studios
            const studios = this.groupByMetadataField(correctionsToward, 'production_companies');
            patterns.push(...this.extractSignificantPatterns(studios, 'studio', 2));

            // Keywords
            const keywords = this.groupByMetadataField(correctionsToward, 'keywords');
            patterns.push(...this.extractSignificantPatterns(keywords, 'keyword', 2));

            // Genres
            const genres = this.groupByMetadataField(correctionsToward, 'genres');
            patterns.push(...this.extractSignificantPatterns(genres, 'genre', 2));

            // Collections
            const collections = this.groupByMetadataField(correctionsToward, 'belongs_to_collection');
            patterns.push(...this.extractSignificantPatterns(collections, 'collection', 2));

            return patterns;

        } catch (error) {
            logger.error('Failed to detect new patterns', { error: error.message });
            return [];
        }
    }

    /**
     * Analyze threshold effectiveness
     * @param {number} policyId - Policy ID
     * @param {Array} feedback - Array of feedback records
     * @returns {Promise<object>} Threshold analysis
     */
    async analyzeThresholds(policyId, feedback) {
        try {
            // Get current thresholds
            const policyResult = await db.query(`
                SELECT auto_classify_threshold, prompt_threshold
                FROM library_policies
                WHERE id = $1
            `, [policyId]);

            if (policyResult.rows.length === 0) {
                return {};
            }

            const currentThresholds = policyResult.rows[0];

            // Separate feedback by action type
            const autoClassified = feedback.filter(f => f.top_suggestion_score >= currentThresholds.auto_classify_threshold);
            const prompted = feedback.filter(f => 
                f.top_suggestion_score < currentThresholds.auto_classify_threshold &&
                f.top_suggestion_score >= currentThresholds.prompt_threshold
            );
            const manual = feedback.filter(f => f.top_suggestion_score < currentThresholds.prompt_threshold);

            // Calculate accuracy for each group
            const autoAccuracy = autoClassified.length > 0
                ? autoClassified.filter(f => !f.was_correction).length / autoClassified.length
                : 0;

            const promptAccuracy = prompted.length > 0
                ? prompted.filter(f => !f.was_correction).length / prompted.length
                : 0;

            return {
                current: currentThresholds,
                autoClassified: {
                    count: autoClassified.length,
                    accuracy: autoAccuracy,
                    corrections: autoClassified.filter(f => f.was_correction).length
                },
                prompted: {
                    count: prompted.length,
                    accuracy: promptAccuracy,
                    corrections: prompted.filter(f => f.was_correction).length
                },
                manual: {
                    count: manual.length
                }
            };

        } catch (error) {
            logger.error('Failed to analyze thresholds', { error: error.message });
            return {};
        }
    }

    /**
     * Generate tuning suggestions based on analysis
     * @param {number} policyId - Policy ID
     * @param {object} analysis - Analysis results
     * @returns {Promise<Array>} Array of suggestions
     */
    async generateSuggestions(policyId, analysis) {
        try {
            const suggestions = [];

            // 1. Suggestions from failure patterns
            if (analysis.failurePatterns) {
                // Add presets for missed positives
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

                // Threshold adjustments
                for (const issue of analysis.failurePatterns.thresholdIssues || []) {
                    if (issue.recommendation === 'increase_auto_classify_threshold') {
                        suggestions.push({
                            type: 'adjust_threshold',
                            config: {
                                threshold_type: 'auto_classify',
                                current: null, // Will be filled in storeSuggestions
                                recommended: null, // Will be calculated
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

            // 2. Suggestions from signal effectiveness
            if (analysis.signalEffectiveness) {
                for (const [signal, stats] of Object.entries(analysis.signalEffectiveness)) {
                    if (stats.accuracy < 0.5 && (stats.correct + stats.incorrect) >= 5) {
                        // Signal is performing poorly
                        suggestions.push({
                            type: 'adjust_weight',
                            config: {
                                signal,
                                current: null, // Will be filled from policy
                                recommended: null, // Decrease weight
                                reason: `Low accuracy (${(stats.accuracy * 100).toFixed(1)}%)`
                            },
                            supporting_feedback: [],
                            confidence: 60,
                            impact_estimate: `Signal has ${(stats.accuracy * 100).toFixed(1)}% accuracy`
                        });
                    } else if (stats.accuracy > 0.85 && (stats.correct + stats.incorrect) >= 10) {
                        // Signal is performing well
                        suggestions.push({
                            type: 'adjust_weight',
                            config: {
                                signal,
                                current: null,
                                recommended: null, // Increase weight
                                reason: `High accuracy (${(stats.accuracy * 100).toFixed(1)}%)`
                            },
                            supporting_feedback: [],
                            confidence: 75,
                            impact_estimate: `Signal has ${(stats.accuracy * 100).toFixed(1)}% accuracy`
                        });
                    }
                }
            }

            // 3. Suggestions from new patterns
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

    /**
     * Store suggestions in database
     * @param {number} policyId - Policy ID
     * @param {Array} suggestions - Array of suggestion objects
     * @returns {Promise<Array>} Stored suggestion records with IDs
     */
    async storeSuggestions(policyId, suggestions) {
        try {
            // Get current policy configuration for filling in current values
            const policyResult = await db.query(`
                SELECT 
                    auto_classify_threshold,
                    prompt_threshold,
                    preset_weight,
                    pattern_weight,
                    rag_weight,
                    history_weight
                FROM library_policies
                WHERE id = $1
            `, [policyId]);

            if (policyResult.rows.length === 0) {
                throw new Error('Policy not found');
            }

            const policy = policyResult.rows[0];
            const storedSuggestions = [];

            for (const suggestion of suggestions) {
                // Fill in current values and calculate recommendations
                if (suggestion.type === 'adjust_threshold') {
                    const thresholdType = suggestion.config.threshold_type;
                    if (thresholdType === 'auto_classify') {
                        suggestion.config.current = policy.auto_classify_threshold;
                        // Adjust by configured amount based on recommendation reason
                        if (suggestion.config.reason.includes('High false positive')) {
                            suggestion.config.recommended = Math.min(
                                policy.auto_classify_threshold + TUNING_CONSTANTS.THRESHOLD_ADJUSTMENT,
                                TUNING_CONSTANTS.MAX_AUTO_CLASSIFY_THRESHOLD
                            );
                        } else {
                            suggestion.config.recommended = Math.max(
                                policy.auto_classify_threshold - TUNING_CONSTANTS.THRESHOLD_ADJUSTMENT,
                                TUNING_CONSTANTS.MIN_AUTO_CLASSIFY_THRESHOLD
                            );
                        }
                    } else if (thresholdType === 'prompt') {
                        suggestion.config.current = policy.prompt_threshold;
                        suggestion.config.recommended = Math.max(
                            policy.prompt_threshold - TUNING_CONSTANTS.THRESHOLD_ADJUSTMENT,
                            TUNING_CONSTANTS.MIN_PROMPT_THRESHOLD
                        );
                    }
                } else if (suggestion.type === 'adjust_weight') {
                    const signal = suggestion.config.signal;
                    const weightMap = {
                        preset: policy.preset_weight || 0.40,
                        pattern: policy.pattern_weight || 0.30,
                        rag: policy.rag_weight || 0.20,
                        history: policy.history_weight || 0.10
                    };
                    suggestion.config.current = weightMap[signal];
                    
                    // Adjust by configured amount based on performance
                    if (suggestion.config.reason.includes('Low accuracy')) {
                        suggestion.config.recommended = Math.max(
                            suggestion.config.current - TUNING_CONSTANTS.WEIGHT_ADJUSTMENT,
                            TUNING_CONSTANTS.MIN_WEIGHT
                        );
                    } else {
                        suggestion.config.recommended = Math.min(
                            suggestion.config.current + TUNING_CONSTANTS.WEIGHT_ADJUSTMENT,
                            TUNING_CONSTANTS.MAX_WEIGHT
                        );
                    }
                }

                // Check if similar suggestion already exists
                const existingResult = await db.query(`
                    SELECT id FROM policy_tuning_suggestions
                    WHERE policy_id = $1
                    AND suggestion_type = $2
                    AND suggestion_config::text = $3::text
                    AND status = 'pending'
                `, [policyId, suggestion.type, JSON.stringify(suggestion.config)]);

                if (existingResult.rows.length > 0) {
                    logger.debug('Similar suggestion already exists', {
                        suggestionId: existingResult.rows[0].id
                    });
                    continue;
                }

                // Insert new suggestion
                const result = await db.query(`
                    INSERT INTO policy_tuning_suggestions (
                        policy_id,
                        suggestion_type,
                        suggestion_config,
                        supporting_feedback_ids,
                        confidence,
                        impact_estimate,
                        status
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, 'pending')
                    RETURNING id, suggestion_type, suggestion_config, confidence, impact_estimate, status, created_at
                `, [
                    policyId,
                    suggestion.type,
                    JSON.stringify(suggestion.config),
                    suggestion.supporting_feedback || [],
                    suggestion.confidence,
                    suggestion.impact_estimate
                ]);

                storedSuggestions.push(result.rows[0]);
            }

            logger.info('Suggestions stored', {
                policyId,
                count: storedSuggestions.length
            });

            return storedSuggestions;

        } catch (error) {
            logger.error('Failed to store suggestions', { error: error.message });
            throw error;
        }
    }

    /**
     * Update learning stats for a policy
     * @param {number} policyId - Policy ID
     * @returns {Promise<object>} Updated stats
     */
    async updateLearningStats(policyId) {
        try {
            // Get all feedback for this policy
            const allFeedback = await db.query(`
                SELECT * FROM policy_feedback_log
                WHERE selected_policy_id = $1
                ORDER BY prompted_at DESC
            `, [policyId]);

            const feedback = allFeedback.rows;

            if (feedback.length === 0) {
                return null;
            }

            // Calculate metrics
            const total_decisions = feedback.length;
            const auto_classified = feedback.filter(f => f.prompt_type === 'auto_classify').length;
            const ai_validated = feedback.filter(f => f.prompt_type === 'ai_validate').length;
            const user_prompted = feedback.filter(f => 
                f.prompt_type === 'prompt_confirm' || f.prompt_type === 'prompt_select'
            ).length;
            const user_corrections = feedback.filter(f => f.was_correction).length;

            const accuracy_rate = total_decisions > 0
                ? (total_decisions - user_corrections) / total_decisions
                : 0;

            const auto_accuracy_rate = auto_classified > 0
                ? feedback.filter(f => f.prompt_type === 'auto_classify' && !f.was_correction).length / auto_classified
                : 0;

            // Last 7 days
            const last7Days = feedback.filter(f => {
                const date = new Date(f.prompted_at);
                const now = new Date();
                const diffDays = (now - date) / (1000 * 60 * 60 * 24);
                return diffDays <= 7;
            });

            const last_7_days_accuracy = last7Days.length > 0
                ? last7Days.filter(f => !f.was_correction).length / last7Days.length
                : null;

            // Last 30 days
            const last30Days = feedback.filter(f => {
                const date = new Date(f.prompted_at);
                const now = new Date();
                const diffDays = (now - date) / (1000 * 60 * 60 * 24);
                return diffDays <= 30;
            });

            const last_30_days_accuracy = last30Days.length > 0
                ? last30Days.filter(f => !f.was_correction).length / last30Days.length
                : null;

            // Determine trend
            let trend = 'stable';
            if (last_7_days_accuracy !== null && last_30_days_accuracy !== null) {
                if (last_7_days_accuracy > last_30_days_accuracy + 0.05) {
                    trend = 'improving';
                } else if (last_7_days_accuracy < last_30_days_accuracy - 0.05) {
                    trend = 'declining';
                }
            }

            const last_decision_at = feedback[0].prompted_at;
            const lastCorrection = feedback.find(f => f.was_correction);
            const last_correction_at = lastCorrection ? lastCorrection.prompted_at : null;

            // Upsert stats
            const result = await db.query(`
                INSERT INTO policy_learning_stats (
                    policy_id,
                    total_decisions,
                    auto_classified,
                    ai_validated,
                    user_prompted,
                    user_corrections,
                    accuracy_rate,
                    auto_accuracy_rate,
                    last_7_days_accuracy,
                    last_30_days_accuracy,
                    trend,
                    last_decision_at,
                    last_correction_at,
                    updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
                ON CONFLICT (policy_id) DO UPDATE SET
                    total_decisions = EXCLUDED.total_decisions,
                    auto_classified = EXCLUDED.auto_classified,
                    ai_validated = EXCLUDED.ai_validated,
                    user_prompted = EXCLUDED.user_prompted,
                    user_corrections = EXCLUDED.user_corrections,
                    accuracy_rate = EXCLUDED.accuracy_rate,
                    auto_accuracy_rate = EXCLUDED.auto_accuracy_rate,
                    last_7_days_accuracy = EXCLUDED.last_7_days_accuracy,
                    last_30_days_accuracy = EXCLUDED.last_30_days_accuracy,
                    trend = EXCLUDED.trend,
                    last_decision_at = EXCLUDED.last_decision_at,
                    last_correction_at = EXCLUDED.last_correction_at,
                    updated_at = NOW()
                RETURNING *
            `, [
                policyId,
                total_decisions,
                auto_classified,
                ai_validated,
                user_prompted,
                user_corrections,
                accuracy_rate,
                auto_accuracy_rate,
                last_7_days_accuracy,
                last_30_days_accuracy,
                trend,
                last_decision_at,
                last_correction_at
            ]);

            logger.info('Learning stats updated', {
                policyId,
                accuracy_rate: (accuracy_rate * 100).toFixed(1) + '%',
                trend
            });

            return result.rows[0];

        } catch (error) {
            logger.error('Failed to update learning stats', { error: error.message, policyId });
            throw error;
        }
    }

    /**
     * Get pending suggestions for a policy
     * @param {number} policyId - Policy ID
     * @returns {Promise<Array>} Pending suggestions with supporting feedback
     */
    async getPendingSuggestions(policyId) {
        try {
            const result = await db.query(`
                SELECT 
                    pts.*,
                    lp.name as policy_name,
                    lp.library_id
                FROM policy_tuning_suggestions pts
                JOIN library_policies lp ON pts.policy_id = lp.id
                WHERE pts.policy_id = $1
                AND pts.status = 'pending'
                ORDER BY pts.confidence DESC, pts.created_at DESC
            `, [policyId]);

            return result.rows;

        } catch (error) {
            logger.error('Failed to get pending suggestions', { error: error.message });
            throw error;
        }
    }

    /**
     * Apply a suggestion
     * @param {number} suggestionId - Suggestion ID
     * @param {number} userId - User ID applying the suggestion
     * @returns {Promise<object>} Result of application
     */
    async applySuggestion(suggestionId, userId) {
        const client = await db.pool.connect();
        try {
            // Begin transaction for atomicity
            await client.query('BEGIN');

            // Get suggestion details
            const suggestionResult = await client.query(`
                SELECT * FROM policy_tuning_suggestions
                WHERE id = $1
            `, [suggestionId]);

            if (suggestionResult.rows.length === 0) {
                throw new Error('Suggestion not found');
            }

            const suggestion = suggestionResult.rows[0];
            const config = suggestion.suggestion_config;

            // Get current policy state for before_metrics (only relevant fields)
            const beforeResult = await client.query(`
                SELECT 
                    auto_classify_threshold,
                    prompt_threshold,
                    preset_weight,
                    pattern_weight,
                    rag_weight,
                    history_weight
                FROM library_policies WHERE id = $1
            `, [suggestion.policy_id]);

            const before_metrics = beforeResult.rows[0];

            // Apply the suggestion based on type
            let applied = false;
            let change_type = suggestion.suggestion_type;

            if (suggestion.suggestion_type === 'adjust_threshold') {
                if (config.threshold_type === 'auto_classify') {
                    await client.query(`
                        UPDATE library_policies
                        SET auto_classify_threshold = $1, updated_at = NOW()
                        WHERE id = $2
                    `, [config.recommended, suggestion.policy_id]);
                    applied = true;
                } else if (config.threshold_type === 'prompt') {
                    await client.query(`
                        UPDATE library_policies
                        SET prompt_threshold = $1, updated_at = NOW()
                        WHERE id = $2
                    `, [config.recommended, suggestion.policy_id]);
                    applied = true;
                }
            } else if (suggestion.suggestion_type === 'adjust_weight') {
                // Validate signal name to prevent SQL injection
                const validSignals = ['preset', 'pattern', 'rag', 'history'];
                if (!validSignals.includes(config.signal)) {
                    throw new Error(`Invalid signal type: ${config.signal}`);
                }
                
                const weightField = `${config.signal}_weight`;
                await client.query(`
                    UPDATE library_policies
                    SET ${weightField} = $1, updated_at = NOW()
                    WHERE id = $2
                `, [config.recommended, suggestion.policy_id]);
                applied = true;
            } else if (suggestion.suggestion_type === 'create_pattern') {
                // Insert into discovered_patterns
                const libraryResult = await client.query(`
                    SELECT library_id FROM library_policies WHERE id = $1
                `, [suggestion.policy_id]);

                if (libraryResult.rows.length > 0) {
                    const library_id = libraryResult.rows[0].library_id;
                    
                    await client.query(`
                        INSERT INTO discovered_patterns (
                            pattern_type,
                            pattern_value,
                            library_id,
                            confidence,
                            status,
                            source
                        )
                        VALUES ($1, $2, $3, $4, 'approved', 'feedback_analysis')
                        ON CONFLICT (pattern_type, pattern_value, library_id) DO UPDATE
                        SET confidence = GREATEST(discovered_patterns.confidence, EXCLUDED.confidence),
                            status = 'approved',
                            updated_at = NOW()
                    `, [
                        config.pattern_type,
                        config.pattern_value,
                        library_id,
                        config.confidence
                    ]);
                    applied = true;
                }
            }

            if (!applied) {
                throw new Error(`Unable to apply suggestion type: ${suggestion.suggestion_type}`);
            }

            // Update suggestion status
            await client.query(`
                UPDATE policy_tuning_suggestions
                SET status = 'applied',
                    reviewed_at = NOW(),
                    reviewed_by = $1
                WHERE id = $2
            `, [userId, suggestionId]);

            // Get after state (only relevant fields)
            const afterResult = await client.query(`
                SELECT 
                    auto_classify_threshold,
                    prompt_threshold,
                    preset_weight,
                    pattern_weight,
                    rag_weight,
                    history_weight
                FROM library_policies WHERE id = $1
            `, [suggestion.policy_id]);

            const after_metrics = afterResult.rows[0];

            // Log to policy_change_log (only changed fields)
            await client.query(`
                INSERT INTO policy_change_log (
                    policy_id,
                    change_type,
                    change_config,
                    before_metrics,
                    after_metrics,
                    applied_by,
                    applied_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
            `, [
                suggestion.policy_id,
                change_type,
                JSON.stringify(config),
                JSON.stringify(before_metrics),
                JSON.stringify(after_metrics),
                userId
            ]);

            // Commit transaction
            await client.query('COMMIT');

            logger.info('Suggestion applied', {
                suggestionId,
                policyId: suggestion.policy_id,
                type: suggestion.suggestion_type,
                userId
            });

            return {
                success: true,
                suggestionId,
                policyId: suggestion.policy_id,
                type: suggestion.suggestion_type
            };

        } catch (error) {
            // Rollback transaction on error
            await client.query('ROLLBACK');
            logger.error('Failed to apply suggestion', { error: error.message, suggestionId });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Reject a suggestion
     * @param {number} suggestionId - Suggestion ID
     * @param {number} userId - User ID rejecting the suggestion
     * @param {string} reason - Rejection reason
     * @returns {Promise<object>} Result
     */
    async rejectSuggestion(suggestionId, userId, reason) {
        try {
            await db.query(`
                UPDATE policy_tuning_suggestions
                SET status = 'rejected',
                    reviewed_at = NOW(),
                    reviewed_by = $1,
                    rejection_reason = $2
                WHERE id = $3
            `, [userId, reason, suggestionId]);

            logger.info('Suggestion rejected', { suggestionId, userId, reason });

            return {
                success: true,
                suggestionId,
                status: 'rejected'
            };

        } catch (error) {
            logger.error('Failed to reject suggestion', { error: error.message });
            throw error;
        }
    }

    /**
     * Run analysis for all active policies
     * @returns {Promise<object>} Analysis results for all policies
     */
    async runFullAnalysis() {
        try {
            logger.info('Running full analysis for all active policies');

            // Get all active policies
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

        } catch (error) {
            logger.error('Failed to run full analysis', { error: error.message });
            throw error;
        }
    }

    // ============================================================================
    // HELPER METHODS
    // ============================================================================

    /**
     * Group feedback by a metadata field
     * @param {Array} feedback - Feedback records
     * @param {string} field - Metadata field to group by
     * @returns {object} Grouped counts
     */
    groupByMetadataField(feedback, field) {
        const groups = {};

        for (const f of feedback) {
            try {
                const metadata = f.item_metadata || {};
                let values = metadata[field];

                if (!values) continue;

                // Parse if string
                if (typeof values === 'string') {
                    try {
                        values = JSON.parse(values);
                    } catch {
                        values = [values];
                    }
                }

                // Ensure array
                if (!Array.isArray(values)) {
                    values = [values];
                }

                // Extract names from objects
                values = values.map(v => {
                    if (typeof v === 'object' && v !== null) {
                        return v.name || v.title || JSON.stringify(v);
                    }
                    return v;
                }).filter(Boolean);

                // Count occurrences
                for (const value of values) {
                    if (!groups[value]) {
                        groups[value] = { count: 0, feedbackIds: [] };
                    }
                    groups[value].count++;
                    groups[value].feedbackIds.push(f.id);
                }
            } catch (error) {
                logger.warn('Skipping feedback due to invalid item_metadata in groupByMetadataField', {
                    feedbackId: f.id,
                    field,
                    error: error && error.message ? error.message : String(error),
                    rawMetadata: f.item_metadata
                });
                // Skip invalid metadata
                continue;
            }
        }

        return groups;
    }

    /**
     * Extract significant patterns from grouped data
     * @param {object} groups - Grouped data
     * @param {string} type - Pattern type
     * @param {number} minCount - Minimum count to be significant
     * @returns {Array} Significant patterns
     */
    extractSignificantPatterns(groups, type, minCount = 3) {
        const patterns = [];

        for (const [value, data] of Object.entries(groups)) {
            if (data.count >= minCount) {
                patterns.push({
                    type,
                    value,
                    count: data.count,
                    feedbackIds: data.feedbackIds
                });
            }
        }

        // Sort by count descending
        return patterns.sort((a, b) => b.count - a.count);
    }

    /**
     * Get impact metrics for an applied suggestion
     * @param {number} suggestionId - Suggestion ID
     * @returns {Promise<object>} Impact metrics (before/after accuracy, improvement)
     */
    async getImpactMetrics(suggestionId) {
        try {
            const result = await db.query(`
                SELECT 
                    pts.before_accuracy,
                    pls.accuracy_rate as after_accuracy,
                    (pls.accuracy_rate - pts.before_accuracy) as improvement,
                    pts.applied_at
                FROM policy_tuning_suggestions pts
                LEFT JOIN policy_learning_stats pls ON pts.policy_id = pls.policy_id
                WHERE pts.id = $1 AND pts.status = 'applied'
            `, [suggestionId]);
            
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Failed to get impact metrics', { error: error.message, suggestionId });
            throw error;
        }
    }
}

module.exports = new FeedbackAnalysis();
