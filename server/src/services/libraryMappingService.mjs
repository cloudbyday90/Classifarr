/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import db from '../config/database.mjs';
import radarrService from './radarr.mjs';
import sonarrService from './sonarr.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('LibraryMappingService');

class LibraryMappingService {
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

    async getLibraryMapping(libraryId) {
        const result = await db.query(`
      SELECT * FROM library_arr_mappings WHERE library_id = $1
    `, [libraryId]);

        return result.rows[0] || null;
    }

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

        const libraryCheck = await db.query('SELECT id FROM libraries WHERE id = $1', [library_id]);
        if (libraryCheck.rows.length === 0) {
            throw new Error('Library not found');
        }

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

        await this.updateMappingCompleteStatus();

        await db.query(
            `UPDATE libraries
             SET arr_type = COALESCE(arr_type, $2),
                 arr_id = COALESCE(arr_id, $3),
                 root_folder = COALESCE(root_folder, $4),
                 quality_profile_id = COALESCE(quality_profile_id, $5),
                 radarr_settings = CASE
                   WHEN $2 = 'radarr' AND (radarr_settings IS NULL OR radarr_settings = '{}'::jsonb)
                   THEN jsonb_build_object(
                     'root_folder_path', $4::text,
                     'quality_profile_id', $5::integer,
                     'monitor', true,
                     'search_on_add', true
                   )
                   ELSE radarr_settings
                 END,
                 sonarr_settings = CASE
                   WHEN $2 = 'sonarr' AND (sonarr_settings IS NULL OR sonarr_settings = '{}'::jsonb)
                   THEN jsonb_build_object(
                     'root_folder_path', $4::text,
                     'quality_profile_id', $5::integer,
                     'monitor', true,
                     'search_on_add', true,
                     'series_type', 'standard',
                     'season_monitoring', 'all',
                     'season_folder', true
                   )
                   ELSE sonarr_settings
                 END,
                 updated_at = NOW()
             WHERE id = $1`,
            [library_id, arr_type, arr_config_id, arr_root_folder_path, quality_profile_id]
        );

        return result.rows[0];
    }

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

    async autoDetectMappings(mediaServerId) {
        const unmappedLibraries = await this.getUnmappedLibraries(mediaServerId);
        const arrInstances = await this.getAvailableArrInstances(mediaServerId);

        const suggestions = [];
        const applied = [];
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

        for (const library of unmappedLibraries) {
            const libraryName = library.name.toLowerCase().trim();
            const mediaType = library.media_type;

            const candidateFolders = rootFolders.filter(f =>
                (mediaType === 'movie' && f.arr_type === 'radarr') ||
                (mediaType === 'tv' && f.arr_type === 'sonarr')
            );

            let exactMatch = null;

            for (const folder of candidateFolders) {
                const pathParts = folder.path.replace(/\\/g, '/').split('/').filter(p => p);
                const folderName = pathParts[pathParts.length - 1]?.toLowerCase().trim();

                if (folderName === libraryName) {
                    exactMatch = folder;
                    break;
                }
            }

            if (exactMatch) {
                const suggestion = {
                    library_id: library.id,
                    library_name: library.name,
                    media_type: library.media_type,
                    arr_type: exactMatch.arr_type,
                    arr_config_id: exactMatch.arr_config_id,
                    arr_name: exactMatch.arr_name,
                    arr_root_folder_id: exactMatch.id,
                    arr_root_folder_path: exactMatch.path,
                    confidence: 100
                };

                try {
                    await this.saveMapping({
                        library_id: library.id,
                        arr_type: exactMatch.arr_type,
                        arr_config_id: exactMatch.arr_config_id,
                        arr_root_folder_id: exactMatch.id,
                        arr_root_folder_path: exactMatch.path
                    });
                    applied.push(suggestion);
                } catch (e) {
                    logger.error('Failed to auto-apply mapping', { error: e.message, suggestion });
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

    async linkArrToMediaServer(arrType, arrConfigId, mediaServerId) {
        const table = arrType === 'radarr' ? 'radarr_config' : 'sonarr_config';

        await db.query(`UPDATE ${table} SET media_server_id = $1 WHERE id = $2`, [mediaServerId, arrConfigId]);

        logger.info(`Linked ${arrType} to media server`, { arrConfigId, mediaServerId });
    }

    translatePath(sourcePath, sourcePrefix, targetPrefix) {
        if (!sourcePath || !sourcePrefix || !targetPrefix) {
            return sourcePath;
        }
        return sourcePath.replace(sourcePrefix, targetPrefix);
    }
}

export default new LibraryMappingService();
