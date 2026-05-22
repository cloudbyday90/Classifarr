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
import {
    calculateNetConfidence as _calculateNetConfidence,
    detectIntraLibraryConflict as _detectIntraLibraryConflict,
    canApplyLearning as _canApplyLearning,
    recordLearningEvent as _recordLearningEvent,
} from './autoLearningConfidence.mjs';
import {
    addGenreToPrefer as _addGenreToPrefer,
    addKeywordToPrefer as _addKeywordToPrefer,
    addStudioToPrefer as _addStudioToPrefer,
} from './autoLearningPreferenceWriters.mjs';

const logger = createLogger('AutoLearning');

const DEFAULT_THRESHOLDS = {
    genreLearnThreshold: 3,
    keywordLearnThreshold: 5,
    studioLearnThreshold: 2,
    minConfidenceRate: 0.75,
    maxLearnsPerUserPerDay: 50,
    maxLearnsPerLibraryPerHour: 20,
    learningLookbackDays: 30
};

let settingsCache = null;
let settingsCacheTime = 0;
const CACHE_TTL = 60000;

class AutoLearningService {
    clearCache() {
        settingsCache = null;
        settingsCacheTime = 0;
        logger.info('Learning settings cache cleared');
    }

    async getLearningSettings() {
        const now = Date.now();
        if (settingsCache && (now - settingsCacheTime) < CACHE_TTL) {
            return settingsCache;
        }

        try {
            const result = await db.query(`
                SELECT setting_key, setting_value
                FROM confidence_settings
                WHERE setting_key LIKE 'learning_%'
            `);

            const settings = { ...DEFAULT_THRESHOLDS };
            
            result.rows.forEach(row => {
                const key = row.setting_key;
                const value = row.setting_value;
                
                if (key === 'learning_genre_threshold') {
                    settings.genreLearnThreshold = parseInt(value) || DEFAULT_THRESHOLDS.genreLearnThreshold;
                } else if (key === 'learning_keyword_threshold') {
                    settings.keywordLearnThreshold = parseInt(value) || DEFAULT_THRESHOLDS.keywordLearnThreshold;
                } else if (key === 'learning_studio_threshold') {
                    settings.studioLearnThreshold = parseInt(value) || DEFAULT_THRESHOLDS.studioLearnThreshold;
                } else if (key === 'learning_min_confidence_rate') {
                    settings.minConfidenceRate = parseInt(value) / 100 || DEFAULT_THRESHOLDS.minConfidenceRate;
                } else if (key === 'learning_max_per_user_day') {
                    settings.maxLearnsPerUserPerDay = parseInt(value) || DEFAULT_THRESHOLDS.maxLearnsPerUserPerDay;
                } else if (key === 'learning_max_per_library_hour') {
                    settings.maxLearnsPerLibraryPerHour = parseInt(value) || DEFAULT_THRESHOLDS.maxLearnsPerLibraryPerHour;
                } else if (key === 'learning_lookback_days') {
                    settings.learningLookbackDays = parseInt(value) || DEFAULT_THRESHOLDS.learningLookbackDays;
                } else if (key === 'learning_conflict_strategy') {
                    settings.conflictStrategy = value || 'escalate';
                } else if (key === 'learning_auto_resolve_threshold') {
                    settings.autoResolveThreshold = parseInt(value) || 7;
                } else if (key === 'learning_multi_genre_strategy') {
                    settings.multiGenreStrategy = value || 'weighted';
                }
            });

            settingsCache = settings;
            settingsCacheTime = now;
            
            return settings;
        } catch (error) {
            logger.error('Failed to load learning settings from database, using defaults', { error: error.message });
            return DEFAULT_THRESHOLDS;
        }
    }

