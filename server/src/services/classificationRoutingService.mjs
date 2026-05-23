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
import { radarrService } from './radarr.mjs';
import { sonarrService } from './sonarr.mjs';
import { routingConfigIntegrityService } from './routingConfigIntegrityService.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  ensureDecisionQuestion,
  isSettingsEmpty,
  normalizeQualityProfileId,
  normalizeSettings,
  parseNonNegativeInteger,
  parsePositiveInteger,
  suggestSeriesType,
} from './classificationRoutingServiceShared.mjs';
import { routeToRadarr } from './classificationRoutingArrRadarr.mjs';
import { routeToSonarr } from './classificationRoutingArrSonarr.mjs';

const logger = createLogger('classificationRoutingService');

export async function resolveDefaultQualityProfile(arrType, baseUrl, apiKey) {
  try {
    const cached = await db.query(
      `SELECT profile_id
       FROM arr_profiles_cache
       WHERE arr_type = $1 AND profile_type = 'quality_profile'
       ORDER BY last_synced DESC, profile_id ASC
       LIMIT 1`,
      [arrType],
    );
    if (cached.rows.length > 0) {
      return cached.rows[0].profile_id;
    }

    const profiles = arrType === 'radarr'
      ? await radarrService.getQualityProfiles(baseUrl, apiKey)
      : await sonarrService.getQualityProfiles(baseUrl, apiKey);
    return profiles?.[0]?.id || null;
  } catch (error) {
    logger.warn('Failed to resolve default quality profile', { arrType, error: error.message });
    return null;
  }
}

export async function resolveDefaultRootFolder(arrType, baseUrl, apiKey) {
  try {
    const cached = await db.query(
      `SELECT profile_path
       FROM arr_profiles_cache
       WHERE arr_type = $1 AND profile_type = 'root_folder'
       ORDER BY last_synced DESC, profile_id ASC
       LIMIT 1`,
      [arrType],
    );
    if (cached.rows.length > 0) {
      return cached.rows[0].profile_path;
    }

    const folders = arrType === 'radarr'
      ? await radarrService.getRootFolders(baseUrl, apiKey)
      : await sonarrService.getRootFolders(baseUrl, apiKey);
    return folders?.[0]?.path || null;
  } catch (error) {
    logger.warn('Failed to resolve default root folder', { arrType, error: error.message });
    return null;
  }
}

export async function resolveRoutingConfig(library) {
  if (!library) {
    return null;
  }

  const libraryId = library.id || library.library_id || null;
  const resolved = {
    ...library,
    id: library.id || library.library_id,
    library_id: library.library_id || library.id,
  };

  const needsMapping = !resolved.arr_id || !resolved.arr_type;
  if (!needsMapping || !libraryId) {
    return resolved;
  }

  const mappingResult = await db.query(
    'SELECT * FROM library_arr_mappings WHERE library_id = $1',
    [libraryId],
  );

  if (mappingResult.rows.length === 0) {
    return resolved;
  }

  const mapping = mappingResult.rows[0];

  resolved.arr_type = resolved.arr_type || mapping.arr_type;
  resolved.arr_id = resolved.arr_id || mapping.arr_config_id;
  resolved.root_folder = resolved.root_folder || mapping.arr_root_folder_path;
  resolved.quality_profile_id = resolved.quality_profile_id || mapping.quality_profile_id;

  if (mapping.arr_type === 'radarr' && isSettingsEmpty(resolved.radarr_settings)) {
    resolved.radarr_settings = {
      root_folder_path: mapping.arr_root_folder_path,
      quality_profile_id: mapping.quality_profile_id,
      monitor: true,
      search_on_add: true,
    };
  }

  if (mapping.arr_type === 'sonarr' && isSettingsEmpty(resolved.sonarr_settings)) {
    resolved.sonarr_settings = {
      root_folder_path: mapping.arr_root_folder_path,
      quality_profile_id: mapping.quality_profile_id,
      series_type: 'standard',
      season_monitoring: 'all',
      season_folder: true,
      search_on_add: true,
    };
  }

  return resolved;
}

export async function routeToArr(metadata, library) {
  const routingResult = {
    attempted: false,
    routed: false,
    arrType: null,
    reason: null,
    error: null,
  };

  try {
    const resolvedLibrary = await resolveRoutingConfig(library);

    if (!resolvedLibrary || !resolvedLibrary.arr_type) {
      routingConfigIntegrityService.warnRoutingDrift({
        reasonCode: 'no_mapping',
        library,
        metadata,
      });
      routingResult.reason = 'no_mapping';
      return routingResult;
    }

    routingResult.arrType = resolvedLibrary.arr_type;

    if (!resolvedLibrary.arr_id) {
      routingConfigIntegrityService.warnRoutingDrift({
        reasonCode: 'missing_arr_id',
        library: resolvedLibrary,
        metadata,
        details: {
          arrType: resolvedLibrary.arr_type,
        },
      });
      routingResult.reason = 'missing_arr_id';
      return routingResult;
    }

    routingResult.attempted = true;

    if (resolvedLibrary.arr_type === 'radarr') {
      return await routeToRadarr(metadata, resolvedLibrary, routingResult);
    }

    if (resolvedLibrary.arr_type === 'sonarr') {
      return await routeToSonarr(metadata, resolvedLibrary, routingResult);
    }

    routingResult.reason = 'unsupported_arr_type';
    return routingResult;
  } catch (error) {
    logger.error('Failed to route to arr', { error: error.message });
    routingResult.error = error.message;
    routingResult.reason = routingResult.reason || 'unexpected_error';
    return routingResult;
  }
}

export const classificationRoutingService = {
  ensureDecisionQuestion,
  isSettingsEmpty,
  normalizeQualityProfileId,
  normalizeSettings,
  resolveDefaultQualityProfile,
  resolveDefaultRootFolder,
  resolveRoutingConfig,
  routeToArr,
  suggestSeriesType,
};

export {
  ensureDecisionQuestion,
  isSettingsEmpty,
  normalizeQualityProfileId,
  normalizeSettings,
  suggestSeriesType,
};
