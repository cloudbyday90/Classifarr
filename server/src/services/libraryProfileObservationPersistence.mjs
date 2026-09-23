/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { observationDistribution } from './libraryProfileObservation.mjs';
import { readLibraryProfileObservation } from './libraryProfileQueries.mjs';
import { publishLibraryProfileObservation } from './libraryProfilePublication.mjs';

export async function generateLibraryProfileObservation(db, libraryId) {
    const { observation, observedAt, inventoryRevision } = await readLibraryProfileObservation(db, libraryId);
    const ratings = observationDistribution(observation, 'rating');
    const genres = observationDistribution(observation, 'genres');
    const studios = observationDistribution(observation, 'studio');
    const keywords = observationDistribution(observation, 'keywords');
    const publishedRevision = await publishLibraryProfileObservation(db, {
        libraryId, inventoryRevision, observedAt, observation, ratings, genres, studios, keywords,
    });
    if (publishedRevision === null) return null;
    return { ratings, genres, studios, keywords, exclusionRatings: [], exclusionGenres: [],
        itemCount: observation.itemCount, enrichedCount: observation.enrichedCount, observation,
        inventoryRevision: publishedRevision };
}
