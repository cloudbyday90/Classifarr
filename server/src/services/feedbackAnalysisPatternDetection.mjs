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
import { groupByMetadataField, extractSignificantPatterns } from './feedbackAnalysisUtils.mjs';

const logger = createLogger('FeedbackAnalysis');

export async function detectFailurePatterns(policyId, feedback) {
    try {
        const patterns = {
            falsePositives: [],
            missedPositives: [],
            thresholdIssues: []
        };

        const falsePositiveCorrections = feedback.filter(f =>
            f.was_correction && f.top_suggestion_library_id !== f.selected_library_id
        );

        if (falsePositiveCorrections.length > 0) {
            const byGenre = groupByMetadataField(falsePositiveCorrections, 'genres');
            const byStudio = groupByMetadataField(falsePositiveCorrections, 'production_companies');
            const byKeyword = groupByMetadataField(falsePositiveCorrections, 'keywords');

            patterns.falsePositives = [
                ...extractSignificantPatterns(byGenre, 'genre', 3),
                ...extractSignificantPatterns(byStudio, 'studio', 3),
                ...extractSignificantPatterns(byKeyword, 'keyword', 3)
            ];
        }

        const policyLibraryResult = await db.query(
            `SELECT library_id FROM library_policies WHERE id = $1`,
            [policyId]
        );
        const policyLibraryId = policyLibraryResult.rows[0]?.library_id || null;

        const correctionsTowardPolicy = await db.query(`
            SELECT * FROM policy_feedback_log
            WHERE selected_policy_id = $1
            AND was_correction = true
            AND (top_suggestion_library_id IS NULL 
                OR top_suggestion_library_id != $2)
            AND prompted_at >= NOW() - INTERVAL '30 days'
        `, [policyId, policyLibraryId]);

        if (correctionsTowardPolicy.rows.length > 0) {
            const byGenre = groupByMetadataField(correctionsTowardPolicy.rows, 'genres');
            const byStudio = groupByMetadataField(correctionsTowardPolicy.rows, 'production_companies');
            const byKeyword = groupByMetadataField(correctionsTowardPolicy.rows, 'keywords');

            patterns.missedPositives = [
                ...extractSignificantPatterns(byGenre, 'genre', 3),
                ...extractSignificantPatterns(byStudio, 'studio', 3),
                ...extractSignificantPatterns(byKeyword, 'keyword', 3)
            ];
        }

        const scoreDistribution = feedback.map(f => f.top_suggestion_score).filter(s => s !== null);
        if (scoreDistribution.length > 0) {
            const avgScore = scoreDistribution.reduce((a, b) => a + b, 0) / scoreDistribution.length;
            const corrections = feedback.filter(f => f.was_correction);
            const correctionRate = corrections.length / feedback.length;

            if (correctionRate > 0.3 && avgScore > 75) {
                patterns.thresholdIssues.push({
                    issue: 'high_false_positive_rate',
                    correctionRate,
                    avgScore,
                    recommendation: 'increase_auto_classify_threshold'
                });
            }

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

export async function analyzeSignalEffectiveness(_policyId, feedback) {
    try {
        const analysis = {
            preset: { correct: 0, incorrect: 0, avgScore: 0 },
            pattern: { correct: 0, incorrect: 0, avgScore: 0 },
            rag: { correct: 0, incorrect: 0, avgScore: 0 },
            history: { correct: 0, incorrect: 0, avgScore: 0 }
        };

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

export async function detectNewPatterns(policyId, feedback) {
    try {
        const correctionsToward = feedback.filter(f =>
            f.was_correction && f.selected_policy_id === policyId
        );

        if (correctionsToward.length === 0) {
            return [];
        }

        const patterns = [];

        const studios = groupByMetadataField(correctionsToward, 'production_companies');
        patterns.push(...extractSignificantPatterns(studios, 'studio', 2));

        const keywords = groupByMetadataField(correctionsToward, 'keywords');
        patterns.push(...extractSignificantPatterns(keywords, 'keyword', 2));

        const genres = groupByMetadataField(correctionsToward, 'genres');
        patterns.push(...extractSignificantPatterns(genres, 'genre', 2));

        const collections = groupByMetadataField(correctionsToward, 'belongs_to_collection');
        patterns.push(...extractSignificantPatterns(collections, 'collection', 2));

        return patterns;

    } catch (error) {
        logger.error('Failed to detect new patterns', { error: error.message });
        return [];
    }
}

export async function analyzeThresholds(policyId, feedback) {
    try {
        const policyResult = await db.query(`
            SELECT auto_classify_threshold, prompt_threshold
            FROM library_policies
            WHERE id = $1
        `, [policyId]);

        if (policyResult.rows.length === 0) {
            return {};
        }

        const currentThresholds = policyResult.rows[0];

        const autoClassified = feedback.filter(f => f.top_suggestion_score >= currentThresholds.auto_classify_threshold);
        const prompted = feedback.filter(f =>
            f.top_suggestion_score < currentThresholds.auto_classify_threshold &&
            f.top_suggestion_score >= currentThresholds.prompt_threshold
        );
        const manual = feedback.filter(f => f.top_suggestion_score < currentThresholds.prompt_threshold);

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
