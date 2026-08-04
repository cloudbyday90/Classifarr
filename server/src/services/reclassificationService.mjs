import * as db from '../config/database.mjs';
import { libraryMappingService } from './libraryMappingService.mjs';
import { createLogger } from '../utils/logger.mjs';
import { moveMovie, moveSeries } from './reclassificationMoves.mjs';
import { rollback as _rollback, previewReclassification as _previewReclassification, triggerPlexScan as _triggerPlexScan } from './reclassificationQueries.mjs';
import { NotFoundError, ValidationError, AppError } from '../utils/appError.mjs';

const logger = createLogger('ReclassificationService');

export class ReclassificationService {
  async executeReclassification({ classificationId, targetLibraryId, correctedBy = 'user' }) {
    const rollbackInfo = { executed: false, originalData: null };

    const classResult = await db.query(`
      SELECT ch.*, l.name as library_name, l.media_type, l.media_server_id
      FROM classification_history ch
      LEFT JOIN libraries l ON ch.library_id = l.id
      WHERE ch.id = $1
    `, [classificationId]);

    if (classResult.rows.length === 0) {
      throw new NotFoundError('Classification not found');
    }

    const classification = classResult.rows[0];
    const { tmdb_id, tvdb_id, media_type, library_id: originalLibraryId, title } = classification;

    const targetMapping = await libraryMappingService.getLibraryMapping(targetLibraryId);
    if (!targetMapping) {
      throw new ValidationError('Target library has no *arr mapping configured. Please configure mappings first.');
    }

    const expectedArrType = media_type === 'movie' ? 'radarr' : 'sonarr';
    if (targetMapping.arr_type !== expectedArrType) {
      throw new ValidationError(`Media type mismatch: ${media_type} content cannot be moved to ${targetMapping.arr_type}. ${media_type === 'movie' ? 'Movies' : 'TV shows'} must stay within ${expectedArrType}.`);
    }

    const originalMapping = await libraryMappingService.getLibraryMapping(originalLibraryId);

    let moveResult;
    if (media_type === 'movie') {
      moveResult = await moveMovie({
        tmdbId: tmdb_id,
        targetMapping,
        originalMapping,
        title,
      });
    } else if (media_type === 'tv') {
      moveResult = await moveSeries({
        tvdbId: tvdb_id || tmdb_id,
        targetMapping,
        originalMapping,
        title,
      });
    } else {
      throw new ValidationError(`Unsupported media type: ${media_type}`);
    }

    if (!moveResult.success) {
      throw new AppError(moveResult.error || 'Move operation failed', 500);
    }

    rollbackInfo.executed = true;
    rollbackInfo.originalData = {
      libraryId: originalLibraryId,
      arrConfig: originalMapping,
    };

    try {
      await db.query(`
        UPDATE classification_history
        SET library_id = $1,
            library_name = (SELECT name FROM libraries WHERE id = $1),
            status = 'reclassified',
            updated_at = NOW()
        WHERE id = $2
      `, [targetLibraryId, classificationId]);

      await db.query(`
        INSERT INTO classification_corrections
        (classification_id, original_library_id, corrected_library_id, corrected_by)
        VALUES ($1, $2, $3, $4)
      `, [classificationId, originalLibraryId, targetLibraryId, correctedBy]);

      try {
        const plexScanResult = await this.triggerPlexScan({
          targetLibraryId,
          originalLibraryId,
          newPath: moveResult.newPath,
          oldPath: moveResult.oldPath,
        });
        logger.info('Plex scan triggered', plexScanResult);
      } catch (plexError) {
        logger.warn('Plex scan failed (move was successful)', { error: plexError.message });
      }

      logger.info('Re-classification successful', {
        classificationId,
        title,
        from: originalLibraryId,
        to: targetLibraryId,
        arrPath: targetMapping.arr_root_folder_path,
      });

      return {
        success: true,
        message: `Successfully moved "${title}" to new library`,
        details: {
          title,
          mediaType: media_type,
          newPath: targetMapping.arr_root_folder_path,
          movedIn: targetMapping.arr_type,
        },
        rollbackInfo,
      };
    } catch (error) {
      if (rollbackInfo.executed && rollbackInfo.originalData) {
        await this.rollback(rollbackInfo.originalData);
      }
      throw error;
    }
  }

  async moveMovie(params) {
    return moveMovie(params);
  }

  async moveSeries(params) {
    return moveSeries(params);
  }

  async rollback(originalData) {
    return _rollback(originalData);
  }

  async previewReclassification(params) {
    return _previewReclassification(params);
  }

  async triggerPlexScan(params) {
    return _triggerPlexScan(params);
  }
}

export const reclassificationService = new ReclassificationService();
