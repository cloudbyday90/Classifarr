/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * Maps a media library type string to its corresponding arr service type.
 * @param {string} mediaType
 * @returns {string|null}
 */
function resolveArrType(mediaType) {
  if (mediaType === 'movie') return 'radarr';
  if (mediaType === 'tv') return 'sonarr';
  return null;
}

/**
 * Computes the diff between remote (media server) libraries and locally stored ones.
 * Returns three sets: libraries to insert, update, delete, plus the retained set with merged metadata.
 *
 * @param {Array} remoteLibraries  - Libraries fetched from the media server
 * @param {Array} existingRows     - Rows currently in the local `libraries` table
 * @returns {{ toInsert: Array, toUpdate: Array, toDelete: Array, retained: Array }}
 */
export function computeLibraryDiff(remoteLibraries, existingRows) {
  const existingMap = new Map(existingRows.map((lib) => [lib.external_id, lib]));
  const toInsert = [];
  const toUpdate = [];
  const retained = [];

  for (const remote of remoteLibraries) {
    const existing = existingMap.get(remote.external_id);
    const arrType = resolveArrType(remote.media_type);

    if (existing) {
      if (
        existing.name !== remote.name ||
        existing.media_type !== remote.media_type ||
        existing.arr_type !== arrType
      ) {
        toUpdate.push({
          id: existing.id,
          name: remote.name,
          media_type: remote.media_type,
          arr_type: arrType,
        });
      }
      retained.push({
        ...existing,
        name: remote.name,
        media_type: remote.media_type,
        arr_type: arrType,
      });
    } else {
      toInsert.push({ ...remote, arrType });
    }
  }

  const toDelete = existingRows.filter(
    (lib) => !remoteLibraries.find((r) => r.external_id === lib.external_id),
  );

  return { toInsert, toUpdate, toDelete, retained };
}

/**
 * Executes the full library sync against an active media server within a transaction,
 * then fires background content-sync tasks for every resulting library.
 *
 * @param {{ db, getMediaServerServiceByType, mediaSyncService, loggerInstance }} opts
 * @returns {Promise<Array>} All libraries present after sync (existing + newly inserted)
 */
export async function syncMediaServerLibraries({
  db,
  getMediaServerServiceByType,
  mediaSyncService,
  loggerInstance,
}) {
  const resultLibraries = [];

  await db.withTransaction(async (client) => {
    const serverResult = await client.query(
      'SELECT * FROM media_server WHERE is_active = true LIMIT 1',
    );

    if (serverResult.rows.length === 0) {
      const err = new Error('No active media server configured');
      err.httpStatus = 404;
      throw err;
    }

    const server = serverResult.rows[0];
    let service;
    try {
      service = getMediaServerServiceByType(server.type);
    } catch (_error) {
      const err = new Error('Invalid media server type');
      err.httpStatus = 400;
      throw err;
    }

    const remoteLibraries = await service.getLibraries(server.url, server.api_key);
    const existingResult = await client.query(
      'SELECT id, external_id, name, media_type, arr_type FROM libraries WHERE media_server_id = $1',
      [server.id],
    );

    const { toInsert, toUpdate, toDelete, retained } = computeLibraryDiff(
      remoteLibraries,
      existingResult.rows,
    );

    resultLibraries.push(...retained);

    if (toDelete.length > 0) {
      const idsToDelete = toDelete.map((lib) => lib.id);
      loggerInstance.info(
        `Deleting ${idsToDelete.length} libraries that are no longer on the media server`,
      );
      await client.query(
        'DELETE FROM media_server_sync_status WHERE library_id = ANY($1)',
        [idsToDelete],
      );
      await client.query(
        `DELETE FROM enrichment_retry_queue
         WHERE media_item_id IN (SELECT id FROM media_server_items WHERE library_id = ANY($1))`,
        [idsToDelete],
      );
      await client.query('DELETE FROM libraries WHERE id = ANY($1)', [idsToDelete]);
    }

    for (const update of toUpdate) {
      await client.query(
        `UPDATE libraries
         SET name = $1, media_type = $2, arr_type = $3, updated_at = NOW()
         WHERE id = $4`,
        [update.name, update.media_type, update.arr_type, update.id],
      );
    }

    for (const library of toInsert) {
      const insertResult = await client.query(
        `INSERT INTO libraries (media_server_id, external_id, name, media_type, arr_type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [server.id, library.external_id, library.name, library.media_type, library.arrType],
      );
      const newLibrary = insertResult.rows[0];

      await client.query(
        `INSERT INTO library_policies
           (library_id, name, description, enabled, priority, auto_classify_threshold, prompt_threshold)
         VALUES ($1, $2, $3, true, 5, 85, 60)
         ON CONFLICT (library_id) DO NOTHING`,
        [newLibrary.id, `${newLibrary.name} Policy`, `Auto-generated policy for ${newLibrary.name}`],
      );

      resultLibraries.push(newLibrary);
    }

    await client.query('UPDATE media_server SET last_sync = NOW() WHERE id = $1', [server.id]);
  });

  for (const library of resultLibraries) {
    mediaSyncService
      .syncLibrary(library.id, { incremental: false, batchSize: 100 })
      .then((result) => {
        loggerInstance.info(
          `Auto-sync completed for library ${library.name}: ${result.itemsImported || 0} items`,
        );
      })
      .catch((error) => {
        loggerInstance.error(`Auto-sync failed for library ${library.name}:`, {
          error: error.message,
        });
      });
  }

  return resultLibraries;
}
