/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import * as db from '../config/database.mjs';
import radarrService from './radarr.mjs';
import sonarrService from './sonarr.mjs';
import libraryMappingService from './libraryMappingService.mjs';
import fileOperationsService from './fileOperationsService.mjs';
import { createLogger } from '../utils/logger.mjs';
import { executeArrMediaMove } from './shared/arrMediaMove.mjs';
import { plexService } from './mediaServers/index.mjs';

const logger = createLogger('ReclassificationService');

class ReclassificationService {
  async executeReclassification({ classificationId, targetLibraryId, correctedBy = 'user' }) {
    const rollbackInfo = { executed: false, originalData: null };

    try {
      const classResult = await db.query(`
        SELECT ch.*, l.name as library_name, l.media_type, l.media_server_id
        FROM classification_history ch
        LEFT JOIN libraries l ON ch.library_id = l.id
        WHERE ch.id = $1
      `, [classificationId]);

      if (classResult.rows.length === 0) {
        throw new Error('Classification not found');
      }

      const classification = classResult.rows[0];
      const { tmdb_id, tvdb_id, media_type, library_id: originalLibraryId, title } = classification;

      const targetMapping = await libraryMappingService.getLibraryMapping(targetLibraryId);
      if (!targetMapping) {
        throw new Error('Target library has no *arr mapping configured. Please configure mappings first.');
      }

      const expectedArrType = media_type === 'movie' ? 'radarr' : 'sonarr';
      if (targetMapping.arr_type !== expectedArrType) {
        throw new Error(`Media type mismatch: ${media_type} content cannot be moved to ${targetMapping.arr_type}. ${media_type === 'movie' ? 'Movies' : 'TV shows'} must stay within ${expectedArrType}.`);
      }

      const originalMapping = await libraryMappingService.getLibraryMapping(originalLibraryId);

      let moveResult;
      if (media_type === 'movie') {
        moveResult = await this.moveMovie({
          tmdbId: tmdb_id,
          targetMapping,
          originalMapping,
          title,
        });
      } else if (media_type === 'tv') {
        moveResult = await this.moveSeries({
          tvdbId: tvdb_id || tmdb_id,
          targetMapping,
          originalMapping,
          title,
        });
      } else {
        throw new Error(`Unsupported media type: ${media_type}`);
      }

      if (!moveResult.success) {
        throw new Error(moveResult.error || 'Move operation failed');
      }

      rollbackInfo.executed = true;
      rollbackInfo.originalData = {
        libraryId: originalLibraryId,
        arrConfig: originalMapping,
      };

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

      await this.saveLearnedCorrection({
        tmdbId: tmdb_id,
        mediaType: media_type,
        correctedLibraryId: targetLibraryId,
        title,
        correctedBy,
      });

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
      logger.error('Re-classification failed', { classificationId, error: error.message });

      if (rollbackInfo.executed && rollbackInfo.originalData) {
        await this.rollback(rollbackInfo.originalData);
      }

      return {
        success: false,
        error: error.message,
        rollbackAttempted: rollbackInfo.executed,
        rollbackInfo,
      };
    }
  }

  async moveMovie({ tmdbId, targetMapping, originalMapping: _originalMapping, title, dryRun = false }) {
    try {
      const { arr_config_id, arr_root_folder_path, quality_profile_id } = targetMapping;

      const configResult = await db.query('SELECT * FROM radarr_config WHERE id = $1', [arr_config_id]);
      if (configResult.rows.length === 0) {
        throw new Error('Radarr configuration not found');
      }

      const config = configResult.rows[0];
      const url = config.url || radarrService.buildUrl(config);

      const movie = await radarrService.getMovieByTmdbId(url, config.api_key, tmdbId);
      if (!movie) {
        return { success: true, message: 'Movie not found in Radarr - no move needed' };
      }

      return executeArrMediaMove({
        label: 'movie',
        title,
        currentPath: movie.path,
        rootPath: arr_root_folder_path,
        logger,
        dryRun,
        validateDestination: (newPath) => radarrService.validatePathInRootFolder(url, config.api_key, newPath),
        translatePath: (path) => fileOperationsService.translatePath(path),
        moveFolder: (fromPath, toPath, options) => fileOperationsService.moveFolder(fromPath, toPath, options),
        updateRemotePath: (newPath) => radarrService.updateMoviePath(
          url,
          config.api_key,
          movie.id,
          newPath,
          { moveFiles: false, qualityProfileId: quality_profile_id },
        ),
        validationErrorMessage: 'Destination path is not within a configured Radarr root folder',
      });
    } catch (error) {
      logger.error('Failed to move movie', { tmdbId, title, error: error.message });
      return { success: false, error: error.message };
    }
  }

  async moveSeries({ tvdbId, targetMapping, originalMapping: _originalMapping, title, dryRun = false }) {
    try {
      const { arr_config_id, arr_root_folder_path, quality_profile_id } = targetMapping;

      const configResult = await db.query('SELECT * FROM sonarr_config WHERE id = $1', [arr_config_id]);
      if (configResult.rows.length === 0) {
        throw new Error('Sonarr configuration not found');
      }

      const config = configResult.rows[0];
      const url = config.url || sonarrService.buildUrl(config);

      const series = await sonarrService.getSeriesByTvdbId(url, config.api_key, tvdbId);
      if (!series) {
        return { success: true, message: 'Series not found in Sonarr - no move needed' };
      }

      return executeArrMediaMove({
        label: 'series',
        title,
        currentPath: series.path,
        rootPath: arr_root_folder_path,
        logger,
        dryRun,
        validateDestination: (newPath) => sonarrService.validatePathInRootFolder(url, config.api_key, newPath),
        translatePath: (path) => fileOperationsService.translatePath(path),
        moveFolder: (fromPath, toPath, options) => fileOperationsService.moveFolder(fromPath, toPath, options),
        updateRemotePath: (newPath) => sonarrService.updateSeriesPath(
          url,
          config.api_key,
          series.id,
          newPath,
          { moveFiles: false, qualityProfileId: quality_profile_id },
        ),
        validationErrorMessage: 'Destination path is not within a configured Sonarr root folder',
      });
    } catch (error) {
      logger.error('Failed to move series', { tvdbId, title, error: error.message });
      return { success: false, error: error.message };
    }
  }

  async saveLearnedCorrection({ tmdbId, mediaType, correctedLibraryId, title, correctedBy, userNote = null }) {
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

  async rollback(originalData) {
    try {
      logger.warn('Attempting rollback', { originalData });
    } catch (error) {
      logger.error('Rollback failed', { error: error.message });
    }
  }

  async previewReclassification({ classificationId, targetLibraryId }) {
    const classResult = await db.query(`
      SELECT ch.*, l.name as current_library_name, l.media_type
      FROM classification_history ch
      LEFT JOIN libraries l ON ch.library_id = l.id
      WHERE ch.id = $1
    `, [classificationId]);

    if (classResult.rows.length === 0) {
      throw new Error('Classification not found');
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

  async triggerPlexScan({ targetLibraryId, originalLibraryId, newPath, oldPath }) {
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
}

const reclassificationService = new ReclassificationService();

export default reclassificationService;
export { ReclassificationService };
