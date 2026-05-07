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
import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';

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
        try {
            await db.withTransaction(async (client) => {
                const policy = await client.query(
                    'SELECT id FROM library_policies WHERE library_id = $1',
                    [libraryId]
                );

                if (policy.rows.length === 0) {
                    logger.warn('No policy found for library', { libraryId });
                    return;
                }

                const policyId = policy.rows[0].id;

                await client.query(`
                UPDATE policy_presets
                SET custom_signals = jsonb_set(
                    COALESCE(custom_signals, '{}'),
                    '{genres,prefer}',
                    COALESCE(custom_signals->'genres'->'prefer', '[]'::jsonb) || $1::jsonb
                )
                WHERE policy_id = $2
                AND NOT (COALESCE(custom_signals->'genres'->'prefer', '[]'::jsonb) @> $1::jsonb)
            `, [JSON.stringify([genre]), policyId]);

                await client.query(`
                INSERT INTO auto_learned_preferences (
                    library_id, policy_id, preference_type, preference_value,
                    confidence_count, source, learned_from_user_id, learned_at
                ) VALUES ($1, $2, 'genre_prefer', $3, $4, 'user_feedback', $5, NOW())
                ON CONFLICT (library_id, preference_type, preference_value) 
                DO UPDATE SET 
                    confidence_count = $4,
                    learned_at = NOW(),
                    status = 'active'
            `, [libraryId, policyId, genre, confirmCount, userId]);

                logger.info('Genre added to prefer list', {
                    libraryId,
                    policyId,
                    genre,
                    confirmCount
                });
            });
        } catch (error) {
            logger.error('Failed to add genre to prefer list', {
                error: error.message,
                libraryId,
                genre
            });
            throw error;
        }
    }

    async addKeywordToPrefer(libraryId, keyword, confirmCount, userId) {
        try {
            await db.withTransaction(async (client) => {
                const policy = await client.query(
                    'SELECT id FROM library_policies WHERE library_id = $1',
                    [libraryId]
                );

                if (policy.rows.length === 0) {
                    return;
                }

                const policyId = policy.rows[0].id;

                await client.query(`
                UPDATE policy_presets
                SET custom_signals = jsonb_set(
                    COALESCE(custom_signals, '{}'),
                    '{keywords,prefer}',
                    COALESCE(custom_signals->'keywords'->'prefer', '[]'::jsonb) || $1::jsonb
                )
                WHERE policy_id = $2
                AND NOT (COALESCE(custom_signals->'keywords'->'prefer', '[]'::jsonb) @> $1::jsonb)
            `, [JSON.stringify([keyword]), policyId]);

                await client.query(`
                INSERT INTO auto_learned_preferences (
                    library_id, policy_id, preference_type, preference_value,
                    confidence_count, source, learned_from_user_id, learned_at
                ) VALUES ($1, $2, 'keyword_prefer', $3, $4, 'user_feedback', $5, NOW())
                ON CONFLICT (library_id, preference_type, preference_value) 
                DO UPDATE SET 
                    confidence_count = $4,
                    learned_at = NOW(),
                    status = 'active'
            `, [libraryId, policyId, keyword, confirmCount, userId]);

                logger.info('Keyword added to prefer list', {
                    libraryId,
                    policyId,
                    keyword,
                    confirmCount
                });
            });
        } catch (error) {
            logger.error('Failed to add keyword to prefer list', { error: error.message });
            throw error;
        }
    }

    async addStudioToPrefer(libraryId, studio, confirmCount, userId) {
        try {
            await db.withTransaction(async (client) => {
                const policy = await client.query(
                    'SELECT id FROM library_policies WHERE library_id = $1',
                    [libraryId]
                );

                if (policy.rows.length === 0) {
                    return;
                }

                const policyId = policy.rows[0].id;

                await client.query(`
                UPDATE policy_presets
                SET custom_signals = jsonb_set(
                    COALESCE(custom_signals, '{}'),
                    '{studios,prefer}',
                    COALESCE(custom_signals->'studios'->'prefer', '[]'::jsonb) || $1::jsonb
                )
                WHERE policy_id = $2
                AND NOT (COALESCE(custom_signals->'studios'->'prefer', '[]'::jsonb) @> $1::jsonb)
            `, [JSON.stringify([studio]), policyId]);

                await client.query(`
                INSERT INTO auto_learned_preferences (
                    library_id, policy_id, preference_type, preference_value,
                    confidence_count, source, learned_from_user_id, learned_at
                ) VALUES ($1, $2, 'studio_prefer', $3, $4, 'user_feedback', $5, NOW())
                ON CONFLICT (library_id, preference_type, preference_value) 
                DO UPDATE SET 
                    confidence_count = $4,
                    learned_at = NOW(),
                    status = 'active'
            `, [libraryId, policyId, studio, confirmCount, userId]);

                logger.info('Studio added to prefer list', {
                    libraryId,
                    policyId,
                    studio,
                    confirmCount
                });
            });
        } catch (error) {
            logger.error('Failed to add studio to prefer list', { error: error.message });
            throw error;
        }
    }

    async calculateNetConfidence(libraryId, value, type) {
        try {
            const result = await db.query(`
                SELECT 
                    selected_library_id,
                    was_correction,
                    item_metadata
                FROM policy_feedback_log
                WHERE prompted_at >= NOW() - $1::interval
            `, [`${DEFAULT_THRESHOLDS.learningLookbackDays} days`]);
            
            let confirmCount = 0;
            let rejectCount = 0;
            
            result.rows.forEach(row => {
                const metadata = row.item_metadata || {};
                let hasSignal = false;
                
                if (type === 'genre') {
                    hasSignal = normalizeMetadataListLower(metadata.genres).includes(value.toLowerCase());
                } else if (type === 'keyword') {
                    hasSignal = normalizeMetadataListLower(metadata.keywords).some(k => 
                        k.includes(value.toLowerCase()) || 
                        value.toLowerCase().includes(k)
                    );
                } else if (type === 'studio' && metadata.studio) {
                    hasSignal = metadata.studio.toLowerCase().includes(value.toLowerCase()) ||
                               value.toLowerCase().includes(metadata.studio.toLowerCase());
                }
                
                if (hasSignal) {
                    if (row.selected_library_id === libraryId && !row.was_correction) {
                        confirmCount++;
                    } else if (row.selected_library_id !== libraryId || row.was_correction) {
                        rejectCount++;
                    }
                }
            });
            
            const netConfidence = confirmCount - rejectCount;
            const totalFeedback = confirmCount + rejectCount;
            const confidenceRate = totalFeedback > 0 ? confirmCount / totalFeedback : 0;
            
            const settings = await this.getLearningSettings();
            
            let threshold = settings.genreLearnThreshold;
            if (type === 'keyword') threshold = settings.keywordLearnThreshold;
            if (type === 'studio') threshold = settings.studioLearnThreshold;
            
            const shouldApply = confirmCount >= threshold && 
                              confidenceRate >= settings.minConfidenceRate;
            
            return {
                confirmCount,
                rejectCount,
                netConfidence,
                confidenceRate,
                shouldApply
            };
        } catch (error) {
            logger.error('Failed to calculate net confidence', {
                error: error.message,
                libraryId,
                value,
                type
            });
            return {
                confirmCount: 0,
                rejectCount: 0,
                netConfidence: 0,
                confidenceRate: 0,
                shouldApply: false
            };
        }
    }

    async detectIntraLibraryConflict(libraryId, value, preferenceType) {
        try {
            const policy = await db.query(`
                SELECT pp.custom_signals 
                FROM policy_presets pp
                JOIN library_policies lp ON pp.policy_id = lp.id
                WHERE lp.library_id = $1
            `, [libraryId]);
            
            if (policy.rows.length === 0) {
                return { conflict: false };
            }
            
            const signals = policy.rows[0].custom_signals || {};
            
            if (preferenceType === 'genre_prefer') {
                const excludeList = signals.genres?.exclude || [];
                
                if (excludeList.includes(value)) {
                    logger.warn('Conflict detected: Genre in exclude list', {
                        library: libraryId,
                        genre: value,
                        action: 'blocked'
                    });
                    
                    await db.query(`
                        INSERT INTO learning_conflicts (
                            library_id, conflict_type, preference_type, 
                            preference_value, existing_signal_type, 
                            existing_signal_value, conflict_detected_at
                        ) VALUES ($1, 'intra_library_exclusion', 'genre_prefer', $2, 'genre_exclude', $2, NOW())
                        ON CONFLICT DO NOTHING
                    `, [libraryId, value]);
                    
                    return { conflict: true, type: 'intra_library_exclusion' };
                }
            }
            
            return { conflict: false };
        } catch (error) {
            logger.error('Failed to detect conflict', {
                error: error.message,
                libraryId,
                value
            });
            return { conflict: true, type: 'error' };
        }
    }

    async canApplyLearning(userId, libraryId) {
        try {
            const settings = await this.getLearningSettings();
            
            const userLimit = await db.query(`
                SELECT COUNT(*) as count
                FROM learning_rate_limits
                WHERE user_id = $1
                AND learn_timestamp >= NOW() - INTERVAL '1 day'
            `, [userId]);
            
            const userCount = parseInt(userLimit.rows[0].count);
            if (userCount >= settings.maxLearnsPerUserPerDay) {
                return {
                    allowed: false,
                    reason: `User rate limit exceeded (${userCount}/${settings.maxLearnsPerUserPerDay} per day)`
                };
            }
            
            const libraryLimit = await db.query(`
                SELECT COUNT(*) as count
                FROM learning_rate_limits
                WHERE library_id = $1
                AND learn_timestamp >= NOW() - INTERVAL '1 hour'
            `, [libraryId]);
            
            const libraryCount = parseInt(libraryLimit.rows[0].count);
            if (libraryCount >= settings.maxLearnsPerLibraryPerHour) {
                return {
                    allowed: false,
                    reason: `Library rate limit exceeded (${libraryCount}/${settings.maxLearnsPerLibraryPerHour} per hour)`
                };
            }
            
            return { allowed: true };
        } catch (error) {
            logger.error('Failed to check rate limits', { error: error.message });
            return { allowed: false, reason: 'rate_limit_check_failed' };
        }
    }

    async recordLearningEvent(userId, libraryId) {
        try {
            await db.query(`
                INSERT INTO learning_rate_limits (user_id, library_id, learn_timestamp)
                VALUES ($1, $2, NOW())
            `, [userId, libraryId]);
        } catch (error) {
            logger.error('Failed to record learning event', { error: error.message });
        }
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

export default new AutoLearningService();
