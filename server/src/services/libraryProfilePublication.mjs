/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createLibraryProfileRevisionSupersededError } from './libraryProfileRevision.mjs';

const validRevision = value => typeof value === 'string' && /^[1-9]\d*$/.test(value);

/** Publish only the exact source snapshot observed by the reader. */
export async function publishLibraryProfileObservation(db, {
    libraryId, inventoryRevision, observedAt, observation, ratings, genres, studios, keywords,
}) {
    if (!validRevision(inventoryRevision)) {
        if (inventoryRevision == null && observation.itemCount === 0) {
            const existing = await db.query('SELECT 1 FROM library_profiles WHERE library_id = $1', [libraryId]);
            if (existing.rows.length === 0) return null;
        }
        throw createLibraryProfileRevisionSupersededError();
    }

    return db.withTransaction(async client => {
        // Inventory writes update this same row through the change trigger.
        // Locking it makes the revision comparison and publication atomic.
        const state = await client.query(
            'SELECT revision::text FROM library_profile_inventory_state WHERE library_id = $1 FOR UPDATE',
            [libraryId]
        );
        if (state.rows[0]?.revision !== inventoryRevision) {
            throw createLibraryProfileRevisionSupersededError();
        }

        if (observation.itemCount === 0) {
            const removed = await client.query(`DELETE FROM library_profiles WHERE library_id = $1
                AND (inventory_revision IS NULL OR inventory_revision <= $2::bigint)`,
            [libraryId, inventoryRevision]);
            if (removed.rowCount === 0) {
                const newer = await client.query('SELECT 1 FROM library_profiles WHERE library_id = $1', [libraryId]);
                if (newer.rows.length) throw createLibraryProfileRevisionSupersededError();
            }
            return null;
        }

        const saved = await client.query(`INSERT INTO library_profiles (
            library_id, rating_distribution, genre_distribution, studio_distribution, keyword_distribution,
            exclusion_ratings, exclusion_genres, exclusion_keywords, item_count, enriched_count,
            last_generated_at, updated_at, observation_summary, inventory_revision
        ) SELECT $1::integer, $2, $3, $4, $5, '{}', '{}', '{}', $6, $7, $8, NOW(), $9, $10::bigint
        FROM library_profile_inventory_state state
        WHERE state.library_id = $1::integer AND state.revision = $10::bigint
        ON CONFLICT (library_id) DO UPDATE SET rating_distribution = EXCLUDED.rating_distribution,
            genre_distribution = EXCLUDED.genre_distribution, studio_distribution = EXCLUDED.studio_distribution,
            keyword_distribution = EXCLUDED.keyword_distribution, exclusion_ratings = '{}', exclusion_genres = '{}',
            exclusion_keywords = '{}', item_count = EXCLUDED.item_count, enriched_count = EXCLUDED.enriched_count,
            last_generated_at = EXCLUDED.last_generated_at, updated_at = NOW(),
            observation_summary = EXCLUDED.observation_summary, inventory_revision = EXCLUDED.inventory_revision
        WHERE library_profiles.inventory_revision IS NULL
            OR library_profiles.inventory_revision < EXCLUDED.inventory_revision
            OR (library_profiles.inventory_revision = EXCLUDED.inventory_revision
                AND (library_profiles.last_generated_at IS NULL
                    OR library_profiles.last_generated_at <= EXCLUDED.last_generated_at))
        RETURNING library_id`,
        [libraryId, JSON.stringify(ratings), JSON.stringify(genres), JSON.stringify(studios), JSON.stringify(keywords),
            observation.itemCount, observation.enrichedCount, observedAt, JSON.stringify(observation), inventoryRevision]);
        if (saved.rowCount !== 1) throw createLibraryProfileRevisionSupersededError();
        return inventoryRevision;
    });
}
