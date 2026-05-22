import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';

const logger = createLogger('AutoLearningConfidence');

const DEFAULT_LOOKBACK_DAYS = 30;

export async function calculateNetConfidence(libraryId, value, type, getLearningSettings) {
    try {
        const result = await db.query(`
            SELECT 
                selected_library_id,
                was_correction,
                item_metadata
            FROM policy_feedback_log
            WHERE prompted_at >= NOW() - $1::interval
        `, [`${DEFAULT_LOOKBACK_DAYS} days`]);

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

        const settings = await getLearningSettings();

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

export async function detectIntraLibraryConflict(libraryId, value, preferenceType) {
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

export async function canApplyLearning(userId, libraryId, getLearningSettings) {
    try {
        const settings = await getLearningSettings();

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

export async function recordLearningEvent(userId, libraryId) {
    try {
        await db.query(`
            INSERT INTO learning_rate_limits (user_id, library_id, learn_timestamp)
            VALUES ($1, $2, NOW())
        `, [userId, libraryId]);
    } catch (error) {
        logger.error('Failed to record learning event', { error: error.message });
    }
}
