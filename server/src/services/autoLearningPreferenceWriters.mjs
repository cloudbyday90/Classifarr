import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';
import {
    POLICY_LEGACY_WRITE_OPERATION_IDS,
} from './policyLegacyWriteBoundary.mjs';
import {
    assertLegacyPolicyWriteAllowed,
    lockPolicyAuthorityForLibraryWrite,
} from './policyLegacyWriteGuard.mjs';

const logger = createLogger('AutoLearningWriters');

async function lockLegacyPreferencePolicy({ client, libraryId, signalType, value }) {
    const policy = await lockPolicyAuthorityForLibraryWrite({
        client,
        libraryId,
    });

    if (!policy) {
        logger.warn('No policy found for library', { libraryId });
        return null;
    }

    assertLegacyPolicyWriteAllowed({
        policy,
        payload: {
            custom_signals: {
                [signalType]: {
                    prefer: [value],
                },
            },
        },
        operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.UPDATE_PRESET_CUSTOM_SIGNALS,
    });

    return policy;
}

export async function addGenreToPrefer(libraryId, genre, confirmCount, userId) {
    return withServiceCatch(logger, 'Failed to add genre to prefer list', { libraryId, genre }, async () => {
        await db.withTransaction(async (client) => {
            const policy = await lockLegacyPreferencePolicy({
                client,
                libraryId,
                signalType: 'genres',
                value: genre,
            });
            if (!policy) {
                return;
            }

            await client.query(`
                UPDATE policy_presets
                SET custom_signals = jsonb_set(
                    COALESCE(custom_signals, '{}'),
                    '{genres,prefer}',
                    COALESCE(custom_signals->'genres'->'prefer', '[]'::jsonb) || $1::jsonb
                )
                WHERE policy_id = $2
                AND NOT (COALESCE(custom_signals->'genres'->'prefer', '[]'::jsonb) @> $1::jsonb)
            `, [JSON.stringify([genre]), policy.id]);

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
            `, [libraryId, policy.id, genre, confirmCount, userId]);

            logger.info('Genre added to prefer list', {
                libraryId,
                policyId: policy.id,
                genre,
                confirmCount
            });
        });
    });
}

export async function addKeywordToPrefer(libraryId, keyword, confirmCount, userId) {
    return withServiceCatch(logger, 'Failed to add keyword to prefer list', async () => {
        await db.withTransaction(async (client) => {
            const policy = await lockLegacyPreferencePolicy({
                client,
                libraryId,
                signalType: 'keywords',
                value: keyword,
            });
            if (!policy) {
                return;
            }

            await client.query(`
                UPDATE policy_presets
                SET custom_signals = jsonb_set(
                    COALESCE(custom_signals, '{}'),
                    '{keywords,prefer}',
                    COALESCE(custom_signals->'keywords'->'prefer', '[]'::jsonb) || $1::jsonb
                )
                WHERE policy_id = $2
                AND NOT (COALESCE(custom_signals->'keywords'->'prefer', '[]'::jsonb) @> $1::jsonb)
            `, [JSON.stringify([keyword]), policy.id]);

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
            `, [libraryId, policy.id, keyword, confirmCount, userId]);

            logger.info('Keyword added to prefer list', {
                libraryId,
                policyId: policy.id,
                keyword,
                confirmCount
            });
        });
    });
}

export async function addStudioToPrefer(libraryId, studio, confirmCount, userId) {
    return withServiceCatch(logger, 'Failed to add studio to prefer list', async () => {
        await db.withTransaction(async (client) => {
            const policy = await lockLegacyPreferencePolicy({
                client,
                libraryId,
                signalType: 'studios',
                value: studio,
            });
            if (!policy) {
                return;
            }

            await client.query(`
                UPDATE policy_presets
                SET custom_signals = jsonb_set(
                    COALESCE(custom_signals, '{}'),
                    '{studios,prefer}',
                    COALESCE(custom_signals->'studios'->'prefer', '[]'::jsonb) || $1::jsonb
                )
                WHERE policy_id = $2
                AND NOT (COALESCE(custom_signals->'studios'->'prefer', '[]'::jsonb) @> $1::jsonb)
            `, [JSON.stringify([studio]), policy.id]);

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
            `, [libraryId, policy.id, studio, confirmCount, userId]);

            logger.info('Studio added to prefer list', {
                libraryId,
                policyId: policy.id,
                studio,
                confirmCount
            });
        });
    });
}
