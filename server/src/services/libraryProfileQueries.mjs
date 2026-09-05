/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildLibraryProfileObservation, observationStats } from './libraryProfileObservation.mjs';

/** A single snapshot for all denominators; projection excludes media content and provider payloads. */
export async function readLibraryProfileObservation(db, libraryId) {
    const { rows } = await db.query(`SELECT msi.tmdb_id, msi.media_type, msi.content_rating, msi.genres, msi.studio,
        statement_timestamp()::text AS observed_at,
        public.library_profile_observed_metadata(msi.metadata) AS metadata
        FROM media_server_items msi WHERE msi.library_id = $1`, [libraryId]);
    // Preserve PostgreSQL timestamp precision for ordering concurrent stored observations.
    const observedAt = rows[0]?.observed_at || new Date().toISOString();
    const observation = buildLibraryProfileObservation(rows);
    return { observation, observedAt, stats: observationStats(observation, new Date(observedAt).toISOString()) };
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
