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
const fileOperationsService = require('./fileOperationsService');
const plexService = require('./plex');
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

            // 8. Trigger Plex library scan for both old and new locations
            try {
                const plexScanResult = await this.triggerPlexScan({
                    targetLibraryId,
                    originalLibraryId,
                    newPath: moveResult.newPath,
                    oldPath: moveResult.oldPath
                });
                logger.info('Plex scan triggered', plexScanResult);
            } catch (plexError) {
                // Log but don't fail the operation if Plex scan fails
                logger.warn('Plex scan failed (move was successful)', { error: plexError.message });
            }

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
     * Flow: 1. Get current path from Radarr
     *       2. Classifarr moves the folder to new root
     *       3. Update Radarr with new path (moveFiles=false)
     * @param {Object} params - Move parameters
     * @param {boolean} params.dryRun - If true, only test if move would succeed
     */
    async moveMovie({ tmdbId, targetMapping, originalMapping, title, dryRun = false }) {
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
                return { success: true, message: 'Movie not found in Radarr - no move needed' };
            }

            // Get current path and calculate new path
            const currentPath = movie.path;
            const titleFolder = currentPath.split('/').pop() || currentPath.split('\\').pop();
            const newPath = arr_root_folder_path.endsWith('/')
                ? `${arr_root_folder_path}${titleFolder}`
                : `${arr_root_folder_path}/${titleFolder}`;

            // Validate destination is within a configured root folder
            const validation = await radarrService.validatePathInRootFolder(url, config.api_key, newPath);
            if (!validation.isValid) {
                throw new Error(validation.error || 'Destination path is not within a configured Radarr root folder');
            }

            logger.info('Preparing movie move', {
                title,
                from: currentPath,
                to: newPath,
                matchedRootFolder: validation.matchedRootFolder,
                dryRun
            });

            // Step 1: Use FileOperationsService to move the folder
            const moveResult = await fileOperationsService.moveFolder(currentPath, newPath, {
                dryRun,
                skipVerification: false
            });

            if (!moveResult.success) {
                throw new Error(moveResult.error || 'File move failed');
            }

            if (dryRun) {
                return {
                    success: true,
                    dryRun: true,
                    message: `Dry run: Move would succeed`,
                    details: {
                        from: currentPath,
                        to: newPath,
                        estimatedSize: moveResult.estimatedSize,
                        fileCount: moveResult.fileCount
                    }
                };
            }

            // Step 2: Update Radarr with new path (moveFiles=false - we already moved)
            const updateResult = await radarrService.updateMoviePath(
                url,
                config.api_key,
                movie.id,
                newPath,
                { moveFiles: false, qualityProfileId: quality_profile_id }
            );

            logger.info('Movie move completed', {
                title,
                from: currentPath,
                to: newPath,
                duration: moveResult.duration,
                fileCount: moveResult.fileCount
            });

            return {
                success: true,
                message: `Movie moved to ${arr_root_folder_path}`,
                details: {
                    from: currentPath,
                    to: newPath,
                    fileCount: moveResult.fileCount,
                    duration: moveResult.duration
                },
                data: updateResult
            };

        } catch (error) {
            logger.error('Failed to move movie', { tmdbId, title, error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Move a series in Sonarr
     * Flow: 1. Get current path from Sonarr
     *       2. Classifarr moves the folder to new root
     *       3. Update Sonarr with new path (moveFiles=false)
     * @param {Object} params - Move parameters
     * @param {boolean} params.dryRun - If true, only test if move would succeed
     */
    async moveSeries({ tvdbId, targetMapping, originalMapping, title, dryRun = false }) {
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

            // Get current path and calculate new path
            const currentPath = series.path;
            const titleFolder = currentPath.split('/').pop() || currentPath.split('\\').pop();
            const newPath = arr_root_folder_path.endsWith('/')
                ? `${arr_root_folder_path}${titleFolder}`
                : `${arr_root_folder_path}/${titleFolder}`;

            // Validate destination is within a configured root folder
            const validation = await sonarrService.validatePathInRootFolder(url, config.api_key, newPath);
            if (!validation.isValid) {
                throw new Error(validation.error || 'Destination path is not within a configured Sonarr root folder');
            }

            logger.info('Preparing series move', {
                title,
                from: currentPath,
                to: newPath,
                matchedRootFolder: validation.matchedRootFolder,
                dryRun
            });

            // Step 1: Use FileOperationsService to move the folder
            const moveResult = await fileOperationsService.moveFolder(currentPath, newPath, {
                dryRun,
                skipVerification: false
            });

            if (!moveResult.success) {
                throw new Error(moveResult.error || 'File move failed');
            }

            if (dryRun) {
                return {
                    success: true,
                    dryRun: true,
                    message: `Dry run: Move would succeed`,
                    details: {
                        from: currentPath,
                        to: newPath,
                        estimatedSize: moveResult.estimatedSize,
                        fileCount: moveResult.fileCount
                    }
                };
            }

            // Step 2: Update Sonarr with new path (moveFiles=false - we already moved)
            const updateResult = await sonarrService.updateSeriesPath(
                url,
                config.api_key,
                series.id,
                newPath,
                { moveFiles: false, qualityProfileId: quality_profile_id }
            );

            logger.info('Series move completed', {
                title,
                from: currentPath,
                to: newPath,
                duration: moveResult.duration,
                fileCount: moveResult.fileCount
            });

            return {
                success: true,
                message: `Series moved to ${arr_root_folder_path}`,
                details: {
                    from: currentPath,
                    to: newPath,
                    fileCount: moveResult.fileCount,
                    duration: moveResult.duration
                },
                data: updateResult
            };

        } catch (error) {
            logger.error('Failed to move series', { tvdbId, title, error: error.message });
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

    /**
     * Trigger Plex library scan after successful file move
     * Scans both old location (to remove) and new location (to add)
     * @param {Object} params - Parameters
     * @param {number} params.targetLibraryId - Target library ID
     * @param {number} params.originalLibraryId - Original library ID
     * @param {string} params.newPath - New file path
     * @param {string} params.oldPath - Old file path
     * @returns {Promise<{success: boolean, scans: object[]}>}
     */
    async triggerPlexScan({ targetLibraryId, originalLibraryId, newPath, oldPath }) {
        const scans = [];

        try {
            // Get library info with media server details for target library
            const targetLibResult = await db.query(`
                SELECT l.id, l.name, l.external_id as plex_library_key, 
                       ms.id as media_server_id, ms.url as plex_url, ms.api_key as plex_token
                FROM libraries l
                JOIN media_servers ms ON l.media_server_id = ms.id
                WHERE l.id = $1 AND ms.type = 'plex'
            `, [targetLibraryId]);

            // Scan new location (target library)
            if (targetLibResult.rows.length > 0) {
                const { plex_url, plex_token, plex_library_key, name } = targetLibResult.rows[0];

                if (plex_url && plex_token && plex_library_key) {
                    const scanResult = await plexService.triggerScanAfterMove(
                        plex_url,
                        plex_token,
                        plex_library_key,
                        newPath ? [newPath] : []
                    );
                    scans.push({
                        library: name,
                        libraryId: targetLibraryId,
                        type: 'target',
                        ...scanResult
                    });
                }
            }

            // Get original library info for scanning old location
            if (originalLibraryId !== targetLibraryId) {
                const origLibResult = await db.query(`
                    SELECT l.id, l.name, l.external_id as plex_library_key, 
                           ms.id as media_server_id, ms.url as plex_url, ms.api_key as plex_token
                    FROM libraries l
                    JOIN media_servers ms ON l.media_server_id = ms.id
                    WHERE l.id = $1 AND ms.type = 'plex'
                `, [originalLibraryId]);

                // Scan old location (original library) to remove stale entries
                if (origLibResult.rows.length > 0) {
                    const { plex_url, plex_token, plex_library_key, name } = origLibResult.rows[0];

                    if (plex_url && plex_token && plex_library_key) {
                        const scanResult = await plexService.triggerScanAfterMove(
                            plex_url,
                            plex_token,
                            plex_library_key,
                            oldPath ? [oldPath] : []
                        );
                        scans.push({
                            library: name,
                            libraryId: originalLibraryId,
                            type: 'source',
                            ...scanResult
                        });
                    }
                }
            }

            return {
                success: scans.every(s => s.success),
                scans
            };
        } catch (error) {
            logger.error('Failed to trigger Plex scan', { error: error.message });
            return {
                success: false,
                error: error.message,
                scans
            };
        }
    }
}

module.exports = new ReclassificationService();