    async learnFromFeedback(feedbackData) {
        try {
            const {
                tmdbId,
                libraryId,
                genres = [],
                keywords = [],
                studio,
                wasCorrection = false,
                userId
            } = feedbackData;

            logger.info('Learning from feedback', {
                tmdbId,
                libraryId,
                wasCorrection,
                genreCount: genres.length,
                keywordCount: keywords.length
            });

            const rateLimitCheck = await this.canApplyLearning(userId, libraryId);
            if (!rateLimitCheck.allowed) {
                logger.warn('Rate limit exceeded', {
                    userId,
                    libraryId,
                    reason: rateLimitCheck.reason
                });
                return {
                    learned: false,
                    reason: 'rate_limit',
                    details: rateLimitCheck.reason
                };
            }

            const learnedPreferences = [];

            for (const genre of genres.slice(0, 3)) {
                const result = await this.learnGenrePreference(libraryId, genre, feedbackData);
                if (result.learned) {
                    learnedPreferences.push({ type: 'genre', value: genre });
                }
            }

            for (const keyword of keywords.slice(0, 5)) {
                const result = await this.learnKeywordPreference(libraryId, keyword, feedbackData);
                if (result.learned) {
                    learnedPreferences.push({ type: 'keyword', value: keyword });
                }
            }

            if (studio) {
                const result = await this.learnStudioPreference(libraryId, studio, feedbackData);
                if (result.learned) {
                    learnedPreferences.push({ type: 'studio', value: studio });
                }
            }

            if (learnedPreferences.length > 0) {
                await this.recordLearningEvent(userId, libraryId);
            }

            logger.info('Learning completed', {
                tmdbId,
                libraryId,
                learnedCount: learnedPreferences.length,
                learned: learnedPreferences
            });

            return {
                learned: learnedPreferences.length > 0,
                preferences: learnedPreferences,
                count: learnedPreferences.length
            };
        } catch (error) {
            logger.error('Failed to learn from feedback', {
                error: error.message,
                stack: error.stack
            });
            return {
                learned: false,
                error: error.message
            };
        }
    }

    async learnGenrePreference(libraryId, genre, feedback) {
        try {
            const confidence = await this.calculateNetConfidence(libraryId, genre, 'genre');
            
            logger.debug('Genre confidence calculated', {
                libraryId,
                genre,
                confirmCount: confidence.confirmCount,
                rejectCount: confidence.rejectCount,
                netConfidence: confidence.netConfidence,
                confidenceRate: confidence.confidenceRate,
                shouldApply: confidence.shouldApply
            });

            if (!confidence.shouldApply) {
                return { learned: false, reason: 'insufficient_confidence' };
            }

            const conflict = await this.detectIntraLibraryConflict(libraryId, genre, 'genre_prefer');
            if (conflict.conflict) {
                logger.warn('Genre learning blocked due to conflict', {
                    libraryId,
                    genre,
                    conflictType: conflict.type
                });
                return { learned: false, reason: 'conflict_detected' };
            }

            await this.addGenreToPrefer(libraryId, genre, confidence.confirmCount, feedback.userId);

            return { learned: true, confirmCount: confidence.confirmCount };
        } catch (error) {
            logger.error('Failed to learn genre preference', {
                error: error.message,
                libraryId,
                genre
            });
            return { learned: false, error: error.message };
        }
    }

    async learnKeywordPreference(libraryId, keyword, feedback) {
        try {
            const confidence = await this.calculateNetConfidence(libraryId, keyword, 'keyword');
            
            const settings = await this.getLearningSettings();
            if (confidence.confirmCount < settings.keywordLearnThreshold) {
                return { learned: false, reason: 'insufficient_confirmations' };
            }

            if (confidence.confidenceRate < settings.minConfidenceRate) {
                return { learned: false, reason: 'low_confidence_rate' };
            }

            await this.addKeywordToPrefer(libraryId, keyword, confidence.confirmCount, feedback.userId);

            return { learned: true, confirmCount: confidence.confirmCount };
        } catch (error) {
            logger.error('Failed to learn keyword preference', {
                error: error.message,
                libraryId,
                keyword
            });
            return { learned: false, error: error.message };
        }
    }

