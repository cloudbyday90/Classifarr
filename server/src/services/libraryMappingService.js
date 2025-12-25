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
const { createLogger } = require('../utils/logger');

const logger = createLogger('LibraryMappingService');

/**
 * Library Mapping Service
 * Manages mappings between Plex libraries and Radarr/Sonarr root folders
 */
class LibraryMappingService {
    /**
     * Get all mappings for a media server
     * @param {number} mediaServerId - Media server ID
     * @returns {Array} List of mappings with library and *arr info
     */
    async getMappings(mediaServerId) {
        const result = await db.query(`
      SELECT 
        lam.*,
        l.name as library_name,
        l.media_type,
        l.external_id as library_external_id
      FROM library_arr_mappings lam
      JOIN libraries l ON l.id = lam.library_id
      WHERE l.media_server_id = $1
      ORDER BY l.name
    `, [mediaServerId]);

        return result.rows;
    }

    /**
     * Get mapping for a specific library
     * @param {number} libraryId - Library ID
     * @returns {Object|null} Mapping details or null
     */
    async getLibraryMapping(libraryId) {
        const result = await db.query(`
      SELECT * FROM library_arr_mappings WHERE library_id = $1
    `, [libraryId]);

        return result.rows[0] || null;
    }

    /**
     * Get unmapped libraries for a media server
     * @param {number} mediaServerId - Media server ID
     * @returns {Array} Libraries without mappings
     */
    async getUnmappedLibraries(mediaServerId) {
        const result = await db.query(`
      SELECT l.id, l.name, l.media_type, l.external_id
      FROM libraries l
      LEFT JOIN library_arr_mappings lam ON lam.library_id = l.id
      WHERE l.media_server_id = $1 
        AND l.is_active = true
        AND lam.id IS NULL
      ORDER BY l.name
    `, [mediaServerId]);

        return result.rows;
    }

    /**
     * Get available *arr instances for a media server
     * @param {number} mediaServerId - Media server ID
     * @returns {Object} Object with radarr and sonarr arrays
     */
    async getAvailableArrInstances(mediaServerId) {
        const [radarrResult, sonarrResult] = await Promise.all([
            db.query(`
        SELECT id, name, url, is_active 
        FROM radarr_config 
        WHERE (media_server_id = $1 OR media_server_id IS NULL) AND is_active = true
      `, [mediaServerId]),
            db.query(`
        SELECT id, name, url, is_active 
        FROM sonarr_config 
        WHERE (media_server_id = $1 OR media_server_id IS NULL) AND is_active = true
      `, [mediaServerId])
        ]);

        return {
            radarr: radarrResult.rows,
            sonarr: sonarrResult.rows
        };
    }

    /**
     * Get root folders from a *arr instance
     * @param {string} arrType - 'radarr' or 'sonarr'
     * @param {number} arrConfigId - *arr config ID
     * @returns {Array} Root folders from the *arr instance
     */
    async getArrRootFolders(arrType, arrConfigId) {
        const table = arrType === 'radarr' ? 'radarr_config' : 'sonarr_config';
        const service = arrType === 'radarr' ? radarrService : sonarrService;

        const configResult = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [arrConfigId]);

        if (configResult.rows.length === 0) {
            throw new Error(`${arrType} config not found`);
        }

        const config = configResult.rows[0];
        const url = config.url || service.buildUrl(config);

