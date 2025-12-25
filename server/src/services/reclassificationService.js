/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const db = require('../config/database');
const radarrService = require('./radarr');
const sonarrService = require('./sonarr');
const libraryMappingService = require('./libraryMappingService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ReclassificationService');

/**
 * Re-Classification Service
 * Handles the actual move of media between *arr root folders
 */
class ReclassificationService {
    /**
     * Execute a re-classification (move media to correct library)
     * @param {Object} params - Re-classification parameters
     * @param {number} params.classificationId - Classification history ID
     * @param {number} params.targetLibraryId - Target library ID
     * @param {string} params.correctedBy - Who is making the correction
     * @returns {Object} Result with success status, details, and rollback info
     */
    async executeReclassification({ classificationId, targetLibraryId, correctedBy = 'user' }) {
        const rollbackInfo = { executed: false, originalData: null };

        try {
            // 1. Get classification details
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

            // 2. Get target library mapping
            const targetMapping = await libraryMappingService.getLibraryMapping(targetLibraryId);
            if (!targetMapping) {
                throw new Error('Target library has no *arr mapping configured. Please configure mappings first.');
            }

            // 2b. CRITICAL: Validate media type isolation
            // Movies can ONLY move to Radarr root folders, TV can ONLY move to Sonarr root folders
            const expectedArrType = media_type === 'movie' ? 'radarr' : 'sonarr';
            if (targetMapping.arr_type !== expectedArrType) {
                throw new Error(`Media type mismatch: ${media_type} content cannot be moved to ${targetMapping.arr_type}. ${media_type === 'movie' ? 'Movies' : 'TV shows'} must stay within ${expectedArrType}.`);
            }

            // 3. Get original library mapping (for potential rollback)
            const originalMapping = await libraryMappingService.getLibraryMapping(originalLibraryId);

            // 4. Execute the move based on media type
            let moveResult;
            if (media_type === 'movie') {
                moveResult = await this.moveMovie({
                    tmdbId: tmdb_id,
                    targetMapping,
                    originalMapping,
                    title
                });
            } else if (media_type === 'tv') {
                moveResult = await this.moveSeries({
                    tvdbId: tvdb_id || tmdb_id, // Fall back to tmdb_id if tvdb not available
                    targetMapping,
                    originalMapping,
                    title
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
                arrConfig: originalMapping
            };

            // 5. Update classification history
            await db.query(`
        UPDATE classification_history 
        SET library_id = $1, status = 'reclassified', updated_at = NOW()
        WHERE id = $2
      `, [targetLibraryId, classificationId]);

            // 6. Save correction record
            await db.query(`
        INSERT INTO classification_corrections 
        (classification_id, original_library_id, corrected_library_id, corrected_by)
        VALUES ($1, $2, $3, $4)
      `, [classificationId, originalLibraryId, targetLibraryId, correctedBy]);

            // 7. Save as learned correction for future classifications
            await this.saveLearnedCorrection({
                tmdbId: tmdb_id,
                mediaType: media_type,
                correctedLibraryId: targetLibraryId,
                title,
                correctedBy
            });

            logger.info('Re-classification successful', {
                classificationId,
                title,
                from: originalLibraryId,
                to: targetLibraryId,
                arrPath: targetMapping.arr_root_folder_path
            });

            return {
                success: true,
                message: `Successfully moved "${title}" to new library`,
                details: {
                    title,
                    mediaType: media_type,
                    newPath: targetMapping.arr_root_folder_path,
                    movedIn: targetMapping.arr_type
                },
                rollbackInfo
            };

        } catch (error) {
            logger.error('Re-classification failed', { classificationId, error: error.message });

            // Attempt rollback if move was executed
            if (rollbackInfo.executed && rollbackInfo.originalData) {
                await this.rollback(rollbackInfo.originalData);
            }

            return {
                success: false,
                error: error.message,
                rollbackAttempted: rollbackInfo.executed,
                rollbackInfo
            };
        }
    }

    /**
     * Move a movie in Radarr
     */
    async moveMovie({ tmdbId, targetMapping, originalMapping, title }) {
        try {
            const { arr_config_id, arr_root_folder_path, quality_profile_id } = targetMapping;

            // Get Radarr config
            const configResult = await db.query('SELECT * FROM radarr_config WHERE id = $1', [arr_config_id]);
            if (configResult.rows.length === 0) {
                throw new Error('Radarr configuration not found');
            }

            const config = configResult.rows[0];
            const url = config.url || radarrService.buildUrl(config);

            // Find the movie in Radarr
            const movie = await radarrService.getMovieByTmdbId(url, config.api_key, tmdbId);
            if (!movie) {
                // Movie not in Radarr yet - might have been added to wrong instance
                // Try adding to the correct Radarr instance
                return { success: true, message: 'Movie not found in Radarr - no move needed' };
            }

            // Update the movie's root folder path (this triggers Radarr to move the files)
            const updateResult = await radarrService.updateMoviePath(
                url,
                config.api_key,
                movie.id,
                arr_root_folder_path,
                quality_profile_id
            );

            return {
                success: true,
                message: `Movie moved to ${arr_root_folder_path}`,
                data: updateResult
            };

        } catch (error) {
            logger.error('Failed to move movie', { tmdbId, error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Move a series in Sonarr
     */
    async moveSeries({ tvdbId, targetMapping, originalMapping, title }) {
        try {
            const { arr_config_id, arr_root_folder_path, quality_profile_id } = targetMapping;

            // Get Sonarr config
            const configResult = await db.query('SELECT * FROM sonarr_config WHERE id = $1', [arr_config_id]);
            if (configResult.rows.length === 0) {
                throw new Error('Sonarr configuration not found');
            }

            const config = configResult.rows[0];
            const url = config.url || sonarrService.buildUrl(config);

            // Find the series in Sonarr
            const series = await sonarrService.getSeriesByTvdbId(url, config.api_key, tvdbId);
            if (!series) {
                return { success: true, message: 'Series not found in Sonarr - no move needed' };
            }

            // Update the series root folder path
            const updateResult = await sonarrService.updateSeriesPath(
                url,
                config.api_key,
                series.id,
                arr_root_folder_path,
                quality_profile_id
            );

            return {
                success: true,
                message: `Series moved to ${arr_root_folder_path}`,
                data: updateResult
            };

        } catch (error) {
            logger.error('Failed to move series', { tvdbId, error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Save a learned correction for future automated classifications
     */
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
            // Don't throw - this is supplementary
        }
    }

    /**
     * Rollback a failed re-classification
     */
    async rollback(originalData) {
        try {
            logger.warn('Attempting rollback', { originalData });
            // Rollback logic would move the file back
            // For now, we just log - full rollback requires knowing the new path
        } catch (error) {
            logger.error('Rollback failed', { error: error.message });
        }
    }

    /**
     * Preview a re-classification without executing
     */
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

        // Get target library info
        const targetLibResult = await db.query('SELECT id, name FROM libraries WHERE id = $1', [targetLibraryId]);
        const targetLibrary = targetLibResult.rows[0];

        // Get target mapping
        const targetMapping = await libraryMappingService.getLibraryMapping(targetLibraryId);

        return {
            title: classification.title,
            mediaType: classification.media_type,
            currentLibrary: classification.current_library_name,
            targetLibrary: targetLibrary?.name,
            targetPath: targetMapping?.arr_root_folder_path || 'No mapping configured',
            canProceed: !!targetMapping,
            warning: !targetMapping ? 'Target library has no *arr mapping configured' : null
        };
    }
}

module.exports = new ReclassificationService();
