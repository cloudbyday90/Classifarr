/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { observationDistribution } from './libraryProfileObservation.mjs';
import { readLibraryProfileObservation } from './libraryProfileQueries.mjs';

export async function generateLibraryProfileObservation(db, libraryId) {
    const { observation, observedAt } = await readLibraryProfileObservation(db, libraryId);
    if (!observation.itemCount) {
        await db.query(`DELETE FROM library_profiles WHERE library_id = $1
            AND NOT EXISTS (SELECT 1 FROM media_server_items WHERE library_id = $1)`, [libraryId]);
        return null;
    }
    const ratings = observationDistribution(observation, 'rating');
    const genres = observationDistribution(observation, 'genres');
    const studios = observationDistribution(observation, 'studio');
    const keywords = observationDistribution(observation, 'keywords');
    await db.query(`INSERT INTO library_profiles (
        library_id, rating_distribution, genre_distribution, studio_distribution, keyword_distribution,
        exclusion_ratings, exclusion_genres, exclusion_keywords, item_count, enriched_count,
        last_generated_at, updated_at, observation_summary
    ) SELECT $1, $2, $3, $4, $5, '{}', '{}', '{}', $6, $7, $8, NOW(), $9
    WHERE EXISTS (SELECT 1 FROM media_server_items WHERE library_id = $1)
    ON CONFLICT (library_id) DO UPDATE SET rating_distribution = EXCLUDED.rating_distribution,
        genre_distribution = EXCLUDED.genre_distribution, studio_distribution = EXCLUDED.studio_distribution,
        keyword_distribution = EXCLUDED.keyword_distribution, exclusion_ratings = '{}', exclusion_genres = '{}',
        exclusion_keywords = '{}', item_count = EXCLUDED.item_count, enriched_count = EXCLUDED.enriched_count,
        last_generated_at = EXCLUDED.last_generated_at, updated_at = NOW(), observation_summary = EXCLUDED.observation_summary
    WHERE library_profiles.last_generated_at IS NULL OR library_profiles.last_generated_at <= EXCLUDED.last_generated_at`,
    [libraryId, JSON.stringify(ratings), JSON.stringify(genres), JSON.stringify(studios), JSON.stringify(keywords),
        observation.itemCount, observation.enrichedCount, observedAt, JSON.stringify(observation)]);
    return { ratings, genres, studios, keywords, exclusionRatings: [], exclusionGenres: [],
        itemCount: observation.itemCount, enrichedCount: observation.enrichedCount, observation };
}
