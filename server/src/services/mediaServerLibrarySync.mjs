/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { AppError, NotFoundError, ValidationError } from '../utils/appError.mjs';

function createHttpError(message, httpStatus) {
  if (httpStatus === 400) {
    return new ValidationError(message);
  }

  if (httpStatus === 404) {
    return new NotFoundError(message);
  }

  return new AppError(message, httpStatus);
}

function resolveArrType(mediaType) {
  if (mediaType === 'movie') return 'radarr';
  if (mediaType === 'tv') return 'sonarr';
  return null;
}

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
    (lib) => !remoteLibraries.find((remote) => remote.external_id === lib.external_id),
  );

  return { toInsert, toUpdate, toDelete, retained };
}

export async function markCompletedClassificationHistoryForLibraryDeletion({
  client,
  libraryIds,
}) {
  if (!Array.isArray(libraryIds) || libraryIds.length === 0) {
    return { rowCount: 0 };
  }

  return client.query(
    `UPDATE classification_history ch
     SET status = 'failed',
         error_message = COALESCE(
           ch.error_message,
           'Library was deleted after this item was classified'
         ),
         library_name = COALESCE(ch.library_name, l.name)
     FROM libraries l
     WHERE ch.library_id = l.id
       AND l.id = ANY($1)
       AND ch.status = 'completed'`,
    [libraryIds],
  );
}

async function loadSyncContext({ _db, getMediaServerServiceByType, client }) {
  const serverResult = await client.query(
    'SELECT * FROM media_server WHERE is_active = true LIMIT 1',
  );

  if (serverResult.rows.length === 0) {
    throw createHttpError('No active media server configured', 404);
  }

  const server = serverResult.rows[0];

  let service;
  try {
    service = getMediaServerServiceByType(server.type);
  } catch (_error) {
    throw createHttpError('Invalid media server type', 400);
  }

  const remoteLibraries = await service.getLibraries(server.url, server.api_key);
  const existingResult = await client.query(
    'SELECT id, external_id, name, media_type, arr_type FROM libraries WHERE media_server_id = $1',
    [server.id],
  );

  return {
    server,
    remoteLibraries,
    existingRows: existingResult.rows,
  };
}

async function deleteRemovedLibraries({ client, librariesToDelete, logger }) {
  if (librariesToDelete.length === 0) {
    return;
  }

  const idsToDelete = librariesToDelete.map((library) => library.id);
  logger.info(
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
  await markCompletedClassificationHistoryForLibraryDeletion({
    client,
    libraryIds: idsToDelete,
  });
  await client.query('DELETE FROM libraries WHERE id = ANY($1)', [idsToDelete]);
}

async function updateExistingLibraries({ client, librariesToUpdate }) {
  for (const library of librariesToUpdate) {
    await client.query(
      `UPDATE libraries
       SET name = $1, media_type = $2, arr_type = $3, updated_at = NOW()
       WHERE id = $4`,
      [library.name, library.media_type, library.arr_type, library.id],
    );
  }
}

async function insertNewLibraries({ client, librariesToInsert, mediaServerId }) {
  const insertedLibraries = [];

  for (const library of librariesToInsert) {
    const insertResult = await client.query(
      `INSERT INTO libraries (media_server_id, external_id, name, media_type, arr_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [mediaServerId, library.external_id, library.name, library.media_type, library.arrType],
    );
    const newLibrary = insertResult.rows[0];

    await client.query(
      `INSERT INTO library_policies
         (library_id, name, description, enabled, priority, auto_classify_threshold, prompt_threshold)
       VALUES ($1, $2, $3, true, 5, 85, 60)
       ON CONFLICT (library_id) DO NOTHING`,
      [newLibrary.id, `${newLibrary.name} Policy`, `Auto-generated policy for ${newLibrary.name}`],
    );

    insertedLibraries.push(newLibrary);
  }

  return insertedLibraries;
}

function triggerBackgroundLibrarySync({ libraries, mediaSyncService, logger }) {
  for (const library of libraries) {
    mediaSyncService
      .syncLibrary(library.id, { incremental: false, batchSize: 100 })
      .then((result) => {
        logger.info(
          `Auto-sync completed for library ${library.name}: ${result.itemsImported || 0} items`,
        );
      })
      .catch((error) => {
        logger.error(`Auto-sync failed for library ${library.name}:`, {
          error: error.message,
        });
      });
  }
}

export async function syncMediaServerLibraries({
  db,
  getMediaServerServiceByType,
  mediaSyncService,
  logger,
}) {
  const resultLibraries = [];

  await db.withTransaction(async (client) => {
    const { server, remoteLibraries, existingRows } = await loadSyncContext({
      db,
      getMediaServerServiceByType,
      client,
    });

    const { toInsert, toUpdate, toDelete, retained } = computeLibraryDiff(
      remoteLibraries,
      existingRows,
    );

    resultLibraries.push(...retained);

    await deleteRemovedLibraries({
      client,
      librariesToDelete: toDelete,
      logger,
    });
    await updateExistingLibraries({
      client,
      librariesToUpdate: toUpdate,
    });

    const insertedLibraries = await insertNewLibraries({
      client,
      librariesToInsert: toInsert,
      mediaServerId: server.id,
    });

    resultLibraries.push(...insertedLibraries);

    await client.query('UPDATE media_server SET last_sync = NOW() WHERE id = $1', [server.id]);
  });

  triggerBackgroundLibrarySync({
    libraries: resultLibraries,
    mediaSyncService,
    logger,
  });

  return resultLibraries;
}
