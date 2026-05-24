import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('AutoLearning');

const CACHE_TTL = 60000;

export function createSettingsState() {
    return { cache: null, cacheTime: 0 };
}

export function clearSettingsState(state) {
    state.cache = null;
    state.cacheTime = 0;
    logger.info('Learning settings cache cleared');
}

export async function getLearningSettings(state, defaults) {
    const now = Date.now();
    if (state.cache && (now - state.cacheTime) < CACHE_TTL) {
        return state.cache;
    }

    try {
        const result = await db.query(`
            SELECT setting_key, setting_value
            FROM confidence_settings
            WHERE setting_key LIKE 'learning_%'
        `);

        const settings = { ...defaults };

        result.rows.forEach(row => {
            const key = row.setting_key;
            const value = row.setting_value;

            if (key === 'learning_genre_threshold') {
                settings.genreLearnThreshold = parseInt(value) || defaults.genreLearnThreshold;
            } else if (key === 'learning_keyword_threshold') {
                settings.keywordLearnThreshold = parseInt(value) || defaults.keywordLearnThreshold;
            } else if (key === 'learning_studio_threshold') {
                settings.studioLearnThreshold = parseInt(value) || defaults.studioLearnThreshold;
            } else if (key === 'learning_min_confidence_rate') {
                settings.minConfidenceRate = parseInt(value) / 100 || defaults.minConfidenceRate;
            } else if (key === 'learning_max_per_user_day') {
                settings.maxLearnsPerUserPerDay = parseInt(value) || defaults.maxLearnsPerUserPerDay;
            } else if (key === 'learning_max_per_library_hour') {
                settings.maxLearnsPerLibraryPerHour = parseInt(value) || defaults.maxLearnsPerLibraryPerHour;
            } else if (key === 'learning_lookback_days') {
                settings.learningLookbackDays = parseInt(value) || defaults.learningLookbackDays;
            } else if (key === 'learning_conflict_strategy') {
                settings.conflictStrategy = value || 'escalate';
            } else if (key === 'learning_auto_resolve_threshold') {
                settings.autoResolveThreshold = parseInt(value) || 7;
            } else if (key === 'learning_multi_genre_strategy') {
                settings.multiGenreStrategy = value || 'weighted';
            }
        });

        state.cache = settings;
        state.cacheTime = now;

        return settings;
    } catch (error) {
        logger.error('Failed to load learning settings from database, using defaults', { error: error.message });
        return defaults;
    }
}

export async function getLearnedPreferences(libraryId, options = {}) {
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

export async function revertPreference(preferenceId, userId, reason) {
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
