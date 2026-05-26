import * as db from '../config/database.mjs';
import { libraryMappingService } from './libraryMappingService.mjs';
import { plexService } from './mediaServers/index.mjs';
import { createLogger } from '../utils/logger.mjs';
import { NotFoundError } from '../utils/appError.mjs';

const logger = createLogger('ReclassificationService');

export async function saveLearnedCorrection({ tmdbId, mediaType, correctedLibraryId, title, correctedBy, userNote = null }) {
  try {
    await db.query(`
      INSERT INTO learned_corrections (tmdb_id, media_type, corrected_library_id, title, corrected_by, user_note)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tmdb_id, media_type)
      DO UPDATE SET
        corrected_library_id = EXCLUDED.corrected_library_id,
        title = EXCLUDED.title,
        corrected_by = EXCLUDED.corrected_by,
        user_note = EXCLUDED.user_note,
        updated_at = NOW()
    `, [tmdbId, mediaType, correctedLibraryId, title, correctedBy, userNote]);

    logger.info('Learned correction saved', { tmdbId, mediaType, correctedLibraryId });
  } catch (error) {
    logger.error('Failed to save learned correction', { error: error.message });
  }
}

export async function rollback(originalData) {
  try {
    logger.warn('Attempting rollback', { originalData });
  } catch (error) {
    logger.error('Rollback failed', { error: error.message });
  }
}

export async function previewReclassification({ classificationId, targetLibraryId }) {
  const classResult = await db.query(`
    SELECT ch.*, l.name as current_library_name, l.media_type
    FROM classification_history ch
    LEFT JOIN libraries l ON ch.library_id = l.id
    WHERE ch.id = $1
  `, [classificationId]);

  if (classResult.rows.length === 0) {
    throw new NotFoundError('Classification not found');
  }

  const classification = classResult.rows[0];
  const targetLibResult = await db.query('SELECT id, name FROM libraries WHERE id = $1', [targetLibraryId]);
  const targetLibrary = targetLibResult.rows[0];
  const targetMapping = await libraryMappingService.getLibraryMapping(targetLibraryId);

  return {
    title: classification.title,
    mediaType: classification.media_type,
    currentLibrary: classification.current_library_name,
    targetLibrary: targetLibrary?.name,
    targetPath: targetMapping?.arr_root_folder_path || 'No mapping configured',
    canProceed: !!targetMapping,
    warning: !targetMapping ? 'Target library has no *arr mapping configured' : null,
  };
}

export async function triggerPlexScan({ targetLibraryId, originalLibraryId, newPath, oldPath }) {
  const scans = [];

  try {
    const targetLibResult = await db.query(`
      SELECT l.id, l.name, l.external_id as plex_library_key,
             ms.id as media_server_id, ms.url as plex_url, ms.api_key as plex_token
      FROM libraries l
      JOIN media_servers ms ON l.media_server_id = ms.id
      WHERE l.id = $1 AND ms.type = 'plex'
    `, [targetLibraryId]);

    if (targetLibResult.rows.length > 0) {
      const { plex_url, plex_token, plex_library_key, name } = targetLibResult.rows[0];

      if (plex_url && plex_token && plex_library_key) {
        const scanResult = await plexService.triggerScanAfterMove(
          plex_url,
          plex_token,
          plex_library_key,
          newPath ? [newPath] : [],
        );
        scans.push({
          library: name,
          ...scanResult,
        });
      }
    }

    if (originalLibraryId !== targetLibraryId) {
      const origLibResult = await db.query(`
        SELECT l.id, l.name, l.external_id as plex_library_key,
               ms.id as media_server_id, ms.url as plex_url, ms.api_key as plex_token
        FROM libraries l
        JOIN media_servers ms ON l.media_server_id = ms.id
        WHERE l.id = $1 AND ms.type = 'plex'
      `, [originalLibraryId]);

      if (origLibResult.rows.length > 0) {
        const { plex_url, plex_token, plex_library_key, name } = origLibResult.rows[0];

        if (plex_url && plex_token && plex_library_key) {
          const scanResult = await plexService.triggerScanAfterMove(
            plex_url,
            plex_token,
            plex_library_key,
            oldPath ? [oldPath] : [],
          );
          scans.push({
            library: name,
            libraryId: originalLibraryId,
            type: 'source',
            ...scanResult,
          });
        }
      }
    }

    return {
      success: scans.every((scan) => scan.success),
      scans,
    };
  } catch (error) {
    logger.error('Failed to trigger Plex scan', { error: error.message });
    return {
      success: false,
      error: error.message,
      scans,
    };
  }
}
