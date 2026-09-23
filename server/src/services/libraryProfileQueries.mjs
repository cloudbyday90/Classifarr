/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildLibraryProfileObservation, observationStats } from './libraryProfileObservation.mjs';

/** A single snapshot for all denominators; projection excludes media content and provider payloads. */
export async function readLibraryProfileObservation(db, libraryId) {
    const { rows } = await db.query(`SELECT msi.id AS observed_item_id, msi.tmdb_id, msi.media_type,
        msi.content_rating, msi.genres, msi.studio, state.revision::text AS inventory_revision,
        statement_timestamp()::text AS observed_at,
        public.library_profile_observed_metadata(msi.metadata) AS metadata
        FROM libraries library
        LEFT JOIN library_profile_inventory_state state ON state.library_id = library.id
        LEFT JOIN media_server_items msi ON msi.library_id = library.id
        WHERE library.id = $1`, [libraryId]);
    // Preserve PostgreSQL timestamp precision for ordering concurrent stored observations.
    const observedAt = rows[0]?.observed_at || new Date().toISOString();
    const inventoryRevision = rows[0]?.inventory_revision ?? null;
    const observation = buildLibraryProfileObservation(rows.filter(row => row.observed_item_id != null));
    return { observation, observedAt, inventoryRevision,
        stats: observationStats(observation, new Date(observedAt).toISOString()) };
}

export async function getCertificationDistribution(db, _logger, libraryId) {
    return (await readLibraryProfileObservation(db, libraryId)).stats.certificationDistribution;
}
export async function getGenreDistribution(db, _logger, libraryId) {
    return (await readLibraryProfileObservation(db, libraryId)).stats.genreDistribution;
}
export async function getStudioDistribution(db, _logger, libraryId) {
    return (await readLibraryProfileObservation(db, libraryId)).stats.studioDistribution;
}
export async function getLanguageDistribution(db, _logger, libraryId) {
    return (await readLibraryProfileObservation(db, libraryId)).stats.languageDistribution;
}
export async function getTotalItems(db, _logger, libraryId) {
    return (await db.query('SELECT COUNT(*)::int AS total FROM media_server_items WHERE library_id = $1', [libraryId])).rows[0].total;
}
