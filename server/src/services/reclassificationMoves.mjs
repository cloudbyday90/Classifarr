import * as db from '../config/database.mjs';
import { radarrService } from './radarr.mjs';
import { sonarrService } from './sonarr.mjs';
import { fileOperationsService } from './fileOperationsService.mjs';
import { createLogger } from '../utils/logger.mjs';
import { executeArrMediaMove } from './shared/arrMediaMove.mjs';

const logger = createLogger('ReclassificationService');

export async function moveMovie({ tmdbId, targetMapping, originalMapping: _originalMapping, title, dryRun = false }) {
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

export async function moveSeries({ tvdbId, targetMapping, originalMapping: _originalMapping, title, dryRun = false }) {
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