    async learnStudioPreference(libraryId, studio, feedback) {
        try {
            const confidence = await this.calculateNetConfidence(libraryId, studio, 'studio');
            
            const settings = await this.getLearningSettings();
            if (confidence.confirmCount < settings.studioLearnThreshold) {
                return { learned: false, reason: 'insufficient_confirmations' };
            }

            if (confidence.confidenceRate < settings.minConfidenceRate) {
                return { learned: false, reason: 'low_confidence_rate' };
            }

            await this.addStudioToPrefer(libraryId, studio, confidence.confirmCount, feedback.userId);

            return { learned: true, confirmCount: confidence.confirmCount };
        } catch (error) {
            logger.error('Failed to learn studio preference', {
                error: error.message,
                libraryId,
                studio
            });
            return { learned: false, error: error.message };
        }
    }

    async addGenreToPrefer(libraryId, genre, confirmCount, userId) {
        return _addGenreToPrefer(libraryId, genre, confirmCount, userId);
    }

    async addKeywordToPrefer(libraryId, keyword, confirmCount, userId) {
        return _addKeywordToPrefer(libraryId, keyword, confirmCount, userId);
    }

    async addStudioToPrefer(libraryId, studio, confirmCount, userId) {
        return _addStudioToPrefer(libraryId, studio, confirmCount, userId);
    }

    async calculateNetConfidence(libraryId, value, type) {
        return _calculateNetConfidence(libraryId, value, type, () => this.getLearningSettings());
    }

    async detectIntraLibraryConflict(libraryId, value, preferenceType) {
        return _detectIntraLibraryConflict(libraryId, value, preferenceType);
    }

    async canApplyLearning(userId, libraryId) {
        return _canApplyLearning(userId, libraryId, () => this.getLearningSettings());
    }

    async recordLearningEvent(userId, libraryId) {
        return _recordLearningEvent(userId, libraryId);
    }

    async getLearnedPreferences(libraryId, options = {}) {
        try {
            const { status = 'active', limit = 100, offset = 0 } = options;
            
            const result = await db.query(`
                SELECT 
                    alp.*,
                    l.name as library_name,
                    u.username as reverted_by_username
                FROM auto_learned_preferences alp
                JOIN libraries l ON alp.library_id = l.id
                LEFT JOIN users u ON alp.reverted_by = u.id
                WHERE alp.library_id = $1
                AND alp.status = $2
                ORDER BY alp.learned_at DESC
                LIMIT $3 OFFSET $4
            `, [libraryId, status, limit, offset]);
            
            return result.rows;
        } catch (error) {
            logger.error('Failed to get learned preferences', { error: error.message });
            return [];
        }
    }

    async revertPreference(preferenceId, userId, reason) {
        try {
            return await db.withTransaction(async (client) => {
                const pref = await client.query(
                    'SELECT * FROM auto_learned_preferences WHERE id = $1',
                    [preferenceId]
                );

                if (pref.rows.length === 0) {
                    throw new Error('Preference not found');
                }

                const preference = pref.rows[0];

                await client.query(`
                UPDATE auto_learned_preferences
                SET status = 'reverted',
                    reverted_at = NOW(),
                    reverted_by = $1,
                    revert_reason = $2
                WHERE id = $3
            `, [userId, reason, preferenceId]);

                const validTypes = ['genre_prefer', 'keyword_prefer', 'studio_prefer'];
                if (!validTypes.includes(preference.preference_type)) {
                    throw new Error('Invalid preference type');
                }

                const signalPath = preference.preference_type.replace('_prefer', '');

                await client.query(`
                UPDATE policy_presets
                SET custom_signals = jsonb_set(
                    custom_signals,
                    $1,
                    (
                        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
                        FROM jsonb_array_elements(custom_signals->$2->'prefer') elem
                        WHERE elem::text != $3::text
                    )
                )
                WHERE policy_id = $4
            `, [`{${signalPath},prefer}`, signalPath, JSON.stringify(preference.preference_value), preference.policy_id]);

                logger.info('Preference reverted', {
                    preferenceId,
                    libraryId: preference.library_id,
                    type: preference.preference_type,
                    value: preference.preference_value
                });

                return { success: true };
            });
        } catch (error) {
            logger.error('Failed to revert preference', { error: error.message });
            throw error;
        }
    }
}

export const autoLearningService = new AutoLearningService();
