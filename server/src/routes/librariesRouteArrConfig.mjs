/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { requireRow } from './routeHelpers.mjs';
import { ValidationError } from '../utils/appError.mjs';

export function registerArrConfigRoutes(router, { db, radarrService, sonarrService, requireReadWrite, logger }) {
  router.get('/:id/arr-options', asyncHandler(async (req, res) => {
      const { id } = req.params;

      const libraryResult = await db.query('SELECT * FROM libraries WHERE id = $1', [id]);
      requireRow(libraryResult, 'Library not found');

      const library = libraryResult.rows[0];
      const options = {};

      if (library.media_type === 'movie' && library.arr_id) {
        const radarrConfig = await db.query(
          'SELECT * FROM radarr_config WHERE id = $1 AND is_active = true',
          [library.arr_id]
        );

        if (radarrConfig.rows.length > 0) {
          const config = radarrConfig.rows[0];
          const [rootFolders, qualityProfiles, tags] = await Promise.all([
            radarrService.getRootFolders(config.url, config.api_key),
            radarrService.getQualityProfiles(config.url, config.api_key),
            radarrService.getTags(config.url, config.api_key),
          ]);

          options.rootFolders = rootFolders.map((rf) => ({
            id: rf.id,
            path: rf.path,
            freeSpace: rf.freeSpace,
          }));
          options.qualityProfiles = qualityProfiles.map((qp) => ({
            id: qp.id,
            name: qp.name,
          }));
          options.tags = tags;
          options.minimumAvailabilityOptions = radarrService.getMinimumAvailabilityOptions();
        }
      } else if (library.media_type === 'tv' && library.arr_id) {
        const sonarrConfig = await db.query(
          'SELECT * FROM sonarr_config WHERE id = $1 AND is_active = true',
          [library.arr_id]
        );

        if (sonarrConfig.rows.length > 0) {
          const config = sonarrConfig.rows[0];
          const [rootFolders, qualityProfiles, tags] = await Promise.all([
            sonarrService.getRootFolders(config.url, config.api_key),
            sonarrService.getQualityProfiles(config.url, config.api_key),
            sonarrService.getTags(config.url, config.api_key),
          ]);

          options.rootFolders = rootFolders.map((rf) => ({
            id: rf.id,
            path: rf.path,
            freeSpace: rf.freeSpace,
          }));
          options.qualityProfiles = qualityProfiles.map((qp) => ({
            id: qp.id,
            name: qp.name,
          }));
          options.tags = tags;
          options.seriesTypeOptions = sonarrService.getSeriesTypeOptions();
          options.seasonMonitoringOptions = sonarrService.getSeasonMonitoringOptions();
        }
      }

      res.json(options);
  }));

  router.put('/:id/arr-settings', requireReadWrite, asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { settings } = req.body;

      const libraryResult = await db.query('SELECT media_type FROM libraries WHERE id = $1', [id]);
      requireRow(libraryResult, 'Library not found');

      const library = libraryResult.rows[0];

      if (library.media_type !== 'movie' && library.media_type !== 'tv') {
        throw new ValidationError('Invalid media type');
      }

      const settingsField = library.media_type === 'movie' ? 'radarr_settings' : 'sonarr_settings';

      const result = await db.query(
        `UPDATE libraries 
       SET ${settingsField} = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
        [JSON.stringify(settings), id]
      );

      res.json(result.rows[0]);
  }));

  router.post('/sync-arr-profiles', requireReadWrite, asyncHandler(async (req, res) => {
      let syncedCount = 0;

      const radarrConfigs = await db.query('SELECT * FROM radarr_config WHERE is_active = true');
      for (const config of radarrConfigs.rows) {
        try {
          const [rootFolders, qualityProfiles, tags] = await Promise.all([
            radarrService.getRootFolders(config.url, config.api_key),
            radarrService.getQualityProfiles(config.url, config.api_key),
            radarrService.getTags(config.url, config.api_key),
          ]);

          for (const rf of rootFolders) {
            await db.query(
              `INSERT INTO arr_profiles_cache (arr_type, profile_type, profile_id, profile_name, profile_path, profile_data, last_synced)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (arr_type, profile_type, profile_id) 
             DO UPDATE SET profile_name = $4, profile_path = $5, profile_data = $6, last_synced = NOW()`,
              ['radarr', 'root_folder', rf.id, rf.path, rf.path, JSON.stringify(rf)]
            );
            syncedCount++;
          }

          for (const qp of qualityProfiles) {
            await db.query(
              `INSERT INTO arr_profiles_cache (arr_type, profile_type, profile_id, profile_name, profile_data, last_synced)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (arr_type, profile_type, profile_id) 
             DO UPDATE SET profile_name = $4, profile_data = $5, last_synced = NOW()`,
              ['radarr', 'quality_profile', qp.id, qp.name, JSON.stringify(qp)]
            );
            syncedCount++;
          }

          for (const tag of tags) {
            await db.query(
              `INSERT INTO arr_profiles_cache (arr_type, profile_type, profile_id, profile_name, profile_data, last_synced)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (arr_type, profile_type, profile_id) 
             DO UPDATE SET profile_name = $4, profile_data = $5, last_synced = NOW()`,
              ['radarr', 'tag', tag.id, tag.label, JSON.stringify(tag)]
            );
            syncedCount++;
          }
        } catch (error) {
          logger.error(`Failed to sync Radarr config ${config.id}`, { error: error.message });
        }
      }

      const sonarrConfigs = await db.query('SELECT * FROM sonarr_config WHERE is_active = true');
      for (const config of sonarrConfigs.rows) {
        try {
          const [rootFolders, qualityProfiles, tags] = await Promise.all([
            sonarrService.getRootFolders(config.url, config.api_key),
            sonarrService.getQualityProfiles(config.url, config.api_key),
            sonarrService.getTags(config.url, config.api_key),
          ]);

          for (const rf of rootFolders) {
            await db.query(
              `INSERT INTO arr_profiles_cache (arr_type, profile_type, profile_id, profile_name, profile_path, profile_data, last_synced)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (arr_type, profile_type, profile_id) 
             DO UPDATE SET profile_name = $4, profile_path = $5, profile_data = $6, last_synced = NOW()`,
              ['sonarr', 'root_folder', rf.id, rf.path, rf.path, JSON.stringify(rf)]
            );
            syncedCount++;
          }

          for (const qp of qualityProfiles) {
            await db.query(
              `INSERT INTO arr_profiles_cache (arr_type, profile_type, profile_id, profile_name, profile_data, last_synced)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (arr_type, profile_type, profile_id) 
             DO UPDATE SET profile_name = $4, profile_data = $5, last_synced = NOW()`,
              ['sonarr', 'quality_profile', qp.id, qp.name, JSON.stringify(qp)]
            );
            syncedCount++;
          }

          for (const tag of tags) {
            await db.query(
              `INSERT INTO arr_profiles_cache (arr_type, profile_type, profile_id, profile_name, profile_data, last_synced)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (arr_type, profile_type, profile_id) 
             DO UPDATE SET profile_name = $4, profile_data = $5, last_synced = NOW()`,
              ['sonarr', 'tag', tag.id, tag.label, JSON.stringify(tag)]
            );
            syncedCount++;
          }
        } catch (error) {
          logger.error(`Failed to sync Sonarr config ${config.id}`, { error: error.message });
        }
      }

      res.json({ success: true, synced: syncedCount });
  }));
}
