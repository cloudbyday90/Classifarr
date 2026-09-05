/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const LIBRARY_OVERLAP_LIMITS = Object.freeze({ libraryLimit: 12, rowLimit: 20000,
    traitEntryLimit: 5, metadataByteLimit: 4096, genresByteLimit: 2048 });

/** One snapshot. The extra ID detects overflow before any trait payload is returned. */
export async function readLibraryOverlapSnapshot(db) {
    const { libraryLimit, rowLimit, metadataByteLimit, genresByteLimit } = LIBRARY_OVERLAP_LIMITS;
    const { rows } = await db.query(`
        WITH selected_libraries AS MATERIALIZED (
            SELECT id, name FROM libraries WHERE is_active = true ORDER BY id LIMIT $1
        ), bounded_ids AS MATERIALIZED (
            SELECT msi.id FROM media_server_items msi
            JOIN selected_libraries l ON l.id = msi.library_id ORDER BY msi.id LIMIT $2
        ), size AS (SELECT COUNT(*)::int AS row_count FROM bounded_ids),
        projected AS MATERIALIZED (
            SELECT msi.library_id, msi.media_type, msi.tmdb_id, msi.content_rating, msi.studio,
                msi.genres, public.library_profile_observed_metadata(msi.metadata) AS metadata
            FROM bounded_ids b JOIN media_server_items msi ON msi.id = b.id
            WHERE (SELECT row_count FROM size) <= $3
        )
        SELECT statement_timestamp()::text AS observed_at,
            (SELECT COUNT(*)::int FROM libraries WHERE is_active = true) AS active_library_count,
            (SELECT row_count FROM size) AS row_count,
            COALESCE((SELECT jsonb_agg(l ORDER BY l.id) FROM selected_libraries l), '[]'::jsonb) AS libraries,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'library_id', library_id, 'media_type', media_type, 'tmdb_id', tmdb_id,
                'content_rating', content_rating, 'studio', studio,
                'genres', CASE WHEN octet_length(genres::text) <= $5 THEN genres ELSE NULL END,
                'metadata', CASE WHEN octet_length(metadata::text) <= $4 THEN metadata ELSE NULL END,
                'omitted_traits', COALESCE(octet_length(genres::text) > $5, false) OR
                    COALESCE(octet_length(metadata::text) > $4, false)
            )) FROM projected), '[]'::jsonb) AS items`,
    [libraryLimit, rowLimit + 1, rowLimit, metadataByteLimit, genresByteLimit]);
    return rows[0];
}
