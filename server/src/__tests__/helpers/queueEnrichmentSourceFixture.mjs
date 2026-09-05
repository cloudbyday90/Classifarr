/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

/** Existing pipeline scenarios assume a matching source item; rejection tests supply their own rows. */
export async function runTaskWithMatchingEnrichmentSource(queueService, db, task) {
  if (task.task_type !== 'metadata_enrichment') return queueService.processTask(task);
  const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;
  const implementation = db.query.getMockImplementation();
  db.query.mockImplementation(async (text, values) => {
    const result = await implementation(text, values);
    if (text.startsWith('SELECT msi.tmdb_id, msi.media_type')) {
      return { rows: [{
        media_type: payload.media.media_type, tmdb_id: payload.tmdb_id ?? null,
        media_server_id: 1, external_id: `fixture-${payload.itemId}`,
        library_id: payload.source_library_id, library_name: payload.source_library_name,
        title: payload.title, year: payload.year, imdb_id: payload.imdb_id ?? null, tvdb_id: payload.tvdb_id ?? null,
        metadata: {}, ...result.rows[0],
      }] };
    }
    if (text.includes('SET metadata = COALESCE(metadata,')) return { ...result, rowCount: result.rowCount ?? 1 };
    return result;
  });
  try {
    return await queueService.processTask(task);
  } finally {
    db.query.mockImplementation(implementation);
  }
}