        return await service.getRootFolders(url, config.api_key);
    }

    /**
     * Create or update a library mapping
     * @param {Object} mapping - Mapping data
     * @returns {Object} Created/updated mapping
     */
    async saveMapping(mapping) {
        const {
            library_id,
            arr_type,
            arr_config_id,
            arr_root_folder_id,
            arr_root_folder_path,
            quality_profile_id,
            plex_path_prefix,
            arr_path_prefix,
            classifarr_path_prefix
        } = mapping;

        // Validate library exists
        const libraryCheck = await db.query('SELECT id FROM libraries WHERE id = $1', [library_id]);
        if (libraryCheck.rows.length === 0) {
            throw new Error('Library not found');
        }

        // Upsert the mapping
        const result = await db.query(`
      INSERT INTO library_arr_mappings 
        (library_id, arr_type, arr_config_id, arr_root_folder_id, arr_root_folder_path, 
         quality_profile_id, plex_path_prefix, arr_path_prefix, classifarr_path_prefix, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (library_id) 
      DO UPDATE SET 
        arr_type = EXCLUDED.arr_type,
        arr_config_id = EXCLUDED.arr_config_id,
        arr_root_folder_id = EXCLUDED.arr_root_folder_id,
        arr_root_folder_path = EXCLUDED.arr_root_folder_path,
        quality_profile_id = EXCLUDED.quality_profile_id,
        plex_path_prefix = EXCLUDED.plex_path_prefix,
        arr_path_prefix = EXCLUDED.arr_path_prefix,
        classifarr_path_prefix = EXCLUDED.classifarr_path_prefix,
        updated_at = NOW()
      RETURNING *
    `, [
            library_id, arr_type, arr_config_id, arr_root_folder_id, arr_root_folder_path,
            quality_profile_id, plex_path_prefix, arr_path_prefix, classifarr_path_prefix
        ]);

        logger.info('Library mapping saved', { library_id, arr_type, arr_root_folder_path });

        // Check if all libraries are now mapped and update app_settings
        await this.updateMappingCompleteStatus();

        return result.rows[0];
    }

    /**
     * Delete a library mapping
     * @param {number} libraryId - Library ID
     * @returns {boolean} Success
     */
    async deleteMapping(libraryId) {
        const result = await db.query(
            'DELETE FROM library_arr_mappings WHERE library_id = $1 RETURNING id',
            [libraryId]
        );

        if (result.rows.length > 0) {
            logger.info('Library mapping deleted', { library_id: libraryId });
            await this.updateMappingCompleteStatus();
        }

        return result.rows.length > 0;
    }

    /**
     * Auto-detect mappings based on path similarity
     * @param {number} mediaServerId - Media server ID
     * @returns {Object} Detection results with suggested and applied mappings
     */
    async autoDetectMappings(mediaServerId) {
        const unmappedLibraries = await this.getUnmappedLibraries(mediaServerId);
        const arrInstances = await this.getAvailableArrInstances(mediaServerId);

        const suggestions = [];
        const applied = [];

        // Get root folders from all *arr instances
        const rootFolders = [];

        for (const radarr of arrInstances.radarr) {
            try {
                const folders = await this.getArrRootFolders('radarr', radarr.id);
                folders.forEach(f => rootFolders.push({
                    ...f,
                    arr_type: 'radarr',
                    arr_config_id: radarr.id,
                    arr_name: radarr.name
                }));
            } catch (e) {
                logger.warn(`Failed to get Radarr root folders from ${radarr.name}`, { error: e.message });
            }
        }

        for (const sonarr of arrInstances.sonarr) {
            try {
                const folders = await this.getArrRootFolders('sonarr', sonarr.id);
                folders.forEach(f => rootFolders.push({
                    ...f,
                    arr_type: 'sonarr',
                    arr_config_id: sonarr.id,
                    arr_name: sonarr.name
                }));
            } catch (e) {
                logger.warn(`Failed to get Sonarr root folders from ${sonarr.name}`, { error: e.message });
            }
        }

        // Match libraries to root folders
        for (const library of unmappedLibraries) {
            const libraryName = library.name.toLowerCase();
            const mediaType = library.media_type;

            // Filter to appropriate *arr type
            const candidateFolders = rootFolders.filter(f =>
                (mediaType === 'movie' && f.arr_type === 'radarr') ||
                (mediaType === 'tv' && f.arr_type === 'sonarr')
            );

            // Score each folder based on name similarity
            let bestMatch = null;
            let bestScore = 0;

            for (const folder of candidateFolders) {
                const folderPath = folder.path.toLowerCase();
                let score = 0;

                // Check if library name appears in folder path
                if (folderPath.includes(libraryName)) {
                    score += 50;
                }

                // Check for common keywords
                const keywords = ['anime', 'kids', '4k', 'uhd', 'hdr', 'foreign', 'documentary'];
                for (const keyword of keywords) {
                    if (libraryName.includes(keyword) && folderPath.includes(keyword)) {
                        score += 30;
                    }
                }

                // Check for media type alignment
                if (mediaType === 'movie' && (folderPath.includes('movie') || folderPath.includes('film'))) {
                    score += 10;
                }
                if (mediaType === 'tv' && (folderPath.includes('tv') || folderPath.includes('series') || folderPath.includes('show'))) {
                    score += 10;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = folder;
                }
            }

            if (bestMatch && bestScore >= 30) {
                const suggestion = {
                    library_id: library.id,
                    library_name: library.name,
                    media_type: library.media_type,
                    arr_type: bestMatch.arr_type,
                    arr_config_id: bestMatch.arr_config_id,
                    arr_name: bestMatch.arr_name,
                    arr_root_folder_id: bestMatch.id,
                    arr_root_folder_path: bestMatch.path,
                    confidence: bestScore
                };

                if (bestScore >= 50) {
                    // High confidence - auto-apply
                    try {
                        await this.saveMapping({
                            library_id: library.id,
                            arr_type: bestMatch.arr_type,
                            arr_config_id: bestMatch.arr_config_id,
                            arr_root_folder_id: bestMatch.id,
                            arr_root_folder_path: bestMatch.path
                        });
                        applied.push(suggestion);
                    } catch (e) {
                        logger.error('Failed to auto-apply mapping', { error: e.message, suggestion });
                        suggestions.push(suggestion);
                    }
                } else {
                    // Lower confidence - suggest for review
                    suggestions.push(suggestion);
                }
            }
        }

        return {
            applied,
            suggestions,
            unmapped: await this.getUnmappedLibraries(mediaServerId)
        };
    }

    /**
     * Update app_settings to reflect mapping complete status
     */
    async updateMappingCompleteStatus() {
        const [mappingsResult, librariesResult] = await Promise.all([
            db.query('SELECT COUNT(*) as count FROM library_arr_mappings'),
            db.query('SELECT COUNT(*) as count FROM libraries WHERE is_active = true')
        ]);

        const isComplete = parseInt(mappingsResult.rows[0].count) >= parseInt(librariesResult.rows[0].count);

        await db.query(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('library_mapping_complete', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [isComplete ? 'true' : 'false']);
    }

    /**
     * Link a *arr config to a media server
     * @param {string} arrType - 'radarr' or 'sonarr'
     * @param {number} arrConfigId - *arr config ID
     * @param {number} mediaServerId - Media server ID
     */
    async linkArrToMediaServer(arrType, arrConfigId, mediaServerId) {
        const table = arrType === 'radarr' ? 'radarr_config' : 'sonarr_config';

        await db.query(`UPDATE ${table} SET media_server_id = $1 WHERE id = $2`, [mediaServerId, arrConfigId]);

        logger.info(`Linked ${arrType} to media server`, { arrConfigId, mediaServerId });
    }

    /**
     * Translate a path from one system to another
     * @param {string} sourcePath - Original path
     * @param {string} sourcePrefix - Prefix to replace
     * @param {string} targetPrefix - New prefix
     * @returns {string} Translated path
     */
    translatePath(sourcePath, sourcePrefix, targetPrefix) {
        if (!sourcePath || !sourcePrefix || !targetPrefix) {
            return sourcePath;
        }
        return sourcePath.replace(sourcePrefix, targetPrefix);
    }
}

module.exports = new LibraryMappingService();
