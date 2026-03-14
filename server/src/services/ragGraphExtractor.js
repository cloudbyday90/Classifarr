/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const { normalizeMetadataList } = require('../utils/metadataNormalization');

/**
 * RAG Graph Extractor
 *
 * Extracts denormalized relationship attributes from a classification_history metadata
 * object and returns them as typed values ready to be written into the five new graph
 * columns (director_name, primary_studio_name, genre_names, cast_ids, cast_names).
 *
 * This module is intentionally stateless and synchronous: it performs no I/O and has no
 * side effects. The caller is responsible for persisting the returned values.
 *
 * IMPORTANT — intarray null constraint:
 * The cast_ids column uses a GIN index with gin__int_ops (from the intarray extension).
 * intarray throws a runtime error at query time if the stored array contains any NULL
 * element. extract() always filters cast_ids through .filter(id => id != null) to guard
 * against malformed or partial TMDB enrichment data. An empty array is valid; a null
 * element is not.
 *
 * Extraction rules (locked in Phase 0 schema audit):
 *   director_name:       metadata.director_name — set at enrichment time by enrichWithTMDB().
 *                        Movie rows: Director from credits.crew. TV rows: created_by[0].name.
 *                        Normalize to lowercase trim, max 255 chars. Null for unenriched rows.
 *   primary_studio_name: metadata.production_companies?.[0]?.name — first company only.
 *                        Normalize to lowercase trim, max 255 chars.
 *   genre_names:         metadata.genres — already a string[] from enrichWithTMDB(). Max 10.
 *   cast_ids:            metadata.cast — top-5 TMDB person IDs. Must filter nulls.
 *   cast_names:          metadata.cast — top-5 cast display names.
 */

/**
 * Extract graph relationship attributes from a metadata object.
 *
 * @param {object|null} metadata - The metadata object stored in classification_history.metadata.
 *   Must be the parsed JS object, not a JSON string.
 * @returns {{
 *   director_name: string|null,
 *   primary_studio_name: string|null,
 *   genre_names: string[],
 *   cast_ids: number[],
 *   cast_names: string[]
 * }}
 */
function extract(metadata) {
    if (!metadata || typeof metadata !== 'object') {
        return {
            director_name: null,
            primary_studio_name: null,
            genre_names: [],
            cast_ids: [],
            cast_names: []
        };
    }

    // director_name: written at enrichment time as a resolved string.
    // For movies: Director from credits.crew. For TV: created_by[0].name (showrunner).
    // Null for manual/source-library rows or pre-Phase-2 rows that have not been backfilled.
    const rawDirector = metadata.director_name;
    const director_name = (rawDirector && typeof rawDirector === 'string')
        ? rawDirector.toLowerCase().trim().slice(0, 255) || null
        : null;

    // primary_studio_name: first production company name.
    const firstCompany = Array.isArray(metadata.production_companies)
        ? metadata.production_companies[0]
        : null;
    const rawStudio = firstCompany?.name;
    const primary_studio_name = (rawStudio && typeof rawStudio === 'string')
        ? rawStudio.toLowerCase().trim().slice(0, 255) || null
        : null;

    // genre_names: metadata.genres is already a string[] from enrichWithTMDB().
    // Phase 0 Finding 1 confirmed: enrichment stores ['Action', 'Comedy'], not objects.
    const genre_names = normalizeMetadataList(metadata.genres).slice(0, 10);

    // cast_ids: top-5 TMDB person IDs (integers).
    // CRITICAL: filter out nulls — gin__int_ops throws at query time on NULL array elements.
    const cast_ids = Array.isArray(metadata.cast)
        ? metadata.cast
            .slice(0, 5)
            .map(c => (c && typeof c.id === 'number' ? c.id : null))
            .filter(id => id != null)
        : [];

    // cast_names: top-5 cast display names (strings).
    const cast_names = Array.isArray(metadata.cast)
        ? metadata.cast
            .slice(0, 5)
            .map(c => (c && typeof c.name === 'string' ? c.name : null))
            .filter(Boolean)
        : [];

    return { director_name, primary_studio_name, genre_names, cast_ids, cast_names };
}

module.exports = { extract };
