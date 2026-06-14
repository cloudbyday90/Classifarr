import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { contentTypeAnalyzer } from './contentTypeAnalyzer.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';

const logger = createLogger('mediaSync');

export async function upsertMediaItem(mediaServerId, libraryId, item) {
    try {
        const libraryCheck = await db.query('SELECT id FROM libraries WHERE id = $1', [libraryId]);
        if (libraryCheck.rows.length === 0) {
            logger.warn(`Skipping media item - library ${libraryId} no longer exists (likely deleted during re-sync)`, {
                item: item.external_id,
            });
            return;
        }

        const normalizedGenres = normalizeMetadataList(item.genres);
        const normalizedTags = normalizeMetadataList(item.tags);
        const normalizedCollections = normalizeMetadataList(item.collections);

        const analysis = await contentTypeAnalyzer.analyze({
            title: item.title,
            overview: item.metadata?.summary || '',
            genres: normalizedGenres,
            keywords: normalizedTags,
            content_rating: item.content_rating,
            original_language: 'en',
            tmdb_id: item.tmdb_id,
        }, null, true);

        if (analysis.analyzed && analysis.bestMatch) {
            item.metadata = {
                ...(item.metadata || {}),
                content_analysis: {
                    type: analysis.bestMatch.type,
                    confidence: analysis.bestMatch.confidence,
                    detected_at: new Date().toISOString(),
                },
            };
        }

        await db.query(
            `INSERT INTO media_server_items
             (media_server_id, library_id, external_id, tmdb_id, imdb_id, tvdb_id,
              title, original_title, year, media_type, genres, tags, collections,
              studio, content_rating, added_at, metadata, last_synced)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
             ON CONFLICT (media_server_id, external_id)
             DO UPDATE SET
               library_id = EXCLUDED.library_id,
               tmdb_id = EXCLUDED.tmdb_id,
               imdb_id = EXCLUDED.imdb_id,
               tvdb_id = EXCLUDED.tvdb_id,
               title = EXCLUDED.title,
               original_title = EXCLUDED.original_title,
               year = EXCLUDED.year,
               genres = EXCLUDED.genres,
               tags = EXCLUDED.tags,
               collections = EXCLUDED.collections,
               studio = EXCLUDED.studio,
               content_rating = CASE
                 WHEN media_server_items.original_rating IS NULL
                      OR UPPER(TRIM(media_server_items.original_rating)) IS DISTINCT FROM UPPER(TRIM(EXCLUDED.content_rating))
                 THEN EXCLUDED.content_rating
                 ELSE media_server_items.content_rating
               END,
               original_rating = CASE
                 WHEN media_server_items.original_rating IS NULL
                      OR UPPER(TRIM(media_server_items.original_rating)) IS DISTINCT FROM UPPER(TRIM(EXCLUDED.content_rating))
                 THEN NULL
                 ELSE media_server_items.original_rating
               END,
               metadata = COALESCE(media_server_items.metadata, '{}')::jsonb || EXCLUDED.metadata::jsonb,
               last_synced = NOW()`,
            [
                mediaServerId,
                libraryId,
                item.external_id,
                item.tmdb_id || null,
                item.imdb_id || null,
                item.tvdb_id || null,
                item.title,
                item.original_title || null,
                item.year || null,
                item.media_type,
                normalizedGenres,
                normalizedTags,
                normalizedCollections,
                item.studio || null,
                item.content_rating || null,
                item.added_at || null,
                JSON.stringify(item.metadata || {}),
            ],
        );
    } catch (error) {
        if (error.code === '23503') {
            logger.warn(`Skipping media item - library ${libraryId} no longer exists (race condition)`, {
                item: item.external_id,
            });
            return;
        }
        logger.error('Error upserting media item', { item: item.external_id, error: error.message });
    }
}

export async function upsertCollection(mediaServerId, libraryId, collection) {
    try {
        const libraryCheck = await db.query('SELECT id FROM libraries WHERE id = $1', [libraryId]);
        if (libraryCheck.rows.length === 0) {
            logger.warn(`Skipping collection - library ${libraryId} no longer exists`, {
                collection: collection.name,
            });
            return;
        }

        await db.query(
            `INSERT INTO media_server_collections
             (media_server_id, library_id, external_id, name, item_count, last_synced)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (media_server_id, external_id)
             DO UPDATE SET
               name = EXCLUDED.name,
               item_count = EXCLUDED.item_count,
               last_synced = NOW()`,
            [mediaServerId, libraryId, collection.external_id, collection.name, collection.item_count || 0],
        );
    } catch (error) {
        if (error.code === '23503') {
            logger.warn(`Skipping collection - library ${libraryId} no longer exists (race condition)`, {
                collection: collection.name,
            });
            return;
        }
        logger.error('Error upserting collection', { collection: collection.name, error: error.message });
    }
}
