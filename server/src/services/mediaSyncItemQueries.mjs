/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const READ_SYNC_ITEM = `SELECT media_server_id, external_id, media_type, title, year,
  tmdb_id, imdb_id, tvdb_id, metadata, xmin::text AS source_revision
  FROM media_server_items WHERE media_server_id = $1 AND external_id = $2`;

export const UPSERT_SYNC_ITEM = `INSERT INTO media_server_items
  (media_server_id, library_id, external_id, tmdb_id, imdb_id, tvdb_id,
   title, original_title, year, media_type, genres, tags, collections,
   studio, content_rating, added_at, metadata, last_synced)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
  ON CONFLICT (media_server_id, external_id) DO UPDATE SET
    library_id = EXCLUDED.library_id,
    tmdb_id = EXCLUDED.tmdb_id,
    imdb_id = EXCLUDED.imdb_id,
    tvdb_id = EXCLUDED.tvdb_id,
    title = EXCLUDED.title,
    original_title = EXCLUDED.original_title,
    year = EXCLUDED.year,
    media_type = EXCLUDED.media_type,
    genres = EXCLUDED.genres,
    tags = EXCLUDED.tags,
    collections = EXCLUDED.collections,
    studio = EXCLUDED.studio,
    content_rating = CASE
      WHEN NOT $19::boolean OR media_server_items.original_rating IS NULL
        OR UPPER(TRIM(media_server_items.original_rating)) IS DISTINCT FROM UPPER(TRIM(EXCLUDED.content_rating))
      THEN EXCLUDED.content_rating ELSE media_server_items.content_rating END,
    original_rating = CASE
      WHEN NOT $19::boolean OR media_server_items.original_rating IS NULL
        OR UPPER(TRIM(media_server_items.original_rating)) IS DISTINCT FROM UPPER(TRIM(EXCLUDED.content_rating))
      THEN NULL ELSE media_server_items.original_rating END,
    metadata = EXCLUDED.metadata,
    inventory_tmdb_attempted_at = CASE WHEN $19::boolean THEN media_server_items.inventory_tmdb_attempted_at ELSE NULL END,
    inventory_tmdb_fetched_at = CASE WHEN $19::boolean THEN media_server_items.inventory_tmdb_fetched_at ELSE NULL END,
    last_synced = NOW()
  WHERE media_server_items.xmin::text = $18::text
  RETURNING id`;
